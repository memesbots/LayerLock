    function passwordScore(password) {
      if (!password) return { score: 0, pct: 0, label: "Пароль не введен", cls: "" };
      const length = [...normalizePassword(password)].length;
      const classes = [/[a-zа-я]/i, /[A-ZА-Я]/, /[0-9]/, /[^\p{L}\p{N}]/u].filter(pattern => pattern.test(password)).length;
      const uniqueRatio = new Set([...password]).size / Math.max(length, 1);
      if (length < 6 || isPredictablePassword(password)) return { score: 12, pct: 12, label: "Легкий", cls: "easy" };
      const score = Math.min(100, Math.round(length * 3 + classes * 8 + uniqueRatio * 18));
      if (length >= 24 && classes >= 3 && score >= 90) return { score, pct: 100, label: "Сложный", cls: "complex" };
      if ((length >= 18 && classes >= 3) || length >= 24) return { score, pct: 78, label: "Надежный", cls: "reliable" };
      if (length >= 12 && classes >= 2) return { score, pct: 52, label: "Средний", cls: "medium" };
      return { score, pct: Math.max(12, Math.min(38, score)), label: "Легкий", cls: "easy" };
    }

    function updateStrength(entry) {
      const pass = entry.querySelector(".entry-pass").value;
      const info = passwordScore(pass);
      const box = entry.querySelector(".strength");
      box.className = `strength ${info.cls}`.trim();
      entry.querySelector(".strength-fill").style.width = `${info.pct}%`;
      entry.querySelector(".strength-text").textContent = info.label;
      updateMatch(entry);
    }
    function syncEntryState(entry) {
      if (!entry) return;
      const pass = entry.querySelector(".entry-pass")?.value.trim() || "";
      const confirm = entry.querySelector(".entry-pass-confirm")?.value.trim() || "";
      const text = entry.querySelector(".entry-text")?.value.trim() || "";
      entry.querySelector(".entry-text-field")?.classList.toggle("has-text", Boolean(text));
      if (entry.classList.contains("master-entry")) {
        entry.classList.toggle("is-active", Boolean(pass));
        return;
      }
      entry.classList.toggle("is-active", Boolean(pass && confirm && normalizePassword(pass) === normalizePassword(confirm) && text && !entry.querySelector(".is-duplicate")));
    }
    function syncDuplicatePasswords() {
      const entries = [...document.querySelectorAll("#entries .entry")];
      const masterIdentity = passwordIdentity($("masterKey")?.value || "");
      const masterFieldset = document.querySelector(".master-entry .pass-fieldset");
      const masterPolicy = $("masterPolicy");
      const groups = new Map();
      masterFieldset?.classList.remove("is-duplicate");
      if (masterPolicy?.dataset.state === "duplicate") {
        masterPolicy.dataset.state = "empty";
        masterPolicy.querySelector(".pass-match-text").textContent = "";
      }
      for (const entry of entries) {
        const passFieldset = entry.querySelector(".pass-fieldset");
        const confirmFieldset = entry.querySelector(".confirm-fieldset");
        const box = entry.querySelector(".pass-match");
        passFieldset?.classList.remove("is-duplicate");
        confirmFieldset?.classList.remove("is-duplicate");
        if (box?.dataset.state === "duplicate") {
          const pass = entry.querySelector(".entry-pass")?.value || "";
          const confirm = entry.querySelector(".entry-pass-confirm")?.value || "";
          const matches = normalizePassword(pass) === normalizePassword(confirm);
          box.dataset.state = !confirm ? "empty" : (matches ? "ok" : "bad");
          box.querySelector(".pass-match-text").textContent = pass && confirm && !matches ? "Пароли не совпадают" : "";
        }
        const password = entry.querySelector(".entry-pass")?.value || "";
        if (!password) continue;
        const identity = passwordIdentity(password);
        if (!groups.has(identity)) groups.set(identity, []);
        groups.get(identity).push(entry);
      }
      for (const duplicates of groups.values()) {
        if (duplicates.length < 2) continue;
        for (const entry of duplicates) {
          const pass = entry.querySelector(".entry-pass")?.value || "";
          const confirm = entry.querySelector(".entry-pass-confirm")?.value || "";
          entry.querySelector(".pass-fieldset")?.classList.add("is-duplicate");
          if (normalizePassword(confirm) === normalizePassword(pass)) entry.querySelector(".confirm-fieldset")?.classList.add("is-duplicate");
          const box = entry.querySelector(".pass-match");
          box.dataset.state = "duplicate";
          box.querySelector(".pass-match-text").textContent = "Этот пароль уже используется в другом слое";
        }
      }
      if (masterIdentity && groups.has(masterIdentity)) {
        masterFieldset?.classList.add("is-duplicate");
        masterPolicy.dataset.state = "duplicate";
        masterPolicy.querySelector(".pass-match-text").textContent = "Мастер-ключ не должен совпадать с паролем слоя.";
        for (const entry of groups.get(masterIdentity)) {
          entry.querySelector(".pass-fieldset")?.classList.add("is-duplicate");
          const confirm = entry.querySelector(".entry-pass-confirm")?.value || "";
          if (passwordIdentity(confirm) === masterIdentity) entry.querySelector(".confirm-fieldset")?.classList.add("is-duplicate");
          const box = entry.querySelector(".pass-match");
          box.dataset.state = "duplicate";
          box.querySelector(".pass-match-text").textContent = "Мастер-ключ не должен совпадать с паролем слоя.";
        }
      }
      entries.forEach(syncEntryState);
    }
    function updateMatch(entry) {
      const pass = entry.querySelector(".entry-pass").value;
      const confirmInput = entry.querySelector(".entry-pass-confirm");
      const passFieldset = entry.querySelector(".pass-fieldset");
      const confirmFieldset = entry.querySelector(".confirm-fieldset");
      const box = entry.querySelector(".pass-match");
      passFieldset.classList.toggle("has-value", Boolean(pass));
      if (!confirmInput || !confirmFieldset || !box) {
        syncEntryState(entry);
        return;
      }
      const conf = confirmInput.value;
      const txt = box.querySelector(".pass-match-text");
      passFieldset.classList.remove("is-bad");
      confirmFieldset.classList.remove("is-ok", "is-bad");
      if (!conf) {
        box.dataset.state = "empty";
        txt.textContent = "";
      } else if (normalizePassword(pass) === normalizePassword(conf)) {
        box.dataset.state = "ok";
        confirmFieldset.classList.add("is-ok");
        txt.textContent = "";
      } else {
        box.dataset.state = "bad";
        passFieldset.classList.add("is-bad");
        confirmFieldset.classList.add("is-bad");
        txt.textContent = "Пароли не совпадают";
      }
      syncEntryState(entry);
      syncDuplicatePasswords();
    }

    function collectMasterKey() {
      const key = $("masterKey").value;
      if (!key) throw new Error("Введите мастер-ключ.");
      if (state.pendingGeneratedKeyFileDigest) throw new Error("Подтвердите скачанный ключ-файл перед созданием контейнера.");
      const issue = passwordPolicyIssue(key, "master");
      if (issue) throw new Error(issue);
      return key;
    }

    function collectEntries() {
      if (!$("vaultName").value.trim()) throw new Error("Введите название.");
      const entries = [...document.querySelectorAll("#entries .entry")].map((el, i) => ({
        el,
        index: i + 1,
        password: el.querySelector(".entry-pass").value,
        confirm: el.querySelector(".entry-pass-confirm").value,
        text: el.querySelector(".entry-text").value
      })).filter(e => e.password || e.confirm || e.text);
      if (!entries.length) throw new Error("Добавьте хотя бы один слой с паролем и текстом.");
      for (const entry of entries) {
        if (!entry.password) throw new Error(`Слой ${entry.index}: введите пароль.`);
        if (normalizePassword(entry.password) !== normalizePassword(entry.confirm)) throw new Error(`Слой ${entry.index}: пароли не совпадают.`);
        const issue = passwordPolicyIssue(entry.password, "layer");
        if (issue) throw new Error(`Слой ${entry.index}: ${issue}`);
        if (!entry.text) throw new Error(`Слой ${entry.index}: введите текст.`);
      }
      const passwordLayers = new Map();
      for (const entry of entries) {
        const identity = passwordIdentity(entry.password);
        if (!passwordLayers.has(identity)) passwordLayers.set(identity, []);
        passwordLayers.get(identity).push(entry.index);
      }
      const duplicateLayers = [...passwordLayers.values()].find(indexes => indexes.length > 1);
      if (duplicateLayers) throw new Error(`Слои ${duplicateLayers.join(" и ")}: одинаковые пароли запрещены.`);
      const masterIdentity = passwordIdentity($("masterKey").value);
      if (passwordLayers.has(masterIdentity)) throw new Error("Мастер-ключ не должен совпадать с паролем слоя.");
      return entries.map(({ password, text }) => ({ password, text }));
    }

    function focusFirstInvalidMakeField() {
      const focusInvalid = field => {
        if (!field) return false;
        const entry = field.closest(".entry");
        if (entry) setEntryCollapsed(entry, false);
        field.setAttribute("aria-invalid", "true");
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      };
      if (!$("vaultName").value.trim()) return focusInvalid($("vaultName"));
      if (!$("masterKey").value) return focusInvalid($("masterKey"));
      if (passwordPolicyIssue($("masterKey").value, "master")) return focusInvalid($("masterKey"));
      for (const layer of $("entries").children) {
        const pass = layer.querySelector(".entry-pass");
        const confirm = layer.querySelector(".entry-pass-confirm");
        const text = layer.querySelector(".entry-text");
        if (!pass.value) return focusInvalid(pass);
        if (normalizePassword(pass.value) !== normalizePassword(confirm.value)) return focusInvalid(confirm);
        if (passwordPolicyIssue(pass.value, "layer")) return focusInvalid(pass);
        if (!text.value) return focusInvalid(text);
      }
      const passwordFields = [...document.querySelectorAll("#entries .entry-pass")];
      const seenPasswords = new Map();
      for (const field of passwordFields) {
        if (!field.value) continue;
        const identity = passwordIdentity(field.value);
        if (identity === passwordIdentity($("masterKey").value)) return focusInvalid(field);
        if (seenPasswords.has(identity)) return focusInvalid(field);
        seenPasswords.set(identity, field);
      }
      return false;
    }

    function setMakeButtonsState(mode = "idle") {
      const busy = mode === "busy";
      const label = busy ? "Создаю..." : (mode === "invalid" ? "Проверьте поля" : "Создать");
      for (const button of [$("makeBtn"), $("mobileMakeBtn")]) {
        button.disabled = busy;
        button.textContent = label;
        button.classList.toggle("invalid", mode === "invalid");
      }
      if (mode === "invalid") setTimeout(() => setMakeButtonsState("idle"), 1800);
    }

    function syncLayerList() {
      const layers = [...$("entries").children];
      layers.forEach((layer, index) => {
        const title = layer.querySelector(".entry-title");
        if (title) title.textContent = `Слой ${index + 1}`;
      });
      if ($("layerCount")) $("layerCount").textContent = String(layers.length);
    }

    function setEntryCollapsed(entry, collapsed) {
      if (!entry || entry.classList.contains("master-entry")) return;
      entry.classList.toggle("is-collapsed", collapsed);
      const toggle = entry.querySelector(".entry-title-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", String(!collapsed));
    }

    function makeEntry(real) {
      [...$("entries").children].forEach(entry => setEntryCollapsed(entry, true));
      const idx = $("entries").children.length + 1;
      const wrap = document.createElement("div");
      wrap.className = "entry";
      wrap.innerHTML = `
        <div class="entry-head">
          <button class="entry-title-toggle" type="button" aria-expanded="true">
            <span class="entry-title">Слой ${idx}</span>
            <svg class="entry-chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          <button class="icon entry-remove" type="button" title="Удалить">×</button>
        </div>
        <div class="entry-body-shell">
          <div class="entry-body">
        <div class="field-fieldset pass-fieldset">
          <span class="field-legend">Пароль</span>
          <span class="password-field">
            <input class="entry-pass" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" data-1p-ignore data-lpignore="true" placeholder=" ">
            <button class="password-toggle" type="button" aria-label="Показать пароль" title="Показать пароль">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </span>
          <span class="field-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>
          </span>
          <span class="field-danger" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v6"/>
              <path d="M12 17h.01"/>
            </svg>
          </span>
        </div>
        <div class="field-fieldset confirm-fieldset">
          <span class="field-legend">Повторите пароль</span>
          <span class="password-field">
            <input class="entry-pass-confirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" data-1p-ignore data-lpignore="true" placeholder=" ">
            <button class="password-toggle" type="button" aria-label="Показать пароль" title="Показать пароль">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </span>
          <span class="field-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>
          </span>
          <span class="field-danger" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v6"/>
              <path d="M12 17h.01"/>
            </svg>
          </span>
        </div>
        <div class="pass-match" data-state="empty" aria-live="polite">
          <span class="pass-match-dot" aria-hidden="true"></span>
          <span class="pass-match-text"></span>
        </div>
        <div class="strength">
          <span class="strength-bar"><span class="strength-fill"></span></span>
          <span class="strength-text">Пароль не введен</span>
        </div>
        <div class="entry-text-field">
          <div class="label-row">
            <label class="entry-text-label">Текст</label>
          </div>
          <div class="text-area-wrap">
            <textarea class="entry-text"></textarea>
            <button class="icon entry-copy" type="button" aria-label="Скопировать текст" title="Скопировать текст">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>
          </div>
        </div>
      `;
      wrap.querySelector(".entry-title-toggle").addEventListener("click", () => {
        setEntryCollapsed(wrap, !wrap.classList.contains("is-collapsed"));
      });
      wrap.querySelector(".entry-remove").addEventListener("click", () => {
        if ($("entries").children.length > 1) {
          wrap.remove();
          syncLayerList();
          syncDuplicatePasswords();
        }
      });
      wrap.querySelector(".entry-pass").addEventListener("input", () => updateStrength(wrap));
      wrap.querySelector(".entry-pass-confirm").addEventListener("input", () => updateMatch(wrap));
      wrap.querySelector(".entry-text").addEventListener("input", () => syncEntryState(wrap));
      $("entries").appendChild(wrap);
      updateStrength(wrap);
      syncLayerList();
    }
