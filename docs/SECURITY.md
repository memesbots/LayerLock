# LayerLock Security Notes

LayerLock is an offline visual encrypted-container prototype. It has automated tests but has not received an independent cryptographic or implementation audit. Do not describe it as formally proven or unbreakable.

## Security Properties

- AES-GCM authenticates encrypted layer and container data.
- Argon2id makes offline password guessing memory-hard.
- Four fixed Argon2id profiles are encoded by a one-byte index; the strongest profile
  uses 128 MiB and six passes without increasing the Aztec matrix payload.
- HKDF domain separation prevents reuse of slot and container keys.
- An optional external key file can be mixed into the container KDF without storing a
  key-file marker or digest in the encrypted image.
- The encrypted manifest hides layer contents and exact layer count until the master key is accepted.
- Aztec error correction repairs visual corruption and LLC2 CRC detects transport damage; neither adds secrecy.
- The Content Security Policy blocks network connections in the shipped HTML.
- Argon2id runs in a local Blob Worker created from the same offline HTML; no code is fetched from a server.
- Generated output can be stress-checked after scaling and contrast loss before it is downloaded.
- Every stress-check candidate is fully authenticated and all expected layers are decrypted;
  merely detecting an Aztec symbol does not count as a successful check.
- Compressed notes are length-framed, decoded with a strict UTF-8 decoder, and capped at
  1 MiB after decompression. Compact imports, image bytes, dimensions and pixel counts are
  rejected before expensive rendering or scanning when they exceed fixed limits.
- The UI rejects short/common passwords, normalized duplicates, and reuse of the master
  key as a layer password. It can generate a 144-bit random master key.
- Secret fields, decrypted output, and cached plaintext credentials are cleared after
  15 minutes of inactivity and when the page is left.
- Clearing or replacing a container invalidates pending continuations. Argon2 and
  scanner Workers are terminated on cancellation. Available temporary byte buffers
  are overwritten; JavaScript strings and engine-managed copies cannot be reliably erased.
- Scanner work runs in a separate embedded Worker. Large images use bounded,
  overlapping native-resolution tiles after two overview passes (8-second search
  budget, at most 64 tiles; each Worker request has a 6-second timeout). A currently
  running request can extend the overall budget. This is not a guarantee for every photo.

## Limitations

- Image dimensions and total payload size leak an approximate upper bound on stored data.
- A weak password remains vulnerable to offline guessing.
- JavaScript cannot guarantee complete memory erasure after use.
- An external key file is a strict second factor: losing or modifying it makes the
  container unrecoverable, and the container intentionally does not reveal that it was used.
- Clipboard contents are controlled by the operating system after copying and may be
  visible to clipboard history, synchronization, or other applications.
- GitHub Pages is a delivery channel. A compromised repository or account could replace the application.
- Plausible deniability is not guaranteed.

## Release Procedure

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm run prepare:release` and `pnpm test`.
   Run `pnpm exec playwright install chromium` and `pnpm run test:browser`.
3. Confirm that `outputs/sigil-vault.html` and `dist/index.html` are byte-identical.
4. Publish `RELEASE.sha256` with the release.
5. Verify the GitHub Actions deployment commit.
6. Keep a separately downloaded offline HTML and compare its SHA-256 before critical use.
7. Verify that the ZIP contains one Aztec PNG, one Aztec SVG, one compact text container, one raw `.llc` container and `settings.txt` without secrets or privacy-sensitive structure metadata.
   When the container exceeds optical capacity, only TXT, RAW and settings are included.

See [RECOVERY.md](RECOVERY.md) for the offline archive and signed GitHub build
provenance. Source sections live in `src/` and are assembled into one offline HTML.
Frozen public fixtures cover all four KDF profiles and must not be regenerated
to make a failing compatibility test pass.

The release command generates a hash-based `script-src` policy. `unsafe-inline` is not
allowed for scripts, all network connections are blocked by `connect-src 'none'`, and
the release verifier checks the CSP, embedded dependencies, output mirror and checksum.

## Recommended Review Before Public Release

- Independent cryptographic and source-code audit
- Browser compatibility matrix, especially iOS Safari
- Scanner corpus covering screenshots, print, blur, perspective, rotation, color shifts and partial damage
- Reproducible release build and signed release manifest
- Documented threat model and recovery procedure
