# 휴지통 복구 · 프린터 이벤트 · 퇴근길 게시판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three additions to the workday game: a day-2 puzzle where the needed quote sits in the recycle bin, a printer-repair event driven by a wiki page, and an external anonymous community site.

**Architecture:** All three are data in `src/scenarios/workday.json` plus small view code. The bin is a derived filesystem view (like `fsWithPinned`); the printer is a pure step-checker plus an overlay in the Hwp app; the board is a new `layout: 'board'` site rendered by one component, like Wiki/Portal.

**Tech Stack:** React 18, zustand, vitest. JSON edits go through Python (round-trip is byte-identical with `indent=2, ensure_ascii=False`).

## Global Constraints

- No new dependencies.
- Puzzle answers (`3,450,000`, `1,410,000`, `256,000`, `64,200`, `180`, `sj.lee@asangsa.co.kr`, `0412`, `P-1042`) never appear in the board site or the portal.
- Every typed answer must appear somewhere in the scenario JSON the test `makes every typed answer obtainable` scans.
- Commit after each task. Never commit `dist/`.

---

### Task 1: Recycle-bin view and restore

**Files:**
- Modify: `src/engine/store.js` (add `restored` state, `restoreFile`, `fsView`)
- Modify: `src/apps/FileExplorer.jsx`, `src/apps/FileDialog.jsx`, `src/shell/Desktop.jsx`
- Modify: `src/scenarios/workday.json` (`file_qb` gets `deleted: true`; 민서 day-2 confession)
- Test: `test/trash.test.js`

**Interfaces:**
- Produces: `fsView(fs, { pinned, restored })` → fs object where files with `deleted && !restored[id]` are moved into `휴지통`; then pinned copies are added (same as `fsWithPinned`).
- Produces: store action `restoreFile(id)` → sets `restored[id] = true`. `restored` is in `PROGRESS` so it saves.

- [ ] **Step 1: Write failing tests** — `test/trash.test.js`

```js
import { describe, expect, it } from 'vitest'
import { entriesAt, fsView, useGame } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

const fs = {
  문서: [{ name: 'B', children: [{ id: 'q', name: 'q.hwp', content: 'x', deleted: true }] }],
  휴지통: [{ id: 'old', name: 'old.hwp', content: 'y' }],
  바탕화면: []
}

describe('recycle bin view', () => {
  it('shows a deleted file in the bin, not in its folder', () => {
    const v = fsView(fs, {})
    expect(entriesAt(v, ['문서', 'B'])).toEqual([])
    expect(entriesAt(v, ['휴지통']).map((f) => f.id)).toEqual(['old', 'q'])
  })

  it('puts it back once restored', () => {
    const v = fsView(fs, { restored: { q: true } })
    expect(entriesAt(v, ['문서', 'B']).map((f) => f.id)).toEqual(['q'])
    expect(entriesAt(v, ['휴지통']).map((f) => f.id)).toEqual(['old'])
  })

  it('leaves the scenario data untouched', () => {
    fsView(fs, {})
    expect(fs['문서'][0].children).toHaveLength(1)
    expect(fs['휴지통']).toHaveLength(1)
  })

  it('still stacks the pinned work folder on top', () => {
    const v = fsView(fs, { pinned: ['old'] })
    expect(entriesAt(v, ['바탕화면', '작업 폴더']).map((f) => f.id)).toEqual(['old'])
  })

  it('restoreFile records the restore', () => {
    useGame.setState({ restored: {} })
    useGame.getState().restoreFile('q')
    expect(useGame.getState().restored.q).toBe(true)
  })

  it("day 2's quote starts in the bin and nothing else does", () => {
    const binned = entriesAt(fsView(scenario.fs, {}), ['휴지통']).filter((f) => f.deleted)
    expect(binned.map((f) => f.id)).toEqual(['file_qb'])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run test/trash.test.js` — expect FAIL (`fsView` is not exported).

- [ ] **Step 3: Implement in `src/engine/store.js`**

