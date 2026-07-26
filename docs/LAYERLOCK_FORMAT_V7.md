# LayerLock Format v7

Status: private-development specification. Multi-byte integers are unsigned and big
endian unless described as a variable integer. A variable integer is unsigned LEB128
with at most four bytes and a maximum accepted value of 16 MiB.

## Pipeline

```text
note UTF-8 / NFC
  -> best of raw, gzip and deflate
  -> AES-256-GCM layer record
  -> LLP7 binary pack
  -> AES-256-GCM LLE4 envelope
  -> LLE4 bytes directly in an Aztec symbol with selected native error correction

For non-optical RAW and text exports, `LLE4` is wrapped in `LLC2`.
```

## KDF and Key Separation

Passwords are normalized with Unicode NFKC. Every password is processed by Argon2id
v1.3 and then HKDF-SHA-256. The envelope stores one KDF profile index:

| Index | Argon2 memory | Passes | Lanes |
|---:|---:|---:|---:|
| 0 | 32 MiB | 2 | 1 |
| 1 | 64 MiB | 3 | 1 |
| 2 | 128 MiB | 4 | 1 |
| 3 | 128 MiB | 6 | 1 |

HKDF salt is the UTF-8 string `LayerLock:v7:HKDF-SHA-256`. HKDF `info` is either
`LayerLock:v7:key:slot` or `LayerLock:v7:key:container`. The output is an AES-256 key.

An optional external key file may be used only for the container key. LayerLock hashes
the selected file with SHA-256 and supplies the following byte string to Argon2id in
place of the password bytes:

```text
"LayerLock:v7:keyfile" || 00 || NFKC(masterKey) || 00 || SHA-256(keyFile)
```

Without a key file, Argon2id receives the normalized password exactly as in the base v7
format. No key-file flag, file name, digest, or other marker is stored in `LLE4`; using
the feature therefore adds zero bytes to the Aztec payload. A reader cannot distinguish
a missing key file from an incorrect master key. Losing either factor is irreversible.

## Derived Parameters

Every new container receives a cryptographically random 16-byte `vaultId`. Every layer
receives an independent random 8-byte `slotId`. The following byte strings are derived:

```text
SHA-256("LayerLock:v7:" || label || 00 || vaultId || itemId)[0:length]
```

- layer Argon2 salt: label `slot-salt`, item `slotId`, 16 bytes
- layer GCM nonce: label `slot-nonce`, item `slotId`, 12 bytes
- container Argon2 salt: label `container-salt`, no item, 16 bytes
- container GCM nonce: label `container-nonce`, no item, 12 bytes

These values are not secret. Security requires a newly generated, unpredictable
`vaultId` for every encryption operation. A container must never be regenerated with
the same `vaultId` and changed plaintext under the same passwords.

## Layer Record v7

Layer plaintext is one codec byte followed by the selected note representation:

- `0`: raw UTF-8
- `1`: gzip
- `2`: deflate

The AES-GCM additional authenticated data is:

```text
"LayerLock:v7:slot-aad" || 00 || slotVersion || packVersion || kdfProfile || vaultId || slotId
```

The encrypted layer record stored in `LLP7` is:

```text
slotId[8] || ciphertextLength[varuint] || ciphertextAndTag[ciphertextLength]
```

The GCM authentication tag is 16 bytes and is included at the end of the ciphertext.

## LLP7 Pack

```text
magic "LLP7"[4]
layerCount[varuint]
layerRecord[layerCount]
```

The entire pack is encrypted by the master key, so its layer count and records are not
visible before successful container authentication. Duplicate `slotId` values are
rejected. Layer order is randomized before packing.

## LLE4 Envelope

Container AES-GCM additional authenticated data is:

```text
"LayerLock:v7:container-aad" || 00 || envelopeVersion || packVersion || kdfProfile || vaultId
```

Binary layout:

```text
magic "LLE4"[4]
envelopeVersion[1] = 4
kdfProfile[1]
vaultId[16]
ciphertextLength[varuint]
encryptedLLP7AndTag[ciphertextLength]
```

## LLC2 Compact Transport

Binary layout:

```text
magic "LLC2"[4]
recoveryProfile[1]     # 0..3 maps to Aztec EC 25/33/40/50 percent
envelopeLength[varuint]
LLE4[envelopeLength]
crc32[4]               # CRC-32/ISO-HDLC over all preceding LLC2 bytes
```

The textual representation is:

```text
LAYERLOCK-COMPACT/2
BASE64URL_WITHOUT_PADDING
```

CRC32 detects transport errors before password processing. It does not authenticate
the container and provides no secrecy; AES-GCM performs cryptographic authentication.

## Security Properties and Limits

- AES-256-GCM uses full 128-bit tags for every layer and for the outer container.
- A different HKDF context separates layer and container keys.
- The master key hides the exact layer count and all inner metadata.
- Image dimensions and total payload length still reveal an approximate size bound.
- Weak passwords remain vulnerable to offline guessing after the image is obtained.
- The interface rejects short, common, predictable, duplicate layer passwords and a
  master key equal to a layer password; this policy does not replace a strong random key.
- Secret form values, decrypted output, and cached key material are cleared after 15
  minutes of inactivity. JavaScript runtimes cannot guarantee complete memory erasure.
- The implementation has automated tests but has not received an independent audit.
