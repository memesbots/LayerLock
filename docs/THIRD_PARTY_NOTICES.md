# Third-Party Components

LayerLock embeds these exact, unmodified release artifacts in the offline HTML:

| Component | Version | License | SHA-256 |
|---|---:|---|---|
| zxing-wasm JavaScript | 3.1.0 | MIT | `5b056986d7030b23b940a7a0decf4e7f28e905aa0616c6af0d31753b20ef8631` |
| zxing-wasm WebAssembly | 3.1.0 | MIT | `f516b088ccd90e353c2bedf7e19d69ce323264ddc288e20a5258a1eae69148ba` |
| hash-wasm Argon2 bundle | 4.12.0 | MIT | `dcec617a2e1b700fa132d1583a186cb70611113395e869f2dd6cc82b415d3094` |
| fflate UMD bundle | 0.8.2 | MIT | `c3b34f2e9f5e74d4d7d64e01cac7a0c01954c6c406414d42185c7b53d6875ddf` |

The corresponding license texts are stored in `vendor/`. `tools/embed-optical-codecs.mjs`
refuses to build when any artifact checksum differs.
