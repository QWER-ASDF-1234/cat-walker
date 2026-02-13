// src/content.ts
(() => {
  const ENABLED_KEY = "catWalkerEnabled";
  const SPRITE_KEY = "catSprite";
  const ROOT_ID = "cat-walker-root";
  const CTRL_KEY = "__catWalkerCtrl__";

  // ====== 스프라이트 설정 ======
  const FRAME_W = 32;
  const FRAME_H = 32;
  const SCALE = 4;

  // ====== 상태 머신 설정 ======
  const enum CatState {
    IDLE,
    WALK,
    SLEEP,
    ONENTER,
    DRAG,
  }

  type StateConfig = {
    row: number;
    frameCount: number;
    frameOffset: number;
    fps: number;
    speedMul: number;
    durationMin: number;
    durationMax: number;
  };

  const STATE_CONFIG: Record<CatState, StateConfig> = {
    [CatState.IDLE]: {
      row: 28,
      frameCount: 3,
      frameOffset: 0,
      fps: 4,
      speedMul: 0,
      durationMin: 2,
      durationMax: 5,
    },
    [CatState.WALK]: {
      row: 6,
      frameCount: 6,
      frameOffset: 0,
      fps: 10,
      speedMul: 1,
      durationMin: 3,
      durationMax: 8,
    },
    [CatState.SLEEP]: {
      row: 12,
      frameCount: 2,
      frameOffset: 0,
      fps: 2,
      speedMul: 0,
      durationMin: 4,
      durationMax: 10,
    },
    [CatState.ONENTER]: {
      row: 35,
      frameCount: 8,
      frameOffset: 0,
      fps: 10,
      speedMul: 0,
      durationMin: 4,
      durationMax: 10,
    },
    [CatState.DRAG]: {
      row: 52,
      frameCount: 3,
      frameOffset: 1,
      fps: 6,
      speedMul: 0,
      durationMin: 0,
      durationMax: 0,
    },
  };

  function randRange(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function nextState(current: CatState): CatState {
    const r = Math.random();
    switch (current) {
      case CatState.WALK:
        return r < 0.85 ? CatState.IDLE : CatState.WALK;
      case CatState.IDLE:
        return r < 0.6 ? CatState.WALK : CatState.SLEEP;
      case CatState.SLEEP:
        return CatState.IDLE;
      case CatState.ONENTER:
        return CatState.IDLE;
      case CatState.DRAG:
        return CatState.IDLE;
    }
  }

  function stateDuration(cs: CatState): number {
    const cfg = STATE_CONFIG[cs];
    return randRange(cfg.durationMin, cfg.durationMax);
  }
  // ============================================

  type Ctrl = {
    enabled: boolean;
    cleanup: null | (() => void);
    currentSprite: string;
  };

  const w = window as unknown as Record<string, Ctrl>;
  if (!w[CTRL_KEY]) w[CTRL_KEY] = { enabled: true, cleanup: null, currentSprite: "cat1" };
  const ctrl = w[CTRL_KEY];

  function removeExistingRoot() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();
  }

  function startCat(spriteName: string): () => void {
    // 중복 생성 방지
    if (document.getElementById(ROOT_ID)) {
      return () => removeExistingRoot();
    }

    const spritePath = `assets/${spriteName}.png`;
    const spriteUrl = chrome.runtime.getURL(spritePath);

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
    cat.style.pointerEvents = "auto";
    cat.style.cursor = "pointer";
    root.appendChild(cat);

    const initVx = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 80);
    const initVy = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 60);

    const state = {
      x: Math.max(8, Math.random() * (window.innerWidth - FRAME_W * SCALE)),
      y: Math.max(8, Math.random() * (window.innerHeight - FRAME_H * SCALE)),
      vx: initVx,
      vy: initVy,
      frame: 0,
      frameAcc: 0,
      catState: CatState.WALK as CatState,
      stateTimer: stateDuration(CatState.WALK),
      savedVx: initVx,
      savedVy: initVy,
      facingLeft: initVx < 0,
      hovered: false,
      dragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
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

    const onMouseEnter = () => {
      state.hovered = true;
      state.frame = 0;
      state.frameAcc = 0;
    };
    const onMouseLeave = () => {
      state.hovered = false;
      state.frame = 0;
      state.frameAcc = 0;
    };
    cat.addEventListener("mouseenter", onMouseEnter);
    cat.addEventListener("mouseleave", onMouseLeave);

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      state.dragging = true;
      state.hovered = false;
      state.frame = 0;
      state.frameAcc = 0;
      // 고양이 좌상단 기준 마우스 오프셋 저장
      state.dragOffsetX = e.clientX - state.x;
      state.dragOffsetY = e.clientY - state.y;
      cat.style.cursor = "grabbing";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!state.dragging) return;
      state.x = e.clientX - state.dragOffsetX;
      state.y = e.clientY - state.dragOffsetY;
    };
    const onMouseUp = () => {
      if (!state.dragging) return;
      state.dragging = false;
      state.frame = 0;
      state.frameAcc = 0;
      cat.style.cursor = "pointer";
    };
    cat.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    function enterState(ns: CatState) {
      state.catState = ns;
      state.stateTimer = stateDuration(ns);
      state.frame = 0;
      state.frameAcc = 0;

      const cfg = STATE_CONFIG[ns];
      if (cfg.speedMul > 0) {
        state.vx = state.savedVx * cfg.speedMul;
        state.vy = state.savedVy * cfg.speedMul;
        state.facingLeft = state.vx < 0;
      } else {
        state.vx = 0;
        state.vy = 0;
      }
    }

    function tick(now: number) {
      let dt = (now - last) / 1000;
      last = now;

      dt = Math.min(dt, 0.033);

      const cfg = state.dragging
        ? STATE_CONFIG[CatState.DRAG]
        : state.hovered
          ? STATE_CONFIG[CatState.ONENTER]
          : STATE_CONFIG[state.catState];

      if (!state.hovered && !state.dragging) {
        state.stateTimer -= dt;
      }
      if (state.stateTimer <= 0) {
        if (cfg.speedMul > 0) {
          state.savedVx = state.vx / cfg.speedMul;
          state.savedVy = state.vy / cfg.speedMul;
          state.facingLeft = state.vx < 0;
        }
        enterState(nextState(state.catState));
        rafId = requestAnimationFrame(tick);
        return;
      }

      const w = window.innerWidth;
      const h = window.innerHeight;

      if (cfg.speedMul > 0) {
        state.x += state.vx * dt;
        state.y += state.vy * dt;

        if (state.x <= 0) {
          state.x = 0;
          state.vx *= -1;
          state.facingLeft = state.vx < 0;
        } else if (state.x >= w - CAT_W) {
          state.x = w - CAT_W;
          state.vx *= -1;
          state.facingLeft = state.vx < 0;
        }

        if (state.y <= 0) {
          state.y = 0;
          state.vy *= -1;
        } else if (state.y >= h - CAT_H) {
          state.y = h - CAT_H;
          state.vy *= -1;
        }
      }

      state.frameAcc += dt;
      const frameInterval = 1 / cfg.fps;
      if (state.frameAcc >= frameInterval) {
        state.frameAcc -= frameInterval;
        state.frame = (state.frame + 1) % cfg.frameCount;
      }

      cat.style.backgroundPosition = `-${(state.frame + cfg.frameOffset) * FRAME_W}px -${cfg.row * FRAME_H}px`;

      const flipX = state.facingLeft ? -1 : 1;
      cat.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${SCALE * flipX}, ${SCALE})`;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      cat.removeEventListener("mouseenter", onMouseEnter);
      cat.removeEventListener("mouseleave", onMouseLeave);
      cat.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      root.remove();
    };
  }

  function restartCat(spriteName: string) {
    if (ctrl.cleanup) {
      ctrl.cleanup();
      ctrl.cleanup = null;
    } else {
      removeExistingRoot();
    }
    ctrl.currentSprite = spriteName;
    if (ctrl.enabled) {
      ctrl.cleanup = startCat(spriteName);
    }
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
      ctrl.cleanup = startCat(ctrl.currentSprite);
    }
  }

  async function init() {
    const result = await chrome.storage.local.get([ENABLED_KEY, SPRITE_KEY]);
    const enabled = typeof result[ENABLED_KEY] === "boolean" ? result[ENABLED_KEY] : true;
    const sprite = typeof result[SPRITE_KEY] === "string" ? result[SPRITE_KEY] : "cat1";

    ctrl.currentSprite = sprite;
    await applyEnabled(enabled);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes[SPRITE_KEY]) {
        const next = changes[SPRITE_KEY].newValue;
        if (typeof next === "string" && next !== ctrl.currentSprite) {
          restartCat(next);
        }
      }

      if (changes[ENABLED_KEY]) {
        const next = changes[ENABLED_KEY].newValue;
        if (typeof next === "boolean") {
          void applyEnabled(next);
        }
      }
    });
  }

  void init();
})();
