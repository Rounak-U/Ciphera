const crypto = require('crypto').webcrypto;

async function test() {
  console.log("Generating key pair...");
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  console.log("Generating session key...");
  const sessionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);

  console.log("Encrypting session key...");
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    keyPair.publicKey,
    rawSessionKey
  );

  console.log("Exporting and Importing private key (JWK)...");
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const importedPrivateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );

  console.log("Decrypting session key with imported private key...");
  try {
    const decryptedRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      importedPrivateKey,
      encrypted
    );
    console.log("Decrypted raw length:", decryptedRaw.byteLength);
    console.log("SUCCESS!");
  } catch (error) {
    console.error("DECRYPTION FAILED:", error);
  }
}

test();
