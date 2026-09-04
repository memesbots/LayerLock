    let zxingReady = null;

    function ensureZXing() {
      if (zxingReady) return zxingReady;
      if (!globalThis.ZXingWASM || !globalThis.LAYERLOCK_ZXING_WASM_BASE64) {
        throw new Error("Кодек Aztec недоступен.");
      }
      const binary = atob(globalThis.LAYERLOCK_ZXING_WASM_BASE64);
      const wasmBinary = Uint8Array.from(binary, char => char.charCodeAt(0));
      globalThis.LAYERLOCK_ZXING_WASM_BASE64 = "";
      zxingReady = Promise.resolve(globalThis.ZXingWASM.prepareZXingModule({
        overrides: { wasmBinary },
        equalityFn: Object.is,
        fireImmediately: true
      }));
      return zxingReady;
    }

    async function createAztecRender(opticalBytes, baseRender) {
      if (opticalBytes.length > MAX_OPTICAL_BYTES) {
        const error = new Error('Container exceeds optical capacity');
        error.code = 'OPTICAL_CAPACITY';
        throw error;
      }
      await ensureZXing();
      const recovery = baseRender.fecProfile?.ecLevel || 33;
      const result = await globalThis.ZXingWASM.writeBarcode(opticalBytes, {
        format: "Aztec",
        scale: 1,
        addQuietZones: true,
        options: `ecLevel=${recovery}%`
      });
      if (result.error || !result.symbol?.data?.length) {
        const error = new Error(result.error || "Не удалось создать Aztec.");
        if (/too (big|large|long)|capacity|fit|encode.*data/i.test(result.error || '')) error.code = 'OPTICAL_CAPACITY';
        throw error;
      }
      return {
        ...baseRender,
        transport: "aztec",
        formatLabel: "Aztec",
        moduleWidth: result.symbol.width,
        moduleHeight: result.symbol.height,
        moduleData: new Uint8ClampedArray(result.symbol.data),
        scale: Math.max(5, Math.min(16, Math.floor(720 / Math.max(result.symbol.width, result.symbol.height))))
      };
    }

    function writeU32(out, n) {
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
    }

    function writeBytes(out, bytes) {
      for (const b of bytes) out.push(b);
    }

    function writeVarUint(out, value) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid integer");
      do {
        let byte = value % 128;
        value = Math.floor(value / 128);
        if (value) byte |= 0x80;
        out.push(byte);
      } while (value);
    }

    function readVarUint(bytes, cursor, maximum = 16777216) {
      let value = 0;
      let factor = 1;
      for (let i = 0; i < 4; i++) {
        if (cursor.p >= bytes.length) throw new Error("bad varint");
        const byte = bytes[cursor.p++];
        value += (byte & 0x7f) * factor;
        if (!(byte & 0x80)) {
          if (i > 0 && byte === 0) throw new Error("bad varint");
          if (value > maximum) throw new Error("integer too large");
          return value;
        }
        factor *= 128;
      }
      throw new Error("bad varint");
    }

    function encodePack(slots) {
      if (!slots.length || slots.length > 255) throw new Error("Недопустимое количество слоев.");
      const out = [];
      out.push(0x4c, 0x4c, 0x50, 0x37); // LLP7
      writeVarUint(out, slots.length);
      const ids = new Set();
      for (const slot of slots) {
        if (slot.v !== SLOT_VERSION || !(slot.id instanceof Uint8Array) || slot.id.length !== 8) throw new Error("invalid slot");
        const id = bytesToHex(slot.id);
        if (ids.has(id)) throw new Error("duplicate slot id");
        ids.add(id);
        writeBytes(out, slot.id);
        writeVarUint(out, slot.ct.length);
        writeBytes(out, slot.ct);
      }
      return new Uint8Array(out);
    }

    function decodePack(bytes, vaultId, kdf = KDF_PROFILES.normal) {
      const cursor = { p: 0 };
      function need(n) {
        if (cursor.p + n > bytes.length) throw new Error("bad pack");
      }
      function u8() {
        need(1);
        return bytes[cursor.p++];
      }
      function take(n) {
        need(n);
        const v = bytes.subarray(cursor.p, cursor.p + n);
        cursor.p += n;
        return v;
      }

      if (!(vaultId instanceof Uint8Array) || vaultId.length !== 16) throw new Error("invalid vault id");
      const safeKdf = validateKdfParams(kdf);
      if (u8() !== 0x4c || u8() !== 0x4c || u8() !== 0x50 || u8() !== 0x37) throw new Error("bad pack");
      const count = readVarUint(bytes, cursor, 255);
      if (!count) throw new Error("bad pack");
      const slots = [];
      const ids = new Set();
      for (let i = 0; i < count; i++) {
        const id = take(8);
        const idHex = bytesToHex(id);
        if (ids.has(idHex)) throw new Error("duplicate slot id");
        ids.add(idHex);
        const ctLen = readVarUint(bytes, cursor);
        if (ctLen < 17) throw new Error("bad slot");
        slots.push({ v: SLOT_VERSION, id: id.slice(), ct: take(ctLen).slice() });
      }
      if (cursor.p !== bytes.length) throw new Error("bad pack");
      return {
        v: PACK_VERSION,
        a: "A256GCM",
        k: `${KDF_NAME}+HKDF-${HKDF_HASH}`,
        q: safeKdf,
        d: bytesToHex(vaultId),
        u: vaultId.slice(),
        p: slots
      };
    }

    function containerAad(vaultId, version = ENVELOPE_VERSION, kdf = KDF_PROFILES.normal) {
      const safeKdf = validateKdfParams(kdf);
      if (!(vaultId instanceof Uint8Array) || vaultId.length !== 16) throw new Error("invalid vault id");
      return concatBytes([
        enc.encode("LayerLock:v7:container-aad\0"),
        new Uint8Array([version, PACK_VERSION, kdfProfileIndex(safeKdf)]),
        vaultId
      ]);
    }

    function encodeEnvelope(ciphertext, vaultId, kdf) {
      const safeKdf = validateKdfParams(kdf);
      if (!(vaultId instanceof Uint8Array) || vaultId.length !== 16) throw new Error("invalid vault id");
      const out = [];
      out.push(0x4c, 0x4c, 0x45, 0x34); // LLE4
      out.push(ENVELOPE_VERSION, kdfProfileIndex(safeKdf));
      writeBytes(out, vaultId);
      writeVarUint(out, ciphertext.length);
      writeBytes(out, ciphertext);
      return new Uint8Array(out);
    }

    function decodeEnvelope(bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.length > MAX_CONTAINER_BYTES) throw new Error("bad envelope");
      const cursor = { p: 0 };
      function need(n) {
        if (cursor.p + n > bytes.length) throw new Error("bad envelope");
      }
      function u8() {
        need(1);
        return bytes[cursor.p++];
      }
      function take(n) {
        need(n);
        const v = bytes.subarray(cursor.p, cursor.p + n);
        cursor.p += n;
        return v;
      }

      if (u8() !== 0x4c || u8() !== 0x4c || u8() !== 0x45 || u8() !== 0x34) throw new Error("bad envelope");
      const version = u8();
      const kdf = kdfProfileFromIndex(u8());
      const vaultId = take(16).slice();
      const ctLen = readVarUint(bytes, cursor);
      if (version !== ENVELOPE_VERSION || ctLen < 17) throw new Error("unsupported envelope");
      const ct = take(ctLen).slice();
      if (cursor.p !== bytes.length) throw new Error("bad envelope");
      return {
        kind: "locked",
        v: version,
        k: KDF_ID,
        q: kdf,
        id: vaultId,
        ct
      };
    }

    function decodeBody(bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.length > MAX_CONTAINER_BYTES) throw new Error("bad body");
      if (bytes.length < 4) throw new Error("bad body");
      if (bytes[0] === 0x4c && bytes[1] === 0x4c && bytes[2] === 0x45 && bytes[3] === 0x34) {
        return { kind: "locked", envelope: decodeEnvelope(bytes) };
      }
      throw new Error("unsupported body");
    }

    async function encryptContainer(masterKey, packBytes, vaultId, kdf = KDF_PROFILES.normal, keyFileDigest = null) {
      const op = operationTicket();
      const safeKdf = validateKdfParams(kdf);
      const salt = await op.wait(deriveDomainBytes("container-salt", vaultId, new Uint8Array(), 16));
      const iv = await op.wait(deriveDomainBytes("container-nonce", vaultId, new Uint8Array(), 12));
      const key = await op.wait(deriveKey(masterKey, salt, KEY_CONTEXT.container, safeKdf, keyFileDigest));
      const ciphertext = new Uint8Array(await op.wait(crypto.subtle.encrypt({
        name: "AES-GCM",
        iv,
        additionalData: containerAad(vaultId, ENVELOPE_VERSION, safeKdf)
      }, key, packBytes)));
      return encodeEnvelope(ciphertext, vaultId, safeKdf);
    }

    async function decryptContainer(masterKey, envelope, keyFileDigest = null) {
      const op = operationTicket();
      const salt = await op.wait(deriveDomainBytes("container-salt", envelope.id, new Uint8Array(), 16));
      const iv = await op.wait(deriveDomainBytes("container-nonce", envelope.id, new Uint8Array(), 12));
      const key = await op.wait(deriveKey(masterKey, salt, KEY_CONTEXT.container, envelope.q, keyFileDigest));
      const plain = new Uint8Array(await op.wait(crypto.subtle.decrypt({
        name: "AES-GCM",
        iv,
        additionalData: containerAad(envelope.id, envelope.v, envelope.q)
      }, key, envelope.ct)));
      try { return decodePack(plain, envelope.id, envelope.q); }
      finally { plain.fill(0); }
    }

    async function packFromBody(body, masterKey, keyFileDigest = null) {
      if (!masterKey) throw new Error("Введите мастер-ключ.");
      return decryptContainer(masterKey, body.envelope, keyFileDigest);
    }

    function renderPixelSize(render) {
      return Math.max(render.moduleWidth, render.moduleHeight) * render.scale;
    }

    function renderSigil(canvas, render) {
      const modules = Math.max(render.moduleWidth, render.moduleHeight);
      const size = modules * render.scale;
      const offsetX = Math.floor((modules - render.moduleWidth) / 2);
      const offsetY = Math.floor((modules - render.moduleHeight) / 2);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < render.moduleHeight; y++) {
        for (let x = 0; x < render.moduleWidth; x++) {
          const value = render.moduleData[y * render.moduleWidth + x];
          ctx.fillStyle = value < 128 ? "#000000" : "#ffffff";
          ctx.fillRect((offsetX + x) * render.scale, (offsetY + y) * render.scale, render.scale, render.scale);
        }
      }
    }

    function makeSvg(render) {
      const modules = Math.max(render.moduleWidth, render.moduleHeight);
      const size = modules * render.scale;
      const offsetX = Math.floor((modules - render.moduleWidth) / 2);
      const offsetY = Math.floor((modules - render.moduleHeight) / 2);
      const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${modules} ${modules}" shape-rendering="crispEdges">`,
        `<rect width="${modules}" height="${modules}" fill="#ffffff"/>`
      ];
      const path = [];
      for (let y = 0; y < render.moduleHeight; y++) {
        let start = -1;
        for (let x = 0; x <= render.moduleWidth; x++) {
          const dark = x < render.moduleWidth && render.moduleData[y * render.moduleWidth + x] < 128;
          if (dark && start < 0) start = x;
          if (!dark && start >= 0) {
            const left = offsetX + start;
            path.push(`M${left} ${offsetY + y}h${x - start}v1H${left}z`);
            start = -1;
          }
        }
      }
      if (path.length) parts.push(`<path fill="#000000" d="${path.join("")}"/>`);
      parts.push("</svg>");
      return parts.join("");
    }

    function bytesToBase64Url(bytes) {
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function base64UrlToBytes(value) {
      const clean = String(value || "").replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
      if (clean.length > MAX_COMPACT_TEXT_CHARS) throw new Error("Компактный код превышает безопасный лимит.");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("Компактный код содержит недопустимые символы.");
      const padded = clean + "=".repeat((4 - clean.length % 4) % 4);
      let binary;
      try { binary = atob(padded); }
      catch (_) { throw new Error("Формат компактного кода не распознан."); }
      return Uint8Array.from(binary, char => char.charCodeAt(0));
    }

    function makeCompactBytes(containerBytes, fecKey = "standard") {
      const profileIndex = FEC_PROFILE_KEYS.indexOf(fecKey);
      if (!(containerBytes instanceof Uint8Array) || !containerBytes.length || profileIndex < 0) {
        throw new Error("Компактный контейнер не готов.");
      }
      if (containerBytes.length > MAX_CONTAINER_BYTES) throw new Error("Контейнер превышает безопасный лимит.");
      const prefix = [0x4c, 0x4c, 0x43, 0x32, profileIndex]; // LLC2
      writeVarUint(prefix, containerBytes.length);
      writeBytes(prefix, containerBytes);
      writeU32(prefix, crc32(new Uint8Array(prefix)));
      return new Uint8Array(prefix);
    }

    function parseCompactBytes(bytes) {
      if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || 0);
      if (bytes.length > MAX_CONTAINER_BYTES + 32) throw new Error("Компактный контейнер превышает безопасный лимит.");
      if (bytes.length < 10 || bytes[0] !== 0x4c || bytes[1] !== 0x4c || bytes[2] !== 0x43 || bytes[3] !== 0x32) {
        throw new Error("Формат компактного кода не распознан.");
      }
      const fecKey = FEC_PROFILE_KEYS[bytes[4]];
      const cursor = { p: 5 };
      const length = readVarUint(bytes, cursor);
      const dataOffset = cursor.p;
      if (!fecKey || !length || length > MAX_CONTAINER_BYTES || bytes.length !== dataOffset + length + 4) {
        throw new Error("Структура компактного кода повреждена.");
      }
      const expected = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(dataOffset + length, false);
      if (crc32(bytes.subarray(0, dataOffset + length)) !== expected) throw new Error("Контрольная сумма компактного кода не совпала.");
      return { containerBytes: bytes.slice(dataOffset, dataOffset + length), fecKey, fecProfile: FEC_PROFILES[fecKey] };
    }

    function makeCompactText(containerBytes, fecKey = "standard") {
      return `${COMPACT_TEXT_MAGIC}\n${bytesToBase64Url(makeCompactBytes(containerBytes, fecKey))}\n`;
    }

    function parseCompactText(source) {
      const normalized = String(source || "").replace(/^\uFEFF/, "").trim();
      if (!normalized) throw new Error("Вставьте компактный код.");
      if (normalized.length > MAX_COMPACT_TEXT_CHARS) throw new Error("Компактный код превышает безопасный лимит.");
      const firstBreak = normalized.indexOf("\n");
      const header = (firstBreak < 0 ? normalized : normalized.slice(0, firstBreak)).trim();
      if (header !== COMPACT_TEXT_MAGIC) {
        if (/^LAYERLOCK-COMPACT\//i.test(header)) throw new Error("Версия компактного кода не поддерживается.");
        throw new Error("Формат компактного кода не распознан.");
      }
      return parseCompactBytes(base64UrlToBytes(firstBreak < 0 ? "" : normalized.slice(firstBreak + 1)));
    }

    function downloadBlob(bytesOrText, type, name) {
      if (state.lastUrl) URL.revokeObjectURL(state.lastUrl);
      state.lastUrl = URL.createObjectURL(new Blob([bytesOrText], { type }));
      const a = document.createElement("a");
      a.download = name;
      a.href = state.lastUrl;
      a.rel = "noopener";
      a.click();
    }

    function selectedRender() {
      return state.lastRender;
    }

    async function pngBytesFromRender(render) {
      const c = document.createElement("canvas");
      renderSigil(c, render);
      const blob = await new Promise(resolve => c.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Не удалось собрать PNG.");
      return stripPngMetadata(new Uint8Array(await blob.arrayBuffer()));
    }

    function pushU16LE(out, n) {
      out.push(n & 255, (n >>> 8) & 255);
    }

    function pushU32LE(out, n) {
      out.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
    }

    function pushAll(out, bytes) {
      for (const byte of bytes) out.push(byte);
    }

    function dosDateTime(date = new Date()) {
      const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
      const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
      return { time, date: dosDate };
    }

    function makeZip(files) {
      const out = [];
      const central = [];
      const now = dosDateTime();
      let offset = 0;
      for (const file of files) {
        const name = enc.encode(file.name);
        const data = file.data instanceof Uint8Array ? file.data : enc.encode(file.data);
        const crc = crc32(data);
        const local = [];
        pushU32LE(local, 0x04034b50);
        pushU16LE(local, 20);
        pushU16LE(local, 0x0800);
        pushU16LE(local, 0);
        pushU16LE(local, now.time);
        pushU16LE(local, now.date);
        pushU32LE(local, crc);
        pushU32LE(local, data.length);
        pushU32LE(local, data.length);
        pushU16LE(local, name.length);
        pushU16LE(local, 0);
        pushAll(local, name);
        pushAll(local, data);
        pushAll(out, local);

        const head = [];
        pushU32LE(head, 0x02014b50);
        pushU16LE(head, 20);
        pushU16LE(head, 20);
        pushU16LE(head, 0x0800);
        pushU16LE(head, 0);
        pushU16LE(head, now.time);
        pushU16LE(head, now.date);
        pushU32LE(head, crc);
        pushU32LE(head, data.length);
        pushU32LE(head, data.length);
        pushU16LE(head, name.length);
        pushU16LE(head, 0);
        pushU16LE(head, 0);
        pushU16LE(head, 0);
        pushU16LE(head, 0);
        pushU32LE(head, 0);
        pushU32LE(head, offset);
        pushAll(central, head);
        pushAll(central, name);
        offset += local.length;
      }
      const centralOffset = out.length;
      pushAll(out, central);
      pushU32LE(out, 0x06054b50);
      pushU16LE(out, 0);
      pushU16LE(out, 0);
      pushU16LE(out, files.length);
      pushU16LE(out, files.length);
      pushU32LE(out, central.length);
      pushU32LE(out, centralOffset);
      pushU16LE(out, 0);
      return new Uint8Array(out);
    }

    async function sha256Hex(value) {
      const bytes = value instanceof Uint8Array ? value : enc.encode(String(value));
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    async function makeSettingsReport(render, files, generatedAt = new Date()) {
      const kdf = render.kdfProfile || selectedKdfProfile();
      const fec = render.fecProfile || selectedFecProfile();
      const checksums = [];
      for (const file of files) {
        checksums.push(`SHA-256  ${await sha256Hex(file.data)}  ${file.name}`);
      }
      const english = currentLanguage === "en";
      const lines = english ? [
        "LayerLock — container settings",
        "================================",
        `Container format: v${ENVELOPE_VERSION}`,
        `Package format: v${PACK_VERSION}`,
        `Layer format: v${SLOT_VERSION}`,
        `Optical format: ${render.formatLabel}`,
        "Geometry: automatic",
        `Matrix: ${render.moduleWidth || render.grid} x ${render.moduleHeight || render.grid}`,
        `Pixels per module: ${render.scale}`,
        `Image size: ${renderPixelSize(render)} x ${renderPixelSize(render)} px`,
        `Aztec payload size: ${state.lastContainerBytes.length} bytes`,
        `Portable .llc size: ${makeCompactBytes(state.lastContainerBytes, state.lastFecKey).length} bytes`,
        `Compact text encoding: Base64URL`,
        "Color classes: 2",
        "Palette: black / white",
        "KDF: Argon2id + HKDF-SHA-256",
        `KDF memory: ${kdf.memory / 1024} MiB`,
        `KDF passes: ${kdf.iterations}`,
        `KDF parallelism: ${kdf.parallelism}`,
        `Damage recovery: ${translateForLanguage(fec.label || "Custom", "en")}`,
        `Aztec error correction: ${fec.ecLevel || Math.round((fec.ratio || 0) * 100)}%`,
        "Additional outer error correction: none",
        "Text compression: automatic (raw / gzip / deflate)",
        "",
        "Secrets, names, layer count, key-file use, the master key, and layer passwords are intentionally omitted.",
        "Checksums detect accidental changes; authenticated encryption validates the container.",
        "",
        "File checksums",
        "--------------",
        ...checksums,
        ""
      ] : [
        "LayerLock — настройки контейнера",
        "================================",
        `Формат контейнера: v${ENVELOPE_VERSION}`,
        `Формат пакета: v${PACK_VERSION}`,
        `Формат слоя: v${SLOT_VERSION}`,
        `Оптический формат: ${render.formatLabel}`,
        "Геометрия: автоматически",
        `Матрица: ${render.moduleWidth || render.grid} x ${render.moduleHeight || render.grid}`,
        `Пикселей на ячейку: ${render.scale}`,
        `Размер изображения: ${renderPixelSize(render)} x ${renderPixelSize(render)} px`,
        `Размер данных Aztec: ${state.lastContainerBytes.length} байт`,
        `Размер переносимого .llc: ${makeCompactBytes(state.lastContainerBytes, state.lastFecKey).length} байт`,
        `Кодирование компактного TXT: Base64URL`,
        "Цветовых классов: 2",
        "Палитра: черный / белый",
        `KDF: Argon2id + HKDF-SHA-256`,
        `KDF-память: ${kdf.memory / 1024} MiB`,
        `KDF-проходы: ${kdf.iterations}`,
        `KDF-параллелизм: ${kdf.parallelism}`,
        `Восстановление повреждений: ${fec.label || "Пользовательское"}`,
        `Коррекция ошибок Aztec: ${fec.ecLevel || Math.round((fec.ratio || 0) * 100)}%`,
        "Дополнительная внешняя коррекция: отсутствует",
        "Сжатие текста: автоматическое (raw / gzip / deflate)",
        "",
        "Секреты, название, число слоев, использование ключ-файла, мастер-ключ и пароли слоев намеренно не записываются.",
        "Контрольные суммы обнаруживают случайные изменения; подлинность контейнера проверяет аутентифицированное шифрование.",
        "",
        "Контрольные суммы файлов",
        "-------------------------",
        ...checksums,
        ""
      ];
      return lines.join("\n");
    }

    async function buildZipFiles(render, root, stamp, generatedAt = new Date()) {
      const op = operationTicket();
      const files = [
        { name: `${root}/${root}.layerlock.txt`, data: makeCompactText(state.lastContainerBytes, state.lastFecKey) },
        { name: `${root}/${root}.llc`, data: makeCompactBytes(state.lastContainerBytes, state.lastFecKey) }
      ];
      if (render) {
        files.push({ name: `${root}/PNG (${stamp})/${root}.png`, data: await op.wait(pngBytesFromRender(render)) });
        files.push({ name: `${root}/SVG (${stamp})/${root}.svg`, data: makeSvg(render) });
      }
      const meta = render || {...state.lastExportMeta,formatLabel:'None (compact only)',moduleWidth:0,moduleHeight:0,scale:0};
      files.push({ name: `${root}/settings.txt`, data: await op.wait(makeSettingsReport(meta, files, generatedAt)) });
      return files;
    }
