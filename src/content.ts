// src/content.ts
(() => {
  const ENABLED_KEY = "catWalkerEnabled";
  const SPRITE_KEY = "catSprite";
  const SELECTED_CATS_KEY = "selectedCats";
  const ROOT_ID_PREFIX = "cat-walker-cat";
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

  type CatState_Runtime = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    frame: number;
    frameAcc: number;
    catState: CatState;
    stateTimer: number;
    savedVx: number;
    savedVy: number;
    facingLeft: boolean;
    hovered: boolean;
    dragging: boolean;
    dragOffsetX: number;
    dragOffsetY: number;
  };

  type CatInstance = {
    sprite: string;
    cleanup: () => void;
    rootElement: HTMLElement;
    index: number;
    update: (dt: number) => void;
    catElement: HTMLElement;
    state: CatState_Runtime;
  };

  type Ctrl = {
    enabled: boolean;
    instances: Map<string, CatInstance>;
  };

  const w = window as unknown as Record<string, Ctrl>;
  if (!w[CTRL_KEY]) w[CTRL_KEY] = { enabled: true, instances: new Map() };
  const ctrl = w[CTRL_KEY];

  // ====== 공유 애니메이션 루프 ======
  let sharedRafId = 0;
  let sharedLastTime = 0;

  function sharedAnimationLoop(now: number) {
    if (ctrl.instances.size === 0) {
      sharedRafId = 0;
      return;
    }

    let dt = sharedLastTime === 0 ? 0 : (now - sharedLastTime) / 1000;
    sharedLastTime = now;
    dt = Math.min(dt, 0.033); // 최대 33ms로 제한

    // 모든 고양이 업데이트 (배치 처리)
    ctrl.instances.forEach((instance) => {
      instance.update(dt);
    });

    sharedRafId = requestAnimationFrame(sharedAnimationLoop);
  }

  function startSharedLoop() {
    if (sharedRafId === 0 && ctrl.instances.size > 0) {
      sharedLastTime = 0;
      sharedRafId = requestAnimationFrame(sharedAnimationLoop);
    }
  }

  function stopSharedLoop() {
    if (sharedRafId !== 0) {
      cancelAnimationFrame(sharedRafId);
      sharedRafId = 0;
      sharedLastTime = 0;
    }
  }

  // 탭 가시성 변경 시 dt 폭주 방지
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      sharedLastTime = 0;
    }
  });
  // ============================================

  function startCatInstance(spriteName: string, instanceIndex: number): CatInstance {
    const uniqueId = `${spriteName}-${instanceIndex}`;
    const rootId = `${ROOT_ID_PREFIX}-${uniqueId}`;

    const spritePath = `assets/${spriteName}.png`;
    const spriteUrl = chrome.runtime.getURL(spritePath);

    const root = document.createElement("div");
    root.id = rootId;
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

    // 겹침 방지를 위한 초기 위치 분산
    const offsetX = (instanceIndex * 200) % (window.innerWidth - 200);
    const offsetY = (instanceIndex * 100) % (window.innerHeight - 200);

    const state = {
      x: Math.max(8, offsetX + Math.random() * 100),
      y: Math.max(8, offsetY + Math.random() * 100),
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

    function update(dt: number) {
      if (dt === 0) return; // 첫 프레임 스킵

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
    }

    const cleanupFn = () => {
      cat.removeEventListener("mouseenter", onMouseEnter);
      cat.removeEventListener("mouseleave", onMouseLeave);
      cat.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      root.remove();
    };

    return {
      sprite: spriteName,
      cleanup: cleanupFn,
      rootElement: root,
      index: instanceIndex,
      update: update,
      catElement: cat,
      state: state,
    };
  }

  function stopAllCats() {
    ctrl.instances.forEach((instance) => instance.cleanup());
    ctrl.instances.clear();
    stopSharedLoop();
  }

  function startAllCats(sprites: string[]) {
    // 기존 인스턴스 모두 정리
    stopAllCats();

    if (sprites.length === 0) return;

    // 동일 sprite 중복을 위한 카운터
    const spriteCounts = new Map<string, number>();

    sprites.forEach((sprite) => {
      const index = spriteCounts.get(sprite) || 0;
      spriteCounts.set(sprite, index + 1);

      const uniqueId = `${sprite}-${index}`;
      const instance = startCatInstance(sprite, index);
      ctrl.instances.set(uniqueId, instance);
    });

    startSharedLoop();
  }

  function updateCats(newSprites: string[]) {
    // 차이만 계산하여 효율적으로 업데이트
    const oldIds = new Set(Array.from(ctrl.instances.keys()));
    const newIds = new Set<string>();
    const spriteCounts = new Map<string, number>();

    // 새로운 ID 계산
    newSprites.forEach((sprite) => {
      const index = spriteCounts.get(sprite) || 0;
      spriteCounts.set(sprite, index + 1);
      newIds.add(`${sprite}-${index}`);
    });

    // 제거된 고양이 정리
    oldIds.forEach((id) => {
      if (!newIds.has(id)) {
        const instance = ctrl.instances.get(id);
        if (instance) {
          instance.cleanup();
          ctrl.instances.delete(id);
        }
      }
    });

    // 새로 추가된 고양이 생성
    spriteCounts.clear();
    newSprites.forEach((sprite) => {
      const index = spriteCounts.get(sprite) || 0;
      spriteCounts.set(sprite, index + 1);
      const uniqueId = `${sprite}-${index}`;

      if (!ctrl.instances.has(uniqueId)) {
        const instance = startCatInstance(sprite, index);
        ctrl.instances.set(uniqueId, instance);
      }
    });

    // 공유 루프 관리
    if (ctrl.instances.size === 0) {
      stopSharedLoop();
    } else if (ctrl.instances.size > 0 && sharedRafId === 0) {
      startSharedLoop();
    }
  }

  async function applyEnabled(enabled: boolean, sprites: string[]) {
    ctrl.enabled = enabled;

    if (!enabled) {
      stopAllCats();
      return;
    }

    startAllCats(sprites);
  }

  async function init() {
    const result = await chrome.storage.local.get([ENABLED_KEY, SELECTED_CATS_KEY, SPRITE_KEY]);

    // 마이그레이션: 기존 catSprite에서 selectedCats로
    let selectedCats: string[] = [];
    if (result[SELECTED_CATS_KEY] && Array.isArray(result[SELECTED_CATS_KEY])) {
      selectedCats = result[SELECTED_CATS_KEY];
    } else if (result[SPRITE_KEY] && typeof result[SPRITE_KEY] === "string") {
      // 기존 형식에서 마이그레이션
      selectedCats = [result[SPRITE_KEY]];
      await chrome.storage.local.set({ [SELECTED_CATS_KEY]: selectedCats });
    } else {
      // 기본값: cat1
      selectedCats = ["cat1"];
      await chrome.storage.local.set({ [SELECTED_CATS_KEY]: selectedCats });
    }

    const enabled = typeof result[ENABLED_KEY] === "boolean" ? result[ENABLED_KEY] : true;
    await applyEnabled(enabled, selectedCats);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes[SELECTED_CATS_KEY]) {
        const newCats = changes[SELECTED_CATS_KEY].newValue;
        if (Array.isArray(newCats) && ctrl.enabled) {
          updateCats(newCats);
        }
      }

      if (changes[ENABLED_KEY]) {
        const newEnabled = changes[ENABLED_KEY].newValue;
        if (typeof newEnabled === "boolean") {
          // enabled 토글 시 현재 선택된 고양이들을 다시 로드
          chrome.storage.local.get([SELECTED_CATS_KEY]).then((res) => {
            const cats = Array.isArray(res[SELECTED_CATS_KEY]) ? res[SELECTED_CATS_KEY] : ["cat1"];
            void applyEnabled(newEnabled, cats);
          });
        }
      }
    });
  }

  void init();
})();