Add `'restored'` to `PROGRESS`. Add state `restored: restored?.restored ?? {}` beside `pinned` — note the module already has a `const restored = startingPoint()`; rename nothing, just read `restored?.restored`. Add action after `unpinFile`:

```js
  restoreFile: (id) => set((s) => ({ restored: { ...s.restored, [id]: true } })),
```

After `fsWithPinned`, add:

```js
// The bin is a view: a file flagged `deleted` in the scenario sits in 휴지통
// until restored, then reappears where the data always kept it.
export function fsView(fs, { pinned = [], restored = {} } = {}) {
  const binned = []
  const strip = (entries) => entries.flatMap((e) => {
    if (e.children) return [{ ...e, children: strip(e.children) }]
    if (e.deleted && !restored[e.id]) { binned.push(e); return [] }
    return [e]
  })
  const out = Object.fromEntries(Object.entries(fs).map(([root, entries]) => [root, strip(entries)]))
  out['휴지통'] = [...(out['휴지통'] ?? []), ...binned]
  return fsWithPinned(out, pinned)
}
```

- [ ] **Step 4: Scenario data** — Python, in `src/scenarios/workday.json`:
  - find `file_qb` under 문서/업무자료/2026/B물산 and set `"deleted": true`.
  - In `days[1].asks`, the first 최민서 ask (stock) — prepend to its `lines`:
    `"선배님… 먼저 죄송한 말씀부터요 ㅠㅠ"`, `"휴가 중에 폴더 정리하다가 B물산 견적서를 실수로 지운 것 같아요."`, `"휴지통 비우기는 안 했으니까 거기서 복원하시면 될 거예요!"` followed by the existing lines.

- [ ] **Step 5: Views**
  - `FileExplorer.jsx`: import `fsView` instead of `fsWithPinned`; `const restored = useGame((s) => s.restored)`; `const restoreFile = useGame((s) => s.restoreFile)`; `const fs = fsView(scenario.fs, { pinned, restored })`; `const inTrash = nav.path[0] === '휴지통'`. In both file buttons replace `{...fileDragProps(f)}` with `{...(inTrash ? {} : fileDragProps(f))}` (same for `file` in hits). Context menu: when `inTrash`, render only 열기 and, if `menu.file.deleted`, a `복원` button calling `restoreFile(menu.file.id)`; otherwise the existing pin/unpin buttons.
  - `FileDialog.jsx`: use `fsView(scenarioFs, { pinned, restored })` and `const roots = Object.keys(fs).filter((r) => r !== '휴지통')`.
  - `Desktop.jsx`: `fsView(scenario.fs, { pinned, restored })['바탕화면']` (read `restored` from the store).

- [ ] **Step 6: Run** `npx vitest run` — all green (existing `walks nested folders` reads raw scenario fs, unaffected).

- [ ] **Step 7: Commit** `feat: day 2's B물산 quote is in the recycle bin and has to be restored`

---

### Task 2: Printer event

**Files:**
- Modify: `src/scenarios/workday.json` (`printer` block, wiki page `office`, day-2 ask + objective + request)
- Modify: `src/engine/store.js` (`printerStep`), `src/apps/Hwp.jsx`, `src/shell/shell.css`
- Modify: `test/scenario.test.js` (request-count tolerance, printer in typed-answer world)
- Test: `test/printer.test.js`

**Interfaces:**
- Produces: `printerStep(steps, done, id)` → `done + 1` if `steps[done] === id`, else `0`.
- Scenario `printer`: `{ name, error: { code, text, help }, buttons: [{id,label}], steps: [id...], receipt, done: [lines] }`.

- [ ] **Step 1: Failing test** — `test/printer.test.js`

