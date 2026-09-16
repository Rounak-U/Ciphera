import { 
  generateRSAKeyPair, 
  generateSessionKey, 
  encryptSessionKey, 
  decryptSessionKey, 
  encryptMessage, 
  decryptMessage 
} from '../src/index';

// Polyfill webcrypto for Jest in Node 19+
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}

describe('SecureChat Cryptography Module', () => {
  let rsaKeyPair: CryptoKeyPair;
  let sessionKey: CryptoKey;

  beforeAll(async () => {
    // Generate an RSA Key Pair once for the test suite
    rsaKeyPair = await generateRSAKeyPair();
  });

  test('TEST 1 & 2: AES Encryption, Decryption, and Tampering', async () => {
    sessionKey = await generateSessionKey();
    const plaintext = "Hello Bob, this is a highly confidential message.";
    
    // Encrypt
    const { ciphertext, nonce } = await encryptMessage(plaintext, sessionKey);
    
    expect(ciphertext).toBeTruthy();
    expect(nonce).toBeTruthy();
    
    // Test 1: Decrypt successfully
    const decrypted = await decryptMessage(ciphertext, nonce, sessionKey);
    expect(decrypted).toBe(plaintext);
    
    // Test 2: Modify ciphertext (Tampering) -> must fail
    const tamperedCiphertext = String.fromCharCode(ciphertext.charCodeAt(0) ^ 1) + ciphertext.slice(1);
    
    await expect(decryptMessage(tamperedCiphertext, nonce, sessionKey)).rejects.toThrow(
      "Message authentication failed. The message may have been modified."
    );
  });

  test('TEST 3: Decrypt with incorrect AES key must fail', async () => {
    const wrongSessionKey = await generateSessionKey();
    const { ciphertext, nonce } = await encryptMessage("Secret Data", sessionKey);
    
    await expect(decryptMessage(ciphertext, nonce, wrongSessionKey)).rejects.toThrow();
  });

  test('TEST 4: RSA-OAEP Encryption and Decryption of Session Key', async () => {
    const originalSessionKey = await generateSessionKey();
    
    // Encrypt session key with public key
    const encryptedKey = await encryptSessionKey(originalSessionKey, rsaKeyPair.publicKey);
    expect(encryptedKey).toBeTruthy();
    
    // Decrypt session key with private key
    const recoveredKey = await decryptSessionKey(encryptedKey, rsaKeyPair.privateKey);
    expect(recoveredKey).toBeTruthy();
    
    // Verify recovered key works
    const { ciphertext, nonce } = await encryptMessage("Data", originalSessionKey);
    const decrypted = await decryptMessage(ciphertext, nonce, recoveredKey);
    
    expect(decrypted).toBe("Data");
  });
});
