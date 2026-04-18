import { API_URL, API_VERSION, DEFAULT_HEADERS } from "./config";
import { generateX25519KeyPair, generateRandomHex } from "./crypto";

export async function registerWarp(model: string, locale: string, jwt?: string) {
  const { publicKey, privateKey } = await generateX25519KeyPair();
  const serial = generateRandomHex(8);

  const regData = {
    key: publicKey,
    install_id: "",
    fcm_token: "",
    tos: new Date().toISOString().replace('Z', '-07:00'),
    model: model,
    serial_number: serial,
    os_version: "",
    key_type: "curve25519",
    tunnel_type: "wireguard",
    locale: locale,
  };

  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (jwt) {
    headers["CF-Access-Jwt-Assertion"] = jwt;
  }

  const response = await fetch(`${API_URL}/${API_VERSION}/reg`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(regData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register Warp: ${errorText}`);
  }

  const data = await response.json() as any;
  return {
    ...data,
    private_key: privateKey,
  };
}

export function formatWireGuard(account: any): string {
  return `[Interface]
PrivateKey = ${account.private_key || "(REPLACE_ME)"}
Address = ${account.config.interface.addresses.v4}, ${account.config.interface.addresses.v6}
DNS = 1.1.1.1
MTU = 1280

[Peer]
PublicKey = ${account.config.peers[0].public_key}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${account.config.peers[0].endpoint.host}:2408
`;
}

export function formatMihomoWg(account: any): string {
  const config = {
    name: "warp-wg",
    type: "wireguard",
    "private-key": account.private_key,
    server: account.config.peers[0].endpoint.host.split(":")[0],
    port: 2408,
    ip: account.config.interface.addresses.v4,
    ipv6: account.config.interface.addresses.v6,
    "public-key": account.config.peers[0].public_key,
    "allowed-ips": ["0.0.0.0/0", "::/0"],
    udp: true,
    mtu: 1280,
  };
  return yamlStringify(config);
}

function yamlStringify(obj: any): string {
  return "- " + JSON.stringify(obj, null, 2)
    .replace(/\{\n/, "")
    .replace(/\n\}/, "")
    .split("\n")
    .map((line, i) => (i === 0 ? line.trim() : "  " + line.trim()))
    .join("\n")
    .replace(/"([^"]+)":/g, "$1:");
}