```js
import { describe, expect, it } from 'vitest'
import { printerStep } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

const p = scenario.printer

describe('printer repair', () => {
  it('advances on the right button and resets on a wrong one', () => {
    expect(printerStep(['a', 'b'], 0, 'a')).toBe(1)
    expect(printerStep(['a', 'b'], 1, 'a')).toBe(0)
    expect(printerStep(['a', 'b'], 1, 'b')).toBe(2)
  })

  it('finishes only by pressing the wiki order end to end', () => {
    let done = 0
    for (const id of p.steps) done = printerStep(p.steps, done, id)
    expect(done).toBe(p.steps.length)
  })

  it('every step is a real button and the wiki lists them in order', () => {
    const ids = new Set(p.buttons.map((b) => b.id))
    for (const id of p.steps) expect(ids.has(id)).toBe(true)
    const wiki = scenario.sites.find((s) => s.layout === 'wiki').wiki.pages.office
    const labels = p.steps.map((id) => p.buttons.find((b) => b.id === id).label)
    expect(wiki.list).toEqual(labels)
  })

  it('the receipt only exists on the printer, never in a file', () => {
    expect(JSON.stringify(scenario.fs)).not.toContain(p.receipt)
  })
})
```

- [ ] **Step 2: Run** — FAIL (`printerStep` undefined).

- [ ] **Step 3: `store.js`** — after `hintAfter`:

```js
// The jammed printer wants the wiki's steps in order; a wrong press jams it again.
export const printerStep = (steps, done, id) => (steps[done] === id ? done + 1 : 0)
```

- [ ] **Step 4: Scenario data** (Python):

```python
d['printer'] = {
  "name": "영업1팀 복합기 (HB-MFP-7)",
  "error": {"code": "E-04", "text": "용지 걸림", "help": "조치 방법은 사내위키 > 공용 > 사무기기 안내를 참고하세요."},
  "buttons": [
    {"id": "cover", "label": "후면 커버 열기"}, {"id": "jam", "label": "걸린 용지 제거"},
    {"id": "close", "label": "후면 커버 닫기"}, {"id": "toner", "label": "토너 교체"},
    {"id": "power", "label": "전원 재시작"}, {"id": "print", "label": "다시 인쇄"}
  ],
  "steps": ["cover", "jam", "close", "print"],
  "receipt": "P-1042",
  "done": ["출력이 완료되었습니다.", "출력물은 복합기 배출구에서 찾아가세요."]
}
```

Wiki (`sites[layout=wiki].wiki`): add `{"id": "office", "title": "사무기기 안내"}` to the 공용 nav section; add page:

```python
w['pages']['office'] = {
  "title": "사무기기 안내", "crumb": ["공용", "사무기기"], "updated": "2026-06-03", "author": "총무팀",
  "intro": "7층 복합기(HB-MFP-7) 오류 코드와 조치 방법입니다. 해결되지 않으면 총무팀 내선 1180으로 연락하세요.",
  "table": {"columns": ["코드", "증상", "조치"], "rows": [
    ["E-01", "토너 부족", "토너 교체"],
    ["E-04", "용지 걸림", "아래 순서대로 조치"],
    ["E-07", "통신 오류", "전원 재시작"]]},
  "list": ["후면 커버 열기", "걸린 용지 제거", "후면 커버 닫기", "다시 인쇄"],
  "notes": ["순서를 건너뛰거나 다른 버튼을 누르면 용지가 다시 걸립니다. 처음부터 다시 진행하세요.",
            "출력이 끝나면 접수번호가 표시됩니다. 사무기기 관리대장에 기록해 주세요."]
}
```

Objective: append `{"id": "print", "title": "박 팀장에게 출력 접수번호 알려주기", "grant": "print"}`; append `"print"` to `days[1].requests`. Append to `days[1].asks`:

