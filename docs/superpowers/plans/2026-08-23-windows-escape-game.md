# 윈도우 방탈출 게임 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 실행되는 Windows 11 스타일 가짜 데스크톱 방탈출 게임 — 메신저로 목표를 받고, 가상 PC를 뒤져 올바른 메일 회신을 보내면 클리어.

**Architecture:** 판 내용(파일시스템·메일·메신저·사이트·정답 조건)은 전부 `src/scenarios/ep1.json` 데이터. React 셸(창 관리, 작업표시줄)과 앱 5종은 이 데이터를 렌더하는 뷰어. 전역 상태는 zustand store 하나.

**Tech Stack:** React 18, Vite 6, zustand 5, vitest 2. 빌드 외 의존성 추가 금지.

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-08-23-windows-escape-game-design.md`
- 게임 내 텍스트는 전부 한국어. 실제 인터넷 접속 없음(브라우저 앱은 게임 내 데이터만 렌더).
- Windows 11 룩: 둥근 모서리, 반투명 blur, 가운데 정렬 작업표시줄, `'Segoe UI', 'Malgun Gothic'` 폰트.
- vitest 유닛 테스트는 engine(정답 판정·store)과 시나리오 데이터 무결성만. 셸/앱 UI는 `npm run dev` 수동 확인.
- 저장/불러오기, 시간제한, OS 로그인, 사운드는 범위 외 (스펙 참조).
- 커밋 메시지 끝에: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.jsx`, `src/App.jsx`

**Interfaces:**
- Produces: `npm run dev`(Vite 개발 서버), `npm test`(vitest), `src/App.jsx` 기본 컴포넌트(이후 Task 5에서 교체).

- [ ] **Step 1: 파일 작성**

`package.json`:
```json
{
  "name": "windows-escape",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

`vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
```

`index.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>한빛상사 업무 PC</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

`.gitignore`:
```
node_modules/
dist/
```

`src/main.jsx`:
```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
```

`src/App.jsx` (임시 — Task 5에서 교체):
```jsx
export default function App() {
  return <h1>부팅 준비 중…</h1>
}
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: 에러 없이 완료, `node_modules/` 생성.

- [ ] **Step 3: 개발 서버 확인**

Run: `npm run dev` → 브라우저에서 http://localhost:5173
Expected: "부팅 준비 중…" 표시.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React project"
```

---

### Task 2: 정답 판정 엔진 (TDD)

**Files:**
- Create: `src/engine/goal.js`
- Test: `test/goal.test.js`

**Interfaces:**
- Produces: `checkGoal(goal, { attachmentId, body })` → `{ ok: boolean, reply: string }`. `goal`은 시나리오 JSON의 `goal` 객체(`requiredAttachment`, `requiredKeywords`, `wrongAttachmentReply`, `missingKeywordReply`, `successReply`). 키워드 비교는 쉼표·공백 무시.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/goal.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { checkGoal } from '../src/engine/goal.js'

const goal = {
  requiredAttachment: 'file_quote_final',
  requiredKeywords: ['3,450,000'],
  wrongAttachmentReply: 'WRONG_ATT',
  missingKeywordReply: 'MISSING_KW',
  successReply: 'SUCCESS'
}

describe('checkGoal', () => {
  it('rejects a wrong attachment', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_v2', body: '3,450,000원입니다' }))
      .toEqual({ ok: false, reply: 'WRONG_ATT' })
  })

  it('rejects a missing attachment', () => {
    expect(checkGoal(goal, { attachmentId: null, body: '3,450,000원입니다' }).ok).toBe(false)
  })

  it('rejects a body without the keyword', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '견적서 보냅니다' }))
      .toEqual({ ok: false, reply: 'MISSING_KW' })
  })

  it('accepts correct attachment and keyword', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '총액 3,450,000원입니다' }))
      .toEqual({ ok: true, reply: 'SUCCESS' })
  })

  it('ignores commas and spaces when matching keywords', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '총액은 345 0000 원' }).ok).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/engine/goal.js"` 류의 에러.

- [ ] **Step 3: 최소 구현**

`src/engine/goal.js`:
```js
const norm = (s) => String(s ?? '').replace(/[,\s]/g, '')

export function checkGoal(goal, { attachmentId, body }) {
  if (attachmentId !== goal.requiredAttachment) {
    return { ok: false, reply: goal.wrongAttachmentReply }
  }
  const nbody = norm(body)
  const missing = goal.requiredKeywords.some((k) => !nbody.includes(norm(k)))
  if (missing) {
    return { ok: false, reply: goal.missingKeywordReply }
  }
  return { ok: true, reply: goal.successReply }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/engine/goal.js test/goal.test.js
git commit -m "feat: add goal verdict engine"
```

---

### Task 3: 시나리오 데이터 ep1.json

**Files:**
- Create: `src/scenarios/ep1.json`
- Test: `test/scenario.test.js`

**Interfaces:**
- Produces: 시나리오 스키마 — 이후 모든 앱이 이 구조를 읽음.
  - `player {name, company, email}`
  - `messenger[] {from, text, delay}` (delay: 부팅 후 ms)
  - `mails[] {id, from, subject, date, body, canReply?}`
  - `fs { 폴더명: [{id, name, content}] }`
  - `sites[] {url, title, content, password?, passwordHint?}`
  - `bookmarks[] {url, title}`, `history[] {url, title, date}`
  - `goal` (Task 2의 checkGoal 입력 + `replyToMail`)

- [ ] **Step 1: ep1.json 작성**

