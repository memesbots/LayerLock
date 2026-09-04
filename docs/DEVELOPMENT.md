# Development and release

Edit `src/`, not the generated HTML. `shell.html` owns the UI/CSS. JavaScript
sections are assembled in `tools/build-source.mjs` order inside a private runtime
factory. They share lexical scope, so this is a source organization step rather
than a full dependency-isolated module system. `api.js` is the explicit test API;
tests import the generated ES module instead of patching strings in the HTML.
Production starts one instance and does not expose that instance's state globally.

```sh
pnpm install --frozen-lockfile
pnpm run prepare:release
pnpm test
pnpm exec playwright install chromium
pnpm run test:browser
```

The browser tests start and stop their own localhost server. Screenshots and
temporary public test downloads go to ignored `work/browser/`.

`prepare:release` verifies vendored libraries, builds hash-based CSP, mirrors
the HTML into `dist/`, and assembles the deterministic offline recovery ZIP.
GitHub Actions rebuilds, checks for byte differences, runs core and browser tests,
attests the resulting HTML/archive, then publishes Pages. Never publish backups,
real secrets, or test downloads. Do not regenerate frozen fixtures when a test fails.

## Tested boundaries

- Four fixed v7 reference containers: every KDF profile, Unicode, whitespace,
  multiple layers, optional key-file factor.
- Tampered framing/ciphertext, incorrect credentials, image size limits,
  decompression limits and oversized compact imports.
- Product scanner on dense 151-module symbols, 4K light/dark images, rotations,
  and a 6K screenshot requiring native-resolution tiles.
- Actual Chromium UI: PNG/RAW export and import, plaintext equality, cancellation,
  reset races, key-file confirmation/enforcement, large compact-only transport,
  mobile overflow, and no external requests during the tested flows.

Not yet established: real iPhone/Android camera reliability, severe perspective,
all accessibility/browser combinations, security against compromised devices,
or formal cryptographic assurance. Synthetic tests are not camera field trials.
