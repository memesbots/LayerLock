    function kdfTag(params) {
      return `${params.memory}:${params.iterations}:${params.parallelism}`;
    }

    function kdfProfileIndex(params) {
      const tag = kdfTag(params || {});
      const index = KDF_PROFILE_KEYS.findIndex(key => kdfTag(KDF_PROFILES[key]) === tag);
      if (index < 0) throw new Error("unsupported KDF profile");
      return index;
    }

    function kdfProfileFromIndex(index) {
      const profile = KDF_PROFILES[KDF_PROFILE_KEYS[index]];
      if (!profile) throw new Error("unsupported KDF profile");
      return { ...profile };
    }

    function validateKdfParams(params) {
      const known = Object.values(KDF_PROFILES).some(profile => kdfTag(profile) === kdfTag(params || {}));
      if (!known) throw new Error("unsupported KDF profile");
      return {
        memory: params.memory,
        iterations: params.iterations,
        parallelism: params.parallelism
      };
    }

    function argon2VendorSource() {
      return globalThis.__LayerLockArgon2VendorSource || $("argon2VendorSource")?.textContent || "";
    }

    function argon2WorkerSource() {
      return `${argon2VendorSource()}\n
if (!globalThis.hashwasm && typeof module === "object" && module.exports) globalThis.hashwasm = module.exports;
self.onmessage = async event => {
  const { id, passwordBuffer, saltBuffer, params } = event.data;
  const password = new Uint8Array(passwordBuffer);
  const salt = new Uint8Array(saltBuffer);
  try {
    const result = await globalThis.hashwasm.argon2id({
      password,
      salt,
      memorySize: params.memory,
      iterations: params.iterations,
      parallelism: params.parallelism,
      hashLength: 32,
      outputType: "binary"
    });
    self.postMessage({ id, ok: true, buffer: result.buffer }, [result.buffer]);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
  } finally {
    password.fill(0);
    salt.fill(0);
  }
};`;
    }

    function rejectArgon2Pending(error) {
      for (const pending of state.argon2Pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      state.argon2Pending.clear();
    }

    function getArgon2Worker() {
      if (state.argon2Worker) return state.argon2Worker;
      if (typeof Worker !== "function" || typeof Blob !== "function" || typeof globalThis.URL?.createObjectURL !== "function") return null;
      const url = URL.createObjectURL(new Blob([argon2WorkerSource()], { type: "text/javascript" }));
      let worker;
      try {
        worker = new Worker(url);
        worker.onmessage = event => {
          const pending = state.argon2Pending.get(event.data.id);
          if (!pending) return;
          state.argon2Pending.delete(event.data.id);
          clearTimeout(pending.timer);
          if (event.data.ok) pending.resolve(new Uint8Array(event.data.buffer));
          else pending.reject(new Error(event.data.error || "Argon2id worker failed"));
        };
        worker.onerror = event => {
          const error = new Error(event.message || "Argon2id worker failed");
          rejectArgon2Pending(error);
          worker.terminate();
          state.argon2Worker = null;
        };
        state.argon2Worker = worker;
        return worker;
      } catch (_) {
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    async function argon2idOnMainThread(password, salt, params) {
      if (!globalThis.hashwasm?.argon2id) throw new Error("Argon2id недоступен в этом браузере.");
      return globalThis.hashwasm.argon2id({
        password,
        salt,
        memorySize: params.memory,
        iterations: params.iterations,
        parallelism: params.parallelism,
        hashLength: 32,
        outputType: "binary"
      });
    }

    async function argon2idRaw(password, salt, params) {
      const safeParams = validateKdfParams(params);
      const worker = getArgon2Worker();
      if (!worker) return argon2idOnMainThread(password, salt, safeParams);
      const passwordCopy = password.slice();
      const saltCopy = salt.slice();
      const id = ++state.argon2RequestId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker.terminate();
          state.argon2Worker = null;
          rejectArgon2Pending(new Error("Argon2id timeout"));
        }, 120000);
        state.argon2Pending.set(id, { resolve, reject, timer });
        worker.postMessage({
          id,
          passwordBuffer: passwordCopy.buffer,
          saltBuffer: saltCopy.buffer,
          params: safeParams
        }, [passwordCopy.buffer, saltCopy.buffer]);
      });
    }

    async function deriveKey(password, salt, context, params = KDF_PROFILES.normal, keyFileDigest = null) {
      const op = operationTicket();
      if (!Object.values(KEY_CONTEXT).includes(context)) throw new Error("invalid key context");
      const plainPasswordBytes = enc.encode(normalizePassword(password));
      let passwordBytes = plainPasswordBytes;
      if (keyFileDigest) {
        if (context !== KEY_CONTEXT.container || !(keyFileDigest instanceof Uint8Array) || keyFileDigest.length !== 32) {
          plainPasswordBytes.fill(0);
          throw new Error("invalid key file digest");
        }
        passwordBytes = concatBytes([
          enc.encode("LayerLock:v7:keyfile\0"),
          plainPasswordBytes,
          new Uint8Array([0]),
          keyFileDigest
        ]);
      }
      let baseBytes;
      try {
        baseBytes = await op.wait(argon2idRaw(passwordBytes, salt, params));
        const hkdfMaterial = await op.wait(crypto.subtle.importKey("raw", baseBytes, "HKDF", false, ["deriveKey"]));
        return await op.wait(crypto.subtle.deriveKey(
          { name: "HKDF", hash: HKDF_HASH, salt: HKDF_SALT, info: enc.encode(context) },
          hkdfMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        ));
      } finally {
        plainPasswordBytes.fill(0);
        passwordBytes.fill(0);
        baseBytes?.fill(0);
      }
    }

    async function deriveDomainBytes(label, vaultId, itemId = new Uint8Array(), length = 16) {
      if (!(vaultId instanceof Uint8Array) || vaultId.length !== 16) throw new Error("invalid vault id");
      if (!(itemId instanceof Uint8Array)) itemId = new Uint8Array(itemId || 0);
      const digest = new Uint8Array(await crypto.subtle.digest(
        "SHA-256",
        concatBytes([enc.encode(`LayerLock:v7:${label}\0`), vaultId, itemId])
      ));
      return digest.slice(0, length);
    }

    function slotAad(aadContext = {}, slotId, slotVersion = SLOT_VERSION) {
      const vaultId = aadContext.vaultId;
      const kdf = validateKdfParams(aadContext.kdf || KDF_PROFILES.normal);
      if (!(vaultId instanceof Uint8Array) || vaultId.length !== 16) throw new Error("invalid vault id");
      if (!(slotId instanceof Uint8Array) || slotId.length !== 8) throw new Error("invalid slot id");
      return concatBytes([
        enc.encode("LayerLock:v7:slot-aad\0"),
        new Uint8Array([slotVersion, PACK_VERSION, kdfProfileIndex(kdf)]),
        vaultId,
        slotId
      ]);
    }

    async function encodeNoteText(note) {
      const raw = enc.encode(normalizeNoteText(note));
      if (raw.byteLength > MAX_NOTE_BYTES) throw new Error("Текст слоя превышает безопасный лимит 1 MiB.");
      const choices = [{ flag: NOTE_RAW_SIZED, bytes: raw }];
      const gz = await tryCompress(raw, "gzip");
      if (gz) choices.push({ flag: NOTE_GZIP_SIZED, bytes: gz });
      const deflated = await tryCompress(raw, "deflate");
      if (deflated) choices.push({ flag: NOTE_DEFLATE_SIZED, bytes: deflated });
      const best = choices.reduce((best, item) => item.bytes.length < best.bytes.length ? item : best);
      const rawLength = raw.byteLength;
      for (const choice of choices) if (choice !== best) choice.bytes.fill(0);
      return { ...best, rawLength };
    }

    async function decodeNoteText(flag, bytes) {
      const sized = flag === NOTE_RAW_SIZED || flag === NOTE_GZIP_SIZED || flag === NOTE_DEFLATE_SIZED;
      const legacy = flag === NOTE_RAW || flag === NOTE_GZIP || flag === NOTE_DEFLATE;
      if (!sized && !legacy) throw new Error("bad note codec");
      let expectedLength = null;
      let payload = bytes;
      if (sized) {
        const cursor = { p: 0 };
        expectedLength = readVarUint(bytes, cursor);
        if (expectedLength > MAX_NOTE_BYTES) throw new Error("Распакованный текст превышает безопасный лимит.");
        payload = bytes.subarray(cursor.p);
      }
      const gzip = flag === NOTE_GZIP || flag === NOTE_GZIP_SIZED;
      const deflate = flag === NOTE_DEFLATE || flag === NOTE_DEFLATE_SIZED;
      const data = gzip
        ? await decompress(payload, "gzip", expectedLength ?? MAX_NOTE_BYTES)
        : (deflate ? await decompress(payload, "deflate", expectedLength ?? MAX_NOTE_BYTES) : payload);
      try {
        if (data.byteLength > MAX_NOTE_BYTES) throw new Error("Распакованный текст превышает безопасный лимит.");
        if (expectedLength !== null && data.byteLength !== expectedLength) throw new Error("Длина распакованного текста не совпала.");
        try {
        return dec.decode(data);
        } catch (_) {
        throw new Error("Текст слоя содержит поврежденные UTF-8 данные.");
        }
      } finally { data.fill(0); }
    }

    async function encryptSlot(password, note, aadContext, kdf = KDF_PROFILES.normal) {
      const op = operationTicket();
      const noteData = await op.wait(encodeNoteText(note));
      const lengthBytes = [];
      writeVarUint(lengthBytes, noteData.rawLength);
      const plain = concatBytes([new Uint8Array([noteData.flag]), new Uint8Array(lengthBytes), noteData.bytes]);
      const slotId = randomBytes(8);
      try {
      const salt = await op.wait(deriveDomainBytes("slot-salt", aadContext.vaultId, slotId, 16));
      const iv = await op.wait(deriveDomainBytes("slot-nonce", aadContext.vaultId, slotId, 12));
      const key = await op.wait(deriveKey(password, salt, KEY_CONTEXT.slot, kdf));
      const ct = new Uint8Array(await op.wait(crypto.subtle.encrypt({
        name: "AES-GCM",
        iv,
        additionalData: slotAad(aadContext, slotId)
      }, key, plain)));
      return { v: SLOT_VERSION, id: slotId, ct };
      } finally { plain.fill(0); noteData.bytes.fill(0); }
    }

    async function decryptSlot(password, slot, aadContext, kdf = KDF_PROFILES.normal) {
      const op = operationTicket();
      if (slot.v !== SLOT_VERSION) throw new Error("unsupported slot");
      const salt = await op.wait(deriveDomainBytes("slot-salt", aadContext.vaultId, slot.id, 16));
      const iv = await op.wait(deriveDomainBytes("slot-nonce", aadContext.vaultId, slot.id, 12));
      const key = await op.wait(deriveKey(password, salt, KEY_CONTEXT.slot, kdf));
      const params = { name: "AES-GCM", iv, additionalData: slotAad(aadContext, slot.id, slot.v) };
      const plain = new Uint8Array(await op.wait(crypto.subtle.decrypt(params, key, slot.ct)));
      try {
      if (plain.length < 1) throw new Error("bad note");
      return await op.wait(decodeNoteText(plain[0], plain.subarray(1)));
      } finally { plain.fill(0); }
    }
