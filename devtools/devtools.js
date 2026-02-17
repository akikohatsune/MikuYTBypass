"use strict";

const tabId = chrome.devtools.inspectedWindow.tabId;
const cacheBust = Date.now();
const panelUrl =
  `devtools/panel.html?tabId=${encodeURIComponent(String(tabId))}` +
  `&cb=${encodeURIComponent(String(cacheBust))}`;

chrome.devtools.panels.create("MikuYTBypass", "", panelUrl, () => {});
