// src/popup.ts
const ENABLED_KEY = "catWalkerEnabled";
const SPRITE_KEY = "catSprite";

const toggle = document.getElementById("toggle") as HTMLInputElement;
const catOptions = document.querySelectorAll<HTMLDivElement>(".cat-option");

async function loadState() {
  const result = await chrome.storage.local.get([ENABLED_KEY, SPRITE_KEY]);
  const enabled = typeof result[ENABLED_KEY] === "boolean" ? result[ENABLED_KEY] : true;
  const sprite = typeof result[SPRITE_KEY] === "string" ? result[SPRITE_KEY] : "cat1";

  toggle.checked = enabled;
  catOptions.forEach((el) => {
    el.classList.toggle("selected", el.dataset.cat === sprite);
  });
}

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [ENABLED_KEY]: toggle.checked });
});

catOptions.forEach((el) => {
  el.addEventListener("click", () => {
    const cat = el.dataset.cat!;
    chrome.storage.local.set({ [SPRITE_KEY]: cat });
    catOptions.forEach((o) => o.classList.toggle("selected", o === el));
  });
});

loadState();
