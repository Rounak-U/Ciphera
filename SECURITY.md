# Security Model

This document outlines the security architecture and threat model of the SecureChat application.

## 🛡️ What the Server Can See
- Usernames, emails, and hashed passwords.
- Public RSA keys.
- Conversation membership (who is talking to whom).
- Ciphertexts (encrypted messages), nonces, and authentication tags.
- Message timestamps and delivery status.
- Encrypted AES session key material.

## 🙈 What the Server CANNOT See
- The plaintext content of any message.
- The plaintext AES-256-GCM session keys.
- The private RSA keys of any user.

## 🔑 Cryptographic Primitives
1. **RSA-OAEP (3072-bit):** Used for asymmetric key exchange. Protects the ephemeral AES session keys in transit. 3072-bit is chosen for modern security margins against classical computing threats.
2. **AES-256-GCM:** Used for symmetric message encryption. GCM provides Authenticated Encryption with Associated Data (AEAD), ensuring both confidentiality and integrity.
3. **Argon2id:** A memory-hard key derivation function used for hashing user passwords to mitigate brute-force and rainbow table attacks.
4. **CSPRNG (Crypto.getRandomValues):** Generates secure random numbers for AES session keys and message nonces.

## 🔄 Nonces and Integrity
- For every single message sent, a new random 96-bit nonce is generated.
- AES-GCM must never reuse a nonce under the same key. The randomized approach ensures this.
- If a message ciphertext is altered in transit or in the database, the AES-GCM decryption process will fail to validate the authentication tag, rejecting the message and preventing ciphertext malleability.

## 🔐 Key Lifecycle & Rotation
- **Session Keys:** When a chat begins, a random AES session key is generated.
- **Rotation Threshold:** After a specific number of messages (e.g., 30), a new AES session key is negotiated using the existing RSA public keys.
- **Forward Secrecy Implications:** By rotating the symmetric key and destroying the old one in memory, if the new key is compromised, the attacker cannot decrypt older messages encrypted with the previous key. However, this implementation is simplified. Formal forward secrecy (such as Signal's Double Ratchet) provides more robust guarantees, especially post-compromise security.

## ⚠️ Known Limitations
- **Metadata Visibility:** The server knows who talks to whom (traffic analysis).
- **Ephemeral Private Key Loss:** In this academic implementation, private keys are generated ephemerally per session (kept in RAM). If a user logs out, they lose access to their private key and cannot decrypt historical messages on their next login. A production system would encrypt the private key symmetrically with a key derived from the user's password and store it on the server, or use a local secure enclave.
- **No Perfect Forward Secrecy for RSA:** If the RSA private key is compromised, all session keys ever sent to that user (and thus all messages) could theoretically be decrypted if the attacker recorded the traffic. Key rotation of the AES key limits the exposure window *if* the RSA key is kept safe, but true PFS requires Diffie-Hellman (e.g., X25519) ephemeral key exchanges.
