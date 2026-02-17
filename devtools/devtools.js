"use strict";

const tabId = chrome.devtools.inspectedWindow.tabId;
const panelUrl = `devtools/panel.html?tabId=${encodeURIComponent(String(tabId))}`;

chrome.devtools.panels.create("MikuYTBypass", "", panelUrl, () => {});
