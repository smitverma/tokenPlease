(function () {
  if (window.__tokenPleaseInjected) {
    return;
  }
  window.__tokenPleaseInjected = true;

  const shared = window.TokenPleaseShared;
  const api = shared.getBrowserApi();

  const OVERLAY_STYLES = `
    :host {
      position: fixed;
      top: 10px;
      right: 10px;
      width: 380px;
      max-height: 85vh;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #111827;
      color: #f9fafb;
      border: 1px solid #374151;
      border-radius: 10px;
      box-shadow: 0 10px 35px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    :host(.tp-hidden) {
      display: none;
    }

    :host(.tp-minimized) {
      display: none;
    }

    :host(.tp-collapsed) .tp-body {
      display: none;
    }

    .tp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      background: #1f2937;
      border-bottom: 1px solid #374151;
    }

    .tp-title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .tp-title-logo {
      width: 16px;
      height: 16px;
      object-fit: contain;
    }

    .tp-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tp-controls button,
    .tp-rule-actions button {
      appearance: none;
      border: 1px solid #4b5563;
      background: #111827;
      color: #f9fafb;
      border-radius: 6px;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 11px;
    }

    .tp-controls button:hover,
    .tp-rule-actions button:hover {
      border-color: #6b7280;
      background: #1f2937;
    }

    .tp-drag-handle {
      cursor: grab;
    }

    .tp-drag-handle:active {
      cursor: grabbing;
    }

    .tp-body {
      max-height: calc(85vh - 44px);
      overflow: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tp-rule {
      border: 1px solid #374151;
      border-radius: 6px;
      background: #0b1220;
      padding: 8px;
    }

    .tp-rule-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .tp-rule-name {
      font-size: 12px;
      font-weight: 600;
      color: #f3f4f6;
    }

    .tp-rule-meta {
      font-size: 10px;
      color: #9ca3af;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tp-rule-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11px;
      background: #0f172a;
      border: 1px solid #1f2937;
      border-radius: 6px;
      padding: 6px;
      margin-bottom: 6px;
      line-height: 1.35;
      word-break: break-all;
    }

    .tp-rule-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tp-jwt {
      margin-top: 6px;
      font-size: 10px;
      border: 1px solid #1f2937;
      border-radius: 6px;
      background: #0f172a;
      padding: 6px;
      color: #d1d5db;
    }

    .tp-jwt pre {
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }

    .tp-empty {
      font-size: 12px;
      color: #9ca3af;
      padding: 10px;
      border: 1px dashed #374151;
      border-radius: 8px;
    }
  `;

  const state = {
    settings: null,
    collapsed: false,
    overlayVisible: false,
    pollingTimer: null,
    paused: false,
    revealMap: new Map(),
    jwtVisibleMap: new Map(),
    latestEntries: [],
    latestEntriesSignature: "",
    minimized: false,
    dragStarted: false,
    position: null
  };

  const dom = {
    root: null,
    shadowRoot: null,
    body: null,
    pauseBtn: null,
    refreshBtn: null,
    optionsBtn: null,
    minimizeBtn: null,
    minimizeCircle: null
  };

  async function ensureOverlay() {
    if (dom.root) {
      return;
    }

    if (!state.position) {
      state.position = await shared.loadPosition();
    }

    const root = document.createElement("div");
    root.id = "tokenplease-root";
    if (state.position) {
      root.style.left = state.position.left + "px";
      root.style.top = state.position.top + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
    }
    const shadowRoot = root.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = OVERLAY_STYLES;

    const panel = document.createElement("div");

    const header = document.createElement("div");
    header.className = "tp-header";

    const title = document.createElement("div");
    title.className = "tp-title";
    const titleLogo = document.createElement("img");
    titleLogo.className = "tp-title-logo";
    titleLogo.src = shared.runtimeGetURL("cookies.png");
    titleLogo.alt = "tokenPlease";

    const titleText = document.createElement("span");
    titleText.className = "tp-title-text";
    titleText.textContent = "tokenPlease";

    title.appendChild(titleLogo);
    title.appendChild(titleText);

    const controls = document.createElement("div");
    controls.className = "tp-controls";

    const pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.textContent = "Pause";

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.textContent = "Refresh";

    const optionsBtn = document.createElement("button");
    optionsBtn.type = "button";
    optionsBtn.textContent = "Rules";

    const dragBtn = document.createElement("button");
    dragBtn.type = "button";
    dragBtn.className = "tp-drag-handle";
    dragBtn.textContent = "≡";
    dragBtn.title = "Drag to move";

    controls.appendChild(pauseBtn);
    controls.appendChild(refreshBtn);
    controls.appendChild(optionsBtn);
    controls.appendChild(dragBtn);

    header.appendChild(title);
    header.appendChild(controls);

    const body = document.createElement("div");
    body.className = "tp-body";

    panel.appendChild(header);
    panel.appendChild(body);

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(panel);

    document.documentElement.appendChild(root);

    pauseBtn.addEventListener("click", () => {
      state.paused = !state.paused;
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      if (!state.paused) {
        runRefresh();
      }
    });

    refreshBtn.addEventListener("click", () => {
      runRefresh();
    });

    optionsBtn.addEventListener("click", async () => {
      const previous = optionsBtn.textContent;
      try {
        const response = await shared.runtimeSendMessage({ type: "tokenPlease:openOptions" });
        if (!response || !response.ok) {
          throw new Error(response && response.error ? response.error : "Open options failed");
        }
      } catch (error) {
        optionsBtn.textContent = "Failed";
        setTimeout(() => {
          optionsBtn.textContent = previous;
        }, 900);
        console.warn("tokenPlease: unable to open options", error);
      }
    });

    dragBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      state.dragStarted = false;
      const rect = root.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;
      const clientStartX = e.clientX;
      const clientStartY = e.clientY;

      function onMouseMove(e) {
        const moveX = Math.abs(e.clientX - clientStartX);
        const moveY = Math.abs(e.clientY - clientStartY);
        if (moveX > 5 || moveY > 5) {
          state.dragStarted = true;
        }

        if (state.dragStarted) {
          const newX = e.clientX - startX;
          const newY = e.clientY - startY;
          root.style.left = Math.max(0, newX) + "px";
          root.style.top = Math.max(0, newY) + "px";
          root.style.right = "auto";
          root.style.bottom = "auto";
        }
      }

      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        if (state.dragStarted) {
          const rect = root.getBoundingClientRect();
          state.position = { left: rect.left, top: rect.top };
          shared.savePosition(state.position);
        }

        if (!state.dragStarted) {
          toggleMinimize();
        }
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    dom.root = root;
    dom.shadowRoot = shadowRoot;
    dom.body = body;
    dom.pauseBtn = pauseBtn;
    dom.refreshBtn = refreshBtn;
    dom.optionsBtn = optionsBtn;
    dom.minimizeBtn = dragBtn;
  }

  function toggleMinimize() {
    state.minimized = !state.minimized;
    if (state.minimized) {
      minimize();
    } else {
      restore();
    }
  }

  function minimize() {
    dom.root.classList.add("tp-minimized");
    if (!dom.minimizeCircle) {
      const circle = document.createElement("div");
      circle.id = "tokenplease-minimize-circle";
      circle.style.position = "fixed";
      circle.style.bottom = "20px";
      circle.style.right = "20px";
      circle.style.width = "60px";
      circle.style.height = "60px";
      circle.style.borderRadius = "50%";
      circle.style.background = "#111827";
      circle.style.border = "2px solid #374151";
      circle.style.cursor = "pointer";
      circle.style.display = "none";
      circle.style.alignItems = "center";
      circle.style.justifyContent = "center";
      circle.style.zIndex = "2147483647";
      circle.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
      circle.style.transition = "transform 120ms ease, border-color 120ms ease";
      circle.style.transform = "scale(1)";

      const img = document.createElement("img");
      img.src = shared.runtimeGetURL("cookies.png");
      img.alt = "tokenPlease";
      img.style.width = "40px";
      img.style.height = "40px";
      img.style.objectFit = "contain";
      circle.appendChild(img);
      circle.addEventListener("mouseenter", () => {
        circle.style.transform = "scale(1.1)";
        circle.style.borderColor = "#6b7280";
      });
      circle.addEventListener("mouseleave", () => {
        circle.style.transform = "scale(1)";
        circle.style.borderColor = "#374151";
      });
      circle.addEventListener("click", () => {
        toggleMinimize();
      });
      document.documentElement.appendChild(circle);
      dom.minimizeCircle = circle;
    }
    dom.minimizeCircle.style.display = "flex";
  }

  function restore() {
    dom.root.classList.remove("tp-minimized");
    if (dom.minimizeCircle) {
      dom.minimizeCircle.style.display = "none";
    }
  }

  function renderEmpty(message) {
    ensureOverlay();
    dom.body.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "tp-empty";
    empty.textContent = message;
    dom.body.appendChild(empty);
    console.log("rendering empty");
  }

  function shouldShowOverlayForCurrentPage(settings) {
    if (!settings.enabled) {
      return false;
    }
    const url = location.href;
    return settings.rules.some((rule) => rule.enabled && shared.urlMatchesRuleDomains(url, rule));
  }

  function maskValue(value) {
    const length = Math.max(8, Math.min(120, String(value || "").length));
    const masked = "•".repeat(Math.min(length, 120));
    return shared.truncateMiddle(masked, state.settings.maxPreviewLength);
  }

  function valuePreview(value) {
    return shared.truncateMiddle(String(value || ""), state.settings.maxPreviewLength);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "absolute";
      area.style.top = "0";
      area.style.left = "-9999px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    }
  }

  function sourceMetaLabel(entry) {
    const labels = [`${entry.rule.source}`, `key:${entry.matchedKey}`];
    if (entry.isHttpOnly) {
      labels.push("HttpOnly");
    }
    return labels;
  }

  function renderEntries(entries) {
    ensureOverlay();

    if (!entries.length) {
      renderEmpty("No matching values found for this page.");
      return;
    }

    dom.body.innerHTML = "";

    for (const entry of entries) {
      const key = `${entry.rule.id}:${entry.matchedKey}`;
      const reveal = state.revealMap.has(key)
        ? state.revealMap.get(key)
        : !state.settings.maskByDefault;

      const card = document.createElement("div");
      card.className = "tp-rule";

      const head = document.createElement("div");
      head.className = "tp-rule-head";

      const name = document.createElement("div");
      name.className = "tp-rule-name";
      name.textContent = entry.rule.name;

      const meta = document.createElement("div");
      meta.className = "tp-rule-meta";
      sourceMetaLabel(entry).forEach((part) => {
        const span = document.createElement("span");
        span.textContent = part;
        meta.appendChild(span);
      });

      head.appendChild(name);
      head.appendChild(meta);

      const valueEl = document.createElement("div");
      valueEl.className = "tp-rule-value";
      const rawValue = String(entry.value || "");
      valueEl.textContent = reveal ? valuePreview(rawValue) : maskValue(rawValue);

      const actions = document.createElement("div");
      actions.className = "tp-rule-actions";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", async () => {
        const copied = await copyText(rawValue);
        const previous = copyBtn.textContent;
        copyBtn.textContent = copied ? "Copied" : "Failed";
        setTimeout(() => {
          copyBtn.textContent = previous;
        }, 900);
      });

      const revealBtn = document.createElement("button");
      revealBtn.type = "button";
      revealBtn.textContent = reveal ? "Mask" : "Reveal";
      revealBtn.addEventListener("click", () => {
        const next = !reveal;
        state.revealMap.set(key, next);
        renderEntries(state.latestEntries);
      });

      actions.appendChild(copyBtn);
      actions.appendChild(revealBtn);

      const decoded = shared.decodeJwt(rawValue);
      if (state.settings.showJwtPreview) {
        const jwtBtn = document.createElement("button");
        jwtBtn.type = "button";
        const jwtVisible = Boolean(state.jwtVisibleMap.get(key));
        jwtBtn.textContent = jwtVisible ? "Hide JWT" : "JWT Decode";
        jwtBtn.disabled = !decoded;
        if (!decoded) {
          jwtBtn.title = "Value is not a valid JWT";
        }
        jwtBtn.addEventListener("click", () => {
          const next = !Boolean(state.jwtVisibleMap.get(key));
          state.jwtVisibleMap.set(key, next);
          renderEntries(state.latestEntries);
        });
        actions.appendChild(jwtBtn);
      }

      card.appendChild(head);
      card.appendChild(valueEl);
      card.appendChild(actions);

      if (state.settings.showJwtPreview && decoded && state.jwtVisibleMap.get(key)) {
        const jwt = document.createElement("div");
        jwt.className = "tp-jwt";
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(decoded, null, 2);
        jwt.appendChild(pre);
        card.appendChild(jwt);
      }

      dom.body.appendChild(card);
    }
  }

  function buildEntriesSignature(entries) {
    return entries
      .map((entry) => {
        const parts = [
          entry.rule.id,
          entry.rule.name,
          entry.rule.source,
          entry.matchedKey,
          String(entry.value || ""),
          entry.isHttpOnly ? "1" : "0"
        ];
        return parts.join("\u001f");
      })
      .join("\u001e");
  }

  function fetchStorageMatches(rule, storageLike) {
    const matches = [];

    if (!storageLike) {
      return matches;
    }

    if (rule.keyIsRegex) {
      const regex = shared.compileRegex(rule.key);
      if (!regex) {
        return matches;
      }
      for (let index = 0; index < storageLike.length; index += 1) {
        const key = storageLike.key(index);
        if (key && regex.test(key)) {
          const value = storageLike.getItem(key);
          matches.push({ matchedKey: key, value: value == null ? "" : value });
        }
      }
      return matches;
    }

    const value = storageLike.getItem(rule.key);
    if (value != null) {
      matches.push({ matchedKey: rule.key, value });
    }

    return matches;
  }

  async function fetchCookieMatches(rules) {
    if (!rules.length) {
      return {};
    }

    const response = await shared.runtimeSendMessage({
      type: "tokenPlease:getCookies",
      url: location.href,
      rules: rules.map((rule) => ({
        id: rule.id,
        key: rule.key,
        keyIsRegex: rule.keyIsRegex
      }))
    });

    if (!response || !response.ok) {
      return {};
    }

    return response.valuesByRuleId || {};
  }

  async function collectEntries(settings) {
    const activeRules = settings.rules.filter((rule) => rule.enabled && shared.urlMatchesRuleDomains(location.href, rule));

    const entries = [];

    const cookieRules = activeRules.filter((rule) => rule.source === "cookie");
    const cookieValuesByRuleId = await fetchCookieMatches(cookieRules);

    // Fetch all cookies once for Smart ID scanning if enabled
    let allCookies = null;
    if (settings.smartIdEnabled) {
      const cookieResponse = await shared.sendMessageToGetAllCookies(location.href);
      if (cookieResponse && cookieResponse.ok && Array.isArray(cookieResponse.cookies)) {
        allCookies = cookieResponse.cookies;
      }
    }

    for (const rule of activeRules) {
      if (rule.source === "localStorage") {
        const values = fetchStorageMatches(rule, window.localStorage);
        values.forEach((item) => entries.push({ ...item, rule }));
      }

      if (rule.source === "sessionStorage") {
        const values = fetchStorageMatches(rule, window.sessionStorage);
        values.forEach((item) => entries.push({ ...item, rule }));
      }

      if (rule.source === "cookie") {
        const values = Array.isArray(cookieValuesByRuleId[rule.id]) ? cookieValuesByRuleId[rule.id] : [];
        values.forEach((item) => entries.push({ ...item, rule }));
      }
    }

    if (settings.smartIdEnabled) {
      const smartIdLocal = shared.scanSmartIdKeys(window.localStorage, "localStorage", settings.smartIdIncludePartial);
      smartIdLocal.forEach((item) => {
        entries.push({
          ...item,
          rule: {
            id: "smart-id-global",
            name: "Smart ID",
            source: item.source,
            enabled: true,
            domains: [],
            key: item.matchedKey,
            keyIsRegex: false,
            smartIdEnabled: true
          }
        });
      });

      const smartIdSession = shared.scanSmartIdKeys(window.sessionStorage, "sessionStorage", settings.smartIdIncludePartial);
      smartIdSession.forEach((item) => {
        entries.push({
          ...item,
          rule: {
            id: "smart-id-global",
            name: "Smart ID",
            source: item.source,
            enabled: true,
            domains: [],
            key: item.matchedKey,
            keyIsRegex: false,
            smartIdEnabled: true
          }
        });
      });

      if (allCookies) {
        const smartIdCookies = shared.scanSmartIdCookies(allCookies, settings.smartIdIncludePartial);
        smartIdCookies.forEach((item) => {
          entries.push({
            ...item,
            rule: {
              id: "smart-id-global",
              name: "Smart ID",
              source: "cookie",
              enabled: true,
              domains: [],
              key: item.matchedKey,
              keyIsRegex: false,
              smartIdEnabled: true
            }
          });
        });
      }
    }

    for (const rule of activeRules) {
      if (rule.smartIdEnabled) {
        if (rule.source === "localStorage") {
          const smartIdValues = shared.scanSmartIdKeys(window.localStorage, "localStorage", settings.smartIdIncludePartial);
          smartIdValues.forEach((item) => {
            entries.push({ ...item, rule: { ...rule, name: `${rule.name} (Smart ID)` } });
          });
        }
        if (rule.source === "sessionStorage") {
          const smartIdValues = shared.scanSmartIdKeys(window.sessionStorage, "sessionStorage", settings.smartIdIncludePartial);
          smartIdValues.forEach((item) => {
            entries.push({ ...item, rule: { ...rule, name: `${rule.name} (Smart ID)` } });
          });
        }
        if (rule.source === "cookie" && allCookies) {
          const smartIdValues = shared.scanSmartIdCookies(allCookies, settings.smartIdIncludePartial);
          smartIdValues.forEach((item) => {
            entries.push({ ...item, rule: { ...rule, name: `${rule.name} (Smart ID)` } });
          });
        }
      }
    }

    entries.sort((left, right) => {
      const nameComp = String(left.rule.name).localeCompare(String(right.rule.name));
      if (nameComp !== 0) {
        return nameComp;
      }
      return String(left.matchedKey).localeCompare(String(right.matchedKey));
    });

    return entries;
  }

  function setOverlayVisibility(show) {
    ensureOverlay();
    state.overlayVisible = show;
    dom.root.classList.toggle("tp-hidden", !show);
  }

  function applyCollapsePreference() {
    state.collapsed = Boolean(state.settings.collapseByDefault);
    dom.root.classList.toggle("tp-collapsed", state.collapsed);
  }

  async function runRefresh() {
    if (!state.settings || state.paused) {
      return;
    }

    const showOverlay = shouldShowOverlayForCurrentPage(state.settings);
    setOverlayVisibility(showOverlay);

    if (!showOverlay) {
      return;
    }

    const entries = await collectEntries(state.settings);
    const signature = buildEntriesSignature(entries);

    if (signature === state.latestEntriesSignature) {
      return;
    }

    state.latestEntries = entries;
    state.latestEntriesSignature = signature;
    renderEntries(entries);
  }

  function resetPolling() {
    if (state.pollingTimer) {
      clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }

    if (!state.settings || !state.settings.enabled) {
      return;
    }

    state.pollingTimer = setInterval(() => {
      runRefresh();
    }, state.settings.pollIntervalMs);
  }

  async function loadSettings() {
    state.settings = await shared.getSettings();
    state.latestEntries = [];
    state.latestEntriesSignature = "";
    await ensureOverlay();
    applyCollapsePreference();
    dom.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    resetPolling();
    await runRefresh();
  }

  function setupSpaHooks() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(() => runRefresh(), 40);
      return result;
    };

    history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(() => runRefresh(), 40);
      return result;
    };

    window.addEventListener("popstate", () => runRefresh());
    window.addEventListener("hashchange", () => runRefresh());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        runRefresh();
      }
    });
  }

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }
    if (!changes[shared.STORAGE_KEY]) {
      return;
    }
    loadSettings();
  });

  setupSpaHooks();
  loadSettings();
})();
