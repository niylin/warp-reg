export async function generateX25519KeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  
  const privBytes = new Uint8Array(privRaw);
  const privRawKey = privBytes.slice(-32);

  return {
    publicKey: b64encode(new Uint8Array(pubRaw)),
    privateKey: b64encode(privRawKey),
  };
}

export async function generateP256KeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const pubKeyDer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privKeyDer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: b64encode(new Uint8Array(pubKeyDer)),
    privateKey: b64encode(new Uint8Array(privKeyDer)), // This is the pure ASN.1 DER PKCS#8
  };
}

export function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64encode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

export function cleanKey(key: string): string {
  if (!key) return "";
  return key
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s/g, "");
}
