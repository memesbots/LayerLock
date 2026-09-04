    async function decodeReadImage() {
      const op = operationTicket();
      if (state.readDecoded) return state.readDecoded;
      if (state.readDecodePromise) return state.readDecodePromise;
      if (!state.imageBitmap) throw new Error("Сначала загрузите изображение.");
      const canvas = $("readCanvas");
      canvas.width = state.imageBitmap.width;
      canvas.height = state.imageBitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(state.imageBitmap, 0, 0);
      const task = decodePackageFromCanvas(canvas)
        .then(result => {
          op.check();
          state.readDecoded = result;
          return result;
        })
        .finally(() => { if (state.readDecodePromise === task) state.readDecodePromise = null; });
      state.readDecodePromise = task;
      return task;
    }

    function setReadMasterStage() {
      state.readPack = null;
      state.readMeta = null;
      clearKeyFile("read");
      $("selectReadKeyFileBtn").disabled = false;
      $("removeReadKeyFileBtn").disabled = false;
      $("readMasterField").classList.remove("is-ok");
      $("readLayerField").classList.remove("is-ok");
      $("readLayerField").classList.add("hidden");
      $("readBtn").textContent = "Открыть контейнер";
      $("readPassword").value = "";
      $("readPassword").readOnly = false;
      $("readLayerPassword").value = "";
      syncFieldsetValid($("readPassword"));
      syncFieldsetValid($("readLayerPassword"));
    }

    function setReadLayerStage(meta) {
      state.readMeta = meta || state.readMeta;
      $("readMasterField").classList.add("is-ok");
      $("readLayerField").classList.remove("is-ok");
      $("readLayerField").classList.remove("hidden");
      $("readBtn").textContent = "Расшифровать";
      $("readPassword").readOnly = true;
      $("selectReadKeyFileBtn").disabled = true;
      $("removeReadKeyFileBtn").disabled = true;
      $("readLayerPassword").value = "";
      syncFieldsetValid($("readPassword"));
      syncFieldsetValid($("readLayerPassword"));
      $("readLayerPassword").focus();
    }

    async function readVault() {
      const op = operationTicket();
      if (!state.imageBitmap && !state.readDecoded) throw new Error("Сначала загрузите изображение.");
      const password = $("readPassword").value;
      const decoded = await op.wait(decodeReadImage());
      const { body, formatLabel, orientation } = decoded;
      const meta = { formatLabel, orientation };
      let pack = state.readPack;
      if (!pack) {
        if (!password) throw new Error("Введите мастер-ключ.");
        try {
          pack = await op.wait(decryptContainer(password, body.envelope, state.readKeyFileDigest));
        } catch (error) {
          rethrowCancellation(error);
          throw new Error("Мастер-ключ не подошел.");
        }
        state.readPack = pack;
        setReadLayerStage(meta);
        haptic("selection");
        $("readout").textContent = "";
        $("readWorkPane").classList.remove("has-result");
        setStatus("readStatusWork", "Контейнер открыт. Введите пароль слоя.", "ok");
        return;
      }

      const layerPassword = $("readLayerPassword").value;
      $("readLayerField").classList.remove("is-ok");
      if (!layerPassword) throw new Error("Введите пароль слоя.");
      const aadContext = { vaultId: pack.u, packVersion: pack.v, kdf: pack.q };
      for (const slot of pack.p) {
        try {
          const text = await op.wait(decryptSlot(layerPassword, slot, aadContext, pack.q));
          $("readout").textContent = text;
          $("readWorkPane").classList.add("has-result");
          $("readLayerField").classList.add("is-ok");
          setStatus("readStatusWork", "Слой открыт.", "ok");
          haptic("success");
          return;
        } catch (error) { rethrowCancellation(error); }
      }
      throw new Error("Контейнер найден, но этот пароль не открыл ни один слой.");
    }

    function setReadScanning(active, label = "Ищу контейнер") {
      const wrap = document.querySelector(".read-image-wrap");
      wrap?.classList.toggle("is-scanning", active);
      const text = $("readScanIndicator")?.querySelector("span:last-child");
      if (text) text.textContent = translateForLanguage(label);
    }

    function announceDecodedImage(decoded, elapsedMs) {
      const ms = Math.max(1, Math.round(elapsedMs || decoded.scanMs || 1));
      const time = ms < 1000 ? `${ms} мс` : `${(ms / 1000).toFixed(1)} с`;
      setStatus("readStatusWork", `Контейнер найден за ${time}. Введите мастер-ключ.`, "ok");
    }

    function isSvgFile(file) {
      const name = String(file?.name || "").toLowerCase();
      return file?.type === "image/svg+xml" || name.endsWith(".svg");
    }

    function isCompactFile(file) {
      const name = String(file?.name || "").toLowerCase();
      return name.endsWith(".llc") || name.endsWith(".txt");
    }

    function validateImageDimensions(width, height) {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new Error("Изображение не содержит корректного размера.");
      }
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
        throw new Error("Изображение слишком большое для безопасной обработки.");
      }
    }

    async function readRasterDimensions(file) {
      if (!file || isSvgFile(file)) return null;
      const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
      }
      if (bytes.length >= 10 && String.fromCharCode(...bytes.subarray(0, 6)).startsWith("GIF8")) {
        return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
      }
      if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 8 < bytes.length) {
          if (bytes[offset] !== 0xff) { offset++; continue; }
          const marker = bytes[offset + 1];
          offset += 2;
          if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
          if (offset + 2 > bytes.length) break;
          const size = view.getUint16(offset, false);
          if (size < 2 || offset + size > bytes.length) break;
          if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            return { height: view.getUint16(offset + 3, false), width: view.getUint16(offset + 5, false) };
          }
          offset += size;
        }
      }
      return null;
    }

    async function rasterizeSvgFile(file) {
      if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error("Файл изображения превышает безопасный лимит.");
      const source = await file.text();
      if (!/^\s*(?:<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(source)) {
        throw new Error("Файл SVG не распознан.");
      }
      if (/<!DOCTYPE|<!ENTITY|<(?:script|foreignObject|image|use|style|link|iframe|object|embed|animate|set)\b|\son[a-z]+\s*=|\b(?:href|src)\s*=|url\s*\(/i.test(source)) {
        throw new Error("SVG содержит неподдерживаемое активное содержимое.");
      }

      const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
      try {
        const image = new Image();
        image.decoding = "async";
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("Не удалось открыть SVG."));
          image.src = url;
        });

        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        validateImageDimensions(width, height);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, width, height);
        return canvas;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    async function decodeImageFile(file) {
      if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error("Файл изображения превышает безопасный лимит.");
      const dimensions = await readRasterDimensions(file);
      if (dimensions) validateImageDimensions(dimensions.width, dimensions.height);
      try {
        const bitmap = await createImageBitmap(file);
        try {
          validateImageDimensions(bitmap.width, bitmap.height);
          return bitmap;
        } catch (error) {
          bitmap.close?.();
          throw error;
        }
      } catch (error) {
        if (!isSvgFile(file)) throw error;
        return rasterizeSvgFile(file);
      }
    }

    async function activateReadImageSource(imageSource, decodedHint = null, restoredRender = null) {
      const op = operationTicket();
      state.readDecoded = decodedHint;
      state.readDecodePromise = null;
      state.readRender = restoredRender;
      setReadMasterStage();
      state.imageBitmap = imageSource;
      const canvas = $("readCanvas");
      canvas.width = state.imageBitmap?.width || 1;
      canvas.height = state.imageBitmap?.height || 1;
      if (state.imageBitmap) canvas.getContext("2d", { willReadFrequently: true }).drawImage(state.imageBitmap, 0, 0);
      document.querySelector('.read-image-wrap').classList.toggle('hidden', !imageSource);
      $('readWorkPane').classList.toggle('compact-only', !imageSource);
      $('resetCompactBtn').classList.toggle('hidden', Boolean(imageSource));
      canvas.closest(".canvas-box").classList.add("has-image");
      $("readDropPane").closest(".read-panel").classList.add("hidden");
      $("readDropPane").classList.add("hidden");
      $("readWorkPane").classList.add("active");
      $("replaceImageBtn").classList.remove("hidden");
      $("expandReadImageBtn").classList.remove("hidden");
      $("downloadReadSvgBtn").classList.toggle("hidden", !restoredRender);
      $("readWorkPane").classList.remove("has-result");
      $("readout").textContent = "";
      setStatus("readStatusWork", "Изображение загружено. Ищу контейнер...");
      setReadScanning(true);
      $("readPassword").focus();
      const start = Date.now();
      if (decodedHint) {
        requestAnimationFrame(() => {
          if (!op.current()) return;
          announceDecodedImage(decodedHint, decodedHint.scanMs || (Date.now() - start));
          setReadScanning(false);
        });
        return;
      }
      setTimeout(() => {
        if (!op.current()) return;
        decodeReadImage()
          .then(decoded => { if (op.current()) announceDecodedImage(decoded, decoded.scanMs || (Date.now() - start)); })
          .catch(e => { if (op.current()) handleError("readStatusWork", e); })
          .finally(() => { if (op.current()) setReadScanning(false); });
      }, 30);
    }

    async function loadImageFile(file, decodedHint = null) {
      cancelOperations();
      const op = operationTicket();
      if (!file || (!file.type.startsWith("image/") && !isSvgFile(file))) {
        throw new Error("Нужен файл изображения.");
      }
      await activateReadImageSource(await op.wait(decodeImageFile(file)), decodedHint, null);
    }

    async function loadCompactContainer(compact, op = operationTicket()) {
      op.check();
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      const body = decodeBody(compact.containerBytes);
      let render = null;
      try { render = await op.wait(createAztecRender(compact.containerBytes, { fecProfile: { ...compact.fecProfile } })); }
      catch (error) { if (error.code !== 'OPTICAL_CAPACITY') throw error; }
      const canvas = render ? document.createElement("canvas") : null;
      if (render) renderSigil(canvas, render);
      const decoded = {
        body,
        transport: "compact",
        formatLabel: "Aztec",
        orientation: 0,
        position: null,
        scanPath: "compact-v2",
        scanCandidates: 1,
        scanMs: (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt
      };
      await activateReadImageSource(canvas, decoded, render);
      showToast("Компактный контейнер восстановлен.", "ok");
    }

    async function loadCompactContainerText(source) {
      cancelOperations();
      return loadCompactContainer(parseCompactText(source));
    }

    async function loadCompactContainerFile(file) {
      cancelOperations();
      const op = operationTicket();
      const name = String(file?.name || "").toLowerCase();
      if (name.endsWith(".llc") && file.size > MAX_CONTAINER_BYTES + 32) throw new Error("Компактный контейнер превышает безопасный лимит.");
      if (!name.endsWith(".llc") && file.size > MAX_COMPACT_TEXT_CHARS) throw new Error("Компактный код превышает безопасный лимит.");
      if (name.endsWith(".llc")) return loadCompactContainer(parseCompactBytes(new Uint8Array(await op.wait(file.arrayBuffer()))), op);
      return loadCompactContainer(parseCompactText(await op.wait(file.text())), op);
    }

    function updateCameraMeter(count = 0) {
      const ready = Math.min(3, count);
      [...$("cameraFrameMeter").children].forEach((dot, index) => dot.classList.toggle("ready", index < ready));
    }

    function createCameraHintGate() {
      let current = null;
      let candidate = null;
      let changedAt = -Infinity;
      return (message, stage, now, immediate = false) => {
        const same = item => item?.message === message && item.stage === stage;
        if (same(current)) { candidate = null; return false; }
        if (!immediate) {
          if (!same(candidate)) candidate = { message, stage, since: now };
          if (now - candidate.since < 900 || now - changedAt < 2000) return false;
        }
        current = { message, stage };
        candidate = null;
        changedAt = now;
        return true;
      };
    }

    let cameraHintGate = createCameraHintGate();

    function setCameraStatus(message, stage = 0, immediate = true) {
      if (!cameraHintGate(message, stage, performance.now(), immediate)) return;
      const translated = translateForLanguage(message);
      if ($("cameraLiveStatus").textContent !== translated) $("cameraLiveStatus").textContent = translated;
      updateCameraMeter(stage);
    }

    function stopLiveCamera(closeModal = true) {
      cameraHintGate = createCameraHintGate();
      state.cameraLoopToken++;
      clearTimeout(state.cameraTimer);
      state.cameraTimer = null;
      state.cameraBusy = false;
      state.cameraFrameCounter = 0;
      if (state.cameraStream) {
        for (const track of state.cameraStream.getTracks()) track.stop();
      }
      state.cameraStream = null;
      updateCameraMeter(0);
      const video = $("cameraVideo");
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
      if (closeModal) {
        $("cameraModal").classList.remove("active");
        $("cameraModal").setAttribute("aria-hidden", "true");
      }
    }

    function openSystemCamera() {
      stopLiveCamera(true);
      setReadSource("camera");
      $("cameraIn").value = "";
      $("cameraIn").click();
    }

    function captureCameraFrame() {
      const video = $("cameraVideo");
      if (!video.videoWidth || !video.videoHeight) return null;
      const maxSide = 720;
      const ratio = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = $("cameraFrameCanvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
      canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    function cropCanvas(source, sx, sy, sw, sh) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    function centeredCameraRegion(frame, fraction = .82) {
      const side = Math.min(frame.width, frame.height) * fraction;
      return {
        sx: (frame.width - side) / 2,
        sy: (frame.height - side) / 2,
        side
      };
    }

    function assessCameraQuality(source) {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const lum = new Float32Array(size * size);
      let sum = 0, squareSum = 0;
      for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
        const value = data[p] * .2126 + data[p + 1] * .7152 + data[p + 2] * .0722;
        lum[i] = value;
        sum += value;
        squareSum += value * value;
      }
      const mean = sum / lum.length;
      const contrast = Math.sqrt(Math.max(0, squareSum / lum.length - mean * mean));
      let edge = 0, samples = 0;
      for (let y = 1; y < size - 1; y += 2) {
        for (let x = 1; x < size - 1; x += 2) {
          const i = y * size + x;
          edge += Math.abs(lum[i] * 4 - lum[i - 1] - lum[i + 1] - lum[i - size] - lum[i + size]);
          samples++;
        }
      }
      const sharpness = edge / Math.max(1, samples);
      if (mean < 22) return { blocked: true, message: "Слишком темно · добавьте света" };
      if (mean > 238) return { blocked: true, message: "Слишком ярко · уберите блик" };
      if (contrast < 13) return { blocked: true, message: "Недостаточно контраста · поднесите камеру ближе" };
      if (sharpness < 7) return { blocked: true, message: "Кадр размыт · зафиксируйте телефон" };
      return { blocked: false, message: "Качество кадра подходит" };
    }

    async function decodeCameraRegion(frame, region, fast = true) {
      const crop = cropCanvas(frame, region.sx, region.sy, region.side, region.side);
      return { decoded: await tryDecodeAztec(crop, fast), candidate: crop };
    }

    async function canvasBlob(canvas) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Не удалось сохранить кадр камеры.");
      return blob;
    }

    async function acceptCameraCandidate(canvas, decoded) {
      const token = state.cameraLoopToken;
      if (state.cameraAccepted) return;
      state.cameraAccepted = true;
      $("cameraGuide").classList.remove("scanning");
      setCameraStatus("Контейнер найден", 3);
      haptic("success");
      const result = {
        ...decoded,
        scanPath: "camera-scanner3",
        scanCandidates: 1,
        scanMs: Math.max(1, performance.now() - state.cameraStartedAt)
      };
      let blob;
      try {
        blob = await canvasBlob(canvas);
        if (token !== state.cameraLoopToken) return;
      } catch (error) {
        state.cameraAccepted = false;
        $("cameraGuide").classList.add("scanning");
        setCameraStatus("Не удалось сохранить кадр. Попробуйте ещё раз");
        throw error;
      }
      stopLiveCamera(true);
      await loadImageFile(blob, result);
    }

    function scheduleCameraScan(token, delay = 90) {
      clearTimeout(state.cameraTimer);
      state.cameraTimer = setTimeout(() => {
        state.cameraTimer = null;
        if (token === state.cameraLoopToken && !state.cameraAccepted) scanCameraFrame(token).catch(() => {});
      }, delay);
    }

    async function scanCameraFrame(token, force = false) {
      if (token !== state.cameraLoopToken || state.cameraAccepted || state.cameraBusy) return;
      const frame = captureCameraFrame();
      if (!frame) {
        scheduleCameraScan(token, 120);
        return;
      }
      state.cameraBusy = true;
      try {
        state.cameraFrameCounter++;
        const quality = assessCameraQuality(frame);
        setCameraStatus(quality.blocked ? quality.message : "Наведите рамку на контейнер", quality.blocked ? 0 : 1, false);
        if (quality.blocked && !force && state.cameraFrameCounter % 3 !== 0) return;

        const direct = await tryDecodeAztec(frame, !force);
        if (token !== state.cameraLoopToken) return;
        if (direct) {
          await acceptCameraCandidate(frame, direct);
          return;
        }

        const fractions = force ? [.66, .82] : [.82];
        for (const fraction of fractions) {
          const result = await decodeCameraRegion(frame, centeredCameraRegion(frame, fraction), !force);
          if (token !== state.cameraLoopToken) return;
          if (result.decoded) {
            await acceptCameraCandidate(result.candidate, result.decoded);
            return;
          }
        }
      } finally {
        if (token === state.cameraLoopToken) state.cameraBusy = false;
        if (token === state.cameraLoopToken && !state.cameraAccepted) scheduleCameraScan(token, force ? 150 : 90);
      }
    }

    async function openLiveCamera() {
      setReadSource("camera");
      stopLiveCamera(true);
      state.cameraAccepted = false;
      state.cameraStartedAt = performance.now();
      updateCameraMeter(0);
      $("cameraGuide").classList.add("scanning");
      $("cameraModal").classList.add("active");
      $("cameraModal").setAttribute("aria-hidden", "false");
      setCameraStatus("Запрашиваю доступ к камере...");
      const requestToken = ++state.cameraLoopToken;
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        showToast("Live-камера недоступна. Открываю системную камеру.", "bad");
        openSystemCamera();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        if (requestToken !== state.cameraLoopToken) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        state.cameraStream = stream;
        const video = $("cameraVideo");
        video.srcObject = stream;
        await video.play();
        setCameraStatus("Наведите рамку на контейнер");
        scheduleCameraScan(requestToken, 80);
      } catch (_) {
        if (requestToken !== state.cameraLoopToken) return;
        showToast("Камера недоступна. Открываю системный снимок.", "bad");
        openSystemCamera();
      }
    }

    function resetReadImageFlow() {
      cancelOperations();
      $("readBtn").disabled = false;
      stopLiveCamera(true);
      state.imageBitmap = null;
      state.readDecoded = null;
      state.readDecodePromise = null;
      state.readRender = null;
      setReadMasterStage();
      const canvas = $("readCanvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.closest(".canvas-box").classList.remove("has-image");
      $("readout").textContent = "";
      $("readWorkPane").classList.remove("active", "has-result");
      $("readWorkPane").classList.remove("is-reading");
      $("readDropPane").closest(".read-panel").classList.remove("hidden");
      $("readDropPane").classList.remove("hidden");
      $("replaceImageBtn").classList.add("hidden");
      $("expandReadImageBtn").classList.add("hidden");
      $("downloadReadSvgBtn").classList.add("hidden");
      $("readStatus").classList.add("hidden");
      $("readStatus").textContent = "";
      $("readStatusWork").textContent = "Введите мастер-ключ.";
      $("readStatusWork").className = "status";
      setReadScanning(false);
      $("fileIn").value = "";
      $("cameraIn").value = "";
      $("bitCodeInput").value = "";
      setReadSource("file");
      requestAnimationFrame(() => $("dropZone").focus());
    }

    function openReadImageModal() {
      if (!state.imageBitmap) return;
      const canvas = $("modalCanvas");
      canvas.width = state.imageBitmap.width;
      canvas.height = state.imageBitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(state.imageBitmap, 0, 0);
      canvas.style.imageRendering = "pixelated";
      canvas.closest(".canvas-box").classList.add("has-image");
      $("imageModal").classList.add("active");
      $("imageModal").setAttribute("aria-hidden", "false");
    }

    function openGeneratedImageModal() {
      const render = selectedRender();
      if (!render) return;
      const canvas = $("modalCanvas");
      renderSigil(canvas, render);
      canvas.style.imageRendering = "pixelated";
      canvas.closest(".canvas-box").classList.add("has-image");
      $("imageModal").classList.add("active");
      $("imageModal").setAttribute("aria-hidden", "false");
    }

    function closeReadImageModal() {
      $("imageModal").classList.remove("active");
      $("imageModal").setAttribute("aria-hidden", "true");
    }

    function setReadSource(source) {
      const camera = source === "camera";
      const bits = source === "bits";
      document.querySelector(".read-source-switch").style.setProperty("--source-progress", bits ? 2 : (camera ? 1 : 0));
      $("cameraSourceBtn").classList.toggle("active", camera);
      $("bitsSourceBtn").classList.toggle("active", bits);
      $("uploadSourceBtn").classList.toggle("active", !camera && !bits);
      $("dropZone").classList.toggle("hidden", bits);
      $("bitImportPane").classList.toggle("hidden", !bits);
      $("dropZone").classList.toggle("camera-mode", camera);
      $("dropZone").setAttribute("aria-label", camera ? "Сканировать камерой" : "Загрузить PNG");
      $("dropTitle").textContent = camera ? "Сканируйте камерой" : "Отправьте изображение";
      $("dropHint").textContent = camera
        ? "Наведите камеру на изображение или нажмите сюда, чтобы открыть камеру."
        : "Или нажмите, выберите файл, либо вставьте через Ctrl+V.";
    }

    async function loadClipboardImage() {
      if (!navigator.clipboard?.read) throw new Error("Браузер не дал доступ к изображению в буфере.");
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (!type) continue;
        await loadImageFile(await item.getType(type));
        return;
      }
      throw new Error("В буфере нет изображения.");
    }

    function switchTab(name) {
      const make = name === "make";
      if (make) stopLiveCamera(true);
      $("views").style.transition = "";
      $("views").style.transform = "";
      $("makeView").classList.toggle("active", make);
      $("readView").classList.toggle("active", !make);
      $("views").classList.toggle("read-active", !make);
      document.body.classList.toggle("read-mode", !make);
      $("tabMake").classList.toggle("active", make);
      $("tabRead").classList.toggle("active", !make);
      document.querySelector(".tabs").style.setProperty("--tab-progress", make ? 0 : 1);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }

    function applyTheme(light) {
      document.body.classList.toggle("light", light);
      $("themeToggle").title = light ? "Темная тема" : "Светлая тема";
      $("themeToggle").setAttribute("aria-label", $("themeToggle").title);
      $("themeLabel").textContent = light ? "Темная" : "Светлая";
    }
