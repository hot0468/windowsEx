# 모바일 셸 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좁은 화면에서 기존 게임을 폰 셸로 띄운다 — 홈 화면, 화면 스택, 폰 모션. 게임 내용과 기존 테스트는 건드리지 않는다.

**Architecture:** `App.jsx` 한 곳에서 뷰포트로 분기해 `PhoneShell`을 띄운다. 화면 스택은 React state가 아니라 **`store.js`에 둔다** — 이 프로젝트는 컴포넌트를 렌더링해 테스트하지 않고 store 상태만 검사하기 때문이다. 앱 34개는 `.win-body` 대신 `.phone-body` 안에 그대로 들어간다.

**Tech Stack:** React 18, zustand 5, Vite 6, Vitest 2. **의존성을 추가하지 않는다** — 모션은 CSS `transform`/`opacity`만 쓴다.

**설계 문서:** `docs/superpowers/specs/2026-08-28-mobile-shell-design.md`

## Global Constraints

- **작업 규칙은 `CLAUDE.md`를 따른다.** 특히: `workday.json`을 Read/cat으로 열지 말 것(`node scripts/query.mjs`), JS/JSX는 대부분 CRLF이므로 스크립트 수정 시 `\r\n` 보존.
- **`workday.json`·`store.js`의 기존 로직·목표 188개를 수정하지 않는다.** store에는 새 상태와 액션만 **추가**한다.
- **기존 테스트 748개는 전부 통과해야 한다.** 깨지면 그 자체가 실패다.
- **의존성 추가 금지.** `react`, `react-dom`, `zustand` 외 런타임 의존성을 넣지 않는다.
- **새 상태를 store에 추가하면 `PROGRESS` 배열에 넣을지 판단한다.** 세이브에 남아야 하는 것만 넣는다. 화면 스택은 **넣지 않는다**(세션 상태).
- **모션은 `transform`/`opacity`만.** 레이아웃 속성(width/height/top/left)을 애니메이션하지 않는다.
- **이징은 `cubic-bezier(.32, .72, 0, 1)`로 통일**, 지속시간 220ms 이하.
- **모든 모션은 `prefers-reduced-motion: reduce`에서 꺼진다.**
- **`shell.css`(125KB)를 수정하지 않는다.** 폰 스타일은 `phone.css`에만 쓴다. 단 Task 7에서 reduced-motion 블록 한 곳만 예외적으로 손댄다.
- 폰의 PC 파일 접근 앱 이름은 **"내 PC 드라이브"**다. `AR 사내 드라이브`(`drive.ar.local`)는 이미 존재하는 다른 것이므로 그 이름을 쓰지 않는다.
- 테스트는 관련 파일만 먼저(`npx vitest run test/<파일>`), 마지막에 한 번 전체(`npm test`).

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/engine/store.js` (수정) | 화면 스택 상태·액션 추가. 기존 로직 불변 |
| `src/shell/useViewport.js` (신규) | 폰/데스크톱 판별. `?shell=` 강제 지정 |
| `src/shell/PhoneShell.jsx` (신규) | 상태바 · 홈 그리드 · 화면 라우팅 |
| `src/shell/PhoneApp.jsx` (신규) | 전체화면 앱 틀. 헤더 · 뒤로 · 홈 인디케이터 |
| `src/shell/phone.css` (신규) | 폰 전용 스타일과 모션 |
| `src/apps/registry.jsx` (수정) | 폰 홈에 놓을 앱 목록 |
| `src/App.jsx` (수정) | 분기 한 줄 |
| `test/phoneShell.test.js` (신규) | 스택·홈 복귀·소프트락 테스트 |
| `test/viewport.test.js` (신규) | 셸 선택 테스트 |

---

## Task 1: 뷰포트 판별

**Files:**
- Create: `src/shell/useViewport.js`
- Test: `test/viewport.test.js`

**Interfaces:**
- Produces:
  - `pickShell({ width, coarse, force }) -> 'phone' | 'desktop'` — 순수 함수, 테스트 대상
  - `useViewport() -> 'phone' | 'desktop'` — React 훅, 리사이즈 추종

판별 로직을 순수 함수로 분리하는 이유는 이 프로젝트에 DOM 테스트 환경이 없기 때문이다. 훅은 얇게 두고 로직만 검사한다.

- [x] **Step 1: 실패하는 테스트를 쓴다**

`test/viewport.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { pickShell } from '../src/shell/useViewport.js'

describe('셸 선택', () => {
  it('좁은 화면은 폰이다', () => {
    expect(pickShell({ width: 390, coarse: true })).toBe('phone')
  })

  it('넓은 화면은 데스크톱이다', () => {
    expect(pickShell({ width: 1440, coarse: false })).toBe('desktop')
  })

  it('경계는 820px이다', () => {
    expect(pickShell({ width: 820, coarse: false })).toBe('phone')
    expect(pickShell({ width: 821, coarse: false })).toBe('desktop')
  })

  // 태블릿·터치 노트북: 넓으면 데스크톱이 낫다. 창을 쓸 자리가 있다.
  it('넓은 터치 화면은 데스크톱이다', () => {
    expect(pickShell({ width: 1024, coarse: true })).toBe('desktop')
  })

  // 좁은 데스크톱 창(마우스)에서도 폰 셸이 맞다 — 창이 들어갈 자리가 없다.
  it('마우스여도 좁으면 폰이다', () => {
    expect(pickShell({ width: 500, coarse: false })).toBe('phone')
  })

  it('강제 지정이 판별을 이긴다', () => {
    expect(pickShell({ width: 1440, coarse: false, force: 'phone' })).toBe('phone')
    expect(pickShell({ width: 390, coarse: true, force: 'desktop' })).toBe('desktop')
  })

  it('알 수 없는 강제값은 무시한다', () => {
    expect(pickShell({ width: 1440, coarse: false, force: 'watch' })).toBe('desktop')
  })
})
```

- [x] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/viewport.test.js`
Expected: FAIL — `Failed to resolve import "../src/shell/useViewport.js"`

