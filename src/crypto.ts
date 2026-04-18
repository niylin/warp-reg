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

  // Export as JWK to get raw d, x, y coordinates
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const d = b64urlToUint8Array(jwk.d!);
  const x = b64urlToUint8Array(jwk.x!);
  const y = b64urlToUint8Array(jwk.y!);

  // Manually construct SEC1 ECPrivateKey DER for P-256
  // Format: Sequence (0x30 0x77)
  //   Version (0x02 0x01 0x01)
  //   PrivateKey (0x04 0x20 [32 bytes])
  //   NamedCurve [0] (0xa0 0x0a 0x06 0x08 0x2a 0x86 0x48 0xce 0x3d 0x03 0x01 0x07)
  //   PublicKey [1] (0xa1 0x44 0x03 0x42 0x00 0x04 [64 bytes])
  
  const sec1 = new Uint8Array(121);
  let pos = 0;
  sec1.set([0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20], pos); pos += 7;
  sec1.set(d, pos); pos += 32;
  sec1.set([0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07], pos); pos += 12;
  sec1.set([0xa1, 0x44, 0x03, 0x42, 0x00, 0x04], pos); pos += 6;
  sec1.set(x, pos); pos += 32;
  sec1.set(y, pos); pos += 32;

  const pubKeyDer = await crypto.subtle.exportKey("spki", keyPair.publicKey);

  return {
    publicKey: b64encode(new Uint8Array(pubKeyDer)),
    privateKey: b64encode(sec1), // Now starts with MHcCAQEE
  };
}

function b64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
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
