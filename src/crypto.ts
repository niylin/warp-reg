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

  // Extract SEC1 from PKCS8 for better compatibility with Mihomo
  const sec1Key = extractSEC1FromPKCS8(new Uint8Array(privKeyDer));

  return {
    publicKey: b64encode(new Uint8Array(pubKeyDer)),
    privateKey: b64encode(sec1Key), // Return SEC1 instead of PKCS8
    rawPkcs8: b64encode(new Uint8Array(privKeyDer)),
  };
}

/**
 * Extracts the SEC1 ECPrivateKey from a PKCS#8 wrapper.
 * PKCS#8 for EC: [30, len, version, algID, [04, len, SEC1]]
 */
function extractSEC1FromPKCS8(pkcs8: Uint8Array): Uint8Array {
  // We search for the inner Octet String (0x04) which contains the SEC1 Sequence (0x30)
  // In standard WebCrypto P-256 exports, this starts at index 29 or similar.
  for (let i = 0; i < pkcs8.length - 1; i++) {
    if (pkcs8[i] === 0x04 && pkcs8[i + 1] === 0x30) {
      return pkcs8.slice(i + 2, i + 2 + pkcs8[i + 1] + 2); // Simple slice for standard lengths
    }
  }
  // Robust fallback: Find the sequence after AlgorithmIdentifier
  // PKCS8 for P-256 is usually 138 bytes. SEC1 is ~121 bytes.
  // The SEC1 sequence always starts with 0x30.
  for (let i = 20; i < pkcs8.length; i++) {
    if (pkcs8[i] === 0x30 && pkcs8[i - 1] === 0x04) {
      return pkcs8.slice(i);
    }
  }
  return pkcs8;
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
