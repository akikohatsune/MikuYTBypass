(() => {
  "use strict";

  const AD_KEYS = [
    "adPlacements",
    "adSlots",
    "adBreakHeartbeatParams",
    "playerAds",
    "auxiliaryUi",
    "ad3Module",
    "adSafetyReason"
  ];

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
      const pr = payload.playerResponse;
      stripAdKeys(pr.playerConfig);
      stripAdKeys(pr.playabilityStatus);
      stripAdKeys(pr.streamingData);
    }

    return payload;
  }

  function sanitizePlayerResponseString(maybeJson) {
    if (typeof maybeJson !== "string") {
      return maybeJson;
    }
    if (!maybeJson.includes("adPlacements") && !maybeJson.includes("playerAds") && !maybeJson.includes("adSlots")) {
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

  function patchFetch() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") {
      return;
    }

    window.fetch = async function patchedFetch(...args) {
      const response = await nativeFetch.apply(this, args);

      try {
        const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        const isPlayerApi = requestUrl.includes("/youtubei/v1/player");

        if (!isPlayerApi) {
          return response;
        }

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
      // Ignore if YouTube already locked property definition.
    }
  }

  function patchYtPlayerConfig() {
    const ytplayer = window.ytplayer;
    const args = ytplayer?.config?.args;
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
      // Best-effort sweep.
    }
  }

  patchFetch();
  patchInitialPlayerResponse();
  sweepWindowDataOnce();

  for (let i = 1; i <= 6; i += 1) {
    setTimeout(sweepWindowDataOnce, i * 1000);
  }

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(sweepWindowDataOnce, 150);
  });
})();
