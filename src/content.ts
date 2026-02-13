// src/content.ts
(() => {
  const KEY = "catWalkerEnabled";
  const ROOT_ID = "cat-walker-root";
  const CTRL_KEY = "__catWalkerCtrl__";

  // ====== 스프라이트 설정 (네 값 유지/조정) ======
  const FRAME_W = 32;
  const FRAME_H = 32;
  const FRAME_COUNT = 6;
  const SCALE = 4;
  const FPS = 10;
  const SPRITE_PATH = "assets/cat.png";

  // "walk만" 쓰려면 여기만 바꾸면 됨 (0부터 시작)
  const WALK_ROW = 6; // 예: 1이면 두 번째 줄
  // ============================================

  type Ctrl = {
    enabled: boolean;
    cleanup: null | (() => void);
  };

  const w = window as unknown as Record<string, Ctrl>;
  if (!w[CTRL_KEY]) w[CTRL_KEY] = { enabled: true, cleanup: null };
  const ctrl = w[CTRL_KEY];

  function removeExistingRoot() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();
  }

  function startCat(): () => void {
    // 중복 생성 방지
    if (document.getElementById(ROOT_ID)) {
      // 이미 있으면 cleanup만 만들어서 반환
      return () => removeExistingRoot();
    }

    const spriteUrl = chrome.runtime.getURL(SPRITE_PATH);

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.position = "fixed";
    root.style.left = "0";
    root.style.top = "0";
    root.style.width = "100vw";
    root.style.height = "100vh";
    root.style.pointerEvents = "none";
    root.style.zIndex = "2147483647";
    document.documentElement.appendChild(root);

    const cat = document.createElement("div");
    cat.setAttribute("aria-hidden", "true");
    cat.style.position = "absolute";
    cat.style.width = `${FRAME_W}px`;
    cat.style.height = `${FRAME_H}px`;
    cat.style.backgroundImage = `url("${spriteUrl}")`;
    cat.style.backgroundRepeat = "no-repeat";
    cat.style.imageRendering = "pixelated";
    cat.style.willChange = "transform, background-position";
    root.appendChild(cat);

    const state = {
      x: Math.max(8, Math.random() * (window.innerWidth - FRAME_W * SCALE)),
      y: Math.max(8, Math.random() * (window.innerHeight - FRAME_H * SCALE)),
      vx: (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 80),
      vy: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 60),
      frame: 0,
      frameAcc: 0
    };

    const CAT_W = FRAME_W * SCALE;
    const CAT_H = FRAME_H * SCALE;

    let last = performance.now();
    let rafId = 0;

    const onVisibility = () => {
      // 탭 복귀 시 dt 폭주 방지
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    function tick(now: number) {
      let dt = (now - last) / 1000;
      last = now;

      // 탭 전환/백그라운드로 누적된 큰 dt 제한 (버그 방지)
      dt = Math.min(dt, 0.033); // ~30fps 기준

      const w = window.innerWidth;
      const h = window.innerHeight;

      state.x += state.vx * dt;
      state.y += state.vy * dt;

      if (state.x <= 0) {
        state.x = 0;
        state.vx *= -1;
      } else if (state.x >= w - CAT_W) {
        state.x = w - CAT_W;
        state.vx *= -1;
      }

      if (state.y <= 0) {
        state.y = 0;
        state.vy *= -1;
      } else if (state.y >= h - CAT_H) {
        state.y = h - CAT_H;
        state.vy *= -1;
      }

      // 애니메이션 프레임
      state.frameAcc += dt;
      const frameInterval = 1 / FPS;
      if (state.frameAcc >= frameInterval) {
        state.frameAcc -= frameInterval;
        state.frame = (state.frame + 1) % FRAME_COUNT;
      }

      // ✅ WALK_ROW만 사용 (행 고정)
      cat.style.backgroundPosition = `-${state.frame * FRAME_W}px -${WALK_ROW * FRAME_H}px`;

      // 진행방향 flip
      const flipX = state.vx < 0 ? -1 : 1;
      cat.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${SCALE * flipX}, ${SCALE})`;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    // cleanup
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      root.remove();
    };
  }

  async function applyEnabled(enabled: boolean) {
    ctrl.enabled = enabled;

    if (!enabled) {
      if (ctrl.cleanup) {
        ctrl.cleanup();
        ctrl.cleanup = null;
      } else {
        removeExistingRoot();
      }
      return;
    }

    if (!ctrl.cleanup) {
      ctrl.cleanup = startCat();
    }
  }

  async function init() {
    const result = await chrome.storage.local.get(KEY);
    const enabled = typeof result[KEY] === "boolean" ? result[KEY] : true;
    await applyEnabled(enabled);

    // background에서 토글되면 이 이벤트가 모든 탭의 content script에 전달됨
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes[KEY]) return;
      const next = changes[KEY].newValue;
      if (typeof next === "boolean") {
        void applyEnabled(next);
      }
    });
  }

  void init();
})();
