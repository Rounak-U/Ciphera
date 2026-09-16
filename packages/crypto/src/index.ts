/**
 * SecureChat Cryptography Module
 * Implements Web Crypto API for RSA-OAEP and AES-256-GCM
 */

// Generate RSA-OAEP 3072-bit Key Pair
export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // Extractable (needed to export the public key and save private key to sessionStorage)
    ["encrypt", "decrypt"]
  );
}

// Export Public Key to PEM
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)));
  const exportedAsBase64 = btoa(exportedAsString);
  return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

// Import Public Key from PEM
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length).trim();
  const binaryDerString = atob(pemContents.replace(/\s+/g, ""));
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

// Export Private Key to JWK string
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

// Import Private Key from JWK string
export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

// Generate AES-256-GCM Session Key
export async function generateSessionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt Session Key with RSA-OAEP Public Key
export async function encryptSessionKey(sessionKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    rawSessionKey
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// Decrypt Session Key with RSA-OAEP Private Key
export async function decryptSessionKey(encryptedSessionKeyBase64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const encryptedSessionKey = Uint8Array.from(atob(encryptedSessionKeyBase64), c => c.charCodeAt(0));
  const rawSessionKey = await crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    encryptedSessionKey
  );
  return await crypto.subtle.importKey(
    "raw",
    rawSessionKey,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt Message using AES-GCM
export async function encryptMessage(message: string, sessionKey: CryptoKey): Promise<{ ciphertext: string, nonce: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Generate 96-bit (12 bytes) secure random nonce for AES-GCM
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      tagLength: 128, // 128-bit authentication tag appended to the end of ciphertext by Web Crypto API
    },
    sessionKey,
    data
  );
  
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const nonceBase64 = btoa(String.fromCharCode(...nonce));
  
  return { ciphertext: ciphertextBase64, nonce: nonceBase64 };
}

// Decrypt Message using AES-GCM
export async function decryptMessage(ciphertextBase64: string, nonceBase64: string, sessionKey: CryptoKey): Promise<string> {
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const nonce = Uint8Array.from(atob(nonceBase64), c => c.charCodeAt(0));
  
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        tagLength: 128,
      },
      sessionKey,
      ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Message authentication failed. The message may have been modified.");
  }
}
