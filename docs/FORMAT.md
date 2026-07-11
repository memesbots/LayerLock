# LayerLock Format

## Processing Pipeline

`UTF-8 -> NFC -> best(raw, gzip, deflate) -> fixed-size layer -> Argon2id/HKDF -> AES-256-GCM -> encrypted container manifest -> Reed-Solomon -> interleaving -> LLO1 optical wrapper -> Aztec`

The current binary versions are:

- Layer record: `v6`
- Encrypted pack: `v6`
- Container envelope: `v3`
- FEC frame: `LLF2`, version `2`
- Optical wrapper: `LLO1`, version `1`

All integers use fixed-width binary fields. Layer plaintext is padded with cryptographically random bytes to the common slot size before encryption. The container manifest is encrypted by the master key and does not expose layer metadata before authentication.

## Cryptography

- Password KDF: Argon2id v1.3
- Key separation: HKDF-SHA-256 with distinct layer and container contexts
- Encryption: AES-256-GCM
- Per-layer salt and container salt: 32 random bytes
- Per-layer nonce and container nonce: 12 random bytes
- Authenticated metadata: version, KDF parameters, vault identifier and slot size

Passwords, master keys and plaintext are never written into PNG, SVG, ZIP settings, browser storage or filenames.

## Optical Transport

LayerLock emits a two-color Aztec symbol. The `LLO1` binary wrapper carries its version, FEC-frame length, CRC32 of the encrypted container and the FEC frame. The bundled `zxing-wasm 3.1.0` encoder and decoder are embedded into the release HTML, including WebAssembly; generation and reading do not request network resources.

A candidate is accepted only after Aztec decoding, optical-wrapper validation, FEC recovery and encrypted-envelope validation. An unrelated Aztec symbol is not treated as a LayerLock container.

## Error Correction

The payload is split into chunks, protected with parity chunks over GF(256), checksummed per chunk and interleaved byte-wise. Failed chunk CRC values are treated as erasures. The global CRC validates the recovered encrypted container before decryption. Four recovery levels map to 10%, 18%, 28% and 40% parity targets, with automatic minimum parity counts based on payload size.

## Camera Decode

Camera frames are checked for severe exposure, contrast and blur problems, then passed to the embedded Aztec decoder with rotation, inversion, downscaling and denoising enabled as appropriate. Candidate data is accepted only after the complete LayerLock wrapper chain validates.

## Versioning

Decoders reject unknown KDF, envelope, pack, FEC, optical-wrapper or slot versions. The format is still in private development, so pre-release images are not a compatibility target. A public release must freeze the version and publish test vectors before compatibility guarantees begin.
