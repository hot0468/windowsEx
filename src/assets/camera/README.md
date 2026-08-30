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

**뷰파인더보다 크게 넣어라.** 사진은 화면의 1.6배로 깔리고, 기기를 기울이거나
손으로 끌면 그 안을 사방으로 둘러본다(`src/shell/tilt.js`). 작게 넣으면 늘어난다.

세로로 긴 폰 화면을 채우므로 3:4 안팎(예: 1440×1920 — 화면의 1.6배를 감안한
크기)이 알맞다. 화면에서만
읽히므로 용량을 우선한다 — 다른 사진들처럼 webp 로, 200KB 아래를 권한다.

```bash
# 예: png 를 webp 로
npx sharp-cli --input desk.png --output desk.webp --format webp
```

---

# 사진 뽑는 프롬프트

넷 다 **김한별의 폰 카메라가 보는 것**이다. 2026년 8월 말, 서울 강남 테헤란로
AR빌딩 7층 영업1팀. 형광등, 회색 파티션, 모니터 두 대, 포스트잇, 텀블러.
사람은 넣지 않는다 — 폰을 들고 있는 사람이 곧 플레이어다.

**세 가지를 지켜야 게임이 안 깨진다.**

1. **글자가 읽히면 안 된다.** 서류의 숫자·날짜·거래처 이름이 읽히면 플레이어가
   그것을 답으로 착각한다. 흐리거나, 각도로 뭉개지거나, 반사에 묻히게 한다.
2. **가장자리까지 볼 것이 있어야 한다.** 기울여서 사방을 둘러보는 사진이다.
   가운데만 채우고 가장자리가 비면 둘러볼 이유가 없다.
3. **밝고 예쁘지 않아야 한다.** 이 게임의 사무실은 담담하고 조금 지쳐 있다.
   채도를 낮추고, 형광등의 푸른 기가 남게 한다.

## 공통 (모든 프롬프트 앞에 붙인다)

```
photorealistic smartphone photo, shot on a modern phone camera, 26mm wide lens,
f/1.8, ISO 400, slight sensor noise, natural handheld framing,
Korean office in Seoul Gangnam, late August 2026, weekday afternoon,
cool fluorescent ceiling light mixed with grey daylight,
muted desaturated palette, greys, warm beige paper, dull green,
quiet ordinary workday mood, slightly worn and lived-in, nothing staged,
no people, no faces, no hands,
vertical 3:4, high detail across the entire frame including edges and corners
```

## 부정 프롬프트 (공통)

```
legible text, readable words, readable numbers, dates, invoices with clear figures,
brand logos, watermark, signature, caption, subtitles,
people, faces, hands, cartoon, illustration, 3d render, cgi, anime,
oversaturated, HDR glow, cinematic teal-orange grading, lens flare,
tidy showroom desk, luxury office, modern minimalist studio,
tilt-shift, heavy vignette, motion blur on the whole frame
```

## 1. `desk.webp` — 책상 위

내려다본 자기 자리. 오래 앉아 있던 자리처럼 보여야 한다.

```
looking down at a cluttered office desk from the seated person's point of view,
mechanical-looking keyboard with worn keycaps, a wired mouse, tangled cable,
a stainless tumbler with a coffee ring on the desk, a company lanyard badge
lying face down, several sticky notes with unreadable scribbles,
a stack of A4 papers with a binder clip, cheap ballpoint pens,
the bottom bezel of two monitors at the top edge of the frame,
a small potted plant slightly wilted at the far corner,
grey fabric partition wall behind, dusty desk surface,
overhead fluorescent light, no direct sun
```

## 2. `screen.webp` — 모니터 화면

화면을 정면에서. **내용이 읽히면 안 되므로** 반사와 초점 흐림으로 덮는다.

```
a desktop monitor seen straight on from a phone held at desk height,
the screen content completely unreadable: soft focus, low contrast,
a pale window shape and blurred grey-blue panels, faint room reflection
on the glossy panel, dust and fingerprints on the screen surface,
sticky notes stuck along the monitor bezel with illegible handwriting,
a second monitor edge entering from the side of the frame,
grey partition and beige wall behind, fluorescent light reflected as a soft bar,
cables running down behind the stand
```

## 3. `paper.webp` — 서류

책상 위 서류 더미를 가까이. 표와 도장 자국은 보이되 **글자는 뭉개진다.**

```
close-up of a stack of A4 office documents lying on a desk,
printed tables and ruled boxes visible as shapes only, all text illegible and
blurred, a faint red company stamp impression, yellow highlighter marks,
a paper clip and a binder clip, one page slightly curled at the corner,
a ballpoint pen resting across the stack, pencil ticks in the margin,
shallow depth of field so the lower pages fall out of focus,
fluorescent light from above, faint shadow of the phone at the frame edge,
beige and grey paper tones
```

## 4. `window.webp` — 창밖

7층에서 본 테헤란로. 여름 늦은 오후, 그러나 화창하지는 않다.

```
view out of a 7th floor office window onto a wide Seoul office street,
mid-rise glass office buildings across the road, rows of street trees in late
summer green, a bus and small cars far below, a crosswalk, roadside signage with
unreadable lettering, hazy humid sky, thin overcast, late afternoon,
half-open horizontal blinds framing the top of the shot,
window glass with faint reflections of the office interior and ceiling lights,
a dead fly and dust on the sill, the edge of a desk in the near foreground
```

## 넣는 법

1. 만든 그림을 이 폴더에 `desk.webp` · `screen.webp` · `paper.webp` ·
   `window.webp` 로 저장한다. `.webp` 만 읽는다.
2. **화면보다 크게** — 사진은 뷰파인더의 1.6배로 깔린다. 세로 1440×1920 이상을
   권한다(그보다 작으면 늘어난다).
3. 용량은 200KB 아래로 줄인다. png/jpg 로 뽑았다면:

```bash
npx sharp-cli --input desk.png --output desk.webp --format webp --quality 78
```

넣지 않아도 게임은 그대로 돈다 — 뷰파인더가 어두운 화면으로 남을 뿐이다.