- [x] **Step 3: 구현한다**

`src/shell/useViewport.js`:

```js
import { useEffect, useState } from 'react'

// 폰 셸로 넘어가는 폭. 이보다 좁으면 창을 띄울 자리가 없다.
export const PHONE_MAX = 820

// 판별만 떼어낸 순수 함수 — 이 프로젝트에는 DOM 테스트 환경이 없으므로
// 로직은 여기서 검사하고 훅은 얇게 둔다.
export function pickShell({ width, coarse = false, force = null }) {
  if (force === 'phone' || force === 'desktop') return force
  return width <= PHONE_MAX ? 'phone' : 'desktop'
}

// ?shell=phone 으로 데스크톱에서도 폰 셸을 열어 볼 수 있다. 개발용이자,
// 좁은 창을 만들 수 없는 환경에서 확인하는 길.
const forced = () => {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('shell')
  } catch {
    return null
  }
}

const read = () => pickShell({
  width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  coarse: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  force: forced()
})

export function useViewport() {
  const [shell, setShell] = useState(read)
  useEffect(() => {
    const on = () => setShell(read())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return shell
}
```

- [x] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/viewport.test.js`
Expected: PASS — 7 tests

- [x] **Step 5: 커밋한다**

```bash
git add src/shell/useViewport.js test/viewport.test.js
git commit -m "feat: 화면 폭으로 폰 셸과 데스크톱 셸을 가른다"
```

---

## Task 2: 화면 스택 — store

**Files:**
- Modify: `src/engine/store.js`
- Test: `test/phoneShell.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - 상태 `screens: string[]` — `[]`면 홈. 항목은 `'app:<id>'` 또는 앱이 정한 임의 문자열
  - `pushScreen(key: string)` — 스택에 쌓는다. 같은 키 연속 중복은 무시
  - `popScreen()` — 하나 벗긴다. 홈에서는 아무 일도 없다
  - `goPhoneHome()` — 스택을 비운다. **`goHome`이 아니다** — 그 이름은 이미
    게임의 '퇴근하기'(야근 제안 거절, `App.jsx:158`)가 쓰고 있고, 거기에
    화면 스택을 얹으면 홈 버튼이 그날 야근 여부를 확정해 overwork 엔딩을
    망가뜨린다
  - `currentApp() -> string | null` — 스택 맨 아래의 앱 id. 홈이면 `null`

스택을 store에 두는 이유: 이 프로젝트는 컴포넌트를 렌더링해 테스트하지 않는다(`@testing-library` 없음, jsdom 미설정). 로직을 store로 밀어야 기존 방식대로 검사할 수 있다.

`screens`는 **`PROGRESS`에 넣지 않는다.** 어느 화면을 보고 있었는지는 세이브에 남을 성질이 아니다 — 불러오면 홈에서 시작하는 게 맞다.

- [x] **Step 1: 실패하는 테스트를 쓴다**

`test/phoneShell.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ screens: [] }))

describe('화면 스택', () => {
  it('처음에는 홈이다', () => {
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().currentApp()).toBe(null)
  })

  it('앱을 열면 쌓인다', () => {
    useGame.getState().pushScreen('app:messenger')
    expect(useGame.getState().screens).toEqual(['app:messenger'])
    expect(useGame.getState().currentApp()).toBe('messenger')
  })

  it('앱 안에서 더 들어가도 앱은 그대로다', () => {
    useGame.getState().pushScreen('app:messenger')
    useGame.getState().pushScreen('thread:junho')
    expect(useGame.getState().currentApp()).toBe('messenger')
    expect(useGame.getState().screens).toHaveLength(2)
  })

  it('뒤로는 한 겹만 벗긴다', () => {
    useGame.getState().pushScreen('app:messenger')
    useGame.getState().pushScreen('thread:junho')
    useGame.getState().popScreen()
    expect(useGame.getState().screens).toEqual(['app:messenger'])
  })

  it('홈에서 뒤로를 눌러도 안전하다', () => {
    useGame.getState().popScreen()
    expect(useGame.getState().screens).toEqual([])
  })

  it('홈은 깊이와 무관하게 한 번에 간다', () => {
    useGame.getState().pushScreen('app:explorer')
    useGame.getState().pushScreen('folder:문서')
    useGame.getState().pushScreen('folder:2026')
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().currentApp()).toBe(null)
  })

  // 같은 화면을 두 번 밀면 뒤로가 헛돈다 — 눌린 것 같은데 안 나가는 버그가 된다.
  it('같은 키를 연속으로 밀지 않는다', () => {
    useGame.getState().pushScreen('app:mail')
    useGame.getState().pushScreen('app:mail')
    expect(useGame.getState().screens).toEqual(['app:mail'])
  })

  // 소프트락 방지: 어떤 깊이에서도 홈으로 나올 수 있어야 한다.
  it('아무리 깊어도 홈으로 나올 수 있다', () => {
    for (let i = 0; i < 30; i++) useGame.getState().pushScreen(`deep:${i}`)
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
  })
})
```