`src/scenarios/ep1.json`:
```json
{
  "id": "ep1",
  "title": "복귀 첫날",
  "player": { "name": "김한별", "company": "한빛상사", "email": "hanbyul.kim@hanbit.co.kr" },
  "messenger": [
    { "from": "박 팀장", "text": "김대리! 복귀 축하해요 🎉 휴가는 잘 보냈어요?", "delay": 1500 },
    { "from": "박 팀장", "text": "쉬는 동안 별일은 없었는데… 딱 하나. 거래처 A상사에서 견적서 최종본을 다시 보내달라고 계속 연락이 왔어요.", "delay": 5000 },
    { "from": "박 팀장", "text": "담당자 이수진 과장님 메일이 와 있을 거예요. 메일 확인하고 오늘 중으로 회신 부탁해요!", "delay": 9500 },
    { "from": "박 팀장", "text": "파일은 아마 김대리 PC 어딘가에 있을 거예요. 그럼 파이팅! 💪", "delay": 13000 }
  ],
  "mails": [
    {
      "id": "mail_client",
      "from": "이수진 <sj.lee@asangsa.co.kr>",
      "subject": "[A상사] 바코드 스캐너 견적서 최종본 재송부 요청",
      "date": "8월 21일 (금) 16:42",
      "body": "김한별 대리님, 안녕하세요. A상사 구매팀 이수진입니다.\n\n휴가 중이시라는 자동회신을 받고 기다리고 있었습니다.\n지난달 논의했던 무선 바코드 스캐너 BS-200 건, 드디어 내부 품의가 잡혔습니다.\n\n아래 두 가지를 회신 부탁드립니다.\n1. 견적서 '최종본' 파일 첨부\n2. 메일 본문에 100대 기준 확정 단가 기재 (총액)\n\n이번 주 안으로 부탁드리겠습니다.\n\n감사합니다.\n이수진 드림",
      "canReply": true
    },
    {
      "id": "mail_wiki",
      "from": "정보전략팀 <it@hanbit.co.kr>",
      "subject": "[안내] 사내위키 비밀번호 초기화 안내",
      "date": "8월 11일 (화) 10:03",
      "body": "임직원 여러분, 보안 강화를 위해 사내위키(wiki.hanbit.co.kr) 비밀번호가 전체 초기화되었습니다.\n\n초기 비밀번호: 본인 입사일 4자리 (MMDD)\n\n로그인 후 반드시 비밀번호를 변경해 주시기 바랍니다.\n정보전략팀 드림"
    },
    {
      "id": "mail_notice",
      "from": "총무팀 <ga@hanbit.co.kr>",
      "subject": "[공지] 사내 주차장 도색 공사 안내 (8/25~8/27)",
      "date": "8월 20일 (목) 09:12",
      "body": "8월 25일(월)부터 27일(수)까지 지하 주차장 도색 공사가 진행됩니다.\n해당 기간에는 인근 공영주차장을 이용해 주시기 바랍니다.\n총무팀 드림"
    },
    {
      "id": "mail_spam",
      "from": "제주드림투어 <event@jejudream.biz>",
      "subject": "🎁 축하합니다! 제주도 왕복 항공권 당첨!!",
      "date": "8월 18일 (화) 03:11",
      "body": "고객님은 제주도 왕복 항공권 이벤트에 당첨되셨습니다!\n지금 바로 링크를 클릭… (아무리 봐도 스팸이다. 게다가 방금 제주도 다녀왔는데.)"
    }
  ],
  "fs": {
    "바탕화면": [
      {
        "id": "file_memo",
        "name": "메모.txt",
        "content": "☆ 휴가 전 할 일 메모 ☆\n\n- 사내위키 비밀번호 바뀜!! → 내 입사일 4자리 (MMDD)\n- 입사일이 기억 안 나면 문서 폴더의 사원증 스캔본 확인\n- 화분 물주기 부탁하기 (완료)\n- 자동회신 설정 (완료)"
      }
    ],
    "문서": [
      {
        "id": "file_idcard",
        "name": "사원증_스캔.txt",
        "content": "[한빛상사 사원증 스캔본]\n\n이름: 김한별\n소속: 영업1팀\n사번: HB-2104\n입사일: 2021년 4월 12일"
      },
      {
        "id": "file_quote_final",
        "name": "견적서_최종_진짜최종.txt",
        "content": "[견적서 - 최종본]\n\n수신: A상사 구매팀\n품목: 무선 바코드 스캐너 BS-200\n수량: 100대\n단가(총액): ※ 사내위키 '확정 단가표' 참조 후 본문에 기재\n납기: 발주 후 3주\n유효기간: 발행일로부터 30일\n\n담당: 영업1팀 김한별"
      }
    ],
    "다운로드": [
      {
        "id": "file_quote_v1",
        "name": "견적서_v1.txt",
        "content": "[견적서 - 초안 v1]\n\n품목: 무선 바코드 스캐너 BS-100 (구형)\n수량: 100대\n단가: 미정\n\n※ BS-100 단종 예정. BS-200으로 다시 작성할 것."
      },
      {
        "id": "file_quote_v2",
        "name": "견적서_v2.txt",
        "content": "[견적서 - v2]\n\n품목: 무선 바코드 스캐너 BS-200\n수량: 100대\n단가: 협의 중 (확정 전)\n\n※ 단가 확정되면 최종본으로 갱신할 것 → 문서 폴더"
      },
      {
        "id": "file_cat",
        "name": "제주도_고양이.txt",
        "content": "(휴가 때 찍은 고양이 사진… 이라고 상상해 주세요.\n귤 창고 앞에서 낮잠 자던 아이입니다. 아주 귀엽습니다.)"
      }
    ]
  },
  "sites": [
    {
      "url": "wiki.hanbit.co.kr",
      "title": "한빛상사 사내위키",
      "password": "0412",
      "passwordHint": "비밀번호: 본인 입사일 4자리 (MMDD)",
      "content": "📄 영업1팀 > 확정 단가표 (2026-07 개정)\n\n무선 바코드 스캐너 BS-100 (단종): -\n무선 바코드 스캐너 BS-200 · 100대 기준 총액: 3,450,000원\n유선 바코드 스캐너 BW-50 · 100대 기준 총액: 1,280,000원\n\n※ 대외 견적서에는 반드시 본 단가표 금액을 사용할 것"
    },
    {
      "url": "portal.hanbit.co.kr",
      "title": "한빛 포털",
      "content": "🏢 한빛상사 사내 포털\n\n[사내 소식]\n- 3분기 워크숍 장소 투표 진행 중\n- 구내식당 이번 주 특식: 전복죽 (금)\n\n바로가기: 사내위키 wiki.hanbit.co.kr"
    }
  ],
  "bookmarks": [
    { "url": "portal.hanbit.co.kr", "title": "한빛 포털" },
    { "url": "wiki.hanbit.co.kr", "title": "사내위키" }
  ],
  "history": [
    { "url": "wiki.hanbit.co.kr", "title": "한빛상사 사내위키 - 확정 단가표", "date": "7월 24일" },
    { "url": "portal.hanbit.co.kr", "title": "한빛 포털", "date": "7월 24일" }
  ],
  "goal": {
    "replyToMail": "mail_client",
    "requiredAttachment": "file_quote_final",
    "requiredKeywords": ["3,450,000"],
    "wrongAttachmentReply": "대리님, 견적서 최종본 파일이 안 보이거나 예전 버전인 것 같습니다. 단가가 확정된 '최종본' 첨부 부탁드려요!",
    "missingKeywordReply": "파일은 잘 받았습니다! 그런데 본문에 확정 단가(총액)가 안 보이네요. 금액을 기재해서 다시 회신 부탁드립니다.",
    "successReply": "최종본과 단가 확인했습니다! 바로 품의 올리겠습니다. 빠른 회신 감사합니다 :)"
  }
}
```

