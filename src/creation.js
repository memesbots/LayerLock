    async function makeVault(onProgress = () => {}) {
      const op = operationTicket();
      const masterKey = collectMasterKey();
      const entries = collectEntries();
      const capacity = await op.wait(measureCapacity(entries.map(entry=>entry.text)));
      if (capacity.containerBytes > MAX_CONTAINER_BYTES) throw new Error('Контейнер превышает безопасный лимит. Сократите текст или число слоев.');
      const kdfProfile = selectedKdfProfile();
      onProgress(`Подготовка данных · профиль ${kdfProfile.label}`, 5);
      const slots = [];
      const vaultId = randomBytes(16);
      const aadContext = { vaultId, packVersion: PACK_VERSION, kdf: kdfProfile };
      const startedAt = Date.now();
      for (let i = 0; i < entries.length; i++) {
        const done = i;
        const eta = done ? ` · примерно ${Math.max(1, Math.round(((Date.now() - startedAt) / done) * (entries.length - done) / 1000))} сек` : "";
        onProgress(`Укрепляю и шифрую слой ${i + 1}/${entries.length}${eta}`, 10 + (i / entries.length) * 58);
        const e = entries[i];
        slots.push(await op.wait(encryptSlot(e.password, e.text, aadContext, kdfProfile)));
      }
      onProgress("Упаковываю слои", 72);
      for (let i = slots.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }
      const packageBytes = encodePack(slots);
      onProgress("Укрепляю мастер-ключ и закрываю контейнер", 76);
      const containerBytes = await op.wait(encryptContainer(masterKey, packageBytes, vaultId, kdfProfile, state.createKeyFileDigest));
      if (containerBytes.length > MAX_CONTAINER_BYTES) {
        throw new Error("Контейнер превышает безопасный лимит. Сократите текст или число слоев.");
      }
      const fecProfile = selectedFecProfile();
      const fecKey = $("fecProfile").value in FEC_PROFILES ? $("fecProfile").value : "standard";
      onProgress(`Настраиваю коррекцию Aztec · ${fecProfile.label.toLowerCase()}`, 80);
      const opticalBytes = containerBytes;
      const id = randomHex(6);
      const baseName = safeName($("vaultName").value);
      const baseRender = {
        kdfProfile: { ...kdfProfile },
        fecProfile: { ...fecProfile }
      };
      onProgress("Строю Aztec", 82);
      let render = null;
      try { render = await op.wait(createAztecRender(opticalBytes, baseRender)); }
      catch (error) { if (error.code !== 'OPTICAL_CAPACITY') throw error; }
      op.check();
      state.lastRender = render;
      $('outputHeading').textContent = translateForLanguage(render ? 'Изображение' : 'Контейнер');
      state.lastExportMeta = baseRender;
      state.lastContainerBytes = containerBytes.slice();
      state.lastFecKey = fecKey;
      state.lastEntries = entries.map(e => ({ ...e }));
      state.lastLayerCount = entries.length;
      state.lastMasterKey = masterKey;
      wipeBytes(state.lastMasterKeyFileDigest);
      state.lastMasterKeyFileDigest = state.createKeyFileDigest?.slice() || null;
      state.lastUsedKeyFile = Boolean(state.createKeyFileDigest);
      state.lastBaseName = baseName;
      state.lastName = `${baseName}-${id}.png`;
      state.lastSvgName = `${baseName}-${id}.svg`;
      state.lastBitsName = `${baseName}-${id}.layerlock.txt`;
      state.lastRawName = `${baseName}-${id}.llc`;
      state.lastZipName = `${baseName}-${id}.zip`;
      state.verifyCache.clear();
      onProgress("Рисую изображение", 86);
      if (render) renderSigil($("canvas"), render);
      $("canvas").closest(".canvas-box").classList.toggle('hidden', !render);
      $("makeView").classList.add("has-output");
      $("makePreviewPane").classList.remove("hidden");
      $("canvas").closest(".canvas-box").classList.add("has-image");
      onProgress('Проверяю контейнер', 90);
      $("downloadPngBtn").disabled = !render;
      $("downloadSvgBtn").disabled = !render;
      $("downloadBitsBtn").disabled = false;
      $("downloadRawBtn").disabled = false;
      $("downloadZipBtn").disabled = false;
      $("printBtn").disabled = !render;
      $("verifyBtn").disabled = !render;
      $("expandMakeImageBtn").disabled = !render;
      setVerifyButton("idle");
      onProgress('Контейнер создан', 92);
      if (!render) {
        setStatus('makeStatus', currentLanguage === 'en'
          ? `Container: ${containerBytes.length} bytes. Too large for one Aztec. RAW, TXT and ZIP are available.`
          : `Контейнер: ${containerBytes.length} байт. Не помещается в один Aztec. Доступны RAW, TXT и ZIP.`, 'ok');
        return;
      }
      const px = renderPixelSize(state.lastRender);
      setStatusHtml("makeStatus", `<strong>Детали:</strong> ${opticalBytes.length} байт, ${entries.length} слой(я), ${state.lastRender.formatLabel}, матрица ${state.lastRender.moduleWidth} x ${state.lastRender.moduleHeight}, изображение ${px} x ${px}.`, "ok");
    }

    async function verifyGeneratedVault() {
      if (!state.lastRender) throw new Error("Сначала создайте изображение.");
      if (!state.lastEntries.length) throw new Error("Нет заполненных слоев для проверки.");
      await verifyRender(state.lastRender, state.lastEntries);
    }

    async function verifyCompactExport() {
      if (!state.lastContainerBytes) throw new Error('Сначала создайте изображение.');
      if (!state.lastMasterKey || !state.lastEntries.length) throw new Error('Секретные поля очищены. Создайте контейнер заново.');
      await verifyContainerBody(decodeBody(state.lastContainerBytes));
    }

    async function verifyCanvas(canvas, entries = state.lastEntries, masterKey = state.lastMasterKey, keyFileDigest = state.lastMasterKeyFileDigest) {
      const op = operationTicket();
      const decoded = await decodePackageFromCanvas(canvas);
      op.check();
      const { body } = decoded;
      return verifyContainerBody(body, entries, masterKey, keyFileDigest);
    }

    async function verifyContainerBody(body, entries = state.lastEntries, masterKey = state.lastMasterKey, keyFileDigest = state.lastMasterKeyFileDigest) {
      const op = operationTicket();
      const pack = await packFromBody(body, masterKey, keyFileDigest);
      op.check();
      const aadContext = { vaultId: pack.u, packVersion: pack.v, kdf: pack.q };
      for (const entry of entries) {
        let ok = false;
        for (const slot of pack.p) {
          try {
            if (await decryptSlot(entry.password, slot, aadContext, pack.q) === normalizeNoteText(entry.text)) {
              ok = true;
              break;
            }
          } catch (error) { rethrowCancellation(error); }
        }
        if (!ok) throw new Error("Проверка не прошла: один из слоев не открылся.");
      }
    }

    async function verifyRender(render, entries = state.lastEntries, masterKey = state.lastMasterKey, keyFileDigest = state.lastMasterKeyFileDigest) {
      if (!render) throw new Error("Сначала создайте изображение.");
      const canvas = document.createElement("canvas");
      renderSigil(canvas, render);
      await verifyCanvas(canvas, entries, masterKey, keyFileDigest);
    }

    function makeDegradedRender(render, kind) {
      const source = document.createElement("canvas");
      renderSigil(source, render);
      if (kind === "scaled") {
        const small = document.createElement("canvas");
        small.width = Math.max(96, Math.round(source.width * .68));
        small.height = small.width;
        const smallCtx = small.getContext("2d", { willReadFrequently: true });
        smallCtx.imageSmoothingEnabled = true;
        smallCtx.drawImage(source, 0, 0, small.width, small.height);
        const restored = document.createElement("canvas");
        restored.width = source.width;
        restored.height = source.height;
        const restoredCtx = restored.getContext("2d", { willReadFrequently: true });
        restoredCtx.imageSmoothingEnabled = true;
        restoredCtx.drawImage(small, 0, 0, restored.width, restored.height);
        return restored;
      }
      const faded = document.createElement("canvas");
      faded.width = source.width;
      faded.height = source.height;
      const ctx = faded.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0);
      const image = ctx.getImageData(0, 0, faded.width, faded.height);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = 22 + image.data[i] * .82;
        image.data[i + 1] = 22 + image.data[i + 1] * .82;
        image.data[i + 2] = 22 + image.data[i + 2] * .82;
      }
      ctx.putImageData(image, 0, 0);
      return faded;
    }

    async function stressTestRender(render) {
      const op = operationTicket();
      const total = 3;
      let passed = 0;
      await verifyRender(render);
      op.check();
      passed++;
      for (const kind of ["scaled", "faded"]) {
        try {
          await verifyCanvas(makeDegradedRender(render, kind));
          passed++;
        } catch (error) { rethrowCancellation(error); }
        op.check();
      }
      if (passed !== total) {
        const error = new Error(`${render.formatLabel} прошел ${passed} из ${total} сценариев качества.`);
        error.verificationScore = `${passed}/${total}`;
        throw error;
      }
      return { passed, total };
    }

    async function verifyAllVariants() {
      if (!state.lastRender) throw new Error("Сначала создайте изображение.");
      await verifyRenderCached(state.lastRender);
    }
