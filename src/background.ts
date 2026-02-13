// src/background.ts
const KEY = "catWalkerEnabled";

async function getEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(KEY);
  return typeof result[KEY] === "boolean" ? result[KEY] : true; // 기본 ON
}

async function updateBadge(enabled: boolean) {
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#2e7d32" : "#616161" });
}

chrome.runtime.onInstalled.addListener(async () => {
  const enabled = await getEnabled();
  await updateBadge(enabled);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes[KEY]) return;
  const next = changes[KEY].newValue;
  if (typeof next === "boolean") {
    void updateBadge(next);
  }
});