- [ ] **Step 2: 데이터 무결성 테스트 작성**

`test/scenario.test.js`:
```js
import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'

const files = Object.values(scenario.fs).flat()

describe('ep1 scenario integrity', () => {
  it('goal attachment file exists in the filesystem', () => {
    expect(files.some((f) => f.id === scenario.goal.requiredAttachment)).toBe(true)
  })

  it('goal reply mail exists and is replyable', () => {
    const m = scenario.mails.find((m) => m.id === scenario.goal.replyToMail)
    expect(m?.canReply).toBe(true)
  })

  it('locked wiki page contains every required keyword', () => {
    const wiki = scenario.sites.find((s) => s.password)
    for (const k of scenario.goal.requiredKeywords) expect(wiki.content).toContain(k)
  })

  it('file ids are unique', () => {
    const ids = files.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test`
Expected: goal 5 + scenario 4 = 9 passed.

- [ ] **Step 4: Commit**

```bash
git add src/scenarios/ep1.json test/scenario.test.js
git commit -m "feat: add ep1 scenario data with integrity tests"
```

---

### Task 4: 전역 store (창 관리 + 게임 액션)

**Files:**
- Create: `src/engine/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: Task 2 `checkGoal`, Task 3 `ep1.json`.
- Produces (모든 UI 태스크가 사용):
  - `useGame` zustand 훅. 상태: `scenario`, `booted`, `windows[]`(각 원소 `{id, key, app, props, x, y, z, minimized, maximized}`), `toast`, `msgCount`, `readMails{}`, `extraMails[]`, `wikiUnlocked`, `cleared`
  - 액션: `setBooted()`, `showToast(t)`, `clearToast()`, `deliverMessage()`, `openWindow(app, props?)`, `closeWindow(id)`, `focusWindow(id)`, `minimizeWindow(id)`, `toggleMaximize(id)`, `moveWindow(id, x, y)`, `markMailRead(id)`, `unlockWiki()`, `sendReply({attachmentId, body})` → boolean
  - 헬퍼 export: `findFile(fs, fileId)` → 파일 객체 | null, `allFiles(fs)` → 파일 배열
  - 창 재사용 규칙: `key = app + (props.fileId ?? '')` — 같은 key의 창이 있으면 새로 만들지 않고 포커스.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/store.test.js`:
```js
import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ windows: [], nextZ: 10 }))

describe('window management', () => {
  it('opens windows with increasing z-order', () => {
    useGame.getState().openWindow('mail')
    useGame.getState().openWindow('browser')
    const [a, b] = useGame.getState().windows
    expect(b.z).toBeGreaterThan(a.z)
  })

  it('reopening the same app focuses the existing window', () => {
    useGame.getState().openWindow('mail')
    useGame.getState().openWindow('mail')
    expect(useGame.getState().windows).toHaveLength(1)
  })

  it('notepad windows for different files are separate', () => {
    useGame.getState().openWindow('notepad', { fileId: 'a' })
    useGame.getState().openWindow('notepad', { fileId: 'b' })
    expect(useGame.getState().windows).toHaveLength(2)
  })

  it('focus unminimizes and raises z', () => {
    useGame.getState().openWindow('mail')
    const id = useGame.getState().windows[0].id
    useGame.getState().minimizeWindow(id)
    expect(useGame.getState().windows[0].minimized).toBe(true)
    const zBefore = useGame.getState().windows[0].z
    useGame.getState().focusWindow(id)
    const w = useGame.getState().windows[0]
    expect(w.minimized).toBe(false)
    expect(w.z).toBeGreaterThan(zBefore)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: store.test.js FAIL — `Failed to resolve import "../src/engine/store.js"`.

- [ ] **Step 3: store 구현**

`src/engine/store.js`:
```js
import { create } from 'zustand'
import scenario from '../scenarios/ep1.json'
import { checkGoal } from './goal.js'

let winId = 0

export const useGame = create((set, get) => ({
  scenario,
  booted: false,
  windows: [],
  nextZ: 10,
  toast: null,
  msgCount: 0,
  readMails: {},
  extraMails: [],
  wikiUnlocked: false,
  cleared: false,

  setBooted: () => set({ booted: true }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  deliverMessage: () =>
    set((s) => ({ msgCount: Math.min(s.msgCount + 1, s.scenario.messenger.length) })),

  openWindow: (app, props = {}) =>
    set((s) => {
      const key = app + (props.fileId ?? '')
      const existing = s.windows.find((w) => w.key === key)
      if (existing) {
        return {
          windows: s.windows.map((w) =>
            w.id === existing.id ? { ...w, minimized: false, z: s.nextZ } : w),
          nextZ: s.nextZ + 1
        }
      }
      const n = s.windows.length
      return {
        windows: [...s.windows, {
          id: ++winId, key, app, props,
          x: 120 + (n % 5) * 36, y: 60 + (n % 5) * 32,
          z: s.nextZ, minimized: false, maximized: false
        }],
        nextZ: s.nextZ + 1
      }
    }),
  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  focusWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.nextZ, minimized: false } : w)),
      nextZ: s.nextZ + 1
    })),
  minimizeWindow: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) })),
  toggleMaximize: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)) })),
  moveWindow: (id, x, y) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),

  markMailRead: (id) => set((s) => ({ readMails: { ...s.readMails, [id]: true } })),
  unlockWiki: () => set({ wikiUnlocked: true }),

  sendReply: ({ attachmentId, body }) => {
    const s = get()
    const goal = s.scenario.goal
    const original = s.scenario.mails.find((m) => m.id === goal.replyToMail)
    const verdict = checkGoal(goal, { attachmentId, body })
    setTimeout(() => {
      set((st) => ({
        extraMails: [...st.extraMails, {
          id: 'reply_' + Date.now(),
          from: original.from,
          subject: 'RE: ' + original.subject,
          date: '방금',
          body: verdict.reply
        }]
      }))
      if (verdict.ok) setTimeout(() => set({ cleared: true }), 2500)
    }, 1800)
    return verdict.ok
  }
}))

export function findFile(fs, fileId) {
  for (const folder of Object.values(fs)) {
    const f = folder.find((x) => x.id === fileId)
    if (f) return f
  }
  return null
}

