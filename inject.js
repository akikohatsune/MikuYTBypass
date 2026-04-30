(() => {
  "use strict";

  const EXT_VERSION = (() => {
    try {
      return document.currentScript?.dataset?.extVersion || "unknown";
    } catch {
      return "unknown";
    }
  })();

  function exposeVersionCommand() {
    const fullVersion = `MikuYTBypass v${EXT_VERSION}`;
    try {
      Object.defineProperty(window, "ver", {
        configurable: true,
        enumerable: false,
        get() {
          return fullVersion;
        },
        set() {
          // Keep command stable.
        }
      });
    } catch {
      // Ignore if property cannot be redefined.
    }
  }

  // Send message to content script for devtools
  function sendToDevtools(type, payload) {
    try {
      window.postMessage({
        source: "miku-inject",
        type,
        payload
      }, "*");
    } catch {
      // Ignore errors
    }
  }

  // Expose devtools API
  function exposeDevtoolsAPI() {
    try {
      Object.defineProperty(window, "MikuDevtools", {
        configurable: true,
        enumerable: false,
        value: {
          log: (message, level = "info", data = {}) => {
            sendToDevtools("devlog", {
              message: String(message),
              level: String(level),
              data: data && typeof data === "object" ? data : {}
            });
          },
          status: (status) => {
            sendToDevtools("devstatus", status && typeof status === "object" ? status : {});
          }
        }
      });
    } catch {
      // Ignore if property cannot be redefined.
    }
  }

  function init() {
    exposeVersionCommand();
    exposeDevtoolsAPI();
  }

  init();
})();