- [x] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/phoneShell.test.js`
Expected: FAIL — `useGame.getState().pushScreen is not a function`

- [x] **Step 3: 구현한다**

`src/engine/store.js`의 `useGame` 안, `openWindow` 정의 근처에 넣는다. 먼저 자리를 찾는다:

```bash
grep -n "openWindow: (" src/engine/store.js
```

그 액션 바로 앞에 다음을 추가한다:

```js
  // 폰 셸의 화면 스택. []면 홈이고, 'app:<id>'가 바닥에 깔린 뒤 앱이 제
  // 안에서 더 들어갈 때마다 쌓인다. 데스크톱 셸은 이 값을 보지 않는다.
  //
  // PROGRESS에 넣지 않는다 — 어느 화면을 보고 있었는지는 세이브에 남을
  // 성질이 아니고, 불러오면 홈에서 시작하는 편이 낫다.
  screens: [],

  pushScreen: (key) => set((s) => (
    // 같은 화면이 두 번 쌓이면 뒤로가 한 번 헛돈다. 눌렀는데 안 나가는
    // 것처럼 보이므로 연속 중복은 버린다.
    s.screens[s.screens.length - 1] === key ? s : { screens: [...s.screens, key] }
  )),

  popScreen: () => set((s) => ({ screens: s.screens.slice(0, -1) })),

  goPhoneHome: () => set({ screens: [] }),

  // 스택이 아무리 깊어도 지금 어느 앱 안에 있는지는 바닥이 정한다.
  currentApp: () => {
    const [first] = get().screens
    return first?.startsWith('app:') ? first.slice(4) : null
  },
```

- [x] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/phoneShell.test.js`
Expected: PASS — 8 tests

- [x] **Step 5: 기존 테스트가 안 깨졌는지 본다**

Run: `npx vitest run test/store.test.js test/save.test.js`
Expected: PASS

- [x] **Step 6: 커밋한다**

```bash
git add src/engine/store.js test/phoneShell.test.js
git commit -m "feat: 폰 셸이 쓸 화면 스택을 store에 둔다"
```

---

## Task 3: 폰 홈에 놓을 앱 목록

**Files:**
- Modify: `src/apps/registry.jsx`
- Test: `test/phoneShell.test.js` (이어서 작성)

**Interfaces:**
- Consumes: `APPS` (기존)
- Produces: `phoneApps(grants: object) -> Array<{ id, title, icon, props? }>`

폰 홈은 데스크톱 시작 메뉴와 다르다. `cmd`·`taskmgr`처럼 폰에 없는 것은 빼고, `사진`·`파일`·`내 PC 드라이브`처럼 폰에만 있는 항목을 넣는다.

이번 라운드에서는 **설정 앱을 만들지 않는다**(스펙의 '제외' 항목). `cmd`를 폰 홈에서 빼면 `hostname`·`ipconfig`를 물어보는 요청 10건이 폰에서 막힌다. 그래서 이번에는 **`cmd`를 폰 홈에 남긴다** — 설정 앱이 생기면 그때 뺀다. 답이 실제로 찾아져야 한다는 원칙이 먼저다.

- [x] **Step 1: 실패하는 테스트를 쓴다**

`test/phoneShell.test.js` 맨 아래에 추가한다:

```js
import { phoneApps } from '../src/apps/registry.jsx'
import { APPS } from '../src/apps/registry.jsx'

describe('폰 홈 앱 목록', () => {
  it('폰다운 앱들이 있다', () => {
    const ids = phoneApps({}).map((a) => a.id)
    expect(ids).toContain('messenger')
    expect(ids).toContain('chat')
    expect(ids).toContain('mail')
    expect(ids).toContain('browser')
  })

  it('폰 저장소가 앱으로 올라온다', () => {
    const ids = phoneApps({}).map((a) => a.id)
    expect(ids).toContain('photos')
    expect(ids).toContain('files')
  })

  it('내 PC 드라이브가 있다', () => {
    const drive = phoneApps({}).find((a) => a.id === 'drive')
    expect(drive).toBeTruthy()
    expect(drive.title).toBe('내 PC 드라이브')
  })

  // 게임에 이미 AR 사내 드라이브(drive.ar.local)가 있다. 같은 이름을 쓰면
  // '사내 드라이브 > 전사 > …' 힌트가 플레이어를 엉뚱한 앱으로 보낸다.
  it('사내 드라이브라는 이름을 쓰지 않는다', () => {
    for (const a of phoneApps({})) expect(a.title).not.toBe('사내 드라이브')
    for (const a of phoneApps({})) expect(a.title).not.toBe('AR 사내 드라이브')
  })

  it('창에서만 열리는 것은 홈에 없다', () => {
    const ids = phoneApps({}).map((a) => a.id)
    expect(ids).not.toContain('devtools')
    expect(ids).not.toContain('installer')
  })

  it('설치하지 않은 프로그램은 홈에 없다', () => {
    expect(phoneApps({}).map((a) => a.id)).not.toContain('vpn')
    expect(phoneApps({ vpnInstalled: true }).map((a) => a.id)).toContain('vpn')
  })

  // 설정 앱이 아직 없다. cmd까지 빼면 hostname·ipconfig를 묻는 요청
  // 10건이 폰에서 답을 찾을 수 없게 된다.
  it('설정 앱이 생기기 전까지 명령 프롬프트를 남긴다', () => {
    expect(phoneApps({}).map((a) => a.id)).toContain('cmd')
  })

  it('홈의 모든 항목은 그릴 수 있는 것이다', () => {
    for (const a of phoneApps({ vpnInstalled: true })) {
      expect(a.title).toBeTruthy()
      expect(a.icon).toBeTruthy()
    }
  })
})
```

