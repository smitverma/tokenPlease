(function () {
  const STORAGE_KEY = "tokenPlease.settings.v1";

  const DEFAULT_SETTINGS = {
    enabled: true,
    pollIntervalMs: 5000,
    collapseByDefault: false,
    showJwtPreview: true,
    maskByDefault: false,
    maxPreviewLength: 20,
    rules: []
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeDomainInput(input) {
    const raw = String(input || "").trim();
    if (!raw) {
      return "";
    }

    if (raw.startsWith("*.")) {
      return `*.${raw.slice(2).toLowerCase()}`;
    }

    if (raw.startsWith(".")) {
      return raw.toLowerCase();
    }

    try {
      const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
      return parsed.hostname.toLowerCase();
    } catch (error) {
      const noPath = raw.split("/")[0];
      return noPath.toLowerCase();
    }
  }

  function normalizeRule(rule) {
    const id = rule && rule.id ? String(rule.id) : uid("rule");
    const source = ["localStorage", "sessionStorage", "cookie"].includes(rule && rule.source)
      ? rule.source
      : "localStorage";

    const domains = Array.isArray(rule && rule.domains)
      ? rule.domains
          .map((domain) => normalizeDomainInput(domain))
          .filter(Boolean)
      : [];

    return {
      id,
      name: String((rule && rule.name) || "New Rule").trim() || "New Rule",
      enabled: rule && typeof rule.enabled === "boolean" ? rule.enabled : true,
      domains,
      source,
      key: String((rule && rule.key) || "").trim(),
      keyIsRegex: Boolean(rule && rule.keyIsRegex)
    };
  }

  function normalizeSettings(input) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, input || {});
    const rules = Array.isArray(merged.rules) ? merged.rules.map(normalizeRule).filter((rule) => rule.key) : [];

    return {
      enabled: Boolean(merged.enabled),
      pollIntervalMs: clampNumber(merged.pollIntervalMs, 250, 10000, DEFAULT_SETTINGS.pollIntervalMs),
      collapseByDefault: Boolean(merged.collapseByDefault),
      showJwtPreview: Boolean(merged.showJwtPreview),
      maskByDefault: Boolean(merged.maskByDefault),
      maxPreviewLength: clampNumber(merged.maxPreviewLength, 16, 240, DEFAULT_SETTINGS.maxPreviewLength),
      rules: rules.length ? rules : deepClone(DEFAULT_SETTINGS.rules)
    };
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(numeric)));
  }

  function hostMatchesDomain(hostname, domainPattern) {
    const host = String(hostname || "").toLowerCase();
    const pattern = normalizeDomainInput(domainPattern);

    if (!host || !pattern) {
      return false;
    }

    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }

    if (pattern.startsWith(".")) {
      const base = pattern.slice(1);
      return host === base || host.endsWith(`.${base}`);
    }

    return host === pattern || host.endsWith(`.${pattern}`);
  }

  function urlMatchesRuleDomains(url, rule) {
    if (!rule || !Array.isArray(rule.domains) || !rule.domains.length) {
      return false;
    }

    let hostname = "";
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (error) {
      return false;
    }

    return rule.domains.some((domainPattern) => hostMatchesDomain(hostname, domainPattern));
  }

  function compileRegex(pattern) {
    try {
      return new RegExp(pattern);
    } catch (error) {
      return null;
    }
  }

  function matchKey(key, rule) {
    if (!rule || !rule.key) {
      return false;
    }

    if (rule.keyIsRegex) {
      const compiled = compileRegex(rule.key);
      return compiled ? compiled.test(key) : false;
    }

    return key === rule.key;
  }

  function safeJsonParse(value) {
    if (typeof value !== "string") {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function decodeJwt(token) {
    if (typeof token !== "string") {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const json = atob(padded);
      return safeJsonParse(json);
    } catch (error) {
      return null;
    }
  }

  function truncateMiddle(text, maxLength) {
    const value = String(text == null ? "" : text);
    const max = Math.max(8, Number(maxLength) || 56);
    if (value.length <= max) {
      return value;
    }
    const side = Math.floor((max - 3) / 2);
    return `${value.slice(0, side)}...${value.slice(value.length - side)}`;
  }

  function getBrowserApi() {
    if (typeof browser !== "undefined") {
      return browser;
    }
    if (typeof chrome !== "undefined") {
      return chrome;
    }
    throw new Error("Browser extension API is unavailable.");
  }

  function usingBrowserNamespace() {
    return typeof browser !== "undefined";
  }

  function callbackToPromise(invoker) {
    return new Promise((resolve, reject) => {
      try {
        invoker((result) => {
          const lastError =
            typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError
              ? chrome.runtime.lastError
              : null;

          if (lastError) {
            reject(new Error(lastError.message || "Extension API call failed."));
            return;
          }

          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function storageSyncGet(key) {
    const api = getBrowserApi();
    if (usingBrowserNamespace()) {
      return api.storage.sync.get(key);
    }
    return callbackToPromise((done) => api.storage.sync.get(key, done));
  }

  async function storageSyncSet(value) {
    const api = getBrowserApi();
    if (usingBrowserNamespace()) {
      return api.storage.sync.set(value);
    }
    return callbackToPromise((done) => api.storage.sync.set(value, done));
  }

  async function runtimeSendMessage(message) {
    const api = getBrowserApi();
    if (usingBrowserNamespace()) {
      return api.runtime.sendMessage(message);
    }
    return callbackToPromise((done) => api.runtime.sendMessage(message, done));
  }

  async function runtimeOpenOptionsPage() {
    const api = getBrowserApi();
    if (usingBrowserNamespace()) {
      return api.runtime.openOptionsPage();
    }
    return callbackToPromise((done) => api.runtime.openOptionsPage(done));
  }

  async function cookiesGetAll(details) {
    const api = getBrowserApi();
    if (usingBrowserNamespace()) {
      return api.cookies.getAll(details);
    }
    return callbackToPromise((done) => api.cookies.getAll(details, done));
  }

  function runtimeGetURL(path) {
    return getBrowserApi().runtime.getURL(path);
  }

  function addRuntimeMessageListener(handler) {
    const api = getBrowserApi();
    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      let output;
      try {
        output = handler(message, sender);
      } catch (error) {
        sendResponse({ ok: false, error: error && error.message ? error.message : "Unhandled error" });
        return true;
      }

      if (output && typeof output.then === "function") {
        output
          .then((value) => {
            sendResponse(value);
          })
          .catch((error) => {
            sendResponse({ ok: false, error: error && error.message ? error.message : "Unhandled error" });
          });
        return true;
      }

      sendResponse(output);
      return true;
    });
  }

  async function getSettings() {
    const result = await storageSyncGet(STORAGE_KEY);
    return normalizeSettings(result[STORAGE_KEY]);
  }

  async function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    await storageSyncSet({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  const sharedApi = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    deepClone,
    uid,
    normalizeDomainInput,
    normalizeRule,
    normalizeSettings,
    hostMatchesDomain,
    urlMatchesRuleDomains,
    compileRegex,
    matchKey,
    decodeJwt,
    truncateMiddle,
    getBrowserApi,
    storageSyncGet,
    storageSyncSet,
    runtimeSendMessage,
    runtimeOpenOptionsPage,
    cookiesGetAll,
    runtimeGetURL,
    addRuntimeMessageListener,
    getSettings,
    saveSettings
  };

  if (typeof window !== "undefined") {
    window.TokenPleaseShared = sharedApi;
  }
  if (typeof self !== "undefined") {
    self.TokenPleaseShared = sharedApi;
  }
})();
