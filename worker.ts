// Cloudflare Worker for generating Warp/MASQUE configurations
// Based on the usque project: https://github.com/Diniboy1123/usque

const API_URL = "https://api.cloudflareclient.com";
const API_VERSION = "v0a4471";
const DEFAULT_HEADERS = {
  "User-Agent": "WARP for Android",
  "CF-Client-Version": "a-6.35-4471",
  "Content-Type": "application/json; charset=UTF-8",
  "Connection": "Keep-Alive",
};

interface Env {
  // Add environment variables here if needed
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/reg") {
      return handleRegister(url);
    }

    return new Response("Usage: /reg?type=[wg|masque|json]&jwt=[optional_token]\n\nExample:\n/reg?type=wg\n/reg?type=masque", { status: 200 });
  },
};

async function handleRegister(url: URL): Promise<Response> {
  const type = url.searchParams.get("type") || "json";
  const jwt = url.searchParams.get("jwt") || "";
  const model = url.searchParams.get("model") || "PC";
  const locale = url.searchParams.get("locale") || "en_US";

  try {
    // 1. Generate random data for registration (WireGuard style)
    const wgPubKey = generateRandomBase64(32);
    const serial = generateRandomHex(8);

    // 2. Register account
    const regData = {
      key: wgPubKey,
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

    const regResponse = await fetch(`${API_URL}/${API_VERSION}/reg`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(regData),
    });

    if (!regResponse.ok) {
      const errorText = await regResponse.text();
      return new Response(`Failed to register: ${errorText}`, { status: regResponse.status });
    }

    const accountData = await regResponse.json() as any;

    // 3. If WireGuard is requested, return initial config
    if (type === "wg") {
      return formatWireGuard(accountData);
    }

    // 4. Enroll MASQUE key if requested (required for usque client)
    if (type === "masque" || type === "json") {
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      const pubKeyDer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
      const privKeyDer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

      const pubKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyDer)));
      const privKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privKeyDer)));

      const enrollData = {
        key: pubKeyBase64,
        key_type: "secp256r1",
        tunnel_type: "masque",
      };

      const enrollHeaders = {
        ...DEFAULT_HEADERS,
        "Authorization": `Bearer ${accountData.token}`,
      };

      const enrollResponse = await fetch(`${API_URL}/${API_VERSION}/reg/${accountData.id}`, {
        method: "PATCH",
        headers: enrollHeaders,
        body: JSON.stringify(enrollData),
      });

      if (!enrollResponse.ok) {
        const errorText = await enrollResponse.text();
        return new Response(`Failed to enroll key: ${errorText}`, { status: enrollResponse.status });
      }

      const updatedAccountData = await enrollResponse.json() as any;
      updatedAccountData.private_key = privKeyBase64; // Return private key to user
      updatedAccountData.original_token = accountData.token; // Keep original token for access

      if (type === "masque") {
        return formatMasque(updatedAccountData);
      }
      
      return new Response(JSON.stringify(updatedAccountData, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(accountData, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

function formatWireGuard(account: any): Response {
  const config = `[Interface]
# Note: You need to generate your own PrivateKey that matches the random PublicKey used during registration
# Or provide a 'key' parameter to the worker to use your own.
PrivateKey = (REPLACE_ME)
Address = ${account.config.interface.addresses.v4}, ${account.config.interface.addresses.v6}
DNS = 1.1.1.1
MTU = 1280

[Peer]
PublicKey = ${account.config.peers[0].public_key}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${account.config.peers[0].endpoint.host}:2408
`;
  return new Response(config, { headers: { "Content-Type": "text/plain" } });
}

function formatMasque(account: any): Response {
  // MASQUE config format matching usque's config/config.go
  const masqueConfig = {
    private_key: account.private_key,
    endpoint_v4: account.config.peers[0].endpoint.v4.split(":")[0],
    endpoint_v6: account.config.peers[0].endpoint.v6.replace("[", "").split("]")[0],
    // usque uses default H2 endpoints usually
    endpoint_h2_v4: "162.159.193.10",
    endpoint_h2_v6: "2606:4700:d1::a29f:c10a",
    endpoint_pub_key: account.config.peers[0].public_key,
    license: account.account.license,
    id: account.id,
    access_token: account.original_token,
    ipv4: account.config.interface.addresses.v4,
    ipv6: account.config.interface.addresses.v6,
  };

  return new Response(JSON.stringify(masqueConfig, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

function generateRandomBase64(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
