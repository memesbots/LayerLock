# LayerLock Format

The current format is specified in [LAYERLOCK_FORMAT_V7.md](LAYERLOCK_FORMAT_V7.md).
The previous private-development format remains documented in
[LAYERLOCK_FORMAT_V6.md](LAYERLOCK_FORMAT_V6.md) for historical reference only.

## Current Pipeline

`UTF-8 -> NFC -> best(raw, gzip, deflate) -> AES-256-GCM per layer -> compact binary pack -> AES-256-GCM container -> Aztec error correction`

Current binary versions:

- Layer record: `v7`
- Encrypted pack: `LLP7`
- Container envelope: `LLE4`
- Compact transport: `LLC2` / `LAYERLOCK-COMPACT/2`

The container manifest is encrypted by the master key. Layer count, layer identifiers,
layer ciphertext lengths and KDF-authenticated pack data are unavailable until the
master key succeeds. Layer records use variable lengths and no artificial random
padding, reducing the optical payload substantially.

## Optical Transport

LayerLock emits a two-color Aztec symbol. Encrypted `LLE4` bytes are passed directly to
Aztec; there is no second outer Reed-Solomon layer. `LLC2` is reserved for RAW and text
exports, where it records the recovery profile and CRC. The recovery setting maps to Aztec error
correction levels of 25%, 33%, 40% or 50%. The bundled ZXing encoder, decoder and
WebAssembly module are embedded in the release HTML and do not request network data.

A candidate is accepted only after Aztec decoding and `LLE4` structure validation.
RAW and text imports additionally require `LLC2` CRC validation. Authenticity of
encrypted data is established by AES-GCM after
the corresponding password succeeds.

## Versioning

Decoders reject unknown compact, KDF, envelope, pack and slot versions. Pre-release
formats are not a compatibility target until a public format is frozen and published
with independent test vectors.
