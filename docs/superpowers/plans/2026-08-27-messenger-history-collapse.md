# 메신저 지난 기록 접기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메신저 대화를 열면 이번 주 메시지만 보이고, 그 이전 기록은 `이전 메시지 N개` 버튼을 눌러 스피너와 함께 날짜 묶음 단위로 불러오게 한다.

**Architecture:** 접기 계산은 `src/engine/history.js`의 순수 함수 `historyChunks(messages)` 하나로 뽑아 단위 테스트한다. `Messenger.jsx`는 그 결과를 받아 렌더만 하고, "몇 묶음 펼쳤나"는 store의 `openedHistory` 맵에 담아 `PROGRESS`로 저장한다. `threadMessages`·`unreadCount`·`heldThreads`는 건드리지 않는다.

**Tech Stack:** React 18 (함수형 + hooks), Zustand (`src/engine/store.js`), Vitest, 순수 CSS (`src/shell/shell.css`)

## Global Constraints

- **파일 인코딩: 대부분 CRLF다.** 스크립트로 고치지 말고 Edit 도구를 쓸 것. 새로 만드는 `src/engine/history.js`와 `test/history.test.js`는 LF로 만들어도 되고, git이 알아서 처리한다.
- **`workday.json`을 Read/cat으로 열지 마라.** 조회는 `node scripts/query.mjs <명령>`, 테스트에서는 `JSON.parse(readFileSync(...))`로 읽는다.
- **테스트는 관련 파일만 먼저**: `npx vitest run test/history.test.js`. 마지막 태스크에서만 `npm test` 전체.
- 접기 판정 기준값 — 기록 **8줄 이하는 접지 않음**, 한 번에 **최대 12줄**, 날짜 묶음은 자르지 않음.
- 로딩 지연 **400ms**. 스피너는 기존 `<span className="spinner sm" />` 재사용 — 새 CSS 애니메이션 금지.
- 배지 계산(`unreadCount`)과 `markThreadSeen`은 **건드리지 않는다.**
- 새 store 필드는 `restored?.openedHistory ?? {}` 로 초기화해 옛 저장을 깨지 않는다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/engine/history.js` (신규) | `historyChunks(messages)` — 메시지 배열을 받아 접을 묶음들을 계산하는 순수 함수. store도 컴포넌트도 모른다. |
| `test/history.test.js` (신규) | 위 함수의 단위 테스트 + 실제 시나리오 전 스레드에 대한 불변 검사. |
| `src/engine/store.js` (수정) | `openedHistory` 상태 + `openHistory(id, n)` 세터 + `PROGRESS` 등록. |
| `test/save.test.js` (수정) | 펼침 상태가 저장/복원되는지, 옛 저장이 깨지지 않는지. |
| `src/apps/Messenger.jsx` (수정) | 버튼·스피너 렌더, 스크롤 보정, store 연결. |
| `src/shell/shell.css` (수정) | `.msg-more` 버튼 스타일. |

---

### Task 1: `historyChunks` 순수 함수

**Files:**
- Create: `src/engine/history.js`
- Test: `test/history.test.js`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `historyChunks(messages: Message[]) => Message[][]`
  - `messages`는 `threadMessages()`가 돌려주는 배열. 각 원소는 `{ date?: string, day?: number, from?: string, me?: boolean, text?: string, ... }`.
  - 반환은 **접을 묶음들의 배열**. `[]`(빈 배열)이면 접지 않는다 — 전부 그냥 보여준다.
  - 순서는 **오래된 것부터**. `chunks[0]`이 가장 오래된 묶음, 마지막 원소가 가장 최근 묶음. 펼치기는 뒤에서부터 꺼낸다(Task 3에서 `slice(-n)`).

- [ ] **Step 1: Write the failing test**

`test/history.test.js` 를 만든다:

```js
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { historyChunks } from '../src/engine/history.js'

const scenario = JSON.parse(readFileSync('src/scenarios/workday.json', 'utf8'))
const allThreads = ['workMessenger', 'privateMessenger']
  .flatMap((src) => scenario[src].sections.flatMap((sec) => sec.threads))

// 지난 기록은 date를 갖고, 이번 주 메시지는 day를 갖는다.
const hist = (msgs) => msgs.filter((m) => m.day === undefined)

