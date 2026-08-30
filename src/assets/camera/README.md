# 카메라 렌즈에 보이는 사진

폰 카메라(`src/apps/Camera.jsx`)의 뷰파인더에 깔리는 사진들이다. 여기에 파일을
넣으면 그 사진이 렌즈에 보이고, 그 상태로 찍은 사진에도 그대로 들어간다.
없으면 뷰파인더는 어두운 화면으로 남는다 — 넣지 않아도 게임은 그대로 돈다.

## 이름

찍는 대상(`SUBJECTS`)의 id 를 그대로 쓴다. `.webp` 만 읽는다.

| 파일 | 화면에 보이는 이름 |
|---|---|
| `desk.webp` | 책상 위 |
| `screen.webp` | 모니터 화면 |
| `paper.webp` | 서류 |
| `window.webp` | 창밖 |

대상을 더 넣고 싶으면 `Camera.jsx` 의 `SUBJECTS` 에 `['id', '이름']` 을 더하고
같은 이름의 `.webp` 를 여기에 두면 된다.

## 크기

세로로 긴 폰 화면을 채우므로 3:4 안팎(예: 900×1200)이 알맞다. 화면에서만
읽히므로 용량을 우선한다 — 다른 사진들처럼 webp 로, 200KB 아래를 권한다.

```bash
# 예: png 를 webp 로
npx sharp-cli --input desk.png --output desk.webp --format webp
```
