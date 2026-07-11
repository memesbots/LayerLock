# LayerLock Format

## Processing Pipeline

`UTF-8 -> NFC -> best(raw, gzip, deflate) -> fixed-size layer -> Argon2id/HKDF -> AES-256-GCM -> encrypted container manifest -> FEC -> interleaving -> optical wrapper -> Aztec | JABCode`

The current binary versions are:

- Layer record: `v6`
- Encrypted pack: `v6`
- Container envelope: `v3`
- FEC frame: `LLF2`, version `2`
- Legacy mosaic wrapper magic: `SGV1`
- Optical wrapper magic: `LLO1`, version `1`

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

## Optical Transports

The encrypted and error-corrected payload is independent of its optical transport. LayerLock can emit:

- Aztec, the default two-color transport for fast camera detection, rotation and perspective handling.
- JABCode, a reserved four-color transport. Its bundled prototype remains disabled for new output until a decoder passes full-size optical round-trip and camera tests.

Both transports carry the same `LLO1` binary wrapper: magic, wrapper version, FEC-frame length, CRC32 of the encrypted container and the FEC frame itself. JABCode represents this wrapper as a Base64 message prefixed with `LLJ1:` because the bundled JavaScript port accepts text input. Base64 is confined to the JAB optical adapter; the encrypted container and Aztec transport remain binary.

The previous LayerLock mosaic decoder remains as a private-development fallback. New output is currently generated as Aztec. The JABCode adapter remains in the private build for replacement with a production C-to-WASM implementation; the current unofficial JavaScript decoder is not accepted as a release transport.

The bundled implementations are pinned locally: `zxing-wasm 3.1.0` for Aztec and `TMSSassen/JABCodeJS` for JABCode. Their JavaScript and WebAssembly assets are embedded into the release HTML; generation and reading do not request a network resource.

The scanner dispatches to Aztec first and then to the legacy mosaic detector. The experimental JABCode path remains isolated until its decoder is replaced. A candidate is accepted only after the optical wrapper, FEC and encrypted-envelope structure validate; an unrelated optical symbol is not treated as a LayerLock container.

## Error Correction

The payload is split into chunks, protected with parity chunks over GF(256), checksummed per chunk and interleaved byte-wise. Failed chunk CRC values are treated as erasures. The global CRC validates the recovered encrypted container before decryption. Four user-facing recovery levels map to 10%, 18%, 28% and 40% parity targets, with automatic minimum parity counts based on payload size.

## Camera Decode

Camera frames are first checked for severe exposure, contrast and blur problems. Aztec is attempted on each suitable frame. The more expensive JABCode decoder runs less frequently, followed by the legacy mosaic locator when needed. Legacy frames with detected anchors are projectively rectified; up to three aligned frames may be fused by per-channel median before another decode attempt. The legacy density locator runs less frequently in a Worker so UI input remains responsive.

## Versioning

Decoders reject unknown KDF, envelope, pack, FEC or slot versions. The format is still in private development, so pre-release images are not a compatibility target. A public release must freeze the version and publish test vectors before compatibility guarantees begin.
