"use strict";

const params = new URLSearchParams(window.location.search);
const tabId = Number(params.get("tabId"));

const routeEl = document.getElementById("status-route");
const adStateEl = document.getElementById("status-ad-state");
const adSessionsEl = document.getElementById("status-ad-sessions");
const skipClicksEl = document.getElementById("status-skip-clicks");
const updatedEl = document.getElementById("status-updated");
const logsEl = document.getElementById("logs");
const clearBtn = document.getElementById("clear-logs-btn");
const connDot = document.getElementById("conn-dot");

let port = null;

function formatTime(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return new Date(value).toLocaleTimeString();
}

function renderStatus(status) {
  const safe = status && typeof status === "object" ? status : {};
  routeEl.textContent = safe.route || "-";
  adStateEl.textContent = safe.adState || "idle";
  adSessionsEl.textContent = String(safe.adSessions || 0);
  skipClicksEl.textContent = String(safe.skipClicks || 0);
  updatedEl.textContent = formatTime(safe.timestamp);
}

function createLogNode(log) {
  const item = document.createElement("div");
  item.className = `log-item ${log.level || "info"}`;

  const head = document.createElement("div");
  head.className = "log-head";
  const level = document.createElement("span");
  level.textContent = (log.level || "info").toUpperCase();
  const ts = document.createElement("span");
  ts.textContent = formatTime(log.timestamp);
  head.appendChild(level);
  head.appendChild(ts);

  const msg = document.createElement("div");
  msg.className = "log-msg";
  msg.textContent = log.message || "event";

  const data = document.createElement("div");
  data.className = "log-data";
  data.textContent = JSON.stringify(log.data || {}, null, 2);

  item.appendChild(head);
  item.appendChild(msg);
  item.appendChild(data);
  return item;
}

function renderLogs(logs) {
  logsEl.innerHTML = "";
  if (!Array.isArray(logs) || logs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No logs yet.";
    logsEl.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const log of logs) {
    fragment.appendChild(createLogNode(log));
  }
  logsEl.appendChild(fragment);
}

function prependLog(log) {
  const empty = logsEl.querySelector(".empty");
  if (empty) {
    empty.remove();
  }
  logsEl.prepend(createLogNode(log));
}

function setConnected(connected) {
  connDot.classList.toggle("connected", connected);
}

function connect() {
  if (!Number.isInteger(tabId) || tabId < 0) {
    renderLogs([]);
    return;
  }

  port = chrome.runtime.connect({ name: "miku-devtools" });

  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "state") {
      renderStatus(message.state?.status);
      renderLogs(message.state?.logs || []);
      return;
    }

    if (message.type === "status") {
      renderStatus(message.status);
      return;
    }

    if (message.type === "log") {
      prependLog(message.log);
      return;
    }

    if (message.type === "logs-cleared") {
      renderLogs([]);
    }
  });

  port.onDisconnect.addListener(() => {
    setConnected(false);
  });

  setConnected(true);
  port.postMessage({ type: "init", tabId });
}

clearBtn.addEventListener("click", () => {
  if (!port) {
    return;
  }
  port.postMessage({ type: "clear-logs" });
});

connect();
