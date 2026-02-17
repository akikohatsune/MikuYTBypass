(() => {
  "use strict";

  const HIDE_SELECTORS = [
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
  ];

  const SKIP_BUTTON_SELECTORS = [
    "button.ytp-ad-skip-button",
    "button.ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    "button.ytp-ad-overlay-close-button",
    ".ytp-ad-skip-button-slot button",
    ".ytp-skip-ad-button__text",
    ".ytp-skip-ad-button__icon"
  ];

  const SKIP_TEXT_HINTS = [
    "skip",
    "skip ad",
    "skip ads",
    "skip this ad",
    "bo qua",
    "bo qua quang cao",
    "bo qua quang cao nay"
  ];

  let savedMuted = null;
  let savedPlaybackRate = null;
  let currentPath = location.pathname + location.search;
  let fastLoopId = null;
  const STATUS_TOAST_ID = "miku-ytbypass-status-toast";
  const STATUS_STYLE_ID = "miku-ytbypass-status-style";
  let statusHideTimerId = null;
  let skipClickCount = 0;
  let adSessionCount = 0;
  let isAdActive = false;
  const logThrottleMap = new Map();

  function sendDevtoolsMessage(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, payload });
    } catch {
      // Ignore message transport failures.
    }
  }

  function pushDevLog(level, message, data, key, throttleMs) {
    if (key) {
      const now = Date.now();
      const previous = logThrottleMap.get(key) || 0;
      if (now - previous < throttleMs) {
        return;
      }
      logThrottleMap.set(key, now);
    }

    sendDevtoolsMessage("devlog", {
      level,
      message,
      data: data || {},
      timestamp: Date.now()
    });
  }

  function updateDevStatus(patch) {
    sendDevtoolsMessage("devstatus", {
      route: location.pathname + location.search,
      extensionActive: true,
      ...patch,
      timestamp: Date.now()
    });
  }

  function injectPageScript() {
    if (document.getElementById("miku-ytbypass-inject")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "miku-ytbypass-inject";
    script.src = chrome.runtime.getURL("inject.js");
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function injectHideStyle() {
    if (document.getElementById("miku-ytbypass-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "miku-ytbypass-style";
    style.textContent = `${HIDE_SELECTORS.join(",")} { display: none !important; }`;
    document.documentElement.appendChild(style);
  }

  function ensureStatusStyle() {
    if (document.getElementById(STATUS_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STATUS_STYLE_ID;
    style.textContent = `
      @keyframes mikuToastIn {
        from { opacity: 0; transform: translateY(12px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes mikuToastOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(10px) scale(0.98); }
      }
      #${STATUS_TOAST_ID} {
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
      #${STATUS_TOAST_ID}.is-visible {
        visibility: visible;
        animation: mikuToastIn 180ms ease-out forwards;
      }
      #${STATUS_TOAST_ID}.is-hiding {
        visibility: visible;
        animation: mikuToastOut 180ms ease-in forwards;
      }
      #${STATUS_TOAST_ID} img {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.45);
        flex: 0 0 auto;
      }
      #${STATUS_TOAST_ID} .miku-status-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      #${STATUS_TOAST_ID} .miku-status-title {
        font: 700 13px/1.1 "Segoe UI", Tahoma, sans-serif;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }
      #${STATUS_TOAST_ID} .miku-status-sub {
        font: 500 11px/1.2 "Segoe UI", Tahoma, sans-serif;
        color: #d2e9ff;
        opacity: 0.9;
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        #${STATUS_TOAST_ID} {
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

    const existing = document.getElementById(STATUS_TOAST_ID);
    if (existing instanceof HTMLElement) {
      return existing;
    }

    const toast = document.createElement("div");
    toast.id = STATUS_TOAST_ID;
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

    const sub = document.createElement("div");
    sub.className = "miku-status-sub";
    sub.textContent = "MikuYTBypass Notify!";

    textWrap.appendChild(title);
    textWrap.appendChild(sub);
    toast.appendChild(avatar);
    toast.appendChild(textWrap);

    (document.body || document.documentElement).appendChild(toast);
    return toast;
  }

  function showStatusToast() {
    const toast = ensureStatusToast();
    const routeKey = location.pathname + location.search;
    if (toast.dataset.routeKey === routeKey) {
      return;
    }

    toast.dataset.routeKey = routeKey;
    toast.classList.remove("is-hiding");
    toast.classList.add("is-visible");

    if (statusHideTimerId !== null) {
      clearTimeout(statusHideTimerId);
      statusHideTimerId = null;
    }

    statusHideTimerId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.classList.add("is-hiding");
      statusHideTimerId = null;
    }, 2000);
  }

  function clickSkipButtons() {
    const candidates = new Set();

    for (const selector of SKIP_BUTTON_SELECTORS) {
      const matches = document.querySelectorAll(selector);
      for (const node of matches) {
        if (node instanceof HTMLElement) {
          candidates.add(node);
        }
      }
    }

    const player = document.querySelector(".html5-video-player");
    if (player) {
      const maybeButtons = player.querySelectorAll("button, [role='button']");
      for (const node of maybeButtons) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        const label = normalizeText([
          node.getAttribute("aria-label") || "",
          node.getAttribute("title") || "",
          node.textContent || ""
        ].join(" "));

        if (SKIP_TEXT_HINTS.some((hint) => label.includes(hint))) {
          candidates.add(node);
        }
      }
    }

    let clicked = 0;
    for (const candidate of candidates) {
      fireClick(candidate);
      clicked += 1;
    }

    if (clicked > 0) {
      skipClickCount += clicked;
      updateDevStatus({ skipClicks: skipClickCount });
      pushDevLog(
        "info",
        "Skip button click fired",
        { clicked, totalSkipClicks: skipClickCount },
        "skip-click",
        700
      );
    }

    return clicked;
  }

  function normalizeText(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
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
      const cls = node.className || "";
      const looksClickable =
        node.tabIndex >= 0 ||
        typeof node.onclick === "function" ||
        node.getAttribute("role") === "button" ||
        /ytp-(?:skip|ad).*button/.test(cls);

      if (looksClickable) {
        return node;
      }
      node = node.parentElement;
    }

    return element;
  }

  function dismissAntiAdblockPopup() {
    const overlay = document.querySelector("ytd-enforcement-message-view-model");
    if (!overlay) {
      return;
    }

    const dialog = overlay.closest("tp-yt-paper-dialog");
    const backdrop = document.querySelector("tp-yt-iron-overlay-backdrop");

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
  function dismissEngagementPanelAds() {
    const panels = document.querySelectorAll("ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']");
    let handledPanels = 0;

    for (const panel of panels) {
      if (!(panel instanceof HTMLElement)) {
        continue;
      }

      panel.setAttribute("visibility", "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN");
      panel.style.display = "none";
      handledPanels += 1;

      const closeBtn = panel.querySelector(
        "button[aria-label*='Dong'], button[aria-label*='Close'], button[aria-label*='close']"
      );
      if (closeBtn instanceof HTMLElement) {
        fireClick(closeBtn);
      }
    }

    const adPanelToggles = document.querySelectorAll(
      "toggle-button-view-model button, [aria-label*='duoc tai tro'], [aria-label*='sponsored']"
    );
    for (const toggle of adPanelToggles) {
      if (toggle instanceof HTMLElement) {
        const adPanel = toggle.closest("ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']");
        if (adPanel instanceof HTMLElement) {
          adPanel.style.display = "none";
        }
      }
    }

    if (handledPanels > 0) {
      pushDevLog("info", "Engagement ad panel hidden", { handledPanels }, "engagement-ad-panel", 2500);
    }
  }
  function handleVideoAd() {
    if (location.pathname !== "/watch") {
      return;
    }

    const player = document.querySelector(".html5-video-player");
    const video = document.querySelector("video");
    const isAdShowing = hasStrongAdSignal(player);

    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    if (isAdShowing) {
      if (!isAdActive) {
        isAdActive = true;
        adSessionCount += 1;
        updateDevStatus({ adState: "in_ad", adSessions: adSessionCount });
        pushDevLog("warn", "Ad detected", { adSessions: adSessionCount }, "ad-start", 300);
      }

      if (savedMuted === null) {
        savedMuted = video.muted;
      }
      if (savedPlaybackRate === null) {
        savedPlaybackRate = video.playbackRate;
      }

      video.muted = true;
      video.playbackRate = 16;

      const looksLikeAdLength = Number.isFinite(video.duration) && video.duration > 0 && video.duration <= 120;
      const hasSkipUi = Boolean(player?.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button"));
      if (looksLikeAdLength && hasSkipUi && video.currentTime < video.duration - 0.2) {
        video.currentTime = Math.max(0, video.duration - 0.1);
      }

      clickSkipButtons();
      return;
    }

    if (isAdActive) {
      isAdActive = false;
      updateDevStatus({ adState: "idle", adSessions: adSessionCount });
      pushDevLog("info", "Ad ended", { adSessions: adSessionCount }, "ad-end", 300);
    }

    if (savedMuted !== null) {
      video.muted = savedMuted;
      savedMuted = null;
    }
    if (savedPlaybackRate !== null) {
      video.playbackRate = savedPlaybackRate;
      savedPlaybackRate = null;
    }
  }

  function hasStrongAdSignal(player) {
    if (!(player instanceof HTMLElement)) {
      return false;
    }

    if (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting")) {
      return true;
    }

    return Boolean(
      player.querySelector(
        ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-preview-container, .ytp-ad-duration-remaining"
      )
    );
  }

  function runLight() {
    injectPageScript();
    injectHideStyle();
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
    if (fastLoopId !== null) {
      clearInterval(fastLoopId);
      fastLoopId = null;
    }
    if (location.pathname === "/watch") {
      fastLoopId = window.setInterval(runFast, 300);
    }
  }

  function onRouteMaybeChanged() {
    const nextPath = location.pathname + location.search;
    if (nextPath === currentPath) {
      return;
    }
    currentPath = nextPath;
    updateDevStatus({
      route: currentPath,
      adState: isAdActive ? "in_ad" : "idle",
      adSessions: adSessionCount,
      skipClicks: skipClickCount
    });
    pushDevLog("info", "Route changed", { route: currentPath }, "route-change", 250);
    resetFastLoop();
    runLight();
    runFast();
  }

  document.addEventListener("yt-navigate-finish", onRouteMaybeChanged);
  window.addEventListener("popstate", onRouteMaybeChanged);

  window.setInterval(runLight, 1200);
  window.setInterval(onRouteMaybeChanged, 1000);

  updateDevStatus({
    route: currentPath,
    adState: "idle",
    adSessions: adSessionCount,
    skipClicks: skipClickCount
  });
  pushDevLog("info", "Content script initialized", { route: currentPath }, "init", 0);

  resetFastLoop();
  runLight();
  runFast();
})();
