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
- The UI rejects short/common passwords, normalized duplicates, and reuse of the master
  key as a layer password. It can generate a 144-bit random master key.
- Secret fields, decrypted output, and cached plaintext credentials are cleared after
  15 minutes of inactivity and when the page is left.

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

1. Run `npm test`.
2. Confirm that `outputs/sigil-vault.html` and `dist/index.html` are byte-identical.
3. Publish `RELEASE.sha256` with the release.
4. Verify the GitHub Actions deployment commit.
5. Keep a separately downloaded offline HTML and compare its SHA-256 before critical use.
6. Verify that the ZIP contains one Aztec PNG, one Aztec SVG, one compact text container, one raw `.llc` container and `settings.txt` without secrets.

## Recommended Review Before Public Release

- Independent cryptographic and source-code audit
- Browser compatibility matrix, especially iOS Safari
- Scanner corpus covering screenshots, print, blur, perspective, rotation, color shifts and partial damage
- Reproducible release build and signed release manifest
- Documented threat model and recovery procedure