- [x] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/phoneShell.test.js`
Expected: FAIL — `phoneApps is not a function`

- [x] **Step 3: 구현한다**

`src/apps/registry.jsx` 맨 아래에 추가한다:

```jsx
// 폰 홈에 놓이는 것들. 데스크톱 시작 메뉴와 다르다 — 폰에 없는 물건은
// 빼고, PC에서는 탐색기 안의 폴더였던 것이 폰에서는 앱이 된다.
//
// 'photos'와 'files'는 fs.휴대폰 아래를 연다. 폰이 제 것으로 가진 저장소고,
// 부름이 묻는 영수증_0723이 여기 있다.
//
// 'drive'는 PC의 저장소가 폰에 마운트된 것이다. 원격 데스크톱이 아니다.
// 이름을 '사내 드라이브'로 하면 안 된다 — drive.ar.local이 이미 그 이름을
// 쓰고 있고, 그쪽은 VPN과 hosts로 잠긴 별개의 퍼즐이다.
const PHONE_EXTRA = [
  { id: 'photos', title: '사진', icon: 'image', app: 'explorer', props: { startFolder: ['휴대폰', '갤러리'] } },
  { id: 'files', title: '파일', icon: 'folder', app: 'explorer', props: { startFolder: ['휴대폰', '다운로드'] } },
  { id: 'drive', title: '내 PC 드라이브', icon: 'folder', app: 'explorer', props: { startFolder: '문서' } }
]

// 폰에 없는 물건. 작업 관리자와 백신은 PC를 관리하는 도구고, 탐색기는
// 사진·파일·드라이브로 갈라져 홈에 이미 세 번 올라와 있다.
//
// cmd와 notepad는 뺄 자리지만 남긴다. 설정 앱(기기 정보 · 사설 DNS)이
// 아직 없어서, 지금 빼면 hostname·ipconfig·hosts를 묻는 요청 14건이
// 폰에서 답을 찾을 수 없게 된다. 설정 앱이 생기는 라운드에 함께 뺀다.
const NOT_ON_PHONE = new Set(['explorer', 'taskmgr', 'antivirus'])

export const phoneApps = (grants = {}) => [
  ...PHONE_EXTRA,
  ...Object.entries(APPS)
    .filter(([id, a]) => !a.noLaunch && !NOT_ON_PHONE.has(id) && (!a.grant || grants[a.grant]))
    .map(([id, a]) => ({ id, title: a.title, icon: a.icon, app: id }))
]
```

- [x] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/phoneShell.test.js`
Expected: PASS — 16 tests

- [x] **Step 5: 커밋한다**

```bash
git add src/apps/registry.jsx test/phoneShell.test.js
git commit -m "feat: 폰 홈에 놓을 앱 목록"
```

---

## Task 4: 폰 앱 틀

**Files:**
- Create: `src/shell/PhoneApp.jsx`

**Interfaces:**
- Consumes: `useGame`(`popScreen`, `goPhoneHome`, `screens`)
- Produces: `<PhoneApp title icon onBack>{children}</PhoneApp>`

`Window.jsx`가 데스크톱에서 하던 일을 폰에서 한다. 창 대신 전체화면이고, 제목 표시줄 대신 헤더, 크기 조절 손잡이 대신 홈 인디케이터다.

- [x] **Step 1: 구현한다**

`src/shell/PhoneApp.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { ChevronLeft } from '../icons/line.jsx'

// 엣지 스와이프로 인식할 시작 영역. 이보다 안쪽에서 시작한 드래그는 앱
// 내용의 스크롤이지 뒤로가기가 아니다.
const EDGE = 20
// 이만큼 끌면 놓았을 때 뒤로 간다.
const COMMIT = 70

export default function PhoneApp({ title, icon, onBack, children }) {
  const screens = useGame((s) => s.screens)
  const popScreen = useGame((s) => s.popScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const [dx, setDx] = useState(0)
  const drag = useRef(null)

  // 뒤로 갈 데가 있는지는 두 곳이 정한다. 앱이 제 안의 깊이를 onBack으로
  // 알려주면 그걸 쓰고, 아니면 스택의 깊이를 본다.
  const back = onBack ?? (screens.length > 1 ? popScreen : goPhoneHome)

  const onPointerDown = (e) => {
    if (e.clientX > EDGE) return
    drag.current = { x0: e.clientX }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    setDx(Math.max(0, e.clientX - drag.current.x0))
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    if (dx > COMMIT) back()
    setDx(0)
  }

  return (
    <div className="phone-app"
         style={dx ? { transform: `translateX(${dx}px)` } : undefined}
         onPointerDown={onPointerDown}
         onPointerMove={onPointerMove}
         onPointerUp={onPointerUp}
         onPointerCancel={onPointerUp}>
      <header className="pa-head">
        <button className="pa-back" onClick={back} aria-label="뒤로">
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <span className="pa-title">
          {icon && <Icon name={icon} size={17} />}{title}
        </span>
      </header>
      <div className="phone-body">{children}</div>
      {/* 홈 인디케이터는 장식이 아니라 버튼이다. 어느 앱에서든 여기로 나온다. */}
      <button className="pa-home" onClick={goPhoneHome} aria-label="홈">
        <span className="pa-bar" />
      </button>
    </div>
  )
}
```

