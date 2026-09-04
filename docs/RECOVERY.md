# Long-term recovery

Keep at least two independently stored copies of the encrypted `.llc` file and
the offline HTML. An Aztec PNG/SVG is an additional transport copy, not a
replacement for a byte-exact backup. Store passwords and the optional key file
separately. Losing the key file is not recoverable with the password alone.

## Offline procedure

1. Extract `LayerLock-recovery.zip` and open `LayerLock.html` in a modern browser.
2. Select Read and load the `.llc`, compact TXT, PNG, or SVG.
3. Supply the original key file if one was used, then enter the master key.
4. Enter the requested layer's password. Verify the plaintext before discarding
   any other backup.

No network is needed for file import and decryption. Live camera access may
require a secure localhost or HTTPS origin. RAW/TXT containers larger than the
Aztec capacity open without an image. There is a 256 KiB encrypted-container
limit and a 1 MiB decompressed limit per layer; these are resource limits, not
cryptographic parameters. Unicode uses the v7 normalization rules; whitespace
is not silently removed.

## Verification and provenance

`RELEASE.sha256` checks the HTML bytes. A checksum stored next to a download is
not proof of its author. For a published build, verify the GitHub attestation:

```sh
gh attestation verify LayerLock.html --repo memesbots/LayerLock
gh attestation verify LayerLock-recovery.zip --repo memesbots/LayerLock
```

Verify the repository and source commit in the result against a separately
trusted reference. Attestations prove build provenance, not absence of bugs.
Keep the verified HTML and its digest offline; account compromise can still
produce new, correctly attested malicious releases.

`v7-public.json` contains PUBLIC passwords, key-file bytes, expected texts and
frozen reference containers for all four profiles. It is test material only.
Future builds must decode these fixtures byte-for-byte without regenerating
them. They are regression checks, not independent cryptographic test vectors.

Do a recovery rehearsal now, not after losing access to the original device.
Blockchain availability alone does not preserve passwords, key files, decoding
software, or access to the chain's historical data.
