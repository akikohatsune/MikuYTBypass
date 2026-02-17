"use strict";

const tabId = Number(new URLSearchParams(window.location.search).get("tabId"));

const elements = {
  route: document.getElementById("status-route"),
  adState: document.getElementById("status-ad-state"),
  adSessions: document.getElementById("status-ad-sessions"),
  skipClicks: document.getElementById("status-skip-clicks"),
  updated: document.getElementById("status-updated"),
  logs: document.getElementById("logs"),
  clearButton: document.getElementById("clear-logs-btn"),
  connectionDot: document.getElementById("conn-dot")
};

const MESSAGE_TYPE = {
  state: "state",
  status: "status",
  log: "log",
  logsCleared: "logs-cleared",
  init: "init",
  clearLogs: "clear-logs"
};

let port = null;

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "-";
  }
  return new Date(timestamp).toLocaleTimeString();
}

function setConnected(isConnected) {
  elements.connectionDot.classList.toggle("connected", isConnected);
}

function renderStatus(status) {
  const safeStatus = status && typeof status === "object" ? status : {};
  elements.route.textContent = safeStatus.route || "-";
  elements.adState.textContent = safeStatus.adState || "idle";
  elements.adSessions.textContent = String(safeStatus.adSessions || 0);
  elements.skipClicks.textContent = String(safeStatus.skipClicks || 0);
  elements.updated.textContent = formatTime(safeStatus.timestamp);
}

function createLogNode(log) {
  const safeLog = log && typeof log === "object" ? log : {};
  const item = document.createElement("div");
  item.className = `log-item ${safeLog.level || "info"}`;

  const head = document.createElement("div");
  head.className = "log-head";

  const level = document.createElement("span");
  level.textContent = String(safeLog.level || "info").toUpperCase();

  const timestamp = document.createElement("span");
  timestamp.textContent = formatTime(safeLog.timestamp);

  head.appendChild(level);
  head.appendChild(timestamp);

  const message = document.createElement("div");
  message.className = "log-msg";
  message.textContent = safeLog.message || "event";

  const data = document.createElement("div");
  data.className = "log-data";
  data.textContent = JSON.stringify(safeLog.data || {}, null, 2);

  item.appendChild(head);
  item.appendChild(message);
  item.appendChild(data);
  return item;
}

function renderEmptyLogs() {
  elements.logs.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = "No logs yet.";
  elements.logs.appendChild(empty);
}

function renderLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    renderEmptyLogs();
    return;
  }

  elements.logs.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const log of logs) {
    fragment.appendChild(createLogNode(log));
  }
  elements.logs.appendChild(fragment);
}

function prependLog(log) {
  const empty = elements.logs.querySelector(".empty");
  if (empty) {
    empty.remove();
  }
  elements.logs.prepend(createLogNode(log));
}

function handlePortMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  switch (message.type) {
    case MESSAGE_TYPE.state:
      renderStatus(message.state?.status);
      renderLogs(message.state?.logs || []);
      return;
    case MESSAGE_TYPE.status:
      renderStatus(message.status);
      return;
    case MESSAGE_TYPE.log:
      prependLog(message.log);
      return;
    case MESSAGE_TYPE.logsCleared:
      renderEmptyLogs();
      return;
    default:
      return;
  }
}

function connectDevtoolsPort() {
  if (!Number.isInteger(tabId) || tabId < 0) {
    renderEmptyLogs();
    return;
  }

  port = chrome.runtime.connect({ name: "miku-devtools" });
  port.onMessage.addListener(handlePortMessage);
  port.onDisconnect.addListener(() => {
    setConnected(false);
    port = null;
  });

  setConnected(true);
  port.postMessage({ type: MESSAGE_TYPE.init, tabId });
}

function clearLogs() {
  if (!port) {
    return;
  }
  port.postMessage({ type: MESSAGE_TYPE.clearLogs });
}

function init() {
  elements.clearButton.addEventListener("click", clearLogs);
  connectDevtoolsPort();
}

init();