- [x] **Step 2: 문법을 검증한다**

`ChevronLeft`는 `src/icons/line.jsx:108`에 이미 있다. 새로 만들지 않는다.

Run: `npm run build`
Expected: 성공 (JSX 문법 검증 겸용 — `node --check`는 JSX를 못 읽는다)

- [x] **Step 3: 커밋한다**

```bash
git add src/shell/PhoneApp.jsx
git commit -m "feat: 폰의 전체화면 앱 틀 — 헤더, 뒤로, 홈"
```

---

## Task 5: 폰 셸

**Files:**
- Create: `src/shell/PhoneShell.jsx`

**Interfaces:**
- Consumes: `phoneApps`(Task 3), `PhoneApp`(Task 4), `useGame`(Task 2), `APPS`
- Produces: `<PhoneShell />`

- [x] **Step 1: 구현한다**

`src/shell/PhoneShell.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'
import { APPS, phoneApps } from '../apps/registry.jsx'
import PhoneApp from './PhoneApp.jsx'
import Icon from '../icons/Icon.jsx'

const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

// 상태바. 시각은 데스크톱 잠금화면과 같은 소스를 쓴다.
function StatusBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="ph-status">
      <span>{hhmm(now)}</span>
      <span className="ph-status-right">
        <span className="ph-signal" aria-hidden="true">▮▮▮</span>
        <span>87%</span>
      </span>
    </div>
  )
}

function Home() {
  const grants = useGame((s) => s.grants)
  const pushScreen = useGame((s) => s.pushScreen)
  const openWindow = useGame((s) => s.openWindow)
  const apps = phoneApps(grants)

  const open = (a) => {
    // 창 목록은 그대로 쓴다 — 앱이 어떤 파일을 열고 있는지 같은 상태가
    // 거기 있고, 데스크톱과 폰이 같은 저장 파일을 공유하기 때문이다.
    openWindow(a.app, a.props)
    pushScreen('app:' + a.id)
  }

  return (
    <div className="ph-home">
      <div className="ph-grid">
        {apps.map((a) => (
          <button key={a.id} className="ph-icon" onClick={() => open(a)}>
            <span className="ph-glyph"><Icon name={a.icon} size={30} /></span>
            <span className="ph-label">{a.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PhoneShell() {
  const screens = useGame((s) => s.screens)
  const grants = useGame((s) => s.grants)
  const currentApp = useGame((s) => s.currentApp)
  const popScreen = useGame((s) => s.popScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const windows = useGame((s) => s.windows)

  // 안드로이드의 뒤로가기 제스처는 그대로 두면 게임을 나가버린다. 한 겹
  // 밀어두고 가로채서 화면 스택을 벗긴다. 홈에서 한 번 더 누르면 그때
  // 브라우저 기본 동작이 먹힌다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const s = useGame.getState()
      if (!s.screens.length) return          // 홈이면 진짜로 나간다
      s.popScreen()
      window.history.pushState(null, '')     // 다음 뒤로가기를 위해 다시 깐다
    }
    window.history.pushState(null, '')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const id = currentApp()
  const entry = id ? phoneApps(grants).find((a) => a.id === id) : null
  const cfg = entry ? APPS[entry.app] : null
  const win = cfg ? windows.find((w) => w.app === entry.app) : null

  return (
    <div className="phone">
      <StatusBar />
      {!entry && (
        <>
          <Home />
          <div className="pa-home" aria-hidden="true"><span className="pa-bar" /></div>
        </>
      )}
      {entry && cfg && (
        <PhoneApp title={entry.title} icon={entry.icon}
                  onBack={screens.length > 1 ? popScreen : goPhoneHome}>
          <cfg.comp {...(entry.props ?? {})} winId={win?.id} />
        </PhoneApp>
      )}
    </div>
  )
}
```

- [x] **Step 2: 문법을 검증한다**

Run: `npm run build`
Expected: 성공

- [x] **Step 3: 커밋한다**

```bash
git add src/shell/PhoneShell.jsx
git commit -m "feat: 폰 셸 — 상태바, 홈, 물리 뒤로가기 가로채기"
```

---

## Task 6: 분기 연결

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useViewport`(Task 1), `PhoneShell`(Task 5)

- [x] **Step 1: import를 넣는다**

`src/App.jsx`의 `import Lock from './shell/Lock.jsx'` 바로 아래에 추가한다:

```jsx
import PhoneShell from './shell/PhoneShell.jsx'
import { useViewport } from './shell/useViewport.js'
import './shell/phone.css'
```

- [x] **Step 2: 분기를 넣는다**

`App()` 안에서 `const booted = useGame((s) => s.booted)` 아래에 추가한다:

```jsx
  const shell = useViewport()
