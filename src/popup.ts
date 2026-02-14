// src/popup.ts
const ENABLED_KEY = "catWalkerEnabled";
const SPRITE_KEY = "catSprite";
const SELECTED_CATS_KEY = "selectedCats";

const toggle = document.getElementById("toggle") as HTMLInputElement;
const catOptions = document.querySelectorAll<HTMLDivElement>(".cat-option");
const selectAllBtn = document.getElementById("select-all") as HTMLButtonElement;
const clearAllBtn = document.getElementById("clear-all") as HTMLButtonElement;

let selectedCats: string[] = [];

async function loadState() {
  const result = await chrome.storage.local.get([ENABLED_KEY, SELECTED_CATS_KEY, SPRITE_KEY]);
  const enabled = typeof result[ENABLED_KEY] === "boolean" ? result[ENABLED_KEY] : true;

  // 마이그레이션 처리
  if (result[SELECTED_CATS_KEY] && Array.isArray(result[SELECTED_CATS_KEY])) {
    selectedCats = result[SELECTED_CATS_KEY];
  } else if (result[SPRITE_KEY] && typeof result[SPRITE_KEY] === "string") {
    // 기존 형식에서 마이그레이션
    selectedCats = [result[SPRITE_KEY]];
    await chrome.storage.local.set({ [SELECTED_CATS_KEY]: selectedCats });
  } else {
    selectedCats = ["cat1"];
    await chrome.storage.local.set({ [SELECTED_CATS_KEY]: selectedCats });
  }

  toggle.checked = enabled;
  updateUI();
}

function updateUI() {
  catOptions.forEach((el) => {
    const cat = el.dataset.cat!;
    const isSelected = selectedCats.includes(cat);
    el.classList.toggle("selected", isSelected);
  });
}

async function saveSelectedCats() {
  await chrome.storage.local.set({ [SELECTED_CATS_KEY]: selectedCats });
}

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [ENABLED_KEY]: toggle.checked });
});

catOptions.forEach((el) => {
  el.addEventListener("click", async () => {
    const cat = el.dataset.cat!;
    const index = selectedCats.indexOf(cat);

    if (index !== -1) {
      // 선택 해제: 배열에서 제거
      selectedCats.splice(index, 1);
    } else {
      // 선택: 배열에 추가
      selectedCats.push(cat);
    }

    updateUI();
    await saveSelectedCats();
  });
});

selectAllBtn.addEventListener("click", async () => {
  selectedCats = ["cat1", "cat2", "cat3"];
  updateUI();
  await saveSelectedCats();
});

clearAllBtn.addEventListener("click", async () => {
  selectedCats = [];
  updateUI();
  await saveSelectedCats();
});

loadState();