```python
{
  "source": "workMessenger", "thread": "boss", "from": "박 팀장",
  "lines": ["김대리, B물산 견적서 한 부 출력해서 내 책상에 올려줄래요?",
            "출력하면 접수번호가 뜨죠? 사무기기 관리대장에 적어야 해서 그 번호도 알려줘요."],
  "ask": {
    "placeholder": "출력 접수번호를 입력해 주세요",
    "accept": ["P-1042"], "grants": "print",
    "ok": ["네, 적어둘게요.", "복합기가 또 말썽이었죠? 고생했어요."],
    "no": [["음, 그 번호가 아닌 것 같은데요.", "출력 끝나고 화면에 뜨는 접수번호요."],
           ["복합기 에러 났으면 사내위키 공용 > 사무기기 안내 한번 봐요.", "거기 순서대로 하면 돼요."],
           ["한글 문서 열어서 인쇄 → 위키 순서대로 버튼 누르면 접수번호가 나와요.", "그 번호 그대로 알려주면 됩니다."]],
    "next": []
  }
}
```

- [ ] **Step 5: `Hwp.jsx`** — add `import { play } from '../shell/sound.js'`, `printerStep` from store; state `const [printing, setPrinting] = useState(false)`, `const [done, setDone] = useState(0)`; `const p = useGame((s) => s.scenario.printer)`; `const printed = done === p.steps.length`. Add a 인쇄 button in `.hwp-bar` before the zoom button:

```jsx
<button className="hwp-print" onClick={() => { setDone(0); setPrinting(true) }}>인쇄</button>
```

Overlay at the end of `.hwp` (inside the root div):

```jsx
{printing && (
  <div className="pr-back" onPointerDown={() => setPrinting(false)}>
    <div className="pr" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pr-head">인쇄 — {p.name}</div>
      {printed ? (
        <div className="pr-ok">
          {p.done.map((l) => <p key={l}>{l}</p>)}
          <div className="pr-receipt">접수번호 <b>{p.receipt}</b></div>
        </div>
      ) : (
        <>
          <div className="pr-err"><b>{p.error.code}</b> {p.error.text}<span>{p.error.help}</span></div>
          <div className="pr-steps">{p.steps.map((_, i) => <i key={i} className={i < done ? 'on' : ''} />)}</div>
          <div className="pr-btns">
            {p.buttons.map((b) => (
              <button key={b.id} onClick={() => {
                const next = printerStep(p.steps, done, b.id)
                play(next === 0 ? 'error' : next === p.steps.length ? 'ok' : 'click')
                setDone(next)
              }}>{b.label}</button>
            ))}
          </div>
        </>
      )}
      <button className="pr-close" onClick={() => setPrinting(false)}>닫기</button>
    </div>
  </div>
)}
```

CSS (`shell.css`, after `.hwp-zoom:hover`):

```css
.hwp { position: relative; }
.hwp-print { margin-left: auto; padding: 4px 10px; border-radius: 4px; background: #f0f0f4; font-size: 12px; }
.hwp-print:hover { background: #e4e4ea; }
.hwp-print + .hwp-zoom { margin-left: 0; }
.pr-back { position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.25); }
.pr { width: 340px; padding: 16px; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.3); font-size: 12px; }
.pr-head { font-weight: 600; margin-bottom: 12px; }
.pr-err { padding: 10px 12px; border-radius: 6px; background: #fdeaea; color: #b33; }
.pr-err span { display: block; margin-top: 4px; color: #866; font-size: 11px; }
.pr-steps { display: flex; gap: 5px; margin: 12px 0 8px; }
.pr-steps i { flex: 1; height: 5px; border-radius: 3px; background: #e4e4ea; }
.pr-steps i.on { background: #2f9160; }
.pr-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pr-btns button { padding: 8px; border-radius: 5px; background: #f0f0f4; }
.pr-btns button:hover { background: #e4e4ea; }
.pr-ok p { margin: 4px 0; color: #333; }
.pr-receipt { margin-top: 10px; padding: 10px; border-radius: 6px; background: #e4f6ec; color: #2f9160; text-align: center; font-size: 14px; user-select: text; }
.pr-close { display: block; margin: 12px 0 0 auto; padding: 6px 14px; border-radius: 5px; background: #f0f0f4; }
```

- [ ] **Step 6: Test tweaks in `test/scenario.test.js`**
  - `gives every day the same number of requests` → rename to `keeps the workload even across days`, body: `const counts = ...; expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)`.
  - In `makes every typed answer obtainable`, add `printer: scenario.printer` to the `world` object.

