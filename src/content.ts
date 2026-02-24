// src/content.ts
(() => {
  const ENABLED_KEY = "catWalkerEnabled";
  const SPRITE_KEY = "catSprite";
  const SELECTED_CATS_KEY = "selectedCats";
  const PAWPRINTS_KEY = "pawprintsEnabled";
  const CURSOR_MODE_KEY = "cursorMode";
  const CAT_SCALES_KEY = "catScales";
  const ROOT_ID_PREFIX = "cat-walker-cat";
  const CTRL_KEY = "__catWalkerCtrl__";

  // ====== 스프라이트 설정 ======
  const FRAME_W = 32;
  const FRAME_H = 32;

  // ====== 상태 머신 설정 ======
  const enum CatState {
    IDLE,
    WALK,
    SLEEP,
    SLEEP_2,
    SLEEP_3,
    SLEEP_4,
    ONENTER,
    ONENTER_2,
    ONENTER_3,
    DRAG,
    DRAG_2
  }
  
  // ====== 랜덤 동작 설정 ======
  const SLEEP_ARRAY = [CatState.SLEEP, CatState.SLEEP_2, CatState.SLEEP_3]; // 수면 상태
  const DRAG_ARRAY = [CatState.DRAG, CatState.DRAG_2]; // 드래그 상태
  const ENTER_ARRAY = [CatState.ONENTER, CatState.ONENTER_2, CatState.ONENTER_3]; // Hover 상태

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
    [CatState.SLEEP_2]: {
      row: 14,
      frameCount: 2,
      frameOffset: 0,
      fps: 2,
      speedMul: 0,
      durationMin: 4,
      durationMax: 10,
    },
    [CatState.SLEEP_3]: {
      row: 16,
      frameCount: 2,
      frameOffset: 0,
      fps: 2,
      speedMul: 0,
      durationMin: 4,
      durationMax: 10,
    },
    [CatState.SLEEP_4]: {
      row: 18,
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
    [CatState.ONENTER_2]: {
      row: 40,
      frameCount: 11,
      frameOffset: 0,
      fps: 12,
      speedMul: 0,
      durationMin: 4,
      durationMax: 10,
    },
    [CatState.ONENTER_3]: {
      row: 41,
      frameCount: 2,
      frameOffset: 0,
      fps: 2,
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
    [CatState.DRAG_2]: {
      row: 43,
      frameCount: 1,
      frameOffset: 0,
      fps: 1,
      speedMul: 0,
      durationMin: 0,
      durationMax: 0,
    },
  };
  
  let draggingState = CatState.DRAG;
  let hoverState = CatState.ONENTER;

  function randRange(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function getRandomState(arr: CatState[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function nextState(current: CatState): CatState {
    const r = Math.random();
    switch (current) {
      case CatState.WALK:
        return r < 0.5 ? CatState.IDLE : CatState.WALK;
      case CatState.IDLE:
        return r < 0.6 ? CatState.WALK : getRandomState(SLEEP_ARRAY);
      case CatState.SLEEP:
      case CatState.SLEEP_2:
      case CatState.SLEEP_3:
      case CatState.SLEEP_4:
      case CatState.ONENTER:
      case CatState.ONENTER_2:
      case CatState.ONENTER_3:
      case CatState.DRAG:
      case CatState.DRAG_2:
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
    lastPawprintTime: number;
    inCursorRange: boolean;
    originalSavedVx?: number;
    originalSavedVy?: number;
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
    pawprintsEnabled: boolean;
    cursorMode: "none" | "curious" | "shy";
    mouseX: number;
    mouseY: number;
    catScales: Record<string, number>;
  };

  const w = window as unknown as Record<string, Ctrl>;
  if (!w[CTRL_KEY]) {
    w[CTRL_KEY] = {
      enabled: true,
      instances: new Map(),
      pawprintsEnabled: false,
      cursorMode: "none",
      mouseX: 0,
      mouseY: 0,
      catScales: { cat1: 4, cat2: 4, cat3: 4 },
    };
  }
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

  // 마우스 위치 추적 (커서 반응 모드용)
  document.addEventListener("mousemove", (e) => {
    ctrl.mouseX = e.clientX;
    ctrl.mouseY = e.clientY;
  });

  // ====== 발자국 시스템 ======
  const pawprints: Array<{ el: HTMLElement; createdAt: number }> = [];
  const PAWPRINT_LIFETIME = 2000; // 2초

  function createPawprint(
    x: number,
    y: number,
    facingLeft: boolean,
    spriteName: string,
  ) {
    if (!ctrl.pawprintsEnabled) return;

    const catScale = ctrl.catScales[spriteName] || 4;
    const pawTopResult = `${y + 50 - (4 / catScale) * 10}px`;
    const pawSize = `${12 + 4 * catScale}px`;
    const paw = document.createElement("div");
    paw.style.position = "fixed";
    paw.style.left = `${x - (catScale - 1) * 10}px`;
    paw.style.top = pawTopResult;
    paw.style.width = "12px";
    paw.style.height = "12px";
    paw.style.fontSize = pawSize;
    paw.style.pointerEvents = "none";
    paw.style.zIndex = "2147483646";
    paw.style.opacity = "0.6";
    paw.style.transition = "opacity 0.5s ease-out";
    paw.textContent = "🐾";
    paw.style.transform = facingLeft ? "scaleX(-1)" : "scaleX(1)";

    // 고양이별 발자국 색상
    if (spriteName === "cat2") {
      paw.style.filter = "grayscale(100%) brightness(0.4)"; // 진한 회색
    } else if (spriteName === "cat3") {
      paw.style.filter = "grayscale(100%) brightness(1.2)"; // 밝은 회색
    }
    // cat1은 기본 색상 (필터 없음)

    document.body.appendChild(paw);

    const createdAt = performance.now();
    pawprints.push({ el: paw, createdAt });

    // 페이드아웃 시작
    setTimeout(() => {
      paw.style.opacity = "0";
    }, PAWPRINT_LIFETIME - 500);

    // 제거
    setTimeout(() => {
      paw.remove();
      const index = pawprints.findIndex((p) => p.el === paw);
      if (index !== -1) pawprints.splice(index, 1);
    }, PAWPRINT_LIFETIME);
  }

  function cleanupPawprints() {
    pawprints.forEach((p) => p.el.remove());
    pawprints.length = 0;
  }
  // ============================================

  function startCatInstance(
    spriteName: string,
    instanceIndex: number,
  ): CatInstance {
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

    const state: CatState_Runtime = {
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
      lastPawprintTime: 0,
      inCursorRange: false,
      originalSavedVx: undefined,
      originalSavedVy: undefined,
    };

    const onMouseEnter = () => {
      hoverState = getRandomState(ENTER_ARRAY);
      state.hovered = true;
      state.frame = 0;
      state.frameAcc = 0;
    };
    const onMouseLeave = () => {
      hoverState = CatState.ONENTER;
      state.hovered = false;
      state.frame = 0;
      state.frameAcc = 0;
    };
    cat.addEventListener("mouseenter", onMouseEnter);
    cat.addEventListener("mouseleave", onMouseLeave);

    // TODO: 1. 여기서 글로벌 변수로 드래그 상태 선언
    const onMouseDown = (e: MouseEvent) => {
      draggingState = getRandomState(DRAG_ARRAY);
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

    // TODO: 2. 여기서 글로벌 변수로 드래그 상태 해제 - default 상태로 변환
    const onMouseUp = () => {
      if (!state.dragging) return;
      draggingState = CatState.DRAG;
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
        ? STATE_CONFIG[draggingState]
        : state.hovered
          ? STATE_CONFIG[hoverState]
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
      const catScale = ctrl.catScales[spriteName] || 4;
      const CAT_W = FRAME_W * catScale;
      const CAT_H = FRAME_H * catScale;

      // 커서 반응 모드 처리 (모든 상태에서 반응 가능, 마우스가 화면 안에 있을 때만)
      const mouseInBounds =
        ctrl.mouseX > 50 &&
        ctrl.mouseX < w - 50 &&
        ctrl.mouseY > 50 &&
        ctrl.mouseY < h - 50;

      const dx = ctrl.mouseX - (state.x + CAT_W / 2);
      const dy = ctrl.mouseY - (state.y + CAT_H / 2);
      const distToMouse = Math.sqrt(dx * dx + dy * dy);

      // 커서 모드 범위 체크 (30-200px)
      const shouldBeInRange =
        ctrl.cursorMode !== "none" &&
        !state.dragging &&
        !state.hovered &&
        mouseInBounds &&
        distToMouse < 200 &&
        distToMouse > 30;

      if (shouldBeInRange) {
        // WALK 상태가 아니면 깨워서 WALK 상태로 전환
        if (state.catState !== CatState.WALK) {
          enterState(CatState.WALK);
          // 초기 속도가 없으면 랜덤하게 설정
          if (state.savedVx === 0 && state.savedVy === 0) {
            state.savedVx =
              (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 80);
            state.savedVy =
              (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 60);
          }
        }

        // 범위에 진입 시 원래 속도 저장
        if (!state.inCursorRange) {
          state.inCursorRange = true;
          state.originalSavedVx = state.savedVx;
          state.originalSavedVy = state.savedVy;
        }

        const angle = Math.atan2(dy, dx);
        const baseSpeed = Math.sqrt(
          state.originalSavedVx! * state.originalSavedVx! +
            state.originalSavedVy! * state.originalSavedVy!,
        );

        if (ctrl.cursorMode === "curious") {
          // 호기심: 마우스를 향해 이동 (1.5배 속도)
          state.savedVx = Math.cos(angle) * baseSpeed;
          state.savedVy = Math.sin(angle) * baseSpeed;
          state.vx = state.savedVx * 1.5; // WALK의 speedMul은 1이므로 직접 1.5배
          state.vy = state.savedVy * 1.5;
          state.facingLeft = dx < 0;
        } else if (ctrl.cursorMode === "shy") {
          // 수줍음: 마우스에서 도망 (1.5배 속도)
          state.savedVx = -Math.cos(angle) * baseSpeed;
          state.savedVy = -Math.sin(angle) * baseSpeed;
          state.vx = state.savedVx * 1.5;
          state.vy = state.savedVy * 1.5;
          state.facingLeft = dx > 0;
        }
      } else if (state.inCursorRange) {
        // 범위를 벗어나면 원래 속도로 복원
        state.inCursorRange = false;
        if (
          state.originalSavedVx !== undefined &&
          state.originalSavedVy !== undefined
        ) {
          state.savedVx = state.originalSavedVx;
          state.savedVy = state.originalSavedVy;
          // 현재 상태의 speedMul 적용
          const currentCfg = STATE_CONFIG[state.catState];
          state.vx = state.savedVx * currentCfg.speedMul;
          state.vy = state.savedVy * currentCfg.speedMul;
          state.facingLeft = state.vx < 0;
        }
      }

      if (cfg.speedMul > 0) {
        state.x += state.vx * dt;
        state.y += state.vy * dt;

        if (state.x <= 0) {
          state.x = 0;
          state.vx *= -1;
          state.savedVx *= -1;
          state.facingLeft = state.vx < 0;
        } else if (state.x >= w - CAT_W) {
          state.x = w - CAT_W;
          state.vx *= -1;
          state.savedVx *= -1;
          state.facingLeft = state.vx < 0;
        }

        if (state.y <= 0) {
          state.y = 0;
          state.vy *= -1;
          state.savedVy *= -1;
        } else if (state.y >= h - CAT_H) {
          state.y = h - CAT_H;
          state.vy *= -1;
          state.savedVy *= -1;
        }

        // 발자국 생성 (시간 기반, 0.4초마다)
        const now = performance.now();
        if (now - state.lastPawprintTime > 400) {
          state.lastPawprintTime = now;
          createPawprint(state.x, state.y, state.facingLeft, spriteName);
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
      cat.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${catScale * flipX}, ${catScale})`;
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
    cleanupPawprints();
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
    const result = await chrome.storage.local.get([
      ENABLED_KEY,
      SELECTED_CATS_KEY,
      SPRITE_KEY,
      PAWPRINTS_KEY,
      CURSOR_MODE_KEY,
      CAT_SCALES_KEY,
    ]);

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

    const enabled =
      typeof result[ENABLED_KEY] === "boolean" ? result[ENABLED_KEY] : true;
    ctrl.pawprintsEnabled =
      typeof result[PAWPRINTS_KEY] === "boolean"
        ? result[PAWPRINTS_KEY]
        : false;
    const cursorMode = result[CURSOR_MODE_KEY];
    ctrl.cursorMode =
      cursorMode === "curious" || cursorMode === "shy" ? cursorMode : "none";

    // catScales 로드 (기본값: 각 고양이 4배)
    const catScales = result[CAT_SCALES_KEY];
    if (catScales && typeof catScales === "object") {
      ctrl.catScales = { ...ctrl.catScales, ...catScales };
    }

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
            const cats = Array.isArray(res[SELECTED_CATS_KEY])
              ? res[SELECTED_CATS_KEY]
              : ["cat1"];
            void applyEnabled(newEnabled, cats);
          });
        }
      }

      if (changes[PAWPRINTS_KEY]) {
        const newPawprints = changes[PAWPRINTS_KEY].newValue;
        if (typeof newPawprints === "boolean") {
          ctrl.pawprintsEnabled = newPawprints;
          if (!newPawprints) {
            cleanupPawprints();
          }
        }
      }

      if (changes[CURSOR_MODE_KEY]) {
        const newMode = changes[CURSOR_MODE_KEY].newValue;
        if (newMode === "curious" || newMode === "shy" || newMode === "none") {
          ctrl.cursorMode = newMode;
        }
      }

      if (changes[CAT_SCALES_KEY]) {
        const newScales = changes[CAT_SCALES_KEY].newValue;
        if (newScales && typeof newScales === "object") {
          ctrl.catScales = { ...ctrl.catScales, ...newScales };
        }
      }
    });
  }

  void init();
})();
