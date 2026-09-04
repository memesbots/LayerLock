    const SLOT_VERSION = 7;
    const PACK_VERSION = 7;
    const ENVELOPE_VERSION = 4;
    const KDF_PROFILES = {
      fast: { label: "Обычная", memory: 32768, iterations: 2, parallelism: 1 },
      normal: { label: "Усиленная", memory: 65536, iterations: 3, parallelism: 1 },
      max: { label: "Максимальная", memory: 131072, iterations: 4, parallelism: 1 },
      ultra: { label: "Экстремальная", memory: 131072, iterations: 6, parallelism: 1 }
    };
    const KDF_ID = 4;
    const KDF_NAME = "Argon2id-v1.3";
    const HKDF_HASH = "SHA-256";
    const HKDF_SALT = new TextEncoder().encode("LayerLock:v7:HKDF-SHA-256");
    const KEY_CONTEXT = {
      slot: "LayerLock:v7:key:slot",
      container: "LayerLock:v7:key:container"
    };
    const FEC_PROFILES = {
      minimal: { label: "Минимальное", ratio: 0.25, ecLevel: 25 },
      standard: { label: "Стандартное", ratio: 0.33, ecLevel: 33 },
      enhanced: { label: "Повышенное", ratio: 0.40, ecLevel: 40 },
      maximum: { label: "Максимальное", ratio: 0.50, ecLevel: 50 }
    };
    const NOTE_RAW = 0;
    const NOTE_GZIP = 1;
    const NOTE_DEFLATE = 2;
    const NOTE_RAW_SIZED = 3;
    const NOTE_GZIP_SIZED = 4;
    const NOTE_DEFLATE_SIZED = 5;
    const COMPACT_TEXT_MAGIC = "LAYERLOCK-COMPACT/2";
    const FEC_PROFILE_KEYS = ["minimal", "standard", "enhanced", "maximum"];
    const KDF_PROFILE_KEYS = ["fast", "normal", "max", "ultra"];
    const MAX_OPTICAL_BYTES = 4096;
    const MAX_CONTAINER_BYTES = 256 * 1024;
    const MAX_COMPACT_TEXT_CHARS = 360 * 1024;
    const MAX_NOTE_BYTES = 1024 * 1024;
    const MAX_IMAGE_FILE_BYTES = 32 * 1024 * 1024;
    const MAX_IMAGE_DIMENSION = 8192;
    const MAX_IMAGE_PIXELS = 32_000_000;
    const KEY_FILE_MAX_BYTES = 16 * 1024 * 1024;
    const KEY_FILE_MIN_BYTES = 16;
    const SENSITIVE_IDLE_MS = 15 * 60 * 1000;
    const enc = new TextEncoder();
    const dec = new TextDecoder("utf-8", { fatal: true });
    const $ = id => document.getElementById(id);
    const state = {
      imageBitmap: null,
      readDecoded: null,
      readDecodePromise: null,
      readPack: null,
      readMeta: null,
      readRender: null,
      lastName: "image.png",
      lastSvgName: "image.svg",
      lastBitsName: "image.layerlock.txt",
      lastRawName: "image.llc",
      lastZipName: "layerlock.zip",
      lastUrl: null,
      lastRender: null,
      lastContainerBytes: null,
      lastFecKey: "standard",
      lastEntries: [],
      lastLayerCount: 0,
      lastMasterKey: "",
      createKeyFileDigest: null,
      pendingGeneratedKeyFileDigest: null,
      readKeyFileDigest: null,
      lastMasterKeyFileDigest: null,
      lastUsedKeyFile: false,
      sensitiveTimer: null,
      lastBaseName: "LayerLock",
      dirty: false,
      verifyCache: new Set(),
      verifyResetTimer: null,
      cameraStream: null,
      cameraLoopToken: 0,
      cameraTimer: null,
      cameraBusy: false,
      cameraStartedAt: 0,
      cameraAccepted: false,
      cameraFrameCounter: 0,
      argon2Worker: null,
      argon2RequestId: 0,
      argon2Pending: new Map()
    };

    const crcTable = (() => {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
      }
      return table;
    })();

    function crc32(bytes) {
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }

    const HAPTIC_PATTERNS = Object.freeze({
      tap: 7,
      selection: 5,
      warning: [14, 34, 8],
      success: [9, 42, 16],
      error: [22, 42, 22]
    });
    let lastHapticAt = 0;
    let lastHapticType = "";

    function haptic(type = "tap") {
      if (document.visibilityState !== "visible") return false;
      if (typeof navigator.vibrate !== "function") return false;
      const pattern = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.tap;
      const now = performance.now();
      const cooldown = type === "tap" ? 45 : (type === "selection" ? 70 : 650);
      if (lastHapticType === type && now - lastHapticAt < cooldown) return false;
      lastHapticAt = now;
      lastHapticType = type;
      try { return navigator.vibrate(pattern); }
      catch (_) { return false; }
    }

    function showToast(message, type = "bad") {
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.textContent = translateForLanguage(message);
      $("toastStack").appendChild(toast);
      haptic(type === "bad" ? "error" : "success");
      setTimeout(() => toast.remove(), type === "bad" ? 5200 : 2800);
    }

    function setStatus(id, message, type = "") {
      const el = $(id);
      el.textContent = translateForLanguage(message);
      el.className = `status ${type}`.trim();
      if (type === "bad") showToast(message, "bad");
    }

    function setStatusHtml(id, html, type = "") {
      const el = $(id);
      el.innerHTML = html;
      localizeTree(el);
      el.className = `status ${type}`.trim();
      if (type === "bad") showToast(el.textContent, "bad");
    }

    function handleError(id, error) {
      if (error?.name === 'AbortError') return;
      setStatus(id, error?.message || String(error), "bad");
    }

    function safeName(name) {
      return (name || "")
        .normalize("NFKC")
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "layerlock";
    }

    function fileStamp(date = new Date()) {
      const pad = n => String(n).padStart(2, "0");
      return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)} ${pad(date.getHours())}꞉${pad(date.getMinutes())}`;
    }

    function formatNumber(n) {
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    function selectedKdfProfile() {
      return KDF_PROFILES[$("kdfProfile").value] || KDF_PROFILES.normal;
    }

    function selectedFecProfile() {
      return FEC_PROFILES[$("fecProfile").value] || FEC_PROFILES.standard;
    }

    function syncKdfNote() {
      const profile = selectedKdfProfile();
      $("kdfNote").textContent = translateForLanguage(`Argon2id + HKDF-SHA-256 · ${profile.memory / 1024} MiB · ${profile.iterations} прохода`);
    }

    function showProgress(message = "Подготовка...", percent = 0) {
      $("progressModal").classList.add("active");
      updateProgress(message, percent);
    }

    function updateProgress(message, percent) {
      $("progressText").textContent = translateForLanguage(message);
      $("progressFill").style.width = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
    }

    function hideProgress() {
      $("progressModal").classList.remove("active");
    }

    function markDirty() {
      state.dirty = true;
    }

    function markSaved() {
      state.dirty = false;
    }

    function verificationKey(render = selectedRender()) {
      if (!render || !state.lastName) return "";
      return `${state.lastName}:aztec:${render.moduleWidth}:${render.moduleHeight}:${render.scale}`;
    }

    async function verifyRenderCached(render = selectedRender()) {
      const op = operationTicket();
      const key = verificationKey(render);
      if (key && state.verifyCache.has(key)) return "cached";
      await verifyRender(render);
      op.check();
      if (key) state.verifyCache.add(key);
      return "fresh";
    }

    function setVerifyButton(mode, detail = "") {
      const btn = $("verifyBtn");
      clearTimeout(state.verifyResetTimer);
      btn.classList.remove("checking", "ok", "bad");
      if (mode === "checking") {
        btn.disabled = true;
        btn.classList.add("checking");
        btn.textContent = translateForLanguage("Проверяю...");
      } else if (mode === "ok") {
        btn.disabled = false;
        btn.classList.add("ok");
        btn.textContent = translateForLanguage(detail ? `Проверено · ${detail}` : "Проверено");
        haptic("success");
      } else if (mode === "bad") {
        btn.disabled = false;
        btn.classList.add("bad");
        btn.textContent = translateForLanguage(detail ? `Не прошло · ${detail}` : "Ошибка проверки");
        haptic("error");
      } else {
        btn.disabled = !state.lastRender;
        btn.textContent = translateForLanguage("Проверить");
      }
    }

    function readStatusTarget() {
      return $("readWorkPane").classList.contains("active") ? "readStatusWork" : "readStatus";
    }

    function randomBytes(n) {
      const b = new Uint8Array(n);
      crypto.getRandomValues(b);
      return b;
    }

    function randomIndex(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 256) throw new Error("invalid random range");
      const limit = Math.floor(256 / maxExclusive) * maxExclusive;
      let value;
      do { value = randomBytes(1)[0]; } while (value >= limit);
      return value % maxExclusive;
    }

    function bytesToHex(bytes) {
      return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    }

    function concatBytes(parts) {
      const n = parts.reduce((a, p) => a + p.length, 0);
      const out = new Uint8Array(n);
      let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      return out;
    }

    function stripPngMetadata(bytes) {
      const sig = [137, 80, 78, 71, 13, 10, 26, 10];
      if (bytes.length < 12 || sig.some((v, i) => bytes[i] !== v)) return bytes;
      const chunks = [bytes.subarray(0, 8)];
      let p = 8;
      while (p + 12 <= bytes.length) {
        const len = new DataView(bytes.buffer, bytes.byteOffset + p, 4).getUint32(0, false);
        const end = p + 12 + len;
        if (end > bytes.length) return bytes;
        const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
        const critical = type[0] >= "A" && type[0] <= "Z";
        if (critical) chunks.push(bytes.subarray(p, end));
        p = end;
        if (type === "IEND") break;
      }
      return concatBytes(chunks);
    }

    function randomHex(bytes = 8) {
      return [...randomBytes(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
    }

    async function compress(bytes, format = "gzip") {
      if (!("CompressionStream" in window)) return bytes;
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function readStreamLimited(stream, maxBytes) {
      const reader = stream.getReader();
      const chunks = [];
      let total = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) throw new Error("Распакованный текст превышает безопасный лимит.");
          chunks.push(new Uint8Array(value));
        }
      } catch (error) {
        try { await reader.cancel(error); } catch (_) {}
        throw error;
      } finally {
        reader.releaseLock();
      }
      return concatBytes(chunks);
    }

    function decompressWithFflate(bytes, format, maxBytes) {
      const Codec = format === "gzip" ? globalThis.fflate?.Gunzip : globalThis.fflate?.Unzlib;
      if (!Codec) throw new Error("Встроенный модуль распаковки недоступен.");
      const chunks = [];
      let total = 0;
      let finished = false;
      const codec = new Codec((chunk, final) => {
        total += chunk.byteLength;
        if (total > maxBytes) throw new Error("Распакованный текст превышает безопасный лимит.");
        chunks.push(chunk.slice());
        finished = final;
      });
      const step = 1024;
      for (let offset = 0; offset < bytes.length; offset += step) {
        const end = Math.min(bytes.length, offset + step);
        codec.push(bytes.subarray(offset, end), end === bytes.length);
      }
      if (!finished) throw new Error("Сжатые данные повреждены или не завершены.");
      return concatBytes(chunks);
    }

    async function decompress(bytes, format = "gzip", maxBytes = MAX_NOTE_BYTES) {
      if (bytes.byteLength > MAX_CONTAINER_BYTES) throw new Error("Сжатые данные превышают безопасный лимит.");
      if ("DecompressionStream" in window) {
        try {
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
          return await readStreamLimited(stream, maxBytes);
        } catch (error) {
          if (/безопасный лимит/i.test(error?.message || "")) throw error;
        }
      }
      return decompressWithFflate(bytes, format, maxBytes);
    }

    async function tryCompress(bytes, format) {
      try {
        if (!("CompressionStream" in window)) return null;
        return await compress(bytes, format);
      } catch (_) {
        return null;
      }
    }

    function normalizeNoteText(note) {
      return String(note).normalize("NFC").replace(/\r\n?/g, "\n");
    }

    function normalizePassword(password) {
      return String(password).normalize("NFKC");
    }

    function passwordIdentity(password) {
      return normalizePassword(password).trim().toLocaleLowerCase("en-US");
    }

    const COMMON_PASSWORDS = new Set([
      "password", "password1", "password123", "123456", "12345678", "123456789",
      "123123", "111111", "000000", "qwerty", "qwerty123", "admin", "letmein",
      "welcome", "iloveyou", "master", "layerlock", "пароль", "пароль123"
    ]);

    function passwordPolicyIssue(password, role = "layer") {
      const normalized = normalizePassword(password);
      if ([...normalized].length < 6) {
        return role === "master"
          ? "Мастер-ключ слишком короткий: используйте не менее 6 символов."
          : "Пароль слоя слишком короткий: используйте не менее 6 символов.";
      }
      return "";
    }

    function isPredictablePassword(password) {
      const identity = passwordIdentity(password);
      const compact = identity.replace(/\s+/g, "");
      const commonToken = /(?:password|qwerty|admin|letmein|welcome|iloveyou|master|layerlock|пароль)/i;
      const sequenceSource = "abcdefghijklmnopqrstuvwxyz0123456789";
      const reverseSequenceSource = [...sequenceSource].reverse().join("");
      const hasSequence = [...compact].some((_, index) => {
        const fragment = compact.slice(index, index + 4);
        return fragment.length === 4 && (sequenceSource.includes(fragment) || reverseSequenceSource.includes(fragment));
      });
      return COMMON_PASSWORDS.has(identity)
        || (/^\d+$/.test(compact) && compact.length < 20)
        || /^(.)\1+$/.test(compact)
        || /^(.{1,12})\1+$/.test(compact)
        || (commonToken.test(compact) && compact.length < 32)
        || hasSequence;
    }

    function wipeBytes(bytes) {
      if (bytes instanceof Uint8Array) bytes.fill(0);
    }

    async function digestKeyFile(file) {
      if (!file) throw new Error("Ключ-файл не выбран.");
      if (file.size < KEY_FILE_MIN_BYTES) throw new Error("Ключ-файл должен содержать не менее 16 байт.");
      if (file.size > KEY_FILE_MAX_BYTES) throw new Error("Ключ-файл слишком большой. Максимум — 16 MiB.");
      const source = new Uint8Array(await file.arrayBuffer());
      try {
        return new Uint8Array(await crypto.subtle.digest("SHA-256", source));
      } finally {
        source.fill(0);
      }
    }

    function closeKeyFileMenu() {
      const menu = $("keyFileMenu");
      const button = $("keyFileMenuBtn");
      if (!menu || !button) return;
      menu.classList.add("hidden");
      button.setAttribute("aria-expanded", "false");
    }

    function toggleKeyFileMenu() {
      const menu = $("keyFileMenu");
      const button = $("keyFileMenuBtn");
      if (!menu || !button) return;
      const opening = menu.classList.contains("hidden");
      menu.classList.toggle("hidden", !opening);
      button.setAttribute("aria-expanded", String(opening));
      if (opening) menu.querySelector("button")?.focus();
    }

    function updateKeyFileUi(kind, active) {
      const create = kind === "create";
      const pending = create && Boolean(state.pendingGeneratedKeyFileDigest);
      const status = $(create ? "masterKeyFileStatus" : "readKeyFileStatus");
      const remove = $(create ? "removeMasterKeyFileBtn" : "removeReadKeyFileBtn");
      status.classList.toggle("active", active);
      status.textContent = pending
        ? "Ключ-файл скачан. Выберите его повторно, чтобы подтвердить сохранение."
        : active
        ? "Ключ-файл подключен. Без него мастер-ключ не сработает."
        : (create
          ? "Опционально: файл становится вторым фактором и не сохраняется в контейнере."
          : "Выберите тот же файл, если он использовался при создании.");
      remove.classList.toggle("hidden", !active && !pending);
      if (create) {
        const button = $("keyFileMenuBtn");
        const label = $("keyFileMenuLabel");
        button?.classList.toggle("active", active);
        if (label) label.textContent = pending ? "Подтвердить ключ-файл" : (active ? "Ключ-файл подключен" : "Добавить ключ-файл");
        closeKeyFileMenu();
      } else {
        $("selectReadKeyFileBtn")?.classList.toggle("active", active);
      }
    }

    const keyFileRevisions = {create:0,read:0};

    function clearKeyFile(kind) {
      keyFileRevisions[kind]++;
      const create = kind === "create";
      const stateKey = create ? "createKeyFileDigest" : "readKeyFileDigest";
      wipeBytes(state[stateKey]);
      state[stateKey] = null;
      if (create) {
        wipeBytes(state.pendingGeneratedKeyFileDigest);
        state.pendingGeneratedKeyFileDigest = null;
      }
      const input = $(create ? "masterKeyFileInput" : "readKeyFileInput");
      if (input) input.value = "";
      updateKeyFileUi(kind, false);
    }

    async function attachKeyFile(kind, file) {
      const op = operationTicket();
      const revision = ++keyFileRevisions[kind];
      const digest = await op.wait(digestKeyFile(file));
      if (revision !== keyFileRevisions[kind]) {
        digest.fill(0);
        throw new DOMException('Key file selection changed','AbortError');
      }
      if (kind === "create" && state.pendingGeneratedKeyFileDigest) {
        let matches = digest.length === state.pendingGeneratedKeyFileDigest.length;
        let difference = 0;
        for (let i = 0; i < digest.length && matches; i++) difference |= digest[i] ^ state.pendingGeneratedKeyFileDigest[i];
        matches = matches && difference === 0;
        if (!matches) {
          digest.fill(0);
          throw new Error("Выбран не тот ключ-файл. Подтвердите только что скачанный файл или отмените операцию.");
        }
        wipeBytes(state.pendingGeneratedKeyFileDigest);
        state.pendingGeneratedKeyFileDigest = null;
      }
      const stateKey = kind === "create" ? "createKeyFileDigest" : "readKeyFileDigest";
      wipeBytes(state[stateKey]);
      state[stateKey] = digest;
      updateKeyFileUi(kind, true);
      showToast("Ключ-файл подключен. Без него мастер-ключ не сработает.", "ok");
    }

    function generateMasterKey() {
      const field = $("masterKey");
      const raw = randomBytes(18);
      try {
        field.value = bytesToBase64Url(raw);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
        showToast("Сгенерирован стойкий мастер-ключ. Сохраните его отдельно.", "ok");
      } finally {
        raw.fill(0);
      }
    }

    async function generateKeyFile() {
      const op = operationTicket();
      const revision = ++keyFileRevisions.create;
      const raw = randomBytes(32);
      try {
        const digest = new Uint8Array(await op.wait(crypto.subtle.digest("SHA-256", raw)));
        if (revision !== keyFileRevisions.create) {
          digest.fill(0);
          throw new DOMException('Key file selection changed','AbortError');
        }
        wipeBytes(state.createKeyFileDigest);
        state.createKeyFileDigest = null;
        wipeBytes(state.pendingGeneratedKeyFileDigest);
        state.pendingGeneratedKeyFileDigest = digest;
        updateKeyFileUi("create", false);
        const name = `${safeName($("vaultName").value || "LayerLock")}.llkey`;
        downloadBlob(raw.slice(), "application/octet-stream", name);
        showToast("Ключ-файл скачан. Повторно выберите его для подтверждения.", "ok");
      } finally {
        raw.fill(0);
      }
    }

    function hasSensitiveValues() {
      const entryHasValue = [...document.querySelectorAll("#entries .entry-pass, #entries .entry-pass-confirm, #entries .entry-text")]
        .some(input => Boolean(input.value));
      return Boolean(
        $("masterKey")?.value
        || $("readPassword")?.value
        || $("readLayerPassword")?.value
        || $("readout")?.textContent
        || entryHasValue
        || state.createKeyFileDigest
        || state.pendingGeneratedKeyFileDigest
        || state.readKeyFileDigest
        || state.lastMasterKey
      );
    }

    function clearSensitiveData(silent = false) {
      cancelOperations();
      stopLiveCamera(true);
      setMakeButtonsState('idle');
      hideProgress();
      $("readBtn").disabled = false;
      clearTimeout(state.sensitiveTimer);
      state.sensitiveTimer = null;
      clearTimeout(capacityTimer);
      capacityRevision++;
      $('capacityStatus').textContent = '';
      for (const input of document.querySelectorAll("#masterKey, #entries .entry-pass, #entries .entry-pass-confirm, #entries .entry-text, #readPassword, #readLayerPassword")) {
        input.value = "";
        input.removeAttribute("aria-invalid");
        if (input.matches(".field-fieldset input")) syncFieldsetValid(input);
      }
      for (const entry of document.querySelectorAll("#entries .entry")) {
        if (entry.classList.contains("master-entry")) updateMatch(entry);
        else updateStrength(entry);
      }
      $("readout").textContent = "";
      $("readWorkPane").classList.remove("has-result");
      state.readPack = null;
      state.readMeta = null;
      state.lastEntries.forEach(entry => {
        entry.password = "";
        entry.text = "";
      });
      state.lastEntries = [];
      state.verifyCache.clear();
      state.lastMasterKey = "";
      wipeBytes(state.lastMasterKeyFileDigest);
      state.lastMasterKeyFileDigest = null;
      clearKeyFile("create");
      clearKeyFile("read");
      if (state.imageBitmap) setReadMasterStage();
      if (!silent) showToast("Секретные поля и расшифрованный результат очищены после 15 минут бездействия.", "ok");
    }

    function touchSensitiveActivity() {
      clearTimeout(state.sensitiveTimer);
      state.sensitiveTimer = setTimeout(() => {
        if (hasSensitiveValues()) clearSensitiveData(false);
      }, SENSITIVE_IDLE_MS);
    }
