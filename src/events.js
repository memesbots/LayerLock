    $("tabMake").addEventListener("click", () => switchTab("make"));
    $("tabRead").addEventListener("click", () => switchTab("read"));
    $("addEntry").addEventListener("click", () => makeEntry(false));
    $("readLayerPassword").addEventListener("input", () => $("readLayerField").classList.remove("is-ok"));
    $("clearAll").addEventListener("click", () => {
      if (!localizedConfirm("Очистить все слои, название и сгенерированное изображение?")) return;
      clearSensitiveData(true);
      haptic("warning");
      $("entries").textContent = "";
      makeEntry(true);
      $("vaultName").value = "";
      $("masterKey").value = "";
      updateMatch(document.querySelector(".master-entry"));
      syncFieldsetValid($("masterKey"));
      state.lastRender = null;
      state.lastContainerBytes = null;
      state.lastEntries = [];
      state.lastLayerCount = 0;
      state.lastMasterKey = "";
      state.lastUsedKeyFile = false;
      wipeBytes(state.lastMasterKeyFileDigest);
      state.lastMasterKeyFileDigest = null;
      clearKeyFile("create");
      $("canvas").closest(".canvas-box").classList.remove("has-image");
      $("makeView").classList.remove("has-output");
      $("makePreviewPane").classList.add("hidden");
      $("downloadPngBtn").disabled = true;
      $("downloadSvgBtn").disabled = true;
      $("downloadBitsBtn").disabled = true;
      $("downloadRawBtn").disabled = true;
      $("downloadZipBtn").disabled = true;
      $("printBtn").disabled = true;
      $("verifyBtn").disabled = true;
      $("expandMakeImageBtn").disabled = true;
      setStatus("makeStatus", "Изображение еще не создано.");
      markSaved();
    });
    $("themeToggle").addEventListener("click", () => {
      const light = !document.body.classList.contains("light");
      applyTheme(light);
      try { localStorage.setItem("layerlock-theme", light ? "light" : "dark"); } catch (_) {}
    });
    $("languageToggle").addEventListener("click", () => {
      applyLanguage(currentLanguage === "en" ? "ru" : "en");
      syncKdfNote();
      syncFecLevel();
      syncSettingsSummary();
      applyTheme(document.body.classList.contains("light"));
    });
    document.addEventListener("pointerup", ev => {
      const button = ev.target.closest("button");
      if (!button || button.disabled || button.id === "clearAll") return;
      const selection = button.matches(".tab, .info-tabs button, .read-source-switch button, .theme-toggle, .language-toggle");
      haptic(selection ? "selection" : "tap");
    }, { passive: true });
    document.addEventListener("input", ev => {
      if (ev.target.closest("#makeView")) markDirty();
    });
    document.addEventListener("change", ev => {
      if (ev.target.closest("#makeView")) markDirty();
    });
    window.addEventListener("beforeunload", ev => {
      if (!state.dirty) return;
      ev.preventDefault();
      ev.returnValue = "";
    });
    for (const eventName of ["pointerdown", "keydown", "input", "change"]) {
      document.addEventListener(eventName, touchSensitiveActivity, { passive: true });
    }
    window.addEventListener("pagehide", () => clearSensitiveData(true));
    window.addEventListener("pageshow", ev => {
      if (ev.persisted) clearSensitiveData(true);
      touchSensitiveActivity();
    });
    document.addEventListener("click", ev => {
      const btn = ev.target.closest(".password-toggle");
      if (!btn) return;
      const field = btn.dataset.target ? $(btn.dataset.target) : btn.parentElement.querySelector("input");
      if (!field) return;
      const hidden = field.type === "password";
      field.type = hidden ? "text" : "password";
      btn.title = hidden ? "Скрыть пароль" : "Показать пароль";
      btn.setAttribute("aria-label", btn.title);
      btn.classList.toggle("active", hidden);
    });
    $("masterKey").addEventListener("input", () => {
      updateMatch(document.querySelector(".master-entry"));
      syncDuplicatePasswords();
    });
    $("generateMasterKeyBtn").addEventListener("click", generateMasterKey);
    $("keyFileMenuBtn").addEventListener("click", () => {
      if (state.pendingGeneratedKeyFileDigest) {
        closeKeyFileMenu();
        $("masterKeyFileInput").click();
        return;
      }
      toggleKeyFileMenu();
    });
    $("generateKeyFileBtn").addEventListener("click", async () => {
      closeKeyFileMenu();
      try { await generateKeyFile(); }
      catch (error) { handleError('makeStatus', error); }
    });
    $("selectMasterKeyFileBtn").addEventListener("click", () => {
      closeKeyFileMenu();
      $("masterKeyFileInput").click();
    });
    $("selectReadKeyFileBtn").addEventListener("click", () => $("readKeyFileInput").click());
    $("removeMasterKeyFileBtn").addEventListener("click", () => clearKeyFile("create"));
    $("removeReadKeyFileBtn").addEventListener("click", () => clearKeyFile("read"));
    document.addEventListener("click", event => {
      if (!event.target.closest(".keyfile-control")) closeKeyFileMenu();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeKeyFileMenu();
    });
    $("masterKeyFileInput").addEventListener("change", async ev => {
      try { await attachKeyFile("create", ev.target.files?.[0]); }
      catch (error) { if (error.name !== 'AbortError') { ev.target.value = ""; showToast(error.message, "bad"); } }
    });
    $("readKeyFileInput").addEventListener("change", async ev => {
      try { await attachKeyFile("read", ev.target.files?.[0]); }
      catch (error) { if (error.name !== 'AbortError') { ev.target.value = ""; showToast(error.message, "bad"); } }
    });
    async function runMake() {
      try {
        collectMasterKey();
        collectEntries();
      } catch (e) {
        handleError("makeStatus", e);
        focusFirstInvalidMakeField();
        setMakeButtonsState("invalid");
        return;
      }
      cancelOperations();
      const op = operationTicket();
      setMakeButtonsState("busy");
      setStatus("makeStatus", "Создание...");
      showProgress("Подготовка...", 0);
      try {
        $("downloadPngBtn").disabled = true;
        $("downloadSvgBtn").disabled = true;
        $("downloadBitsBtn").disabled = true;
        $("downloadRawBtn").disabled = true;
        $("downloadZipBtn").disabled = true;
        $("printBtn").disabled = true;
        $("verifyBtn").disabled = true;
        $("expandMakeImageBtn").disabled = true;
        state.lastRender = null;
        state.lastContainerBytes = null;
        state.verifyCache.clear();
        $("canvas").closest(".canvas-box").classList.remove("has-image");
        $("makeView").classList.remove("has-output");
        $("makePreviewPane").classList.add("hidden");
        setVerifyButton("idle");
        await makeVault(updateProgress);
        op.check();
        if (!state.lastRender) {
          await op.wait(verifyContainerBody(decodeBody(state.lastContainerBytes)));
          updateProgress('Готово', 100);
          return;
        }
        updateProgress("Проверяю качество Aztec", 95);
        try {
          const result = await stressTestRender(state.lastRender);
          op.check();
          state.verifyCache.add(verificationKey(state.lastRender));
          setVerifyButton("ok", `${result.passed}/${result.total}`);
          updateProgress("Готово · проверка пройдена", 100);
        } catch (verificationError) {
          rethrowCancellation(verificationError);
          setVerifyButton("bad", verificationError.verificationScore || "ошибка");
          setStatus("makeStatus", verificationError.message, "bad");
          updateProgress("Создано · проверка требует внимания", 100);
        }
        $("canvas").closest(".preview-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      catch (e) { handleError("makeStatus", e); }
      finally {
        if (op.current()) {
        setMakeButtonsState("idle");
        setTimeout(() => { if (op.current()) hideProgress(); }, 350);
        }
      }
    }
    $('cancelOperationBtn').addEventListener('click', () => {
      clearSensitiveData(true);
      setStatus('makeStatus', 'Операция отменена. Секретные поля очищены.');
    });
    $("makeBtn").addEventListener("click", runMake);
    $("mobileMakeBtn").addEventListener("click", runMake);
    document.addEventListener("keydown", ev => {
      if (ev.key !== "Enter" || ev.isComposing) return;
      const target = ev.target;
      if (target?.id === "readPassword" || target?.id === "readLayerPassword") {
        ev.preventDefault();
        $("readBtn").click();
      }
    });
    document.addEventListener("input", ev => {
      if (ev.target?.matches("#makeView input, #makeView textarea")) ev.target.removeAttribute("aria-invalid");
      if (ev.target?.matches('.entry-text')) scheduleCapacity();
    });
    new MutationObserver(scheduleCapacity).observe($('entries'), {childList:true});
    $('languageToggle').addEventListener('click', scheduleCapacity);
    $("verifyBtn").addEventListener("click", async () => {
      const op = operationTicket();
      setVerifyButton("checking");
      try {
        const result = await op.wait(stressTestRender(state.lastRender));
        state.verifyCache.add(verificationKey(state.lastRender));
        setVerifyButton("ok", `${result.passed}/${result.total}`);
        showToast("Проверено: слои открываются, масштабирование и потеря контраста пройдены.", "ok");
      } catch (e) {
        if (!op.current()) return;
        setVerifyButton("bad", e.verificationScore || "ошибка");
        showToast(e.message, "bad");
      }
    });
    document.addEventListener("click", async ev => {
      const btn = ev.target.closest(".entry-copy");
      if (!btn) return;
      ev.preventDefault();
      const textArea = btn.closest(".text-area-wrap")?.querySelector(".entry-text");
      const text = textArea?.value || "";
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast("Скопировано. Помните: системный буфер обмена находится вне контроля LayerLock.", "ok");
      } catch (_) {
        handleError("makeStatus", new Error("Не удалось скопировать текст."));
      }
    });
    $("copyReadoutBtn").addEventListener("click", async () => {
      const text = $("readout").textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setStatus("readStatusWork", "Скопировано. Помните: системный буфер обмена находится вне контроля LayerLock.", "ok");
      } catch (_) {
        handleError("readStatusWork", new Error("Не удалось скопировать результат."));
      }
    });
    $("downloadPngBtn").addEventListener("click", async () => {
      const op = operationTicket();
      try {
        await op.wait(verifyRenderCached(selectedRender()));
        downloadBlob(await op.wait(pngBytesFromRender(selectedRender())), "image/png", state.lastName);
        markSaved();
      } catch (e) {
        handleError("makeStatus", e);
      }
    });
    $("downloadSvgBtn").addEventListener("click", async () => {
      const op = operationTicket();
      try {
        if (!state.lastRender) throw new Error("Сначала создайте изображение.");
        await op.wait(verifyRenderCached(selectedRender()));
        downloadBlob(makeSvg(selectedRender()), "image/svg+xml", state.lastSvgName);
        markSaved();
      } catch (e) {
        handleError("makeStatus", e);
      }
    });
    $("downloadBitsBtn").addEventListener("click", async () => {
      const op = operationTicket();
      try {
        await op.wait(verifyCompactExport());
        downloadBlob(makeCompactText(state.lastContainerBytes, state.lastFecKey), "text/plain;charset=utf-8", state.lastBitsName);
        markSaved();
      } catch (e) {
        handleError("makeStatus", e);
      }
    });
    $("downloadRawBtn").addEventListener("click", async () => {
      const op = operationTicket();
      try {
        await op.wait(verifyCompactExport());
        downloadBlob(makeCompactBytes(state.lastContainerBytes, state.lastFecKey), "application/octet-stream", state.lastRawName);
        markSaved();
      } catch (e) {
        handleError("makeStatus", e);
      }
    });
    $("downloadZipBtn").addEventListener("click", async () => {
      const op = operationTicket();
      try {
        setStatus("makeStatus", "Проверяю контейнер перед ZIP...");
        await op.wait(verifyCompactExport());
        const stamp = fileStamp();
        const generatedAt = new Date();
        const root = safeName(state.lastBaseName);
        const render = selectedRender();
        const files = await op.wait(buildZipFiles(render, root, stamp, generatedAt));
        downloadBlob(makeZip(files), "application/zip", state.lastZipName);
        markSaved();
        setStatus("makeStatus", `ZIP собран. ${selectedRender()?.formatLabel || "Контейнер"} проверен.`, "ok");
      } catch (e) {
        handleError("makeStatus", e);
      }
    });
    $("printBtn").addEventListener("click", async () => {
      const op = operationTicket();
      try {
        if (!state.lastRender) throw new Error("Сначала создайте изображение.");
        await op.wait(verifyRenderCached(selectedRender()));
        renderSigil($("printCanvas"), selectedRender());
        $("printTitle").textContent = state.lastBaseName;
        $("printMeta").textContent = `LayerLock · ${fileStamp()} · ${selectedRender().formatLabel} · ${selectedRender().moduleWidth} x ${selectedRender().moduleHeight}`;
        window.print();
      } catch (e) {
        handleError("makeStatus", e);
      }
    });
    $("fileIn").addEventListener("change", async ev => {
      const file = ev.target.files[0];
      if (!file) return;
      setReadSource(isCompactFile(file) ? "bits" : "file");
      try {
        if (isCompactFile(file)) await loadCompactContainerFile(file);
        else await loadImageFile(file);
      }
      catch (e) { handleError(readStatusTarget(), e); }
    });
    $("cameraIn").addEventListener("change", async ev => {
      const file = ev.target.files[0];
      if (!file) return;
      stopLiveCamera(true);
      setReadSource("camera");
      try { await loadImageFile(file); }
      catch (e) { handleError(readStatusTarget(), e); }
    });
    $("replaceImageBtn").addEventListener("click", () => {
      if (!localizedConfirm("Текущее изображение, введенные ключи и результат будут сброшены. Загрузить другое изображение?")) return;
      resetReadImageFlow();
    });
    $('resetCompactBtn').addEventListener('click', () => $('replaceImageBtn').click());
    $("expandReadImageBtn").addEventListener("click", openReadImageModal);
    $("downloadReadSvgBtn").addEventListener("click", () => {
      if (!state.readRender) return;
      downloadBlob(makeSvg(state.readRender), "image/svg+xml", "LayerLock-restored.svg");
    });
    $("expandMakeImageBtn").addEventListener("click", openGeneratedImageModal);
    $("closeImageModal").addEventListener("click", closeReadImageModal);
    $("imageModal").addEventListener("click", ev => {
      if (ev.target === $("imageModal")) closeReadImageModal();
    });
    function openModal(modal) {
      clearTimeout(modal._closeTimer);
      modal.classList.remove("closing");
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
    }
    function closeModal(modal, onClosed) {
      if (!modal.classList.contains("active")) return;
      clearTimeout(modal._closeTimer);
      modal.classList.remove("active");
      modal.classList.add("closing");
      modal.setAttribute("aria-hidden", "true");
      modal._closeTimer = setTimeout(() => {
        modal.classList.remove("closing");
        onClosed?.();
      }, 230);
    }
    function openSettings() {
      openModal($("settingsModal"));
      document.body.classList.add("settings-open");
    }
    function closeSettings() {
      closeModal($("settingsModal"), () => document.body.classList.remove("settings-open"));
    }
    function openInfo() {
      switchInfoPage(document.body.classList.contains("read-mode") ? "read" : "make");
      openModal($("infoModal"));
    }
    function closeInfo() {
      closeModal($("infoModal"));
    }
    function switchInfoPage(name) {
      const make = name === "make";
      $("infoModal").style.setProperty("--info-progress", make ? 0 : 1);
      $("infoModal").classList.toggle("info-make-mode", make);
      $("infoModal").classList.toggle("info-read-mode", !make);
      $("infoMakeTab").classList.toggle("active", make);
      $("infoReadTab").classList.toggle("active", !make);
      $("infoMakePage").classList.toggle("active", make);
      $("infoReadPage").classList.toggle("active", !make);
    }
    document.body.appendChild($("settingsModal"));
    document.body.appendChild($("infoModal"));
    $("openSettingsBtn").addEventListener("click", openSettings);
    $("closeSettingsBtn").addEventListener("click", closeSettings);
    $("settingsModal").addEventListener("click", ev => {
      if (ev.target === $("settingsModal")) closeSettings();
    });
    $("openInfoBtn").addEventListener("click", openInfo);
    $("closeInfoBtn").addEventListener("click", closeInfo);
    $("infoModal").addEventListener("click", ev => {
      if (ev.target === $("infoModal")) closeInfo();
    });
    $("infoMakeTab").addEventListener("click", () => switchInfoPage("make"));
    $("infoReadTab").addEventListener("click", () => switchInfoPage("read"));
    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") {
        stopLiveCamera(true);
        closeReadImageModal();
        closeSettings();
        closeInfo();
      }
    });
    $("uploadSourceBtn").addEventListener("click", () => {
      stopLiveCamera(true);
      setReadSource("file");
    });
    $("cameraSourceBtn").addEventListener("click", () => {
      setReadSource("camera");
    });
    $("bitsSourceBtn").addEventListener("click", () => {
      stopLiveCamera(true);
      setReadSource("bits");
      requestAnimationFrame(() => $("bitCodeInput").focus());
    });
    $("restoreBitsBtn").addEventListener("click", async () => {
      $("restoreBitsBtn").disabled = true;
      setStatus("readStatus", "Восстанавливаю компактный контейнер...");
      try {
        await loadCompactContainerText($("bitCodeInput").value);
      } catch (e) {
        handleError("readStatus", e);
      } finally {
        $("restoreBitsBtn").disabled = false;
      }
    });
    $("bitCodeInput").addEventListener("keydown", ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        $("restoreBitsBtn").click();
      }
    });
    $("closeCameraBtn").addEventListener("click", () => stopLiveCamera(true));
    $("cameraFallbackBtn").addEventListener("click", openSystemCamera);
    $("cameraCaptureBtn").addEventListener("click", () => {
      clearTimeout(state.cameraTimer);
      state.cameraTimer = null;
      const token = state.cameraLoopToken;
      scanCameraFrame(token, true).catch(e => handleError("readStatus", e));
    });
    window.addEventListener("pagehide", () => stopLiveCamera(true));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLiveCamera(true);
    });
    $("dropZone").addEventListener("click", () => {
      if ($("cameraSourceBtn").classList.contains("active")) {
        openLiveCamera().catch(e => handleError("readStatus", e));
        return;
      }
      setReadSource("file");
      $("fileIn").click();
    });
    $("dropZone").addEventListener("keydown", ev => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if ($("cameraSourceBtn").classList.contains("active")) {
          openLiveCamera().catch(e => handleError("readStatus", e));
          return;
        }
        setReadSource("file");
        $("fileIn").click();
      }
    });
    for (const type of ["dragenter", "dragover"]) {
      $("dropZone").addEventListener(type, ev => {
        ev.preventDefault();
        $("dropZone").classList.add("dragging");
      });
    }
    for (const type of ["dragleave", "drop"]) {
      $("dropZone").addEventListener(type, ev => {
        ev.preventDefault();
        $("dropZone").classList.remove("dragging");
      });
    }
    $("dropZone").addEventListener("drop", async ev => {
      const file = [...ev.dataTransfer.files].find(f => f.type.startsWith("image/") || isCompactFile(f));
      setReadSource(isCompactFile(file) ? "bits" : "file");
      try {
        if (isCompactFile(file)) await loadCompactContainerFile(file);
        else await loadImageFile(file);
      }
      catch (e) { handleError(readStatusTarget(), e); }
    });
    document.addEventListener("paste", async ev => {
      if (!$("readView").classList.contains("active")) return;
      const item = [...ev.clipboardData.items].find(i => i.type.startsWith("image/"));
      if (!item) return;
      ev.preventDefault();
      setReadSource("file");
      try { await loadImageFile(item.getAsFile()); }
      catch (e) { handleError(readStatusTarget(), e); }
    });
    $("readBtn").addEventListener("click", async () => {
      const op = operationTicket();
      const action = state.readPack ? "Проверяю пароль слоя через Argon2id..." : (state.readDecoded ? "Проверяю мастер-ключ через Argon2id..." : "Ищу контейнер и проверяю мастер-ключ...");
      const searching = !state.readDecoded;
      setStatus("readStatusWork", action);
      $("readout").textContent = "";
      $("readWorkPane").classList.add("is-reading");
      $("readBtn").disabled = true;
      if (searching) setReadScanning(true);
      try { await readVault(); }
      catch (e) { handleError("readStatusWork", e); }
      finally {
        if (op.current()) {
        $("readBtn").disabled = false;
        $("readWorkPane").classList.remove("is-reading");
        if (searching) setReadScanning(false);
        }
      }
    });

    let swipeStartX = 0, swipeStartY = 0, swipeDx = 0, swipeActive = false;
    function isMobileSwipe() {
      return window.matchMedia("(max-width: 720px)").matches;
    }
    $("views").addEventListener("touchstart", ev => {
      if (!isMobileSwipe() || ev.touches.length !== 1) return;
      if (ev.target.closest("input, textarea, select, button, canvas")) return;
      swipeStartX = ev.touches[0].clientX;
      swipeStartY = ev.touches[0].clientY;
      swipeDx = 0;
      swipeActive = true;
    }, { passive: true });
    $("views").addEventListener("touchmove", ev => {
      if (!swipeActive || ev.touches.length !== 1) return;
      const dx = ev.touches[0].clientX - swipeStartX;
      const dy = ev.touches[0].clientY - swipeStartY;
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      ev.preventDefault();
      swipeDx = dx;
    }, { passive: false });
    $("views").addEventListener("touchend", () => {
      if (!swipeActive) return;
      if (swipeDx < -56) switchTab("read");
      else if (swipeDx > 56) switchTab("make");
      else document.querySelector(".tabs").style.setProperty("--tab-progress", $("readView").classList.contains("active") ? 1 : 0);
      swipeActive = false;
      swipeDx = 0;
    });
    function syncSettingsSummary() {
      const profile = selectedKdfProfile();
      const fec = selectedFecProfile();
      $("settingsSummary").textContent = `${profile.label} защита · ${fec.label.toLowerCase()} восстановление · Aztec`;
      $("openSettingsBtn").title = `Настройки: ${profile.label.toLowerCase()} защита паролей, ${fec.label.toLowerCase()} восстановление, Aztec`;
    }

    function syncFecLevel() {
      const keys = ["minimal", "standard", "enhanced", "maximum"];
      const notes = [
        "Минимальный дополнительный объем для чистых цифровых копий.",
        "Умеренный запас данных для восстановления частично поврежденного изображения.",
        "Повышенный запас для фотографий, масштабирования и небольших дефектов.",
        "Максимальный запас восстановления; изображение будет крупнее."
      ];
      const index = Math.max(0, Math.min(3, Number($("fecLevel").value) || 0));
      $("fecLevel").closest(".recovery-slider-shell").style.setProperty("--fec-progress", `${(index / 3) * 100}%`);
      $("fecLevel").setAttribute("aria-valuetext", FEC_PROFILES[keys[index]].label);
      $("fecProfile").value = keys[index];
      $("fecLevelValue").textContent = FEC_PROFILES[keys[index]].label;
      $("fecNote").textContent = notes[index];
      syncSettingsSummary();
    }

    $("fecLevel").addEventListener("input", () => {
      syncFecLevel();
      haptic("selection");
    });
    $("kdfProfile").addEventListener("change", () => {
      syncKdfNote();
      syncSettingsSummary();
    });
    languageObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: LOCALIZED_ATTRIBUTES
    });
    let savedLanguage = "en";
    try { savedLanguage = localStorage.getItem("layerlock-language") || savedLanguage; } catch (_) {}
    applyLanguage(savedLanguage, false);
    try { applyTheme(localStorage.getItem("layerlock-theme") === "light"); }
    catch (_) { applyTheme(false); }
    syncKdfNote();
    syncFecLevel();
    syncSettingsSummary();

    /* ---------- Custom select enhancer ---------- */
    const CARET_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
    function enhanceSelect(sel) {
      if (sel.classList.contains("hidden") || sel.hidden) return;
      if (sel.dataset.enhanced === "1") return;
      sel.dataset.enhanced = "1";
      // Unbind any wrapping <label> so it can't hijack clicks and open the native picker
      const lbl = sel.closest("label");
      if (lbl) {
        const div = document.createElement("div");
        div.className = (lbl.className ? lbl.className + " " : "") + "field-group";
        while (lbl.firstChild) div.appendChild(lbl.firstChild);
        lbl.parentNode.replaceChild(div, lbl);
      }
      sel.setAttribute("tabindex", "-1");
      sel.setAttribute("aria-hidden", "true");
      const wrap = document.createElement("div");
      wrap.className = "field-select";
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "field-select-trigger";
      trigger.innerHTML = '<span class="field-select-value"></span><span class="field-select-caret">' + CARET_SVG + '</span>';
      wrap.appendChild(trigger);
      const menu = document.createElement("div");
      menu.className = "field-select-menu";
      menu.setAttribute("role", "listbox");
      document.body.appendChild(menu);

      function buildMenu() {
        menu.innerHTML = "";
        [...sel.options].forEach((opt, i) => {
          const el = document.createElement("div");
          el.className = "field-select-option" + (i === sel.selectedIndex ? " selected" : "");
          el.setAttribute("role", "option");
          el.textContent = opt.textContent;
          el.dataset.value = opt.value;
          el.addEventListener("click", ev => {
            ev.stopPropagation();
            if (sel.value !== opt.value) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
            }
            syncTrigger();
            close();
          });
          menu.appendChild(el);
        });
      }
      function syncTrigger() {
        const opt = sel.options[sel.selectedIndex];
        trigger.querySelector(".field-select-value").textContent = opt ? opt.textContent : "";
        [...menu.children].forEach((el, i) => el.classList.toggle("selected", i === sel.selectedIndex));
      }
      function positionMenu() {
        const r = trigger.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const viewportInset = 10;
        const menuMax = 260;
        const spaceBelow = vh - r.bottom;
        const spaceAbove = r.top;
        menu.style.position = "fixed";
        const width = Math.min(r.width, vw - viewportInset * 2);
        menu.style.left = Math.max(viewportInset, Math.min(r.left, vw - width - viewportInset)) + "px";
        menu.style.width = width + "px";
        if (spaceBelow < 180 && spaceAbove > spaceBelow) {
          menu.style.top = "auto";
          menu.style.bottom = (vh - r.top + 6) + "px";
          menu.style.maxHeight = Math.max(120, Math.min(menuMax, spaceAbove - 12)) + "px";
        } else {
          menu.style.top = (r.bottom + 6) + "px";
          menu.style.bottom = "auto";
          menu.style.maxHeight = Math.max(120, Math.min(menuMax, spaceBelow - 12)) + "px";
        }
      }
      function open() {
        document.querySelectorAll(".field-select.open").forEach(w => {
          if (w !== wrap) w.dispatchEvent(new Event("fieldselectclose"));
        });
        wrap.classList.add("open");
        menu.classList.add("open");
        positionMenu();
        window.addEventListener("scroll", onScrollClose, true);
        window.addEventListener("resize", onScrollClose);
      }
      function close() {
        wrap.classList.remove("open");
        menu.classList.remove("open");
        window.removeEventListener("scroll", onScrollClose, true);
        window.removeEventListener("resize", onScrollClose);
      }
      function onScrollClose(ev) {
        // Ignore scrolling that happens INSIDE the menu itself (users scrolling the options list)
        if (ev && ev.target && (ev.target === menu || (ev.target.nodeType === 1 && menu.contains(ev.target)))) return;
        close();
      }
      trigger.addEventListener("click", ev => {
        ev.stopPropagation();
        wrap.classList.contains("open") ? close() : open();
      });
      wrap.addEventListener("fieldselectclose", close);
      sel.addEventListener("change", syncTrigger);
      wrap._syncLanguage = () => { buildMenu(); syncTrigger(); };
      buildMenu();
      syncTrigger();
      // Rebuild menu if options change
      const mo = new MutationObserver(() => { buildMenu(); syncTrigger(); });
      mo.observe(sel, { childList: true });
    }
    document.querySelectorAll("select").forEach(enhanceSelect);
    document.addEventListener("click", () => {
      document.querySelectorAll(".field-select.open").forEach(w => w.dispatchEvent(new Event("fieldselectclose")));
    });
    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") {
        document.querySelectorAll(".field-select.open").forEach(w => w.dispatchEvent(new Event("fieldselectclose")));
      }
    });

    /* ---------- Fieldset valid-check (password non-empty) ---------- */
    function syncFieldsetValid(input) {
      const fs = input.closest(".field-fieldset");
      if (!fs) return;
      fs.classList.toggle("valid", input.value.trim().length > 0);
    }
    document.addEventListener("input", ev => {
      if (ev.target.matches(".field-fieldset input")) syncFieldsetValid(ev.target);
    });
    // Init existing
    document.querySelectorAll(".field-fieldset input").forEach(syncFieldsetValid);
    // Also re-enhance selects/fieldsets when new entries are added
    const entriesEl = document.getElementById("entries");
    if (entriesEl) {
      new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          node.querySelectorAll && node.querySelectorAll("select").forEach(enhanceSelect);
          node.querySelectorAll && node.querySelectorAll(".field-fieldset input").forEach(syncFieldsetValid);
        }));
      }).observe(entriesEl, { childList: true, subtree: true });
    }

    makeEntry(true);
    markSaved();