- [ ] **Step 7: Run** `npx vitest run` — green. **Commit** `feat: a jammed printer you fix by following the wiki, and the boss wants the receipt number`

---

### Task 3: 퇴근길 anonymous board

**Files:**
- Create: `src/apps/Board.jsx`
- Modify: `src/apps/Browser.jsx` (layout hook), `src/shell/shell.css`, `src/scenarios/workday.json` (site + bookmark)
- Modify: `test/scenario.test.js` (two intranet-only loops)
- Test: `test/board.test.js`

**Interfaces:**
- Site: `{ url: 'toegeun.kr', title: '퇴근길 - 직장인 익명 커뮤니티', layout: 'board', board: { name, tagline, posts: [{ id, title, company, author, time, likes, body: [string], comments: [{ author, text, likes }] }] } }`.

- [ ] **Step 1: Failing test** — `test/board.test.js`

```js
import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { siteView } from '../src/engine/store.js'

const site = scenario.sites.find((s) => s.layout === 'board')
const chain = (ask) => (ask ? [ask, ...chain(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

describe('퇴근길 board', () => {
  it('is an outside site: no approval, no login', () => {
    expect(siteView(site, { grants: {}, unlocked: {} })).toBe('ready')
    expect(scenario.bookmarks.some((b) => b.url === site.url)).toBe(true)
  })

  it('every post is complete and every comment has a voice', () => {
    expect(site.board.posts.length).toBeGreaterThan(5)
    const ids = site.board.posts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of site.board.posts) {
      expect(p.title && p.company && p.author && p.time).toBeTruthy()
      expect(p.body.length).toBeGreaterThan(0)
      for (const c of p.comments) expect(c.author && c.text).toBeTruthy()
    }
  })

  it('never gives a puzzle answer away', () => {
    const board = JSON.stringify(site.board)
    const answers = [
      ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(chain),
      ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask)))
    ].flatMap((a) => a.accept.flat())
    for (const a of [...answers, ...scenario.days.flatMap((d) => d.goal.requiredKeywords),
      ...scenario.sites.filter((s) => s.login).map((s) => s.login.password), scenario.printer.receipt]) {
      expect(board).not.toContain(a)
    }
  })
})
```

- [ ] **Step 2: Run** — FAIL (site undefined).

- [ ] **Step 3: Scenario data** — append site with `board.posts` (9 posts, see data in execution; companies mix `AR주식회사`, `B물산`, `익명`; one post about a jammed printer, one "휴가 복귀 첫날" thread, one "AR 영업팀 분위기" question, one 점심 맛집 thread, one 익명 팀장 욕, one 탕비실 커피, one 사내 메신저 읽씹, one 주차장 공사, one 주말 고양이). Bookmark `{ "url": "toegeun.kr", "title": "퇴근길" }` appended.

- [ ] **Step 4: `Board.jsx`**