```

그리고 return 문 직전의 오버레이 분기는 그대로 두고, 마지막 `return (` 을 다음으로 바꾼다:

```jsx
  if (ended) return <Ending />
  if (crashed) return <Crash />
  if (!booted) return <Boot />

  // 오버레이는 두 셸이 함께 쓴다 — 이미 전체화면이라 폰에서도 그대로 선다.
  const overlays = (
    <>
      <Toast />
      {locked && <Lock />}
      {rumorPending(rumor) && !failed && <RumorOverlay />}
      {cut && !failed && !rumorPending(rumor) && <LayoffOverlay />}
      {offer && !cut && !rumorPending(rumor) && <OvertimeOverlay offer={offer} />}
      {done && !offer && !cut && !rumorPending(rumor) && <QuitOverlay />}
      {failed && !finished && <FailOverlay />}
    </>
  )

  if (shell === 'phone') return <><PhoneShell />{overlays}</>

  return (
    <div className="desktop" style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}>
      <Desktop />
      <Progress />
      <WindowLayer />
      {overlays}
      <Taskbar />
    </div>
  )
```

- [x] **Step 3: 문법을 검증한다**

Run: `npm run build`
Expected: 성공

- [x] **Step 4: 기존 테스트 전체를 돌린다**

Run: `npm test`
Expected: 748+ passed — 데스크톱이 깨지지 않았음을 확인한다

- [x] **Step 5: 커밋한다**

```bash
git add src/App.jsx
git commit -m "feat: 좁은 화면이면 폰 셸로 간다"
```

---

## Task 6.5: 폰에서 하루를 끝낼 수 있게 한다

**Files:**
- Modify: `src/shell/PhoneShell.jsx`

**Interfaces:**
- Consumes: `useGame`(`closeDay`, `closing`), `requestsOf`, `objectiveDone`

**왜 이 태스크가 계획에 뒤늦게 들어왔나:** Task 6 리뷰에서 발견됐다. 데스크톱의
`Progress` 컴포넌트에는 「오늘 업무 마치기」 버튼이 있고, **그것이 `closeDay`를
부르는 유일한 경로다**(`grep closeDay` → `Progress.jsx` 한 곳). 폰 셸에는
`Progress`가 없으므로, 요청을 다 풀어도 하루가 끝나지 않는다. 1일차에서 게임이
멈춘다 — 소프트락이다.

폰에 데스크톱의 `Progress`를 그대로 얹지는 않는다. 그건 접었다 펴는 패널이라
폰 홈에 어울리지 않는다. 대신 **상태바 아래 얇은 진행 바** 하나를 둔다.

- [x] **Step 1: 홈에 진행 바를 넣는다**

`src/shell/PhoneShell.jsx`의 import에 추가한다:

```jsx
import { useGame, objectiveDone, requestsOf } from '../engine/store.js'
```

`StatusBar` 함수 아래에 컴포넌트를 추가한다:

```jsx
// 데스크톱의 Progress가 하던 두 가지 — 오늘 몇 건을 풀었는지, 그리고 하루를
// 끝내는 일 — 을 폰에서는 이 한 줄이 한다. closeDay를 부르는 경로가 여기밖에
// 없으므로 이게 없으면 폰에서는 하루가 끝나지 않는다.
function DayBar() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const ripples = useGame((s) => s.ripples)
  const closing = useGame((s) => s.closing)
  const closeDay = useGame((s) => s.closeDay)

  const list = requestsOf(scenario, day, overtime, drawn, ripples)
  const done = list.filter((o) => objectiveDone(o, { grants, unlocked }))
  const finished = done.length === list.length

  return (
    <div className="ph-day">
      <span className="ph-day-n">
        {day}일차 · <b>{done.length}</b>/{list.length}
        {overtime[day] && <i> · 야근</i>}
      </span>
      {finished && (
        <button className="ph-day-end" onClick={closeDay} disabled={closing}>
          오늘 업무 마치기
        </button>
      )}
    </div>
  )
}
```

- [x] **Step 2: 홈에 건다**

`PhoneShell`의 return에서 홈을 그리는 부분을 다음으로 바꾼다:

```jsx
      {!entry && (
        <>
          <DayBar />
          <Home />
          <div className="pa-home" aria-hidden="true"><span className="pa-bar" /></div>
        </>
      )}
```

- [x] **Step 3: 빌드하고 전체 테스트**

Run: `npm run build`
Expected: 성공

Run: `npm test`
Expected: 772+ passed

- [x] **Step 4: 커밋한다**

```bash
git add src/shell/PhoneShell.jsx
git commit -m "fix: 폰에서도 하루를 끝낼 수 있게 한다"
```

Task 7의 `phone.css`에 `.ph-day`, `.ph-day-n`, `.ph-day-end` 스타일이 포함된다.

---

## Task 7: 스타일과 모션

**Files:**
- Create: `src/shell/phone.css`
- Modify: `src/shell/shell.css` (reduced-motion 블록 한 곳만)

`shell.css`는 이 한 곳 외에 건드리지 않는다.

- [x] **Step 1: `phone.css`를 쓴다**

```css
/* 폰 셸. 데스크톱과 다른 물건이므로 회사 시스템의 파랑(#2f6fd0)을 쓰지
   않는다. 색은 갤러리 사진과 읽지 않은 알림 점에만 산다. */
