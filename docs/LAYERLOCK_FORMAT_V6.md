# LayerLock Format v6

Status: private development format. Compatibility with v5 is intentionally not
provided.

## Pipeline

```text
UTF-8/NFC text
  -> shortest of raw, gzip, or deflate
  -> fixed-size randomized layer plaintext
  -> Argon2id v1.3
  -> HKDF-SHA-256 domain separation
  -> AES-256-GCM per layer
  -> shuffled LLK6 pack
  -> Argon2id + HKDF-SHA-256 + AES-256-GCM container envelope (LLE3)
  -> LLF2 adaptive Reed-Solomon frame and interleaving
  -> LLO1 optical wrapper
  -> Aztec symbol
```

## Password KDF

Each layer and the outer container use an independent random 32-byte salt.
Argon2id produces 32 bytes, which are passed to HKDF-SHA-256 before importing an
AES-256-GCM key. Passwords are normalized with Unicode NFKC.

The embedded profiles are:

| Profile | Memory | Passes | Lanes |
| --- | ---: | ---: | ---: |
| Fast | 32 MiB | 2 | 1 |
| Reliable | 64 MiB | 3 | 1 |
| Maximum | 128 MiB | 4 | 1 |

The decoder accepts only these exact tuples before starting Argon2id. This caps
memory and CPU consumption from an untrusted image. Argon2id runs in an inline
Blob Worker; a synchronous fallback exists only for environments without Worker
support.

HKDF salt is the UTF-8 string `LayerLock:v6:HKDF-SHA-256`. HKDF `info` is:

- layer: `LayerLock:v6:key:slot`
- container: `LayerLock:v6:key:container`

## Layer Encryption

A layer plaintext is `NOTE` (4 bytes), codec (1), data length (4), compressed or
raw UTF-8 bytes, then cryptographically random padding to the shared layer size.
AES-GCM uses a random 12-byte IV. Its AAD is:

```text
LayerLock:slot:v6:pack:v6:size:{slotSize}:vault:{vaultIdHex}:kdf:{memory}:{passes}:{lanes}
```

## LLK6 Pack

All integers are unsigned and big-endian.

| Field | Bytes |
| --- | ---: |
| magic `LLK6` | 4 |
| pack version, layer version, KDF id | 3 |
| Argon2 memory KiB | 4 |
| Argon2 passes, lanes | 2 |
| vault ID length and vault ID | 1 + variable |
| layer size, layer count | 2 + 2 |

Each shuffled layer then stores version (1), salt length (1), IV length (1),
ciphertext length (4), salt, IV, and ciphertext.

## LLE3 Container

The complete LLK6 pack is encrypted by the master key. Container AAD is:

```text
LayerLock:container:v3:pack:v6:kdf:{memory}:{passes}:{lanes}
```

The envelope stores magic `LLE3` (4), envelope version (1), KDF id (1), Argon2
memory KiB (4), passes (1), lanes (1), salt length (1), IV length (1), ciphertext
length (4), salt, IV, and ciphertext. Layer count and the LLK6 manifest remain
inside the authenticated ciphertext.

## Embedded Implementation

Argon2id is supplied by the pinned `hash-wasm` 4.12.0 UMD build under the MIT
license. The embedded upstream file SHA-256 is:

```text
4c623029dcde56c12ae2dc290f90e616cfeb4734e23575bb08c01cdeac3acbe3
```

The rest of the cryptographic chain uses the browser Web Crypto API. The format
and implementation still require an independent security review before public
release or use for high-value secrets.
