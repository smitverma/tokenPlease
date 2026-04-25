(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;

  function openOptionsPage() {
    if (typeof browser !== "undefined") {
      return api.runtime.openOptionsPage();
    }

    return new Promise((resolve, reject) => {
      api.runtime.openOptionsPage(() => {
        const lastError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        if (lastError) {
          reject(new Error(lastError.message || "Unable to open options page"));
          return;
        }
        resolve();
      });
    });
  }

  document.getElementById("open-settings").addEventListener("click", async () => {
    await openOptionsPage();
    window.close();
  });
})();