```jsx
import { useState } from 'react'
import { ChevronLeft, MessageCircle, ThumbsUp } from '../icons/line.jsx'

// An outside community site: list of posts, one post at a time, nothing to log into.
export default function Board({ site }) {
  const b = site.board
  const [id, setId] = useState(null)
  const post = b.posts.find((p) => p.id === id)

  return (
    <div className="bd">
      <div className="bd-top">
        <span className="bd-logo" onClick={() => setId(null)}>{b.name}</span>
        <span className="bd-tag">{b.tagline}</span>
      </div>

      {post ? (
        <article className="bd-post">
          <button className="bd-back" onClick={() => setId(null)}>
            <ChevronLeft size={13} strokeWidth={2.2} />목록
          </button>
          <h1>{post.title}</h1>
          <div className="bd-meta">
            <span className="bd-co">{post.company}</span>{post.author} · {post.time}
            <span className="bd-likes"><ThumbsUp size={12} strokeWidth={2} />{post.likes}</span>
          </div>
          {post.body.map((line, i) => <p key={i}>{line}</p>)}
          <div className="bd-cm-head">댓글 {post.comments.length}</div>
          {post.comments.map((c, i) => (
            <div key={i} className="bd-cm">
              <span className="bd-cm-who">{c.author}</span>
              <span className="bd-cm-text">{c.text}</span>
              <span className="bd-likes"><ThumbsUp size={11} strokeWidth={2} />{c.likes}</span>
            </div>
          ))}
        </article>
      ) : (
        <div className="bd-list">
          {b.posts.map((p) => (
            <button key={p.id} className="bd-row" onClick={() => setId(p.id)}>
              <span className="bd-co">{p.company}</span>
              <span className="bd-title">{p.title}</span>
              <span className="bd-n"><MessageCircle size={12} strokeWidth={2} />{p.comments.length}</span>
              <span className="bd-n"><ThumbsUp size={12} strokeWidth={2} />{p.likes}</span>
              <span className="bd-time">{p.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

If `MessageCircle`/`ThumbsUp` are missing from `src/icons/line.jsx`, add them there following the existing icon pattern.

`Browser.jsx`: import `Board`; in the ready branch add `: site.layout === 'board' ? <Board site={site} />`.

CSS (`shell.css`, after the portal block):

```css
.bd { min-height: 100%; background: #f7f7f9; font-size: 12px; }
.bd-top { display: flex; align-items: baseline; gap: 10px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #e8e8ee; }
.bd-logo { font-size: 17px; font-weight: 800; color: #e9542f; cursor: pointer; }
.bd-tag { color: #999; font-size: 11px; }
.bd-list { max-width: 680px; margin: 12px auto; background: #fff; border: 1px solid #e8e8ee; border-radius: 8px; overflow: hidden; }
.bd-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 14px; border-bottom: 1px solid #f0f0f4; text-align: left; font: inherit; }
.bd-row:last-child { border-bottom: none; }
.bd-row:hover { background: #fafafc; }
.bd-co { flex-shrink: 0; padding: 2px 7px; border-radius: 4px; background: #fff0eb; color: #e9542f; font-size: 10px; }
.bd-title { flex: 1; min-width: 0; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-n { display: flex; align-items: center; gap: 3px; color: #999; font-size: 11px; }
.bd-time { color: #bbb; font-size: 11px; white-space: nowrap; }
.bd-post { max-width: 680px; margin: 12px auto 30px; padding: 20px 24px; background: #fff; border: 1px solid #e8e8ee; border-radius: 8px; }
.bd-back { display: flex; align-items: center; gap: 2px; color: #888; font: inherit; }
.bd-post h1 { margin: 10px 0 6px; font-size: 17px; color: #222; line-height: 1.5; }
.bd-meta { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid #eee; color: #999; font-size: 11px; }
.bd-likes { display: flex; align-items: center; gap: 3px; margin-left: auto; color: #e9542f; }
.bd-post p { margin-top: 12px; color: #333; font-size: 13px; line-height: 1.9; user-select: text; }
.bd-cm-head { margin: 22px 0 8px; font-weight: 600; color: #444; }
.bd-cm { display: flex; align-items: baseline; gap: 8px; padding: 9px 0; border-top: 1px solid #f0f0f4; }
.bd-cm-who { flex-shrink: 0; color: #e9542f; font-size: 11px; }
.bd-cm-text { flex: 1; color: #333; line-height: 1.6; user-select: text; }
```

- [ ] **Step 5: `test/scenario.test.js`** — `both intranet sites are behind the company account` and `gates the intranet on an IP approval` loop over `scenario.sites.filter((s) => s.login)` instead of all sites.

- [ ] **Step 6: Run** `npx vitest run` and `npx vite build` — green. **Commit** `feat: 퇴근길, an anonymous community site outside the company`

---

### Task 4: README count + wrap-up

- [ ] Update the test count in `README.md` (`npm test         # N tests`) and the 앱/사이트 lines to mention 퇴근길 and the printer. Commit `docs: readme for the bin, printer, and 퇴근길`.