export function allFiles(fs) {
  return Object.values(fs).flat()
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 13 passed (goal 5 + scenario 4 + store 4).

- [ ] **Step 5: Commit**

```bash
git add src/engine/store.js test/store.test.js
git commit -m "feat: add global game store with window management"
```

---

### Task 5: Windows 11 셸 (창·바탕화면·작업표시줄·시작메뉴·부팅)

**Files:**
- Create: `src/shell/shell.css`, `src/shell/Window.jsx`, `src/shell/Desktop.jsx`, `src/shell/Taskbar.jsx`, `src/apps/registry.jsx`
- Modify: `src/App.jsx`(전면 교체), `src/main.jsx`(css import 추가)

**Interfaces:**
- Consumes: Task 4 `useGame` 액션 전부.
- Produces:
  - `Window` 컴포넌트: `({ win, title, icon, width, height, children })` — 드래그/최소화/최대화/닫기/포커스 처리.
  - `APPS` 레지스트리(`src/apps/registry.jsx`): `{ [appKey]: { title, icon, comp, w, h } }`. appKey는 `messenger | mail | explorer | notepad | browser`. 이후 앱 태스크는 자기 항목의 `comp: Placeholder`만 실제 컴포넌트로 교체.
  - CSS 클래스: `.btn-primary`, `.window`, `.taskbar`, `.toast`, `.clear-overlay` 등 이후 태스크가 사용.

- [ ] **Step 1: shell.css 작성**

`src/shell/shell.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #root { height: 100%; overflow: hidden; }
body { font-family: 'Segoe UI', 'Segoe UI Variable', 'Malgun Gothic', sans-serif; font-size: 14px; user-select: none; }
button { font: inherit; border: none; background: none; cursor: pointer; color: inherit; }
.btn-primary { padding: 8px 18px; border-radius: 5px; background: #0067c0; color: #fff; }
.btn-primary:hover { background: #1976d2; }

/* boot */
.boot { height: 100%; background: #000; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.boot .logo { font-size: 76px; }
.spinner { width: 28px; height: 28px; border: 3px solid #444; border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* desktop */
.desktop { position: relative; height: 100%; overflow: hidden; background: radial-gradient(1200px 800px at 30% 20%, #3d7edb, #1a4fa0 55%, #0d2b63); }
.desktop-icons { position: absolute; top: 16px; left: 16px; display: flex; flex-direction: column; gap: 8px; }
.desktop-icon { width: 88px; padding: 8px 4px; border-radius: 4px; color: #fff; text-align: center; font-size: 12px; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.desktop-icon:hover { background: rgba(255,255,255,.15); }
.desktop-icon .glyph { font-size: 34px; text-shadow: none; }

/* window */
.window { position: absolute; display: flex; flex-direction: column; background: #f9f9f9; border-radius: 8px; border: 1px solid rgba(0,0,0,.25); box-shadow: 0 16px 40px rgba(0,0,0,.35); overflow: hidden; }
.window.minimized { display: none; }
.titlebar { height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding-left: 12px; background: #fff; touch-action: none; }
.titlebar .title { font-size: 13px; }
.win-buttons { display: flex; }
.win-buttons button { width: 46px; height: 36px; font-size: 12px; color: #333; }
.win-buttons button:hover { background: rgba(0,0,0,.06); }
.win-buttons .close:hover { background: #c42b1c; color: #fff; }
.win-body { flex: 1; overflow: auto; background: #fff; }

/* taskbar */
.taskbar { position: absolute; left: 0; right: 0; bottom: 0; height: 48px; display: flex; align-items: center; background: rgba(240,243,249,.85); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,.08); z-index: 9000; }
.tb-center { flex: 1; display: flex; justify-content: center; gap: 4px; }
.tb-icon { width: 40px; height: 40px; border-radius: 6px; font-size: 20px; position: relative; display: flex; align-items: center; justify-content: center; }
.tb-icon:hover { background: rgba(0,0,0,.08); }
.tb-icon .dot { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); width: 6px; height: 3px; border-radius: 2px; background: #0067c0; }
.tb-clock { width: 120px; text-align: right; padding-right: 14px; font-size: 12px; line-height: 1.3; }

/* start menu */
.startmenu { position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%); width: 420px; padding: 24px; border-radius: 8px; background: rgba(243,243,243,.92); backdrop-filter: blur(30px); box-shadow: 0 16px 40px rgba(0,0,0,.3); z-index: 9100; }
.startmenu h3 { font-size: 13px; margin-bottom: 14px; }
.sm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.sm-app { padding: 10px 4px; border-radius: 6px; text-align: center; font-size: 12px; }
.sm-app:hover { background: rgba(0,0,0,.06); }
.sm-app .glyph { font-size: 28px; }

/* toast */
.toast { position: absolute; right: 16px; bottom: 64px; width: 320px; padding: 14px 16px; border-radius: 8px; background: rgba(32,32,32,.92); color: #fff; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.4); z-index: 9500; font-size: 13px; line-height: 1.5; }
.toast b { display: block; font-size: 12px; margin-bottom: 4px; color: #9ecbff; }

/* clear overlay */
.clear-overlay { position: absolute; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(10,25,60,.88); backdrop-filter: blur(8px); color: #fff; text-align: center; padding: 24px; }
.clear-overlay .big { font-size: 48px; }
```

- [ ] **Step 2: Window.jsx 작성**

`src/shell/Window.jsx`:
```jsx
import { useRef } from 'react'
import { useGame } from '../engine/store.js'

export default function Window({ win, title, icon, width = 640, height = 440, children }) {
  const focusWindow = useGame((s) => s.focusWindow)
  const closeWindow = useGame((s) => s.closeWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const toggleMaximize = useGame((s) => s.toggleMaximize)
  const moveWindow = useGame((s) => s.moveWindow)
  const drag = useRef(null)

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current || win.maximized) return
    moveWindow(win.id, e.clientX - drag.current.dx, Math.max(0, e.clientY - drag.current.dy))
  }
  const onPointerUp = () => { drag.current = null }

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - 48px)', zIndex: win.z }
    : { left: win.x, top: win.y, width, height, zIndex: win.z }

  return (
    <div className={'window' + (win.minimized ? ' minimized' : '')} style={style}
         onPointerDown={() => focusWindow(win.id)}>
      <div className="titlebar" onPointerDown={onPointerDown}
           onPointerMove={onPointerMove} onPointerUp={onPointerUp}
           onDoubleClick={() => toggleMaximize(win.id)}>
        <span className="title">{icon} {title}</span>
        <div className="win-buttons">
          <button onClick={() => minimizeWindow(win.id)} title="최소화">─</button>
          <button onClick={() => toggleMaximize(win.id)} title="최대화">▢</button>
          <button className="close" onClick={() => closeWindow(win.id)} title="닫기">✕</button>
        </div>
      </div>
      <div className="win-body">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: registry.jsx 작성 (placeholder 앱)**

`src/apps/registry.jsx`:
```jsx
const Placeholder = () => <div style={{ padding: 24, color: '#888' }}>준비 중…</div>

export const APPS = {
  messenger: { title: '한빛톡', icon: '💬', comp: Placeholder, w: 380, h: 520 },
  mail: { title: '메일', icon: '✉️', comp: Placeholder, w: 780, h: 540 },
  explorer: { title: '파일 탐색기', icon: '📁', comp: Placeholder, w: 640, h: 420 },
  notepad: { title: '메모장', icon: '📝', comp: Placeholder, w: 520, h: 400 },
  browser: { title: '브라우저', icon: '🌐', comp: Placeholder, w: 820, h: 560 }
}
```

- [ ] **Step 4: Desktop.jsx / Taskbar.jsx 작성**

`src/shell/Desktop.jsx`:
```jsx
import { useGame } from '../engine/store.js'

export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  return (
    <div className="desktop-icons">
      {scenario.fs['바탕화면'].map((f) => (
        <button key={f.id} className="desktop-icon"
                onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
          <div className="glyph">📄</div>{f.name}
        </button>
      ))}
    </div>
  )
}
```

`src/shell/Taskbar.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'
import { APPS } from '../apps/registry.jsx'

