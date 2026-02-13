// src/background.ts
const KEY = "catWalkerEnabled";

async function getEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(KEY);
  return typeof result[KEY] === "boolean" ? result[KEY] : true; // 기본 ON
}

async function setEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [KEY]: enabled });
}

async function updateBadge(enabled: boolean) {
  // 배지는 선택사항 (보기 좋음)
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#2e7d32" : "#616161" });
}

chrome.runtime.onInstalled.addListener(async () => {
  const enabled = await getEnabled();
  await updateBadge(enabled);
});

chrome.action.onClicked.addListener(async () => {
  const enabled = await getEnabled();
  const next = !enabled;
  await setEnabled(next);
  await updateBadge(next);
});
