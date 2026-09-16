# Ciphera: End-to-End Encrypted Chat Application

Ciphera is a Cryptography and Network Security course project demonstrating hybrid cryptography for real-time messaging, with a focus on End-to-End Encryption (E2EE), integrity checking, and forward secrecy through session key rotation.

## Table of Contents
- [Objectives](#objectives)
- [Features](#features)
- [Architecture](#architecture)
- [Cryptographic Workflow](#cryptographic-workflow)
- [Running with Docker](#running-with-docker)
- [Demonstration Guide (Viva)](#demonstration-guide-viva)
- [Limitations (Academic Scope)](#limitations-academic-scope)

## Objectives
- Demonstrate Hybrid Cryptography (RSA-OAEP + AES-GCM).
- Prevent server from accessing plaintext messages.
- Implement forward secrecy concepts via automatic ephemeral session key rotation.
- Demonstrate Message Tampering detection (Integrity Validation).

## Features
- **User Authentication:** Argon2id hashed passwords, JWT secure HttpOnly cookies.
- **End-to-End Encryption:** Messages are encrypted locally on the browser using AES-256-GCM.
- **RSA Session Key Negotiation:** AES session keys are encrypted with 3072-bit RSA-OAEP before transiting the server.
- **Forward Secrecy (Key Rotation):** Session keys rotate automatically every 30 messages.
- **Real-Time Delivery:** Powered by Socket.IO.
- **Security Lab:** Interactive simulations for tampering and database exposure.

## Architecture
The system uses a Monorepo containing:
- **Next.js Web Client**: Handles Web Crypto API operations, storing private keys locally in memory, managing UI.
- **Express.js Server**: Acts as an unprivileged relayer for ciphertext and metadata, handling Socket.IO events.
- **PostgreSQL (Prisma)**: Stores encrypted messages, hashed passwords, and public keys.
- **Shared Crypto Package**: Centralized Web Crypto API implementation.

## Cryptographic Workflow
1. **Identity Generation**: Users generate 3072-bit RSA key pairs on the client side during registration. Private key stays in memory.
2. **Session Initialization**: User A generates an ephemeral AES-256-GCM session key, encrypts it with User B's RSA public key using RSA-OAEP.
3. **Message Encryption**: Each message is encrypted with the AES-GCM session key and a fresh 96-bit nonce. The authentication tag is appended to the ciphertext.
4. **Decryption**: User B uses their private key to decrypt the AES session key, then uses AES-GCM to decrypt the message and verify its integrity tag.

## Running with Docker
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Database: port 5432

## Demonstration Guide (Viva)
1. **Setup**: Register "Alice" in one browser, "Bob" in an incognito window.
2. **Communication**: Send messages from Alice to Bob. Observe the "E2E Encrypted" and "Key v1" badges.
3. **Key Rotation**: Send 30 messages rapidly to trigger the threshold. Observe the key version incrementing to "Key v2".
4. **Security Lab**: Navigate to the "Security Lab" from the sidebar.
5. **Simulations**:
   - Run the "Message Tampering" simulation to show how the authentication tag detects modified ciphertext.
   - Click "View Database Record" to prove that the server only holds ciphertext.

## Limitations (Academic Scope)
- True Forward Secrecy typically requires the Double Ratchet Algorithm (X25519) to rotate keys *after every message* and handle asynchronous offline sessions perfectly. This implementation rotates symmetric keys based on a message threshold using a simplified re-negotiation.
- Private keys are held in memory and regenerated if lost upon login (for simplicity, instead of password-based local key vault encryption).