export default function Taskbar() {
  const windows = useGame((s) => s.windows)
  const nextZ = useGame((s) => s.nextZ)
  const openWindow = useGame((s) => s.openWindow)
  const focusWindow = useGame((s) => s.focusWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const [startOpen, setStartOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const clickApp = (key) => {
    const win = windows.find((w) => w.app === key)
    if (!win) return openWindow(key)
    if (!win.minimized && win.z === nextZ - 1) minimizeWindow(win.id)
    else focusWindow(win.id)
  }

  return (
    <>
      {startOpen && (
        <div className="startmenu">
          <h3>고정됨</h3>
          <div className="sm-grid">
            {Object.entries(APPS).map(([key, a]) => (
              <button key={key} className="sm-app"
                      onClick={() => { openWindow(key); setStartOpen(false) }}>
                <div className="glyph">{a.icon}</div>{a.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="taskbar">
        <div className="tb-center">
          <button className="tb-icon" title="시작" onClick={() => setStartOpen(!startOpen)}>⊞</button>
          {Object.entries(APPS).map(([key, a]) => (
            <button key={key} className="tb-icon" title={a.title} onClick={() => clickApp(key)}>
              {a.icon}
              {windows.some((w) => w.app === key) && <span className="dot" />}
            </button>
          ))}
        </div>
        <div className="tb-clock">
          {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}<br />
          {now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: App.jsx 교체, main.jsx에 css import**

`src/main.jsx`의 import에 추가:
```jsx
import './shell/shell.css'
```

`src/App.jsx` (전면 교체):
```jsx
import { useEffect } from 'react'
import { useGame } from './engine/store.js'
import { APPS } from './apps/registry.jsx'
import Window from './shell/Window.jsx'
import Desktop from './shell/Desktop.jsx'
import Taskbar from './shell/Taskbar.jsx'

function Boot() {
  const setBooted = useGame((s) => s.setBooted)
  useEffect(() => {
    const t = setTimeout(setBooted, 2500)
    return () => clearTimeout(t)
  }, [setBooted])
  return (
    <div className="boot">
      <div className="logo">⊞</div>
      <div className="spinner" />
    </div>
  )
}

function Toast() {
  const toast = useGame((s) => s.toast)
  const clearToast = useGame((s) => s.clearToast)
  const openWindow = useGame((s) => s.openWindow)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 4500)
    return () => clearTimeout(t)
  }, [toast, clearToast])
  if (!toast) return null
  return (
    <div className="toast" onClick={() => { openWindow('messenger'); clearToast() }}>
      <b>💬 한빛톡 — {toast.from}</b>
      {toast.text}
    </div>
  )
}

function WindowLayer() {
  const windows = useGame((s) => s.windows)
  return windows.map((win) => {
    const cfg = APPS[win.app]
    const C = cfg.comp
    return (
      <Window key={win.id} win={win} title={cfg.title} icon={cfg.icon} width={cfg.w} height={cfg.h}>
        <C {...win.props} />
      </Window>
    )
  })
}

export default function App() {
  const booted = useGame((s) => s.booted)
  if (!booted) return <Boot />
  return (
    <div className="desktop">
      <Desktop />
      <WindowLayer />
      <Toast />
      <Taskbar />
    </div>
  )
}
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → http://localhost:5173
Expected 확인 목록:
1. 검은 부팅 화면(로고+스피너) 2.5초 → 파란 배경화면.
2. 바탕화면 왼쪽 위에 `메모.txt` 아이콘. 더블클릭 → "준비 중…" 창(메모장 placeholder).
3. 작업표시줄 가운데 정렬: 시작버튼 + 앱 5개 + 오른쪽 시계.
4. 시작버튼 → 시작메뉴 열림, 앱 클릭 → 창 열림 + 실행중 점 표시.
5. 창 타이틀바 드래그 이동 / ─ 최소화(작업표시줄 아이콘 클릭으로 복원) / ▢ 최대화 / ✕ 닫기.
6. 창 두 개 열고 클릭하면 클릭한 창이 앞으로.

- [ ] **Step 7: 테스트 회귀 확인 + Commit**

Run: `npm test` → Expected: 13 passed.
```bash
git add -A
git commit -m "feat: add Windows 11 shell (windows, desktop, taskbar, start menu, boot)"
```

---

### Task 6: 메모장 + 파일 탐색기

**Files:**
- Create: `src/apps/Notepad.jsx`, `src/apps/FileExplorer.jsx`
- Modify: `src/apps/registry.jsx` (notepad·explorer 항목의 comp 교체), `src/shell/shell.css` (하단에 추가)

**Interfaces:**
- Consumes: `useGame`, `findFile`(Task 4), `openWindow('notepad', { fileId })` 규약(Task 5의 Desktop도 동일 규약 사용).
- Produces: 없음 (말단 앱).

- [ ] **Step 1: Notepad.jsx 작성**

`src/apps/Notepad.jsx`:
```jsx
import { useGame, findFile } from '../engine/store.js'

export default function Notepad({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const file = findFile(scenario.fs, fileId)
  if (!file) return <div style={{ padding: 20 }}>파일을 찾을 수 없습니다.</div>
  return (
    <div className="notepad">
      <div className="np-name">{file.name}</div>
      <pre className="np-body">{file.content}</pre>
    </div>
  )
}
```

- [ ] **Step 2: FileExplorer.jsx 작성**

`src/apps/FileExplorer.jsx`:
```jsx
import { useState } from 'react'
import { useGame } from '../engine/store.js'

export default function FileExplorer() {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  const folders = Object.keys(scenario.fs)
  const [folder, setFolder] = useState(folders[0])
  return (
    <div className="explorer">
      <div className="ex-side">
        {folders.map((name) => (
          <button key={name} className={'ex-folder' + (folder === name ? ' sel' : '')}
                  onClick={() => setFolder(name)}>
            📁 {name}
          </button>
        ))}
      </div>
      <div className="ex-main">
        {scenario.fs[folder].map((f) => (
          <button key={f.id} className="ex-file"
                  onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
            <div className="glyph">📄</div>{f.name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: registry 교체 + CSS 추가**

`src/apps/registry.jsx` — 상단에 import 추가, 두 항목의 `comp` 교체:
```jsx
import Notepad from './Notepad.jsx'
import FileExplorer from './FileExplorer.jsx'
```
```jsx
  explorer: { title: '파일 탐색기', icon: '📁', comp: FileExplorer, w: 640, h: 420 },
  notepad: { title: '메모장', icon: '📝', comp: Notepad, w: 520, h: 400 },
```

`src/shell/shell.css` 하단에 추가:
```css
/* explorer */
.explorer { display: flex; height: 100%; }
.ex-side { width: 160px; border-right: 1px solid #eee; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.ex-folder { text-align: left; padding: 7px 10px; border-radius: 5px; }
.ex-folder:hover { background: #f0f0f0; }
.ex-folder.sel { background: #e5f1fb; }
.ex-main { flex: 1; padding: 16px; display: flex; flex-wrap: wrap; gap: 12px; align-content: flex-start; }
.ex-file { width: 96px; padding: 10px 4px; border-radius: 6px; text-align: center; font-size: 12px; word-break: break-all; }
.ex-file:hover { background: #e5f1fb; }
.ex-file .glyph { font-size: 34px; }

/* notepad */
.notepad { height: 100%; display: flex; flex-direction: column; }
.np-name { padding: 6px 12px; font-size: 12px; color: #666; border-bottom: 1px solid #eee; }
.np-body { flex: 1; padding: 14px; font-family: Consolas, monospace; font-size: 13px; white-space: pre-wrap; overflow: auto; user-select: text; }
```

- [ ] **Step 4: 수동 확인**

Run: `npm run dev`
Expected:
1. 작업표시줄 📁 → 탐색기. 폴더 3개(바탕화면/문서/다운로드) 전환.
2. `견적서_v2.txt` 더블클릭 → 메모장 창에 내용 표시.
3. 다른 파일 더블클릭 → 별도 메모장 창(파일별 1개). 같은 파일 재더블클릭 → 기존 창 포커스.
4. 바탕화면 `메모.txt` 더블클릭 → 메모장으로 열림.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Notepad and FileExplorer apps"
```

---

### Task 7: 브라우저

**Files:**
- Create: `src/apps/Browser.jsx`
- Modify: `src/apps/registry.jsx` (browser 항목 comp 교체), `src/shell/shell.css` (하단에 추가)

**Interfaces:**
- Consumes: `useGame`의 `scenario.sites/bookmarks/history`, `wikiUnlocked`, `unlockWiki()`.
- Produces: 없음.

- [ ] **Step 1: Browser.jsx 작성**

`src/apps/Browser.jsx`:
```jsx
import { useState } from 'react'
import { useGame } from '../engine/store.js'

export default function Browser() {
  const scenario = useGame((s) => s.scenario)
  const wikiUnlocked = useGame((s) => s.wikiUnlocked)
  const unlockWiki = useGame((s) => s.unlockWiki)
  const [url, setUrl] = useState('')
  const [current, setCurrent] = useState(null)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)

  const go = (u) => {
    const clean = u.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    setUrl(clean)
    setCurrent(clean || null)
    setPw('')
    setPwError(false)
  }
  const tryLogin = (site) => (pw === site.password ? unlockWiki() : setPwError(true))
  const site = current ? scenario.sites.find((s) => s.url === current) : null

  return (
    <div className="browser">
      <div className="addr-bar">
        <button onClick={() => go('')} title="홈">🏠</button>
        <input value={url} onChange={(e) => setUrl(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && go(url)}
               placeholder="주소를 입력하세요" spellCheck={false} />
      </div>
      <div className="page">
        {!current && (
          <div className="newtab">
            <h2>새 탭</h2>
            <h4>즐겨찾기</h4>
            <div className="tiles">
              {scenario.bookmarks.map((b) => (
                <button key={b.url} className="tile" onClick={() => go(b.url)}>⭐ {b.title}</button>
              ))}
            </div>
            <h4>방문 기록</h4>
            {scenario.history.map((h, i) => (
              <div key={i} className="hist" onClick={() => go(h.url)}>
                🕘 {h.title} <span className="hist-url">{h.url}</span>
                <span className="hist-date">{h.date}</span>
              </div>
            ))}
          </div>
        )}
        {current && !site && (
          <div className="site-error">
            <h2>사이트에 연결할 수 없음</h2>
            <p>{current} 의 서버 IP 주소를 찾을 수 없습니다.</p>
            <p className="err-code">ERR_NAME_NOT_RESOLVED</p>
          </div>
        )}
        {site && site.password && !wikiUnlocked && (
          <div className="wiki-lock">
            <h2>🔒 {site.title}</h2>
            <p>{site.passwordHint}</p>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && tryLogin(site)} placeholder="비밀번호" />
            <button className="btn-primary" onClick={() => tryLogin(site)}>로그인</button>
            {pwError && <p className="pw-error">비밀번호가 올바르지 않습니다.</p>}
          </div>
        )}
        {site && (!site.password || wikiUnlocked) && (
          <div className="site">
            <h2>{site.title}</h2>
            <pre className="site-body">{site.content}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: registry 교체 + CSS 추가**

`src/apps/registry.jsx`:
```jsx
import Browser from './Browser.jsx'
```
```jsx
  browser: { title: '브라우저', icon: '🌐', comp: Browser, w: 820, h: 560 },
```

`src/shell/shell.css` 하단에 추가:
```css
/* browser */
.browser { height: 100%; display: flex; flex-direction: column; }
.addr-bar { display: flex; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #eee; background: #f7f7f7; flex-shrink: 0; }
.addr-bar input { flex: 1; padding: 7px 14px; border: none; border-radius: 15px; background: #fff; box-shadow: inset 0 0 0 1px #ddd; outline: none; font: inherit; }
.page { flex: 1; overflow: auto; padding: 24px; }
.newtab h4 { margin: 18px 0 8px; color: #555; }
.tiles { display: flex; gap: 8px; flex-wrap: wrap; }
.tile { padding: 10px 16px; border-radius: 8px; background: #f2f6fc; }
.tile:hover { background: #e5f1fb; }
.hist { padding: 7px 4px; border-radius: 5px; cursor: pointer; font-size: 13px; }
.hist:hover { background: #f0f0f0; }
.hist-url { color: #1a73e8; margin: 0 8px; }
.hist-date { color: #999; font-size: 12px; }
.site-error { text-align: center; padding-top: 60px; color: #444; }
.err-code { color: #999; font-size: 12px; margin-top: 8px; }
.wiki-lock { max-width: 340px; margin: 60px auto 0; text-align: center; display: flex; flex-direction: column; gap: 10px; }
.wiki-lock input { padding: 8px 12px; border: 1px solid #ccc; border-radius: 5px; font: inherit; }
.pw-error { color: #c42b1c; font-size: 13px; }
.site-body { white-space: pre-wrap; font-family: inherit; line-height: 1.7; margin-top: 12px; user-select: text; }
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
Expected:
1. 🌐 실행 → 새 탭(즐겨찾기 2개 + 방문 기록 2건).
2. 방문 기록의 위키 클릭 → 🔒 로그인 화면. 틀린 비번 → 에러 문구.
3. `0412` 입력 → 확정 단가표(3,450,000원) 표시. 창 닫았다 다시 접속해도 잠금 해제 유지.
4. 주소창에 `asdf.com` 입력 + Enter → "사이트에 연결할 수 없음".
5. 🏠 → 새 탭 복귀.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Browser app with wiki password gate"
```

---

### Task 8: 메신저 + 알림 토스트 연동

**Files:**
- Create: `src/apps/Messenger.jsx`
- Modify: `src/apps/registry.jsx` (messenger comp 교체), `src/App.jsx` (메시지 배달 effect 추가), `src/shell/shell.css` (하단에 추가)

**Interfaces:**
- Consumes: `useGame`의 `msgCount`, `deliverMessage()`, `showToast()`, `booted`, Task 5의 Toast(클릭 시 messenger 열림 — 이미 구현됨).
- Produces: 없음.

- [ ] **Step 1: Messenger.jsx 작성**

`src/apps/Messenger.jsx`:
```jsx
import { useState } from 'react'
import { useGame } from '../engine/store.js'

const QUICK = ['넵, 확인하겠습니다!', '팀장님 감사합니다 🙇']

export default function Messenger() {
  const scenario = useGame((s) => s.scenario)
  const msgCount = useGame((s) => s.msgCount)
  const [mine, setMine] = useState([])
  const msgs = scenario.messenger.slice(0, msgCount)
  return (
    <div className="messenger">
      <div className="msg-list">
        {msgs.length === 0 && <div className="msg-empty">아직 메시지가 없습니다</div>}
        {msgs.map((m, i) => (
          <div key={i} className="bubble them"><b>{m.from}</b>{m.text}</div>
        ))}
        {mine.map((t, i) => (
          <div key={'m' + i} className="bubble me">{t}</div>
        ))}
      </div>
      <div className="quick">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setMine((p) => [...p, q])}>{q}</button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: registry 교체**

`src/apps/registry.jsx`:
```jsx
import Messenger from './Messenger.jsx'
```
```jsx
  messenger: { title: '한빛톡', icon: '💬', comp: Messenger, w: 380, h: 520 },
```

- [ ] **Step 3: App.jsx에 메시지 배달 effect 추가**

`src/App.jsx`의 `App` 컴포넌트를 다음으로 교체 (booted 시 시나리오 딜레이대로 메시지+토스트 발생):
```jsx
export default function App() {
  const booted = useGame((s) => s.booted)

  useEffect(() => {
    if (!booted) return
    const sc = useGame.getState().scenario
    const timers = sc.messenger.map((m) =>
      setTimeout(() => {
        useGame.getState().deliverMessage()
        useGame.getState().showToast({ from: m.from, text: m.text })
      }, m.delay))
    return () => timers.forEach(clearTimeout)
  }, [booted])

  if (!booted) return <Boot />
  return (
    <div className="desktop">
      <Desktop />
      <WindowLayer />
      <Toast />
      <Taskbar />
    </div>
  )
}
```

- [ ] **Step 4: CSS 추가**

`src/shell/shell.css` 하단에 추가:
```css
/* messenger */
.messenger { height: 100%; display: flex; flex-direction: column; background: #eef3f8; }
.msg-list { flex: 1; overflow: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.bubble { max-width: 78%; padding: 9px 13px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
.bubble b { display: block; font-size: 11px; color: #556; margin-bottom: 3px; }
.bubble.them { align-self: flex-start; background: #fff; border-top-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.bubble.me { align-self: flex-end; background: #0067c0; color: #fff; border-top-right-radius: 4px; }
.msg-empty { color: #99a; text-align: center; margin-top: 40px; }
.quick { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #dde; }
.quick button { flex: 1; padding: 8px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #cdd; font-size: 12px; }
.quick button:hover { background: #e5f1fb; }
```

- [ ] **Step 5: 수동 확인**

Run: `npm run dev`
Expected:
1. 부팅 후 1.5초쯤 오른쪽 아래 토스트 "💬 한빛톡 — 박 팀장". 이후 3건 순차 도착.
2. 토스트 클릭 → 메신저 창 열림, 도착한 메시지 표시. 이후 메시지도 실시간 추가.
3. 빠른답장 버튼 → 파란 말풍선으로 내 메시지 추가.
4. 토스트는 4.5초 후 자동 소멸.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Messenger app with notification toasts"
```

---

### Task 9: 메일 앱 + 정답 판정 연결 + 클리어 화면

**Files:**
- Create: `src/apps/Mail.jsx`
- Modify: `src/apps/registry.jsx` (mail comp 교체), `src/App.jsx` (ClearOverlay 추가), `src/shell/shell.css` (하단에 추가)

**Interfaces:**
- Consumes: `useGame`의 `mails`+`extraMails`, `readMails`, `markMailRead()`, `sendReply()`(Task 4 — 내부에서 checkGoal 호출, 1.8초 뒤 NPC 답장 도착, 정답이면 2.5초 뒤 `cleared: true`), `allFiles()`.
- Produces: 게임 완성.

- [ ] **Step 1: Mail.jsx 작성**

`src/apps/Mail.jsx`:
```jsx
import { useState } from 'react'
import { useGame, allFiles } from '../engine/store.js'

export default function Mail() {
  const scenario = useGame((s) => s.scenario)
  const extraMails = useGame((s) => s.extraMails)
  const readMails = useGame((s) => s.readMails)
  const markMailRead = useGame((s) => s.markMailRead)
  const sendReply = useGame((s) => s.sendReply)
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [body, setBody] = useState('')
  const [att, setAtt] = useState('')
  const [sent, setSent] = useState(false)

  const mails = [...scenario.mails, ...extraMails]
  const mail = mails.find((m) => m.id === selected)

  const open = (m) => {
    setSelected(m.id)
    setComposing(false)
    setSent(false)
    markMailRead(m.id)
  }
  const send = () => {
    sendReply({ attachmentId: att || null, body })
    setSent(true)
    setComposing(false)
    setBody('')
    setAtt('')
  }

  return (
    <div className="mail-layout">
      <div className="mail-list">
        {mails.map((m) => (
          <div key={m.id}
               className={'mail-item' + (readMails[m.id] ? '' : ' unread') + (selected === m.id ? ' sel' : '')}
               onClick={() => open(m)}>
            <div className="mi-from">{m.from}</div>
            <div className="mi-subject">{m.subject}</div>
            <div className="mi-date">{m.date}</div>
          </div>
        ))}
      </div>
      <div className="mail-detail">
        {sent && <div className="mail-sent">📨 메일을 보냈습니다. 곧 답장이 올지도 모릅니다…</div>}
        {!mail && !sent && <div className="mail-empty">메일을 선택하세요</div>}
        {mail && !composing && (
          <>
            <h3>{mail.subject}</h3>
            <div className="md-meta">{mail.from} · {mail.date}</div>
            <pre className="md-body">{mail.body}</pre>
            {mail.canReply && (
              <button className="btn-primary" onClick={() => setComposing(true)}>↩ 회신</button>
            )}
          </>
        )}
        {mail && composing && (
          <div className="compose">
            <div className="md-meta">받는 사람: {mail.from}</div>
            <div className="md-meta">제목: RE: {mail.subject}</div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder="본문을 입력하세요" />
            <div className="compose-row">
              <span>📎</span>
              <select value={att} onChange={(e) => setAtt(e.target.value)}>
                <option value="">첨부 없음</option>
                {allFiles(scenario.fs).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button className="btn-primary" onClick={send}>보내기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: registry 교체**

`src/apps/registry.jsx`:
```jsx
import Mail from './Mail.jsx'
```
```jsx
  mail: { title: '메일', icon: '✉️', comp: Mail, w: 780, h: 540 },
```

Placeholder를 더 이상 쓰는 항목이 없으므로 `Placeholder` 정의는 삭제.

- [ ] **Step 3: App.jsx에 ClearOverlay 추가**

`src/App.jsx`에 컴포넌트 추가:
```jsx
function ClearOverlay() {
  const scenario = useGame((s) => s.scenario)
  return (
    <div className="clear-overlay">
      <div className="big">🎉</div>
      <h1>미션 클리어!</h1>
      <p>"{scenario.goal.successReply}"</p>
      <p>— A상사 이수진 과장</p>
      <button className="btn-primary" onClick={() => location.reload()}>다시 하기</button>
    </div>
  )
}
```

`App` 컴포넌트의 return을 다음으로 교체:
```jsx
  const cleared = useGame((s) => s.cleared)
  // (booted 선언 아래에 추가)
```
```jsx
  return (
    <div className="desktop">
      <Desktop />
      <WindowLayer />
      <Toast />
      <Taskbar />
      {cleared && <ClearOverlay />}
    </div>
  )
```

- [ ] **Step 4: CSS 추가**

`src/shell/shell.css` 하단에 추가:
```css
/* mail */
.mail-layout { display: flex; height: 100%; }
.mail-list { width: 280px; flex-shrink: 0; border-right: 1px solid #eee; overflow: auto; }
.mail-item { padding: 10px 14px; border-bottom: 1px solid #f2f2f2; cursor: pointer; }
.mail-item:hover { background: #f7f9fc; }
.mail-item.sel { background: #e5f1fb; }
.mail-item.unread .mi-subject { font-weight: 700; }
.mi-from { font-size: 12px; color: #333; }
.mi-subject { font-size: 13px; margin: 2px 0; }
.mi-date { font-size: 11px; color: #999; }
.mail-detail { flex: 1; padding: 18px 22px; overflow: auto; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.md-meta { font-size: 12px; color: #666; }
.md-body { white-space: pre-wrap; font-family: inherit; line-height: 1.7; user-select: text; }
.mail-empty { color: #99a; margin: auto; }
.mail-sent { background: #e7f4e8; color: #1b5e20; padding: 10px 14px; border-radius: 6px; font-size: 13px; }
.compose { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.compose textarea { height: 180px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; font: inherit; resize: none; }
.compose select { padding: 7px; border: 1px solid #ccc; border-radius: 5px; font: inherit; }
.compose-row { display: flex; gap: 8px; align-items: center; }
```

- [ ] **Step 5: 전체 플레이스루 수동 확인**

Run: `npm run dev` — 처음부터 끝까지 플레이:
1. 부팅 → 토스트 → 메신저에서 브리핑 확인.
2. 메일에서 A상사 메일 열람(unread 볼드가 읽음 처리로 바뀜) → 회신.
3. **오답 경로 1**: `견적서_v2.txt` 첨부 + 단가 미기재 → 보내기 → 1.8초 뒤 "예전 버전" 답장 도착(unread).
4. **오답 경로 2**: `견적서_최종_진짜최종.txt` 첨부 + 단가 없는 본문 → "단가가 안 보이네요" 답장.
5. 탐색기에서 최종본 확인 → "위키 참조" → 메모.txt → 사원증(입사일 0412) → 브라우저 위키 로그인 → 단가 3,450,000원 확인.
6. **정답**: 최종본 첨부 + 본문에 `3,450,000` 포함 → 성공 답장 → 2.5초 뒤 클리어 오버레이 → "다시 하기"로 리셋.

- [ ] **Step 6: 최종 테스트 + Commit**

Run: `npm test` → Expected: 13 passed.
Run: `npm run build` → Expected: 에러 없이 dist 생성.
```bash
git add -A
git commit -m "feat: add Mail app with reply verdict and clear screen"
```
