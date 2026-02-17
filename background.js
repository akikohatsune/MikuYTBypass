"use strict";

const MAX_LOGS = 400;
const tabStateMap = new Map();
const tabPortsMap = new Map();

function normalizeTabId(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return null;
  }
  return num;
}

function ensureTabState(tabId) {
  let state = tabStateMap.get(tabId);
  if (!state) {
    state = {
      status: {
        extensionActive: true,
        route: "",
        adState: "idle",
        adSessions: 0,
        skipClicks: 0,
        timestamp: Date.now()
      },
      logs: []
    };
    tabStateMap.set(tabId, state);
  }
  return state;
}

function getSerializableState(tabId) {
  const state = ensureTabState(tabId);
  return {
    status: { ...state.status },
    logs: state.logs.slice()
  };
}

function postToTabPorts(tabId, payload) {
  const ports = tabPortsMap.get(tabId);
  if (!ports || ports.size === 0) {
    return;
  }

  for (const port of ports) {
    try {
      port.postMessage(payload);
    } catch {
      // Ignore stale ports.
    }
  }
}

function addLog(tabId, payload) {
  const state = ensureTabState(tabId);
  const log = {
    level: typeof payload?.level === "string" ? payload.level : "info",
    message: typeof payload?.message === "string" ? payload.message : "event",
    data: payload?.data && typeof payload.data === "object" ? payload.data : {},
    timestamp: Number.isFinite(payload?.timestamp) ? payload.timestamp : Date.now()
  };

  state.logs.unshift(log);
  if (state.logs.length > MAX_LOGS) {
    state.logs.length = MAX_LOGS;
  }

  postToTabPorts(tabId, { type: "log", log });
}

function updateStatus(tabId, payload) {
  const state = ensureTabState(tabId);
  const safePatch = payload && typeof payload === "object" ? payload : {};
  state.status = {
    ...state.status,
    ...safePatch,
    timestamp: Number.isFinite(safePatch.timestamp) ? safePatch.timestamp : Date.now()
  };

  postToTabPorts(tabId, { type: "status", status: state.status });
}

function bindPortToTab(tabId, port) {
  let ports = tabPortsMap.get(tabId);
  if (!ports) {
    ports = new Set();
    tabPortsMap.set(tabId, ports);
  }
  ports.add(port);
}

function unbindPortFromAllTabs(port) {
  for (const [tabId, ports] of tabPortsMap.entries()) {
    if (ports.delete(port) && ports.size === 0) {
      tabPortsMap.delete(tabId);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "devtools:get-state") {
    const tabId = normalizeTabId(message.tabId);
    sendResponse({
      ok: tabId !== null,
      state: tabId === null ? null : getSerializableState(tabId)
    });
    return;
  }

  const senderTabId = normalizeTabId(sender?.tab?.id);
  const explicitTabId = normalizeTabId(message.tabId);
  const tabId = explicitTabId ?? senderTabId;
  if (tabId === null) {
    return;
  }

  if (message.type === "devlog") {
    addLog(tabId, message.payload);
    return;
  }

  if (message.type === "devstatus") {
    updateStatus(tabId, message.payload);
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "miku-devtools") {
    return;
  }

  let connectedTabId = null;

  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "init") {
      const tabId = normalizeTabId(message.tabId);
      if (tabId === null) {
        return;
      }

      connectedTabId = tabId;
      bindPortToTab(tabId, port);
      port.postMessage({ type: "state", state: getSerializableState(tabId) });
      return;
    }

    if (connectedTabId === null) {
      return;
    }

    if (message.type === "clear-logs") {
      const state = ensureTabState(connectedTabId);
      state.logs = [];
      postToTabPorts(connectedTabId, { type: "logs-cleared" });
    }
  });

  port.onDisconnect.addListener(() => {
    unbindPortFromAllTabs(port);
  });
});
