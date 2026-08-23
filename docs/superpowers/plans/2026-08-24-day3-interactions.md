# 3일차 · Cmd · 시트 편집 · 파일 답변 · 잠금 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four new ways to interact (typed shell commands, editing a spreadsheet cell, answering a chat by dropping a file, a lock screen) and a third working day that asks for them.

**Architecture:** Spec: `docs/superpowers/specs/2026-08-24-day3-interactions-design.md`. All puzzle content is data in `workday.json`; code adds one pure helper per mechanic in `store.js`, a few lines in the app that owns the interaction, and one new shell component (`Lock.jsx`).

**Tech Stack:** React 18, zustand, vitest. JSON edits via Python round-trip (`indent=2, ensure_ascii=False`).

## Global Constraints

- No new dependencies. Puzzle answers never appear in the portal or 퇴근길.
- Every `accept` string must exist in the JSON the `makes every typed answer obtainable` test scans; every `files` id must be a real file.
- Days keep request counts within 1 of each other (6/6/6).
- Commit after each task.

---

### Task 1: Day 3 skeleton + Cmd (`ipconfig /all`, `ping`)

**Files:** `src/scenarios/workday.json`, `src/apps/Cmd.jsx`, `test/cmd.test.js`, `test/scenario.test.js`

**Produces:** `scenario.network.mac`, `scenario.network.pingMs`; exported `ipconfigAll(net)` and `ping(net, host)` line builders from `Cmd.jsx`; day 3 with goal, mail, opening, closing, portal; objectives `quote_c`, `mac`; day-2 `print` ask/request moved to day 3 with C테크 wording.

- [ ] Test `test/cmd.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { ipconfigAll, ping } from '../src/apps/Cmd.jsx'
import scenario from '../src/scenarios/workday.json'

const net = scenario.network
describe('command prompt', () => {
  it('ipconfig /all is the only place the MAC shows up', () => {
    expect(ipconfigAll(net).join('\n')).toContain(net.mac)
    expect(JSON.stringify(scenario.fs)).not.toContain(net.mac)
  })
  it('ping answers four times and averages to the scenario figure', () => {
    const out = ping(net, net.gateway).join('\n')
    expect(out.match(/응답:/g)).toHaveLength(4)
    expect(out).toContain(`평균 = ${net.pingMs}ms`)
  })
})
```

- [ ] `Cmd.jsx`: export `ipconfigAll` and `ping`; parse `const [cmd, ...args] = typed.toLowerCase().split(/\s+/)`; handle `ipconfig` with `args[0] === '/all'`, `ping` with `args[0]` (no host → usage line). HELP gains `IPCONFIG /ALL` and `PING`.
- [ ] Scenario: `network.mac = "00-1A-7D-4C-9E-21"`, `network.pingMs = 2`. Day 3 object (n 3, label 셋째 날, date `8월 25일 (수)`, requests `["quote_c","mac","print","orders","review","catpic"]`, mails `[mail_ctech]`, goal for `file_qc` / `256,000` / grants `quote_c`, opening, closing, portal notice+news ×2, asks: security `mac`, boss `print` (moved, reworded), boss `orders` beat (no ask), junho `review`, mom `catpic`). Remove `print` from day 2 requests and asks. Objectives: `quote_c`, `mac`, `orders` (with `cell`), `review`, `catpic`.
- [ ] `test/scenario.test.js` updates (see spec §테스트). Run all, commit `feat: day 3, and a command prompt that knows ipconfig /all and ping`.

### Task 2: Sheet cell editing

**Files:** `src/engine/store.js`, `src/apps/Sheet.jsx`, `src/shell/shell.css`, `test/sheet.test.js`

**Produces:** `cellKey(fileId, sheet, r, c)`, `cellMatches(objective, sheetEdits)`, store `sheetEdits`, `editCell(fileId, sheet, r, c, value)` which grants matching cell objectives.

- [ ] Test:

```js
import { describe, expect, it } from 'vitest'
import { cellKey, cellMatches, findFile, useGame } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

const orders = scenario.objectives.find((o) => o.cell)
describe('sheet edits', () => {
  it('keys a cell by file, sheet and position', () => {
    expect(cellKey('f', '2026', 1, 3)).toBe('f:2026:1:3')
  })
  it('matches an objective loosely on whitespace', () => {
    const edits = { [cellKey(orders.cell.file, orders.cell.sheet, orders.cell.row, orders.cell.col)]: ` ${orders.cell.value} ` }
    expect(cellMatches(orders, edits)).toBe(true)
    expect(cellMatches(orders, {})).toBe(false)
  })
  it('points at a real cell in a real workbook', () => {
    const file = findFile(scenario.fs, orders.cell.file)
    const sheet = file.sheets.find((s) => s.name === orders.cell.sheet)
    expect(sheet.rows[orders.cell.row][orders.cell.col]).toBeTruthy()
  })
  it('editing the right cell grants the objective', () => {
    useGame.setState({ sheetEdits: {}, grants: {} })
    const { file, sheet, row, col, value } = orders.cell
    useGame.getState().editCell(file, sheet, row, col, value)
    expect(useGame.getState().grants[orders.grant]).toBe(true)
  })
})
```

- [ ] Store: `'sheetEdits'` in PROGRESS; state `sheetEdits: restored?.sheetEdits ?? {}`; helpers + action. `Sheet.jsx`: `editing` state `{r,c,text}`; `onDoubleClick` on body cells; input commits on Enter (`editCell`), cancels on Escape; cell value = `sheetEdits[key] ?? value`. CSS `.xl-grid td input`. Commit `feat: spreadsheet cells can be edited, and the boss notices when the right one is`.

### Task 3: File-answer asks in the messenger

**Files:** `src/apps/Messenger.jsx`, `src/engine/store.js` (`fileFits(ask, fileId)`), `test/hints.test.js` (add case)

- [ ] Test in `test/hints.test.js`: `fileFits({ files: ['a','b'] }, 'b') === true`, `fileFits({ accept: ['x'] }, 'a') === false`.
- [ ] Store: `export const fileFits = (ask, id) => Boolean(ask?.files?.includes(id))`.
- [ ] Messenger: in `sendFile`, after `say(...)`: if `ask?.files` → `fileFits` ? same as the correct-answer branch of `answer()` : `speak(hintAfter(ask, missed))` with the wrongs counter; else `reactTo(file.id)`. Factor the correct-answer branch into `const solved = () => {...}` used by both. In `answer()`, if `ask.files` treat typed text as a miss. Commit `feat: a question can ask for a file, answered by dropping it into the chat`.

### Task 4: Lock screen

**Files:** `src/shell/Lock.jsx` (new), `src/App.jsx`, `src/shell/Taskbar.jsx`, `src/engine/store.js`, `src/shell/shell.css`, `src/scenarios/workday.json` (`lock`), `test/lock.test.js`

- [ ] Test: `scenario.lock.password` is contained in the ID card file's `alt` (so a player who found it can unlock); `lock()`/`unlock()` flip `locked`.
- [ ] Store: `locked: false`, `lock: () => set({ locked: true, toast: null })`, `unlock: () => { play('ok'); set({ locked: false }) }`.
- [ ] `Lock.jsx`: clock from `new Date()` (HH:MM) + `days[day-1].date`; name from `scenario.player.name`; password input, Enter → compare; miss → error line + `lock.hint`. `App.jsx`: `{locked && <Lock />}` after Taskbar; a `useEffect` with `keydown` (Ctrl+Alt+L → lock) and an idle timer reset on `pointerdown`/`keydown`, firing `lock()` after `scenario.lock.idleMs` while booted and not crashed/locked. Taskbar start menu: `잠금` item above 새 게임. CSS `.lock`, `.lock-clock`, `.lock-card`. Commit `feat: lock screen — start menu, Ctrl+Alt+L, or four idle minutes`.

### Task 5: README + counts

- [ ] README: test count, 앱 설명에 잠금·Cmd·시트 편집·파일 답변, 3일차 언급. Commit `docs: readme for day 3 and the new interactions`.
