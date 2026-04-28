import { API_URL, API_VERSION, DEFAULT_HEADERS } from "./config";
import { generateP256KeyPair, cleanKey } from "./crypto";

export async function enrollMasque(accountData: any) {
  const { publicKey, privateKey } = await generateP256KeyPair();

  const enrollData = {
    key: cleanKey(publicKey),
    key_type: "secp256r1",
    tunnel_type: "masque",
  };

  const enrollHeaders = {
    ...DEFAULT_HEADERS,
    "Authorization": `Bearer ${accountData.token}`,
  };

  const response = await fetch(`${API_URL}/${API_VERSION}/reg/${accountData.id}`, {
    method: "PATCH",
    headers: enrollHeaders,
    body: JSON.stringify(enrollData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to enroll Masque: ${errorText}`);
  }

  const updatedAccountData = await response.json() as any;
  return {
    ...updatedAccountData,
    private_key: privateKey,
    original_token: accountData.token,
  };
}

export function formatMasque(account: any): any {
  return {
    private_key: account.private_key,
    endpoint_v4: account.config.peers[0].endpoint.v4.split(":")[0],
    endpoint_v6: account.config.peers[0].endpoint.v6.replace("[", "").split("]")[0],
    endpoint_h2_v4: "162.159.193.10",
    endpoint_h2_v6: "2606:4700:d1::a29f:c10a",
    endpoint_pub_key: cleanKey(account.config.peers[0].public_key),
    license: account.account.license,
    id: account.id,
    access_token: account.original_token,
    ipv4: account.config.interface.addresses.v4,
    ipv6: account.config.interface.addresses.v6,
  };
}

export function formatMihomoMasque(account: any): string {
  const config = {
    name: "warp-masque",
    type: "masque",
    server: "masque.wdqgn.eu.org",
    port: 443,
    "private-key": account.private_key,
    "public-key": cleanKey(account.config.peers[0].public_key),
    ip: account.config.interface.addresses.v4.includes("/") 
        ? account.config.interface.addresses.v4 
        : account.config.interface.addresses.v4 + "/32",
    ipv6: account.config.interface.addresses.v6.includes("/")
        ? account.config.interface.addresses.v6
        : account.config.interface.addresses.v6 + "/128",
    mtu: 1280,
    udp: true,
  };
  return yamlStringify(config);
}

export function formatSingBoxMasque(account: any): any {
  const addressV4 = account.config.interface.addresses.v4;
  const addressV6 = account.config.interface.addresses.v6;

  return {
    type: "wireguard",
    tag: "warp-masque",
    system: false,
    mtu: 1408,
    address: [
      addressV4.includes("/") ? addressV4 : `${addressV4}/32`,
      addressV6.includes("/") ? addressV6 : `${addressV6}/128`,
    ],
    private_key: cleanKey(account.private_key),
    listen_port: 10000,
    peers: [
      {
        address: "162.159.193.10",
        port: 443,
        public_key: cleanKey(account.config.peers[0].public_key),
        pre_shared_key: "",
        allowed_ips: ["0.0.0.0/0", "::/0"],
        persistent_keepalive_interval: 0,
        reserved: [0, 0, 0],
      },
    ],
    udp_timeout: "5m",
    workers: 0,
  };
}

function yamlStringify(obj: any): string {
  const lines = ["- name: " + obj.name];
  const keys = Object.keys(obj).filter(k => k !== "name");
  for (const key of keys) {
    let value = obj[key];
    if (typeof value === "string" && (key === "name" || key === "server" || key === "type")) {
      value = `"${value}"`;
    }
    lines.push(`  ${key}: ${value}`);
  }
  return lines.join("\n") + "\n";
}