.phone {
  --p-ink: #10131a;
  --p-bg: #f7f8fa;
  --p-surface: #fff;
  --p-line: #e6e8ed;
  --p-mute: #8b909c;
  --p-accent: #3d4a5c;
  --p-ease: cubic-bezier(.32, .72, 0, 1);

  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--p-bg);
  color: var(--p-ink);
  font-family: Pretendard, -apple-system, 'Malgun Gothic', sans-serif;
  font-size: 15px;
  overflow: hidden;
}

/* 상태바 */
.ph-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px;
  padding: 0 20px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .2px;
  flex: none;
}
.ph-status-right { display: flex; align-items: center; gap: 6px; }
.ph-signal { letter-spacing: -2px; font-size: 10px; }

/* 하루 진행 바. 데스크톱 Progress의 두 가지 일을 한 줄로 한다. */
.ph-day {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 20px 10px;
  font-size: 12.5px;
  color: var(--p-mute);
  flex: none;
}
.ph-day-n b { color: var(--p-ink); font-weight: 600; }
.ph-day-n i { font-style: normal; color: #c9803a; }
.ph-day-end {
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--p-accent);
  color: #fff;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 90ms ease-out, opacity 90ms ease-out;
}
.ph-day-end:active { transform: scale(.96); }
.ph-day-end:disabled { opacity: .5; cursor: default; }

/* 홈 */
.ph-home { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 12px 8px; }
.ph-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px 4px;
}
.ph-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: transform 90ms ease-out;
}
.ph-icon:active { transform: scale(.92); }
.ph-glyph {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  border-radius: 18px;
  background: var(--p-surface);
  color: var(--p-accent);
  box-shadow: 0 1px 3px rgba(16, 19, 26, .08), 0 6px 16px rgba(16, 19, 26, .05);
}
.ph-label {
  max-width: 74px;
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

/* 앱 */
.phone-app {
  position: absolute;
  inset: 40px 0 0;             /* 상태바 아래 */
  display: flex;
  flex-direction: column;
  background: var(--p-bg);
  animation: ph-in 220ms var(--p-ease);
  will-change: transform;
}
@keyframes ph-in {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: none; }
}
.pa-head {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 52px;
  padding: 0 8px 0 4px;
  background: var(--p-surface);
  border-bottom: 1px solid var(--p-line);
  flex: none;
}
.pa-back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: var(--p-ink);
  cursor: pointer;
  transition: transform 90ms ease-out, background 90ms ease-out;
}
.pa-back:active { transform: scale(.9); background: rgba(16, 19, 26, .05); }
.pa-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

/* 앱 내용. 데스크톱의 .win-body가 하던 자리를 그대로 잇는다. */
.phone-body {
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: var(--p-surface);
}

/* 홈 인디케이터. 보이는 선은 얇지만 누르는 자리는 넓다. */
.pa-home {
  display: grid;
  place-items: center;
  height: 26px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  flex: none;
  touch-action: none;
}
.pa-bar {
  width: 140px;
  height: 5px;
  border-radius: 3px;
  background: var(--p-ink);
  opacity: .22;
  transition: opacity 90ms ease-out, transform 90ms ease-out;
}
.pa-home:active .pa-bar { opacity: .45; transform: scaleX(.94); }

/* 폰에서는 데스크톱 창틀이 설 자리가 없다. */
.phone .window, .phone .taskbar, .phone .desktop-icons { display: none; }
```

- [x] **Step 2: reduced-motion에 물린다**

`src/shell/shell.css`의 1213줄 근처 블록을 찾는다:

```bash
grep -n "prefers-reduced-motion" src/shell/shell.css
```

그 블록 안에 폰 모션을 추가한다. 기존 줄은 지우지 않는다:

```css
@media (prefers-reduced-motion: reduce) {
  .clear-overlay.ot > *, .clear-overlay.quit > *, .clear-overlay.quit .quit-score b { animation: none; }
  /* 폰 셸의 모션도 전부 여기서 멈춘다. */
  .phone-app { animation: none; }
  .ph-icon, .pa-back, .pa-bar, .ph-day-end { transition: none; }
}
```

- [x] **Step 3: 빌드한다**

Run: `npm run build`
Expected: 성공

- [x] **Step 4: 커밋한다**

```bash
git add src/shell/phone.css src/shell/shell.css
git commit -m "feat: 폰 셸의 스타일과 모션"
```

---

## Task 8: 실제로 띄워서 확인

**Files:** 없음 (검증만)

계획서의 코드가 통과해도 화면이 맞는지는 별개다. 이 프로젝트에는 CDP로 브라우저를 띄워 확인한 전례가 있다(메모리 `windowsex-cdp-driving`).

- [x] **Step 1: 개발 서버를 띄운다**

Run: `npm run dev`
Expected: `http://127.0.0.1:5173` 에서 뜬다

- [x] **Step 2: 폰 셸을 연다**

브라우저에서 `http://127.0.0.1:5173/?shell=phone` 를 연다.
DevTools의 기기 모드로 폭 390px을 준다.

- [x] **Step 3: 다음을 눈으로 확인한다**