describe('historyChunks', () => {
  it('이번 주 메시지가 없으면 접지 않는다', () => {
    const msgs = [{ date: '7월 23일 (금)', text: 'a' }, { date: '7월 23일 (금)', text: 'b' }]
    expect(historyChunks(msgs)).toEqual([])
  })

  it('기록이 8줄 이하면 접지 않는다', () => {
    const msgs = [
      ...Array.from({ length: 8 }, (_, i) => ({ date: '7월 23일 (금)', text: 'h' + i })),
      { day: 1, text: '오늘' }
    ]
    expect(historyChunks(msgs)).toEqual([])
  })

  it('기록이 9줄이면 접는다', () => {
    const msgs = [
      ...Array.from({ length: 9 }, (_, i) => ({ date: '7월 23일 (금)', text: 'h' + i })),
      { day: 1, text: '오늘' }
    ]
    expect(historyChunks(msgs).length).toBeGreaterThan(0)
  })

  it('한 묶음이 날짜 경계를 가로지르지 않는다', () => {
    for (const t of allThreads) {
      for (const chunk of historyChunks(t.messages ?? [])) {
        const dates = new Set(chunk.map((m) => m.date ?? '(무표기)'))
        // 12줄이 넘는 단일 날짜는 통째로 올라오므로 묶음 안의 날짜는 항상 이어진다
        const seen = []
        for (const m of chunk) {
          const d = m.date ?? '(무표기)'
          if (seen[seen.length - 1] !== d) seen.push(d)
        }
        expect(seen.length, `${t.id}: 묶음이 날짜를 오간다`).toBe(dates.size)
      }
    }
  })

  it('묶음을 모두 이으면 원래 기록과 정확히 같다 — 유실도 중복도 없다', () => {
    for (const t of allThreads) {
      const msgs = t.messages ?? []
      const chunks = historyChunks(msgs)
      if (!chunks.length) continue
      expect(chunks.flat(), `${t.id}: 기록이 어긋난다`).toEqual(hist(msgs))
    }
  })

  it('한 묶음은 12줄을 넘지 않는다 — 단일 날짜가 그보다 길지 않은 한', () => {
    for (const t of allThreads) {
      for (const chunk of historyChunks(t.messages ?? [])) {
        if (chunk.length <= 12) continue
        const dates = new Set(chunk.map((m) => m.date ?? '(무표기)'))
        expect(dates.size, `${t.id}: 12줄 초과 묶음이 여러 날짜다`).toBe(1)
      }
    }
  })

  it('접히는 스레드는 정확히 이 일곱이다', () => {
    const folded = allThreads
      .filter((t) => historyChunks(t.messages ?? []).length > 0)
      .map((t) => t.id)
      .sort()
    expect(folded).toEqual(
      ['boss', 'jihyun', 'junho', 'minseo', 'mom', 'room_school', 'soyoung'].sort()
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/history.test.js`
Expected: FAIL — `Failed to resolve import "../src/engine/history.js"`

- [ ] **Step 3: Write minimal implementation**

`src/engine/history.js` 를 만든다:

```js
// 대화를 열었을 때 이번 주 것만 보이고 그 이전은 '이전 메시지'로 접히게 하려면,
// 접을 기록을 날짜 단위로 나눠 두어야 한다. 한 날짜의 대화가 중간에 끊겨
// 올라오면 읽는 흐름이 깨지므로 묶음은 날짜를 가로지르지 않는다.
const MAX_PER_CHUNK = 12   // 한 번에 올라오는 최대 줄 수
const KEEP_ALL_UNDER = 8   // 이보다 짧은 기록은 접을 것도 없다

// 지난 기록은 `date`를, 이번 주 메시지는 `day`를 갖는다 (`threadMessages` 참조).
const isHistory = (m) => m.day === undefined

// 접을 묶음들. 빈 배열이면 접지 않고 전부 보여준다는 뜻이다.
// 오래된 것부터 담기므로, 펼치기는 뒤에서부터 꺼내면 최근 것부터 올라온다.
export const historyChunks = (messages = []) => {
  // 이번 주가 없는 대화 — 공지방, 강 사장님, 알림 스레드 — 는 접지 않는다.
  // 접으면 대화창이 빈 채로 열린다.
  if (!messages.some((m) => !isHistory(m))) return []

  const history = messages.filter(isHistory)
  if (history.length <= KEEP_ALL_UNDER) return []

  // 같은 날짜끼리 먼저 모은다.
  const days = []
  for (const m of history) {
    const date = m.date ?? '(무표기)'
    if (days[days.length - 1]?.date !== date) days.push({ date, items: [] })
    days[days.length - 1].items.push(m)
  }

  // 최근 쪽부터 12줄까지 채워 나간다. 첫 번째로 올라올 묶음이 가장 최근이어야
  // 하기 때문에 뒤에서 앞으로 채운다.
  const chunks = []
  let chunk = []
  for (let i = days.length - 1; i >= 0; i--) {
    const { items } = days[i]
    if (chunk.length && chunk.length + items.length > MAX_PER_CHUNK) {
      chunks.unshift(chunk)
      chunk = []
    }
    chunk = [...items, ...chunk]
  }
  if (chunk.length) chunks.unshift(chunk)
  return chunks
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/history.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/engine/history.js test/history.test.js
git commit -m "feat: work out which messenger history folds behind a button"
```

---

### Task 2: store에 펼침 상태 싣기

**Files:**
- Modify: `src/engine/store.js:11` (PROGRESS 배열), `src/engine/store.js:108` (초기화), `src/engine/store.js:668` (세터)
- Test: `test/save.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `openedHistory: { [threadId: string]: number }` — 스레드별로 **펼친 묶음 수**. 없으면 0으로 친다.
  - `openHistory(id: string, n: number) => void` — 그 스레드의 펼친 묶음 수를 `n`으로 놓는다. 같은 값이면 상태를 갈지 않는다.

- [ ] **Step 1: Write the failing test**

`test/save.test.js` 의 `describe('save / load', ...)` 블록 안, 첫 `it(...)` 바로 뒤에 넣는다:

```js
  it('펼쳐 둔 이전 메시지는 다시 켜도 펼쳐져 있다', async () => {
    const useGame = await freshStore()
    useGame.getState().openHistory('mom', 2)
    useGame.getState().saveGame()
    await settle()

    vi.resetModules()
    const again = await freshStore()
    again.getState().loadGame()
    expect(again.getState().openedHistory.mom).toBe(2)
  })

  it('이 필드가 없던 옛 저장도 읽힌다', async () => {
    // 예전 세이브에는 openedHistory 자체가 없다.
    globalThis.localStorage.setItem('windowsEx.save',
      JSON.stringify({ at: 1, windows: [], nextZ: 10, day: 1 }))
    const useGame = await freshStore()
    expect(() => useGame.getState().loadGame()).not.toThrow()
    expect(useGame.getState().openedHistory).toEqual({})
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/save.test.js`
Expected: FAIL — `useGame.getState().openHistory is not a function`

- [ ] **Step 3: Write minimal implementation**

`src/engine/store.js:11` — `PROGRESS` 배열 마지막 원소 `'dreamt'` 뒤에 `'openedHistory'` 를 더한다. 그 줄이 다음처럼 되게 한다:

```js
  'mfpFixed', 'beatQueue', 'beatAsk', 'branches', 'dreamt', 'openedHistory']
```

`src/engine/store.js:108` — `seenThreads: restored?.seenThreads ?? {},` 바로 아래에 더한다:

```js
  // 대화마다 지난 기록을 몇 묶음까지 펼쳐 두었나. 한 번 연 기록은 다시 감추지
  // 않으므로 저장에 실린다.
  openedHistory: restored?.openedHistory ?? {},
```

`src/engine/store.js:668` — `markThreadSeen` 세터 바로 아래에 더한다:

```js
  openHistory: (id, n) =>
    set((s) => (s.openedHistory[id] === n ? s : { openedHistory: { ...s.openedHistory, [id]: n } })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/save.test.js`
Expected: PASS — 기존 케이스 포함 전부

- [ ] **Step 5: Commit**

```bash
git add src/engine/store.js test/save.test.js
git commit -m "feat: remember how much history each conversation has opened"
```

---

### Task 3: 버튼과 스피너 렌더

**Files:**
- Modify: `src/apps/Messenger.jsx`
- Modify: `src/shell/shell.css`

**Interfaces:**
- Consumes: `historyChunks(messages)` (Task 1), `openedHistory` / `openHistory(id, n)` (Task 2)
- Produces: 없음 (마지막 렌더 태스크)

- [ ] **Step 1: import 더하기**

`src/apps/Messenger.jsx:2` 의 store import 아래에 한 줄 더한다:

```jsx
import { historyChunks } from '../engine/history.js'
```

- [ ] **Step 2: store 연결과 로컬 상태**

`src/apps/Messenger.jsx` 에서 `const pinned = useGame((s) => s.pinned)` 줄 **바로 위**에 더한다:

```jsx
  const openedHistory = useGame((s) => s.openedHistory)
  const openHistory = useGame((s) => s.openHistory)
  // 불러오는 시늉이 도는 동안에는 버튼을 다시 누를 수 없다.
  const [loading, setLoading] = useState(false)
```

- [ ] **Step 3: 보여줄 메시지를 잘라내기**

`const shown = thread ? msgsOf(thread) : []` 줄을 찾아 다음으로 **바꾼다**:

```jsx
  const all = thread ? msgsOf(thread) : []
  // 지난 기록은 접어 두고 이번 주 것만 펼쳐 둔다. 펼친 묶음은 뒤(최근)에서부터
  // 꺼내므로, 두 묶음을 열었다면 가장 최근 두 날짜 뭉치가 올라온다.
  const chunks = thread ? historyChunks(all) : []
  const opened = openedHistory[thread?.id] ?? 0
  const folded = chunks.slice(0, Math.max(0, chunks.length - opened))
  const hidden = folded.flat().length
  const shown = hidden ? all.slice(hidden) : all
```

- [ ] **Step 4: 스크롤 보정과 펼치기 동작**

`const speak = (lines) => sayBack(thread.id, thread.name, lines)` 줄 **바로 위**에 더한다:

```jsx
  // 기록이 위에 붙으면 읽고 있던 자리가 그만큼 밀린다. 붙기 전 높이를 재 두고
  // 그 차이만큼 내려 주면 보던 자리가 그대로 남는다.
  const loadMore = () => {
    if (loading) return
    setLoading(true)
    const el = list.current
    const before = el ? el.scrollHeight : 0
    setTimeout(() => {
      openHistory(thread.id, opened + 1)
      setLoading(false)
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - before
      })
    }, 400)
  }
```

- [ ] **Step 5: 버튼을 목록 맨 위에 놓기**

`<div className="msg-list" ref={list} onScroll={onScroll}>` 바로 다음 줄의
`{shown.length === 0 && <div className="msg-empty">아직 메시지가 없습니다</div>}` **위에** 더한다:

```jsx
              {folded.length > 0 && (
                loading ? (
                  <div className="msg-more busy">
                    <span className="spinner sm" />불러오는 중…
                  </div>
                ) : (
                  <button className="msg-more" onClick={loadMore}>
                    이전 메시지 {folded[folded.length - 1].length}개 더 보기
                  </button>
                )
              )}
```

- [ ] **Step 6: 스타일 더하기**

`src/shell/shell.css:830` 의 `.msg-date { ... }` 줄 **바로 아래**에 더한다:

```css
.msg-more { align-self: center; display: flex; align-items: center; gap: 7px; margin: 2px 0 6px; padding: 6px 14px; border: 0; border-radius: 13px; background: rgba(0,0,0,.05); color: #667; font: inherit; font-size: 12px; cursor: pointer; }
.msg-more:hover { background: rgba(0,0,0,.09); }
.msg-more.busy { cursor: default; color: #99a; }
```

- [ ] **Step 7: 빌드로 JSX 문법 검증**

Run: `npm run build`
Expected: 성공 (에러 없이 끝남). `node --check`는 JSX를 못 읽으므로 build가 문법 검증을 겸한다.

- [ ] **Step 8: 전체 테스트**

Run: `npm test`
Expected: PASS — 382개 이상 전부. Task 1의 7개가 더해져 있어야 한다.

- [ ] **Step 9: Commit**

```bash
git add src/apps/Messenger.jsx src/shell/shell.css
git commit -m "feat: load older messages behind a button, the way a messenger does"
```

---

## 검증 — 사람이 직접 볼 것

`npm run dev` 로 띄우고 1일차에서:

1. **박 팀장**(AR톡) 대화를 연다 → 이번 주 2줄만 보이고 위에 `이전 메시지 10개 더 보기`. 누르면 스피너가 잠깐 돌고 7월 23일치 10줄이 올라온다. 이어서 `7개` → `6개`, 세 번째를 누르면 버튼이 사라지고 25줄 전부가 보인다.
2. **엄마**(개인 메신저) → `11개` → `9개` → `9개` → `8개`, 네 번 눌러야 6월 27일까지 닿는다. 중간에 다른 대화로 갔다 와도 펼친 만큼 남아 있다.
3. **강 사장님** → 버튼이 없고 5줄이 전부 보인다. 마지막 줄이 "체크인 시간이 지났는데 언제쯤 오세요?"여야 한다.
4. **한진택배·우리카드** → 버튼 없이 지금과 똑같다.
5. **차민혁**(정보보안팀) → 기록이 2줄뿐이라 버튼이 없다.
6. 저장하고 새로고침 → 2번에서 펼친 상태가 그대로다.
7. 읽지 않음 배지 숫자가 접기 전후로 같다.
