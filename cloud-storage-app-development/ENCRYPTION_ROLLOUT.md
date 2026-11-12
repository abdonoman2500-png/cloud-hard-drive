# Client-side encryption rollout status

This branch adds a browser Web Crypto foundation for creating a random vault key, wrapping it with a user passphrase and a separately generated recovery key, and encrypting/decrypting byte buffers with AES-256-GCM. The passphrase and unwrapped key are not parameters to a server API in this module.

## Important: not yet end-to-end encryption

This module is **not wired into authentication, the database, upload/download, previews, or recovery screens**. The current app still uploads and serves plaintext files through its existing APIs. Do not deploy or describe the current application as end-to-end encrypted based on this module alone. `encryptBytes` currently accepts a complete `ArrayBuffer` and is unsuitable for very large files without a separately designed chunked authenticated-encryption format.

## Required work before enabling encrypted storage

- Add a backward-compatible database migration for key envelopes and encryption metadata; retain existing records and blobs.
- Design a migration that encrypts existing files in the browser, with resumability and a verified rollback/backup plan. Never silently label old plaintext objects as encrypted.
- Integrate key creation/unlock, passphrase confirmation, one-time recovery-key display, recovery, change-passphrase, and in-memory key lifecycle into the UI and session flow.
- Replace upload, download, preview, video range requests, deduplication, and public sharing with a versioned chunk format that authenticates each chunk and its ordering. The existing public-share API would expose ciphertext only and needs an explicit client-side key-sharing design.
- Add per-user authorization tests and a least-privilege database/RLS strategy. Existing authorization currently resides in application API checks.
- Add automated browser crypto, API, migration, and end-to-end tests, then verify the production build and deployment environment.

Recovery envelopes are only as safe as the user's recovery key. Losing both the passphrase and recovery key makes the vault key and encrypted files unrecoverable. PBKDF2 is deliberately bounded on envelope input to avoid attacker-controlled excessive work; parameters should be benchmarked on target mobile devices before product rollout.
