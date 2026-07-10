# LayerLock Format

## Processing Pipeline

`UTF-8 -> NFC -> best(raw, gzip, deflate) -> fixed-size layer -> Argon2id/HKDF -> AES-256-GCM -> encrypted container manifest -> FEC -> interleaving -> visual grid`

The current binary versions are:

- Layer record: `v6`
- Encrypted pack: `v6`
- Container envelope: `v3`
- FEC frame: `LLF2`, version `2`
- Visual wrapper magic: `SGV1`

All integers in the visual and encrypted formats use fixed-width binary fields. Layer plaintext is padded with cryptographically random bytes to the common slot size before encryption. The manifest is encrypted by the container master key and does not expose layer metadata before authentication.

## Cryptography

- Password KDF: Argon2id v1.3
- Key separation: HKDF-SHA-256 with distinct slot and container contexts
- Encryption: AES-256-GCM
- Per-layer salt: 32 random bytes
- Per-layer nonce: 12 random bytes
- Container salt: 32 random bytes
- Container nonce: 12 random bytes
- Authentication metadata: version, KDF parameters, vault identifier and slot size

Passwords, master keys and plaintext are never written into PNG, SVG, ZIP settings, browser storage or filenames.

## Visual Frame

The visual grid has a three-cell synchronization margin. It contains four high-contrast corner brackets and timing tracks with two cadences. Payload cells begin after this margin. The top-left bracket is asymmetric and establishes orientation.

Scanner 3 first detects a dense candidate region, estimates its quadrilateral, applies projective rectification, calibrates color centroids from the embedded calibration symbols and then validates the binary header before FEC or decryption.

## Error Correction

The payload is split into chunks, protected with parity chunks over GF(256), checksummed per chunk and interleaved byte-wise. Failed chunk CRC values are treated as erasures. The global CRC validates the recovered encrypted container before decryption.

## Compatibility

Decoders must reject unknown KDF, envelope, pack, FEC or slot versions. A new incompatible format requires a new version and new published test vectors.
