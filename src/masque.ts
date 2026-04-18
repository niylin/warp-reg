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
    private_key: privateKey, // Now contains SEC1 Base64
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
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").split(".")[0];
  const config = {
    name: `warp-masque-${timestamp}`,
    type: "masque",
    server: "masque.wdqgn.eu.org",
    port: 443,
    "private-key": account.private_key, // SEC1 Base64
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

function yamlStringify(obj: any): string {
  const lines = ["- name: " + obj.name];
  const keys = Object.keys(obj).filter(k => k !== "name");
  for (const key of keys) {
    let value = obj[key];
    if (typeof value === "string") {
      value = `"${value}"`;
    }
    lines.push(`  ${key}: ${value}`);
  }
  return lines.join("\n");
}
