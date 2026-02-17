(() => {
  "use strict";

  const EXT_VERSION = (() => {
    try {
      return chrome.runtime.getManifest()?.version || "unknown";
    } catch {
      return "unknown";
    }
  })();

  const IDS = {
    injectScript: "miku-ytbypass-inject",
    hideStyle: "miku-ytbypass-style",
    statusStyle: "miku-ytbypass-status-style",
    statusToast: "miku-ytbypass-status-toast"
  };

  const INTERVALS = {
    lightLoopMs: 1200,
    routeCheckMs: 1000,
    fastWatchLoopMs: 300,
    toastVisibleMs: 2000
  };

  const SELECTORS = {
    hide: [
      "ytd-display-ad-renderer",
      "ytd-video-masthead-ad-advertiser-info-renderer",
      "ytd-ad-slot-renderer",
      "ytd-in-feed-ad-layout-renderer",
      "ytd-banner-promo-renderer-background",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-search-pyv-renderer",
      ".ytp-ad-overlay-container",
      ".ytp-ad-text-overlay",
      ".ytp-ad-image-overlay",
      ".ytp-ad-message-container",
      ".ytp-ad-player-overlay",
      ".video-ads",
      ".ytp-ad-module",
      "#player-ads",
      "ytd-enforcement-message-view-model",
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']",
      "ytd-ads-engagement-panel-content-renderer",
      "panel-ad-header-image-lockup-view-model",
      "panel-text-icon-text-grid-cards-sub-layout-content-view-model",
      "ad-avatar-lockup-view-model",
      "ad-button-view-model",
      "ad-grid-card-collection-view-model",
      "ad-grid-card-text-view-model"
    ],
    skipButtons: [
      "button.ytp-ad-skip-button",
      "button.ytp-ad-skip-button-modern",
      ".ytp-skip-ad-button",
      "button.ytp-ad-overlay-close-button",
      ".ytp-ad-skip-button-slot button",
      ".ytp-skip-ad-button__text",
      ".ytp-skip-ad-button__icon"
    ],
    playerButtons: "button, [role='button']",
    playerRoot: ".html5-video-player",
    watchVideo: "video",
    antiAdblockOverlay: "ytd-enforcement-message-view-model",
    antiAdblockDialog: "tp-yt-paper-dialog",
    antiAdblockBackdrop: "tp-yt-iron-overlay-backdrop",
    engagementAdPanel: "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']",
    adPanelToggleCandidates: "toggle-button-view-model button, [aria-label*='duoc tai tro'], [aria-label*='sponsored']",
    skipUiSignals: ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button",
    adSignalElements:
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-preview-container, .ytp-ad-duration-remaining"
  };

  const SKIP_TEXT_HINTS = [
    "skip",
    "skip ad",
    "skip ads",
    "skip this ad",
    "bo qua",
    "bo qua quang cao",
    "bo qua quang cao nay"
  ];

  const CLOSE_TEXT_HINTS = ["dong", "close"];

  const state = {
    savedMuted: null,
    savedPlaybackRate: null,
    currentRoute: getRouteKey(),
    fastLoopId: null,
    statusHideTimerId: null,
    hasShownToastOnce: false,
    skipClickCount: 0,
    adSessionCount: 0,
    isAdActive: false,
    logThrottleMap: new Map()
  };

  function getRouteKey() {
    return `${location.pathname}${location.search}`;
  }

  function sendRuntimeMessage(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, payload });
    } catch {
      // Ignore runtime messaging failures.
    }
  }

  function shouldThrottle(key, throttleMs) {
    if (!key) {
      return false;
    }
    const now = Date.now();
    const previous = state.logThrottleMap.get(key) || 0;
    if (now - previous < throttleMs) {
      return true;
    }
    state.logThrottleMap.set(key, now);
    return false;
  }

  function pushDevLog(level, message, data = {}, throttleKey = null, throttleMs = 0) {
    if (shouldThrottle(throttleKey, throttleMs)) {
      return;
    }

    sendRuntimeMessage("devlog", {
      level,
      message,
      data,
      timestamp: Date.now()
    });
  }

  function updateDevStatus(patch = {}) {
    sendRuntimeMessage("devstatus", {
      version: EXT_VERSION,
      route: getRouteKey(),
      extensionActive: true,
      ...patch,
      timestamp: Date.now()
    });
  }

  function ensureInjectedPageScript() {
    if (document.getElementById(IDS.injectScript)) {
      return;
    }

    const script = document.createElement("script");
    script.id = IDS.injectScript;
    script.src = chrome.runtime.getURL("inject.js");
    script.dataset.extVersion = EXT_VERSION;
    script.async = false;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function ensureHideStyle() {
    if (document.getElementById(IDS.hideStyle)) {
      return;
    }

    const style = document.createElement("style");
    style.id = IDS.hideStyle;
    style.textContent = `${SELECTORS.hide.join(",")} { display: none !important; }`;
    document.documentElement.appendChild(style);
  }

  function ensureStatusStyle() {
    if (document.getElementById(IDS.statusStyle)) {
      return;
    }

    const style = document.createElement("style");
    style.id = IDS.statusStyle;
    style.textContent = `
      @keyframes mikuToastIn {
        from { opacity: 0; transform: translateY(12px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes mikuToastOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(10px) scale(0.98); }
      }
      #${IDS.statusToast} {
        position: fixed;
        left: 16px;
        bottom: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 52px;
        max-width: min(340px, calc(100vw - 24px));
        padding: 8px 12px 8px 8px;
        border-radius: 14px;
        border: 1px solid rgba(117, 205, 255, 0.5);
        background: linear-gradient(135deg, rgba(20, 26, 49, 0.92), rgba(169, 45, 134, 0.88));
        color: #f4f8ff;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(8px);
        z-index: 2147483647;
        pointer-events: none;
        box-sizing: border-box;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px) scale(0.98);
      }
      #${IDS.statusToast}.is-visible {
        visibility: visible;
        animation: mikuToastIn 180ms ease-out forwards;
      }
      #${IDS.statusToast}.is-hiding {
        visibility: visible;
        animation: mikuToastOut 180ms ease-in forwards;
      }
      #${IDS.statusToast} img {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.45);
        flex: 0 0 auto;
      }
      #${IDS.statusToast} .miku-status-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      #${IDS.statusToast} .miku-status-title {
        font: 700 13px/1.1 "Segoe UI", Tahoma, sans-serif;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }
      #${IDS.statusToast} .miku-status-sub {
        font: 500 11px/1.2 "Segoe UI", Tahoma, sans-serif;
        color: #d2e9ff;
        opacity: 0.9;
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        #${IDS.statusToast} {
          left: 10px;
          right: 10px;
          bottom: 10px;
          max-width: none;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureStatusToast() {
    ensureStatusStyle();

    const existing = document.getElementById(IDS.statusToast);
    if (existing instanceof HTMLElement) {
      return existing;
    }

    const toast = document.createElement("div");
    toast.id = IDS.statusToast;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-label", "MikuYTBypass status");

    const avatar = document.createElement("img");
    avatar.alt = "Miku";
    avatar.src = chrome.runtime.getURL("image/miku.png");

    const textWrap = document.createElement("div");
    textWrap.className = "miku-status-text";

    const title = document.createElement("div");
    title.className = "miku-status-title";
    title.textContent = "Adblock Working!";

    const subtitle = document.createElement("div");
    subtitle.className = "miku-status-sub";
    subtitle.textContent = "MikuYTBypass Notify!";

    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);
    toast.appendChild(avatar);
    toast.appendChild(textWrap);

    (document.body || document.documentElement).appendChild(toast);
    return toast;
  }

  function showStatusToast() {
    if (state.hasShownToastOnce) {
      return;
    }

    const toast = ensureStatusToast();
    state.hasShownToastOnce = true;
    toast.classList.remove("is-hiding");
    toast.classList.add("is-visible");

    if (state.statusHideTimerId !== null) {
      clearTimeout(state.statusHideTimerId);
      state.statusHideTimerId = null;
    }

    state.statusHideTimerId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.classList.add("is-hiding");
      state.statusHideTimerId = null;
    }, INTERVALS.toastVisibleMs);
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getClickableTarget(element) {
    const direct = element.closest("button, [role='button'], .ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern");
    if (direct instanceof HTMLElement) {
      return direct;
    }

    let node = element;
    for (let i = 0; i < 6 && node; i += 1) {
      if (!(node instanceof HTMLElement)) {
        break;
      }

      const className = node.className || "";
      const looksClickable =
        node.tabIndex >= 0 ||
        typeof node.onclick === "function" ||
        node.getAttribute("role") === "button" ||
        /ytp-(?:skip|ad).*button/.test(className);

      if (looksClickable) {
        return node;
      }
      node = node.parentElement;
    }

    return element;
  }

  function fireClick(element) {
    const target = getClickableTarget(element);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (typeof PointerEvent === "function") {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true }));
      target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, composed: true }));
    }

    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
    target.click();
  }

  function collectSkipCandidates(player) {
    const candidates = new Set();

    for (const selector of SELECTORS.skipButtons) {
      const matches = document.querySelectorAll(selector);
      for (const match of matches) {
        if (match instanceof HTMLElement) {
          candidates.add(match);
        }
      }
    }

    if (!(player instanceof HTMLElement)) {
      return candidates;
    }

    const buttonCandidates = player.querySelectorAll(SELECTORS.playerButtons);
    for (const candidate of buttonCandidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }

      const label = normalizeText(
        [candidate.getAttribute("aria-label"), candidate.getAttribute("title"), candidate.textContent].join(" ")
      );
      if (SKIP_TEXT_HINTS.some((hint) => label.includes(hint))) {
        candidates.add(candidate);
      }
    }

    return candidates;
  }

  function clickSkipButtons() {
    const player = document.querySelector(SELECTORS.playerRoot);
    const candidates = collectSkipCandidates(player);

    let clicked = 0;
    for (const candidate of candidates) {
      fireClick(candidate);
      clicked += 1;
    }

    if (clicked > 0) {
      state.skipClickCount += clicked;
      updateDevStatus({ skipClicks: state.skipClickCount });
      pushDevLog(
        "info",
        "Skip button click fired",
        { clicked, totalSkipClicks: state.skipClickCount },
        "skip-click",
        700
      );
    }

    return clicked;
  }

  function dismissAntiAdblockPopup() {
    const overlay = document.querySelector(SELECTORS.antiAdblockOverlay);
    if (!overlay) {
      return;
    }

    const dialog = overlay.closest(SELECTORS.antiAdblockDialog);
    const backdrop = document.querySelector(SELECTORS.antiAdblockBackdrop);

    if (dialog) {
      dialog.remove();
    }
    if (backdrop) {
      backdrop.remove();
    }

    document.documentElement.style.removeProperty("overflow");
    document.body?.style?.removeProperty("overflow");
    pushDevLog("warn", "Anti-adblock popup dismissed", {}, "anti-popup-dismissed", 4000);
  }

  function isCloseButton(button) {
    if (!(button instanceof HTMLElement)) {
      return false;
    }
    const label = normalizeText(
      [button.getAttribute("aria-label"), button.getAttribute("title"), button.textContent].join(" ")
    );
    return CLOSE_TEXT_HINTS.some((hint) => label.includes(hint));
  }

  function dismissEngagementPanelAds() {
    const panels = document.querySelectorAll(SELECTORS.engagementAdPanel);
    let handledPanels = 0;

    for (const panel of panels) {
      if (!(panel instanceof HTMLElement)) {
        continue;
      }

      panel.setAttribute("visibility", "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN");
      panel.style.display = "none";
      handledPanels += 1;

      const closeButtons = panel.querySelectorAll(SELECTORS.playerButtons);
      for (const closeButton of closeButtons) {
        if (isCloseButton(closeButton)) {
          fireClick(closeButton);
          break;
        }
      }
    }

    const toggles = document.querySelectorAll(SELECTORS.adPanelToggleCandidates);
    for (const toggle of toggles) {
      if (!(toggle instanceof HTMLElement)) {
        continue;
      }
      const adPanel = toggle.closest(SELECTORS.engagementAdPanel);
      if (adPanel instanceof HTMLElement) {
        adPanel.style.display = "none";
      }
    }

    if (handledPanels > 0) {
      pushDevLog("info", "Engagement ad panel hidden", { handledPanels }, "engagement-ad-panel", 2500);
    }
  }

  function hasStrongAdSignal(player) {
    if (!(player instanceof HTMLElement)) {
      return false;
    }

    if (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting")) {
      return true;
    }

    return Boolean(player.querySelector(SELECTORS.adSignalElements));
  }

  function handleVideoAd() {
    if (location.pathname !== "/watch") {
      return;
    }

    const player = document.querySelector(SELECTORS.playerRoot);
    const video = document.querySelector(SELECTORS.watchVideo);
    const isAdShowing = hasStrongAdSignal(player);

    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    if (isAdShowing) {
      if (!state.isAdActive) {
        state.isAdActive = true;
        state.adSessionCount += 1;
        updateDevStatus({ adState: "in_ad", adSessions: state.adSessionCount });
        pushDevLog("warn", "Ad detected", { adSessions: state.adSessionCount }, "ad-start", 300);
      }

      if (state.savedMuted === null) {
        state.savedMuted = video.muted;
      }
      if (state.savedPlaybackRate === null) {
        state.savedPlaybackRate = video.playbackRate;
      }

      video.muted = true;
      video.playbackRate = 16;

      const hasFiniteDuration = Number.isFinite(video.duration) && video.duration > 0;
      const looksLikeAdLength = hasFiniteDuration && video.duration <= 120;
      const hasSkipUi = Boolean(player?.querySelector(SELECTORS.skipUiSignals));
      if (looksLikeAdLength && hasSkipUi && video.currentTime < video.duration - 0.2) {
        video.currentTime = Math.max(0, video.duration - 0.1);
      }

      clickSkipButtons();
      return;
    }

    if (state.isAdActive) {
      state.isAdActive = false;
      updateDevStatus({ adState: "idle", adSessions: state.adSessionCount });
      pushDevLog("info", "Ad ended", { adSessions: state.adSessionCount }, "ad-end", 300);
    }

    if (state.savedMuted !== null) {
      video.muted = state.savedMuted;
      state.savedMuted = null;
    }
    if (state.savedPlaybackRate !== null) {
      video.playbackRate = state.savedPlaybackRate;
      state.savedPlaybackRate = null;
    }
  }

  function runLight() {
    ensureInjectedPageScript();
    ensureHideStyle();
    showStatusToast();
    dismissAntiAdblockPopup();
    dismissEngagementPanelAds();
    clickSkipButtons();
  }

  function runFast() {
    clickSkipButtons();
    handleVideoAd();
  }

  function resetFastLoop() {
    if (state.fastLoopId !== null) {
      clearInterval(state.fastLoopId);
      state.fastLoopId = null;
    }

    if (location.pathname === "/watch") {
      state.fastLoopId = window.setInterval(runFast, INTERVALS.fastWatchLoopMs);
    }
  }

  function onRouteMaybeChanged() {
    const nextRoute = getRouteKey();
    if (nextRoute === state.currentRoute) {
      return;
    }

    state.currentRoute = nextRoute;
    updateDevStatus({
      route: state.currentRoute,
      adState: state.isAdActive ? "in_ad" : "idle",
      adSessions: state.adSessionCount,
      skipClicks: state.skipClickCount
    });
    pushDevLog("info", "Route changed", { route: state.currentRoute }, "route-change", 250);

    resetFastLoop();
    runLight();
    runFast();
  }

  function init() {
    document.addEventListener("yt-navigate-finish", onRouteMaybeChanged);
    window.addEventListener("popstate", onRouteMaybeChanged);

    window.setInterval(runLight, INTERVALS.lightLoopMs);
    window.setInterval(onRouteMaybeChanged, INTERVALS.routeCheckMs);

    updateDevStatus({
      route: state.currentRoute,
      adState: "idle",
      adSessions: state.adSessionCount,
      skipClicks: state.skipClickCount
    });
    pushDevLog("info", "Content script initialized", { route: state.currentRoute, version: EXT_VERSION }, "init", 0);
    console.info(`[MikuYTBypass v${EXT_VERSION}] Content script initialized`, { route: state.currentRoute });

    resetFastLoop();
    runLight();
    runFast();
  }

  init();
})();
