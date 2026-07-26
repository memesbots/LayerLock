# LayerLock Security Notes

LayerLock is an offline visual encrypted-container prototype. It has automated tests but has not received an independent cryptographic or implementation audit. Do not describe it as formally proven or unbreakable.

## Security Properties

- AES-GCM authenticates encrypted layer and container data.
- Argon2id makes offline password guessing memory-hard.
- HKDF domain separation prevents reuse of slot and container keys.
- The encrypted manifest hides layer contents and exact layer count until the master key is accepted.
- Aztec error correction repairs visual corruption and LLC2 CRC detects transport damage; neither adds secrecy.
- The Content Security Policy blocks network connections in the shipped HTML.
- Argon2id runs in a local Blob Worker created from the same offline HTML; no code is fetched from a server.
- Generated output can be stress-checked after scaling and contrast loss before it is downloaded.

## Limitations

- Image dimensions and total payload size leak an approximate upper bound on stored data.
- A weak password remains vulnerable to offline guessing.
- JavaScript cannot guarantee complete memory erasure after use.
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
