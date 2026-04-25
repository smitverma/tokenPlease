(function () {
  if (!self.TokenPleaseShared && typeof importScripts === "function") {
    importScripts("shared.js");
  }

  const shared = self.TokenPleaseShared;

  function filterCookieMatches(cookies, rule) {
    if (!Array.isArray(cookies) || !rule) {
      return [];
    }

    return cookies
      .filter((cookie) => shared.matchKey(cookie.name, rule))
      .map((cookie) => ({
        matchedKey: cookie.name,
        value: cookie.value,
        isHttpOnly: Boolean(cookie.httpOnly),
        path: cookie.path,
        domain: cookie.domain,
        expires: cookie.expirationDate || null
      }));
  }

  async function getCookieValuesForRules(url, rules) {
    const cookies = await shared.cookiesGetAll({ url });
    const result = {};

    for (const rule of rules) {
      result[rule.id] = filterCookieMatches(cookies, rule);
    }

    return result;
  }

  shared.addRuntimeMessageListener((message) => {
    if (!message || !message.type) {
      return { ok: false, error: "Invalid message" };
    }

    if (message.type === "tokenPlease:getCookies") {
      const url = String(message.url || "");
      const rules = Array.isArray(message.rules) ? message.rules : [];

      return getCookieValuesForRules(url, rules)
        .then((valuesByRuleId) => ({ ok: true, valuesByRuleId }))
        .catch((error) => ({ ok: false, error: error && error.message ? error.message : "Cookie read failed" }));
    }

    if (message.type === "tokenPlease:getSettings") {
      return shared
        .getSettings()
        .then((settings) => ({ ok: true, settings }))
        .catch((error) => ({ ok: false, error: error && error.message ? error.message : "Settings read failed" }));
    }

    if (message.type === "tokenPlease:saveSettings") {
      return shared
        .saveSettings(message.settings || {})
        .then((settings) => ({ ok: true, settings }))
        .catch((error) => ({ ok: false, error: error && error.message ? error.message : "Settings save failed" }));
    }

    if (message.type === "tokenPlease:openOptions") {
      return shared
        .runtimeOpenOptionsPage()
        .then(() => ({ ok: true }))
        .catch((error) => ({ ok: false, error: error && error.message ? error.message : "Open options failed" }));
    }

    return { ok: false, error: "Unsupported message type" };
  });
})();