- [x] 상태바에 시각이 뜬다
- [x] 홈에 아이콘이 4열로 놓인다
- [x] 아이콘을 누르면 앱이 우→좌로 밀려 들어온다
- [x] 앱 안에서 스크롤이 된다
- [x] `‹` 뒤로가 동작한다
- [x] **홈 인디케이터를 누르면 홈으로 나온다** — 어느 앱, 어느 깊이에서든
- [x] 좌측 가장자리에서 오른쪽으로 끌면 뒤로 간다
- [x] 안드로이드(또는 DevTools 기기 모드)에서 뒤로가기가 게임을 나가지 않는다
- [x] `AR톡`을 열어 대화가 보인다
- [x] `사진`을 열어 갤러리가 보인다
- [x] `내 PC 드라이브`를 열어 문서 폴더가 보인다

- [x] **Step 4: 데스크톱이 그대로인지 본다**

`http://127.0.0.1:5173/` 를 넓은 창에서 연다. 창을 끌고 크기를 바꿔 본다.
Expected: 예전과 똑같다

- [x] **Step 5: 전체 테스트**

Run: `npm test`
Expected: 748+ passed

- [x] **Step 6: 확인한 것을 적는다**

`docs/superpowers/plans/2026-08-28-mobile-shell.md` 맨 아래에 「확인 기록」 절을 만들어, 위 항목 중 안 되는 것과 그 이유를 적는다. 다음 라운드(앱 내부 손질)의 출발점이 된다.

```bash
git add docs/superpowers/plans/2026-08-28-mobile-shell.md
git commit -m "docs: 폰 셸 실제 확인 기록"
```

---

## 다음 라운드로 미룬 것

스펙의 '제외' 항목이다. 이번 계획에 넣지 않는다.

- **설정 앱** (기기 정보 · 와이파이 사설 DNS) — 이게 생기면 `cmd`와 `notepad`를 폰 홈에서 뺀다. 그 전에 빼면 요청 14건이 폰에서 막힌다.
- **앱 34개 내부 손질** — 셸만으로는 폰다움의 7할이다. 나머지는 실제로 보고 정한다.
- **시트 셀 편집** — 한글/시트가 70개 ask에 걸려 있고 360px에서 좁다. 전용 편집기를 만들지, 해당 요청을 내 PC 드라이브 쪽으로 보낼지 Task 8에서 보고 정한다.
- **앱 전환 카드**(`AppSwitcher`) — 홈 복귀 경로가 이미 둘(인디케이터, 뒤로) 있으므로 급하지 않다.
- **폰 잠금화면의 알림 스택** — 스펙의 시그니처지만 셸이 선 뒤에 얹는 게 맞다.

---

## 확인 기록 (2026-08-28)

헤드리스 크롬 + CDP로 390×844(터치)와 1440×900 두 폭에서 실제로 띄워 확인했다.

### 되는 것

- 폰 셸이 뜬다. 데스크톱 잔재(바탕화면 아이콘·작업표시줄) 없음
- 상태바(시각·배터리), 진행 바(`1일차 · 0/9`), 4열 홈 그리드
- 아이콘을 누르면 앱이 전체화면으로 열리고 헤더에 제목이 뜬다
- **홈 인디케이터를 누르면 홈으로 돌아온다** — 소프트락 없음
- 뒤로 버튼 `aria-label="뒤로"`, 홈은 실제 `<button>`
- 앱 본문 `overflow: auto`로 스크롤됨
- 사진(휴대폰/갤러리)·내 PC 드라이브(문서) 모두 올바른 위치를 연다
- `prefers-reduced-motion: reduce`에서 `.phone-app`의 `animationName`이
  실측으로 `none` — 모션이 실제로 꺼진다
- 1440px에서는 데스크톱 셸 그대로. 창 열기·제목표시줄·Progress 정상

### 고친 것

- **홈에 '사진'이 두 번 나왔다.** `viewer`의 제목이 '사진'이라 폰 네이티브
  `photos`와 겹쳤다. `NOT_ON_PHONE`에 `viewer` 추가. 중복 이름 금지 테스트와
  함께 커밋(11f4d85). 실제로 띄워보지 않았으면 못 봤을 결함이다.

### 다음 라운드로 넘기는 것 — 앱 내부가 아직 데스크톱 밀도다

계획서가 예고한 "셸만으로는 7할"의 나머지 3할이 눈으로 확인됐다.

1. **파일 앱 사이드바에 PC 루트 6개가 그대로 나온다.** 사진(갤러리)을 열어도
   왼쪽에 `로컬 디스크 (C:)`까지 보인다. "폰은 폰 것만" 설계가 UI에서
   지켜지지 않았다. `FileExplorer`가 `roots`를 prop으로 받게 하고 폰 네이티브
   앱에는 `휴대폰`만, 내 PC 드라이브에는 PC 4개만 넘겨야 한다.
2. **툴바가 가로로 잘린다.** 주소창·보기 메뉴가 390px를 넘어가 가로 스크롤이
   생긴다. 스펙이 금지한 것(`overflow-x`는 내부 컨테이너에만)이다.
3. **아이콘 구분이 약하다.** 파일과 내 PC 드라이브가 같은 폴더 아이콘이라
   홈에서 구별되지 않는다.
4. **시트 셀 편집**은 아직 확인하지 못했다. 70개 ask가 걸려 있어 다음
   라운드의 첫 항목으로 둔다.
