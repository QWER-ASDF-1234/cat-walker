# Dot Cat Walker

모든 웹 페이지 위를 돌아다니는 픽셀 고양이 Chrome 확장 프로그램입니다.

## 기능

- 웹 페이지 위를 자유롭게 걸어 다니는 픽셀 고양이
- IDLE, WALK, SLEEP 등 다양한 상태 애니메이션
- 마우스 호버 시 반응, 드래그로 고양이 이동 가능
- 팝업에서 ON/OFF 토글
- 3종류의 고양이 스프라이트 선택 가능

## 설치

1. 이 저장소를 클론합니다.
2. 의존성을 설치하고 빌드합니다.
   ```bash
   npm install
   npm run build
   ```
3. Chrome에서 `chrome://extensions`로 이동합니다.
4. **개발자 모드**를 활성화합니다.
5. **압축해제된 확장 프로그램을 로드합니다**를 클릭하고 프로젝트 폴더를 선택합니다.

## 사용법

- 확장 아이콘을 클릭하면 팝업이 열립니다.
- **ON/OFF** 토글로 고양이를 켜거나 끌 수 있습니다.
- 3가지 고양이 중 원하는 스프라이트를 선택할 수 있습니다.

## 프로젝트 구조

```
cat-walker/
├── assets/
│   ├── cat1.png
│   ├── cat2.png
│   └── cat3.png
├── src/
│   ├── background.ts
│   ├── content.ts
│   └── popup.ts
├── popup.html
├── manifest.json
├── tsconfig.json
└── package.json
```

## 스프라이트 출처

고양이 스프라이트 이미지는 **Last Tick**의 에셋을 사용하였습니다.

- [Animated Pixel Kittens / Cats 32x32](https://last-tick.itch.io/animated-pixel-kittens-cats-32x32) — itch.io
