(() => {
  "use strict";

  const EXT_VERSION = (() => {
    try {
      return document.currentScript?.dataset?.extVersion || "unknown";
    } catch {
      return "unknown";
    }
  })();

  const AD_KEYS = new Set([
    "adPlacements",
    "adSlots",
    "adBreakHeartbeatParams",
    "playerAds",
    "auxiliaryUi",
    "ad3Module",
    "adSafetyReason"
  ]);

  const PLAYER_API_PATH = "/youtubei/v1/player";
  const INITIAL_SWEEP_COUNT = 6;
  const INITIAL_SWEEP_INTERVAL_MS = 1000;
  const NAV_SWEEP_DELAY_MS = 150;

  function stripAdKeys(target) {
    if (!target || typeof target !== "object") {
      return;
    }
    for (const key of AD_KEYS) {
      if (key in target) {
        delete target[key];
      }
    }
  }

  function sanitizePlayerPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return payload;
    }

    stripAdKeys(payload);
    stripAdKeys(payload.playerResponse);

    if (payload.playerResponse && typeof payload.playerResponse === "object") {
      stripAdKeys(payload.playerResponse.playerConfig);
      stripAdKeys(payload.playerResponse.playabilityStatus);
      stripAdKeys(payload.playerResponse.streamingData);
    }

    return payload;
  }

  function sanitizePlayerResponseString(maybeJson) {
    if (typeof maybeJson !== "string") {
      return maybeJson;
    }

    const hasAdHints =
      maybeJson.includes("adPlacements") || maybeJson.includes("playerAds") || maybeJson.includes("adSlots");
    if (!hasAdHints) {
      return maybeJson;
    }

    try {
      const parsed = JSON.parse(maybeJson);
      sanitizePlayerPayload(parsed);
      return JSON.stringify(parsed);
    } catch {
      return maybeJson;
    }
  }

  function isPlayerApiRequest(requestInfo) {
    const requestUrl = typeof requestInfo === "string" ? requestInfo : requestInfo?.url || "";
    return requestUrl.includes(PLAYER_API_PATH);
  }

  async function buildSanitizedResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      return response;
    }

    const cloned = response.clone();
    const payload = await cloned.json();
    sanitizePlayerPayload(payload);

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  function patchFetch() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") {
      return;
    }

    window.fetch = async function patchedFetch(...args) {
      const response = await nativeFetch.apply(this, args);
      if (!isPlayerApiRequest(args[0])) {
        return response;
      }

      try {
        return await buildSanitizedResponse(response);
      } catch {
        return response;
      }
    };
  }

  function patchInitialPlayerResponse() {
    let cachedResponse = null;

    try {
      Object.defineProperty(window, "ytInitialPlayerResponse", {
        configurable: true,
        enumerable: true,
        get() {
          return cachedResponse;
        },
        set(value) {
          cachedResponse = sanitizePlayerPayload(value);
        }
      });
    } catch {
      // Ignore if YouTube locked this property.
    }
  }

  function patchYtPlayerConfig() {
    const args = window.ytplayer?.config?.args;
    if (!args || typeof args !== "object") {
      return;
    }

    args.player_response = sanitizePlayerResponseString(args.player_response);
    if (args.raw_player_response && typeof args.raw_player_response === "object") {
      sanitizePlayerPayload(args.raw_player_response);
    }
  }

  function sweepWindowDataOnce() {
    try {
      sanitizePlayerPayload(window.ytInitialPlayerResponse);
      sanitizePlayerPayload(window.ytInitialData?.playerResponse);
      patchYtPlayerConfig();
    } catch {
      // Best effort only.
    }
  }

  function exposeVersionCommand() {
    const fullVersion = `MikuYTBypass v${EXT_VERSION}`;

    console.log("Made by akikohatsune");
    console.log("git: github.com/akikohatsune/MikuYTBypass");

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

  function scheduleSweeps() {
    for (let i = 1; i <= INITIAL_SWEEP_COUNT; i += 1) {
      setTimeout(sweepWindowDataOnce, i * INITIAL_SWEEP_INTERVAL_MS);
    }

    document.addEventListener("yt-navigate-finish", () => {
      setTimeout(sweepWindowDataOnce, NAV_SWEEP_DELAY_MS);
    });
  }

  function init() {
    exposeVersionCommand();
    patchFetch();
    patchInitialPlayerResponse();
    sweepWindowDataOnce();
    scheduleSweeps();
  }

  init();
})();
