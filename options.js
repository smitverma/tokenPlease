(function () {
  const shared = window.TokenPleaseShared;

  const state = {
    settings: null,
    toastTimer: null
  };

  const elements = {
    menuButtons: Array.from(document.querySelectorAll(".menu-btn")),
    panels: {
      rules: document.getElementById("panel-rules"),
      behavior: document.getElementById("panel-behavior"),
      data: document.getElementById("panel-data"),
      about: document.getElementById("panel-about")
    },
    rulesList: document.getElementById("rules-list"),
    addRuleBtn: document.getElementById("add-rule-btn"),
    globalEnabled: document.getElementById("global-enabled"),
    pollInterval: document.getElementById("poll-interval"),
    collapseDefault: document.getElementById("collapse-default"),
    maskDefault: document.getElementById("mask-default"),
    showJwt: document.getElementById("show-jwt"),
    smartIdEnabled: document.getElementById("smart-id-enabled"),
    smartIdPartial: document.getElementById("smart-id-partial"),
    maxPreview: document.getElementById("max-preview"),
    exportBtn: document.getElementById("export-btn"),
    importBtn: document.getElementById("import-btn"),
    dataBox: document.getElementById("data-box"),
    dialog: document.getElementById("rule-dialog"),
    dialogTitle: document.getElementById("rule-dialog-title"),
    ruleForm: document.getElementById("rule-form"),
    ruleId: document.getElementById("rule-id"),
    ruleName: document.getElementById("rule-name"),
    ruleEnabled: document.getElementById("rule-enabled"),
    ruleSource: document.getElementById("rule-source"),
    ruleDomains: document.getElementById("rule-domains"),
    ruleKey: document.getElementById("rule-key"),
    ruleKeyRegex: document.getElementById("rule-key-regex"),
    ruleSmartId: document.getElementById("rule-smart-id"),
    cancelRuleBtn: document.getElementById("cancel-rule-btn"),
    toast: document.getElementById("toast")
  };

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    state.toastTimer = setTimeout(() => {
      elements.toast.classList.remove("show");
      state.toastTimer = null;
    }, 1400);
  }

  function switchPanel(target) {
    Object.keys(elements.panels).forEach((name) => {
      const active = name === target;
      elements.panels[name].classList.toggle("active", active);
    });

    elements.menuButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.target === target);
    });
  }

  function setBehaviorFields() {
    elements.globalEnabled.checked = state.settings.enabled;
    elements.pollInterval.value = state.settings.pollIntervalMs;
    elements.collapseDefault.checked = state.settings.collapseByDefault;
    elements.maskDefault.checked = state.settings.maskByDefault;
    elements.showJwt.checked = state.settings.showJwtPreview;
    elements.smartIdEnabled.checked = state.settings.smartIdEnabled;
    elements.smartIdPartial.checked = state.settings.smartIdIncludePartial;
    elements.maxPreview.value = state.settings.maxPreviewLength;
  }

  function getRuleSummary(rule) {
    const domains = rule.domains.length ? rule.domains.join(", ") : "none";
    const keyLabel = rule.keyIsRegex ? `regex:${rule.key}` : `key:${rule.key}`;
    return [rule.source, keyLabel, domains];
  }

  function renderRules() {
    elements.rulesList.innerHTML = "";

    if (!state.settings.rules.length) {
      const empty = document.createElement("div");
      empty.className = "rules-empty";
      empty.textContent = "No Rules";
      empty.style.fontSize = "30px";
      elements.rulesList.appendChild(empty);
      return;
    }

    for (const rule of state.settings.rules) {
      const row = document.createElement("div");
      row.className = "rule-row";

      const left = document.createElement("div");

      const title = document.createElement("div");
      title.className = "rule-title";
      title.textContent = rule.name;

      const meta = document.createElement("div");
      meta.className = "rule-meta";
      getRuleSummary(rule).forEach((part) => {
        const span = document.createElement("span");
        span.textContent = part;
        meta.appendChild(span);
      });

      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "rule-actions";

      const enabled = document.createElement("input");
      enabled.type = "checkbox";
      enabled.checked = rule.enabled;
      enabled.title = "Enable/Disable";
      enabled.addEventListener("change", async () => {
        rule.enabled = enabled.checked;
        await persistSettings();
        renderRules();
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openRuleDialog(rule));

      const duplicateBtn = document.createElement("button");
      duplicateBtn.type = "button";
      duplicateBtn.textContent = "Duplicate";
      duplicateBtn.addEventListener("click", async () => {
        const copy = shared.normalizeRule({
          ...shared.deepClone(rule),
          id: shared.uid("rule"),
          name: `${rule.name} (copy)`
        });
        state.settings.rules.push(copy);
        await persistSettings();
        renderRules();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async () => {
        state.settings.rules = state.settings.rules.filter((item) => item.id !== rule.id);
        await persistSettings();
        renderRules();
      });

      actions.appendChild(enabled);
      actions.appendChild(editBtn);
      actions.appendChild(duplicateBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(left);
      row.appendChild(actions);
      elements.rulesList.appendChild(row);
    }
  }

  function openRuleDialog(rule) {
    const editMode = Boolean(rule);

    elements.dialogTitle.textContent = editMode ? "Edit Rule" : "Add Rule";
    elements.ruleId.value = editMode ? rule.id : "";
    elements.ruleName.value = editMode ? rule.name : "";
    elements.ruleEnabled.checked = editMode ? rule.enabled : true;
    elements.ruleSource.value = editMode ? rule.source : "localStorage";
    elements.ruleDomains.value = editMode ? rule.domains.join("\n") : "";
    elements.ruleKey.value = editMode ? rule.key : "";
    elements.ruleKeyRegex.checked = editMode ? rule.keyIsRegex : false;
    elements.ruleSmartId.checked = editMode ? Boolean(rule.smartIdEnabled) : false;

    elements.dialog.showModal();
  }

  function collectRuleFormData() {
    const id = elements.ruleId.value || shared.uid("rule");
    const domains = elements.ruleDomains.value
      .split("\n")
      .map((item) => shared.normalizeDomainInput(item))
      .filter(Boolean);

    const rule = shared.normalizeRule({
      id,
      name: elements.ruleName.value,
      enabled: elements.ruleEnabled.checked,
      source: elements.ruleSource.value,
      domains,
      key: elements.ruleKey.value,
      keyIsRegex: elements.ruleKeyRegex.checked,
      smartIdEnabled: elements.ruleSmartId.checked
    });

    if (!rule.domains.length) {
      throw new Error("At least one domain is required.");
    }

    if (!rule.key) {
      throw new Error("Key is required.");
    }

    if (rule.keyIsRegex && !shared.compileRegex(rule.key)) {
      throw new Error("Invalid regex pattern.");
    }

    return rule;
  }

  function collectBehaviorFields() {
    return {
      enabled: elements.globalEnabled.checked,
      pollIntervalMs: Number(elements.pollInterval.value),
      collapseByDefault: elements.collapseDefault.checked,
      maskByDefault: elements.maskDefault.checked,
      showJwtPreview: elements.showJwt.checked,
      smartIdEnabled: elements.smartIdEnabled.checked,
      smartIdIncludePartial: elements.smartIdPartial.checked,
      maxPreviewLength: Number(elements.maxPreview.value)
    };
  }

  async function persistSettings() {
    state.settings = shared.normalizeSettings(state.settings);
    state.settings = await shared.saveSettings(state.settings);
    showToast("Saved");
  }

  async function onRuleSave(event) {
    event.preventDefault();

    try {
      const rule = collectRuleFormData();
      const index = state.settings.rules.findIndex((item) => item.id === rule.id);
      if (index >= 0) {
        state.settings.rules[index] = rule;
      } else {
        state.settings.rules.push(rule);
      }

      await persistSettings();
      renderRules();
      elements.dialog.close();
    } catch (error) {
      showToast(error.message || "Unable to save rule");
    }
  }

  async function saveBehavior() {
    const behavior = collectBehaviorFields();
    state.settings = {
      ...state.settings,
      ...behavior
    };
    await persistSettings();
    setBehaviorFields();
  }

  function exportSettings() {
    elements.dataBox.value = JSON.stringify(state.settings, null, 2);
    showToast("Exported to text box");
  }

  async function importSettings() {
    try {
      const parsed = JSON.parse(elements.dataBox.value || "{}");
      state.settings = shared.normalizeSettings(parsed);
      await persistSettings();
      renderRules();
      setBehaviorFields();
      showToast("Import complete");
    } catch (error) {
      showToast("Invalid JSON");
    }
  }

  function attachEvents() {
    elements.menuButtons.forEach((button) => {
      button.addEventListener("click", () => {
        switchPanel(button.dataset.target);
      });
    });

    elements.addRuleBtn.addEventListener("click", () => openRuleDialog(null));
    elements.globalEnabled.addEventListener("change", saveBehavior);
    elements.pollInterval.addEventListener("change", saveBehavior);
    elements.collapseDefault.addEventListener("change", saveBehavior);
    elements.maskDefault.addEventListener("change", saveBehavior);
    elements.showJwt.addEventListener("change", saveBehavior);
    elements.smartIdEnabled.addEventListener("change", saveBehavior);
    elements.smartIdPartial.addEventListener("change", saveBehavior);
    elements.maxPreview.addEventListener("change", saveBehavior);
    elements.exportBtn.addEventListener("click", exportSettings);
    elements.importBtn.addEventListener("click", importSettings);
    elements.ruleForm.addEventListener("submit", onRuleSave);
    elements.cancelRuleBtn.addEventListener("click", () => elements.dialog.close());

    document.querySelectorAll(".number-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = button.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;

        const current = Number(input.value);
        const step = Number(input.step) || 1;
        const min = Number(input.min);
        const max = Number(input.max);

        let newValue;
        if (button.classList.contains("plus-btn")) {
          newValue = current + step;
        } else {
          newValue = current - step;
        }

        if (!isNaN(min) && newValue < min) newValue = min;
        if (!isNaN(max) && newValue > max) newValue = max;

        input.value = newValue;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  async function init() {
    attachEvents();
    state.settings = await shared.getSettings();
    renderRules();
    setBehaviorFields();
  }

  init();
})();
