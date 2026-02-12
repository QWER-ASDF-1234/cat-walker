(() => {
  const EXISTING_ID = "cat-walker-root";
  if (document.getElementById(EXISTING_ID)) return;

  const FRAME_W = 32;
  const FRAME_H = 32;
  const FRAME_COUNT = 6;
  const SCALE = 4;
  const FPS = 10;
  const SPRITE_PATH = "assets/cat.png";
  const ROW = 6;

  const spriteUrl = chrome.runtime.getURL(SPRITE_PATH);

  // 오버레이 루트
  const root = document.createElement("div");
  root.id = EXISTING_ID;
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = "100vw";
  root.style.height = "100vh";
  root.style.pointerEvents = "none";
  root.style.zIndex = "2147483647";
  document.documentElement.appendChild(root);

  // 고양이 엘리먼트
  const cat = document.createElement("div");
  cat.setAttribute("aria-hidden", "true");
  cat.style.position = "absolute";
  cat.style.width = `${FRAME_W}px`;
  cat.style.height = `${FRAME_H}px`;
  cat.style.backgroundImage = `url("${spriteUrl}")`;
  cat.style.backgroundRepeat = "no-repeat";
  cat.style.imageRendering = "pixelated"; // 픽셀 깨끗하게
  cat.style.willChange = "transform, background-position";
  root.appendChild(cat);

  // 이동 상태
  const state = {
    x: Math.max(8, Math.random() * (window.innerWidth - FRAME_W * SCALE)),
    y: Math.max(8, Math.random() * (window.innerHeight - FRAME_H * SCALE)),
    vx: (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 80), // px/s
    vy: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 60), // px/s
    frame: 0,
    frameAcc: 0,
  };

  const CAT_W = FRAME_W * SCALE;
  const CAT_H = FRAME_H * SCALE;

  let last = performance.now();

  function tick(now: number) {
    const dt = (now - last) / 1000;
    last = now;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // 이동
    state.x += state.vx * dt;
    state.y += state.vy * dt;

    // 벽 튕김
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

    // 애니메이션 프레임 변경
    state.frameAcc += dt;
    const frameInterval = 1 / FPS;
    if (state.frameAcc >= frameInterval) {
      state.frameAcc -= frameInterval;
      state.frame = (state.frame + 1) % FRAME_COUNT;
    }

    // 스프라이트 시트에서 현재 프레임 위치
    // 가로로 프레임이 붙어있으니 x만 이동
    cat.style.backgroundPosition = `-${state.frame * FRAME_W}px -${ROW * FRAME_H}px`;

    // 진행 방향에 따라 좌우 반전
    const flipX = state.vx < 0 ? -1 : 1;

    // translate + scale + flip
    cat.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${SCALE * flipX}, ${SCALE})`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
