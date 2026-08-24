# 브라우저 다운로드·설치 단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 실행 파일을 내려받아 설치하는 단계 네 가지(정부25 보안 프로그램, 사내 VPN+hosts, 거래처 전용 뷰어, 가짜 뷰어 함정)를 추가한다.

**Architecture:** `scenario.hangul` 하나만 알던 설치 마법사를 `scenario.programs.<id>` 사전으로 일반화하고, 실행 파일이 `program` 키로 자기 프로그램을 가리킨다. 브라우저에는 공용 다운로드 버튼과 회사 홈페이지용 `vendor` 레이아웃을 더한다. VPN은 새 앱 + store 상태 `vpn`으로, 나머지 셋은 기존 컴포넌트(Gov, Mail, Browser)에 게이트를 하나씩 얹는다.

**Tech Stack:** React 18 + zustand + Vite, vitest. 시나리오는 `src/scenarios/workday.json` 한 파일. UI 문자열은 전부 한국어.

## Global Constraints

- 모든 UI 문자열·시나리오 데이터는 한국어. 영어 라벨을 쓰지 않는다.
- 시나리오는 `src/scenarios/workday.json` 하나뿐이다. 새 JSON 파일을 만들지 않는다.
- 퍼즐 정답(세션 ID `ARV-7K3Q-92XF`, 품의번호 `DY-PR-260826`)은 **읽는 글**(메신저 대사, 힌트,
  게시판, 위키, 문서, 뉴스, Q&A) 어디에도 나오면 안 된다. 정답의 출처가 되는 자리와
  `ask.accept` 배열에는 당연히 들어간다 — `answerFits` 는 문자열을 그대로 비교하고
  템플릿 기능이 없다. 기존 `printer.receipt`(`P-1042`)가 `scenario.printer` 와
  `days[2].asks[…].ask.accept` 양쪽에 있는 것과 같은 규약이다. 정답 누출 테스트는
  `test/gov.test.js` 처럼 **검사할 표면을 좁혀서** 쓴다 — 시나리오 전체를 stringify 하면
  accept 배열까지 걸려 통과할 수 없는 테스트가 된다.
- 새 파일은 전부 `attached: true` — 내려받기 전에는 파일 탐색기 어디에도 보이지 않는다.
- 커밋 메시지는 `feat:` / `test:` / `refactor:` 접두사 + 한 줄 요약. 끝에 다음 두 줄을 붙인다:
  ```
  
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- 테스트는 `npm test -- --run` 으로 돌린다(워치 모드로 들어가지 않게).
- 기존 테스트 전부(272개)가 끝까지 통과해야 한다. 기존 테스트를 지우지 않는다 — 규약이 바뀐 곳만 고친다.
- `pool.fixed[n]` 배열은 `days[n-1].requests` 와 **정확히 같은 원소**여야 한다(test/pool.test.js 가 검사).
- **VPN 은 이름이 비슷한 것 셋이 따로 논다. 하나로 합치지 않는다:**
  | 이름 | 무엇 | 어디 |
  |---|---|---|
  | `grants.vpnInstalled` | 클라이언트가 설치됨 (바탕화면 아이콘이 생기는 조건) | `programs.vpn.grant` |
  | store `vpn` (boolean) | 지금 터널이 연결되어 있음 (재부팅하면 풀림) | `useGame` 상태 |
  | `grants.vpn` | 세션 ID 를 정보보안팀에 보고함 (둘째 날 요청 완료) | objective `vpn` |

---

### Task 1: 프로그램 사전으로 일반화

`scenario.hangul` 을 `scenario.programs.hangul` 로 옮기고, Installer 가 실행 파일의 `program` 키로 어떤 프로그램인지 찾게 만든다. 동작은 그대로다 — 자리만 옮기는 리팩터링.

**Files:**
- Modify: `src/scenarios/workday.json` (최상위 `"hangul"` 키 → `"programs": { "hangul": … }`, 다운로드 폴더의 `한글2024_설치.exe` 항목)
- Modify: `src/apps/Installer.jsx`
- Modify: `src/apps/Hwp.jsx:9`
- Test: `test/hangul.test.js`, `test/programs.test.js` (신규)

**Interfaces:**
- Consumes: `findFile(fs, fileId)`, `useGame`
- Produces: `scenario.programs` — `{ [id]: { product, publisher, version, size, setup, intro[], steps[], done{title,lines[]}, already{title,lines[]}, grant, needs?, blocked?{title,lines[],code}, missing?, shortcut?, danger?, aftermath? } }`.
  실행 파일 항목은 `{ id, name, program, content }` 꼴로 `program`이 `programs`의 키를 가리킨다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/programs.test.js` 를 새로 만든다:

```js
import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener } from '../src/engine/store.js'

const files = allFiles(scenario.fs)
const programs = Object.entries(scenario.programs)

describe('the program dictionary', () => {
  it('gives every program a wizard with something to show', () => {
    expect(programs.length).toBeGreaterThan(0)
    for (const [id, p] of programs) {
      expect(p.product, id).toBeTruthy()
      expect(p.publisher, id).toBeTruthy()
      expect(p.setup.endsWith('.exe'), id).toBe(true)
      expect(p.intro.length, id).toBeGreaterThan(0)
      expect(p.steps.length, id).toBeGreaterThan(2)
      for (const screen of [p.done, p.already]) {
        expect(screen.title.length, id).toBeGreaterThan(0)
        expect(screen.lines.length, id).toBeGreaterThan(0)
      }
      expect(p.grant, id).toBeTruthy()
    }
  })

  it('lets each setup file name the program it installs', () => {
    for (const [id, p] of programs) {
      const setup = files.find((f) => f.name === p.setup)
      expect(setup, id).toBeTruthy()
      expect(setup.program, id).toBe(id)
      expect(fileOpener(setup).app, id).toBe('installer')
    }
  })

  it('only asks for approval where it has a refusal screen to show', () => {
    for (const [id, p] of programs) {
      if (!p.needs) continue
      expect(p.blocked.title, id).toBeTruthy()
      expect(p.blocked.lines.length, id).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/programs.test.js`
Expected: FAIL — `Cannot convert undefined or null to object` (아직 `scenario.programs` 가 없다)

- [ ] **Step 3: 시나리오에서 hangul 을 programs 아래로 옮긴다**

`src/scenarios/workday.json` 최상위의 `"hangul": { … }` 블록을 통째로 잘라, 같은 자리에 다음처럼 넣는다.

**`…기존 그대로…` 는 "지금 파일에 있는 그 블록을 한 글자도 바꾸지 말고 그대로 옮겨 붙인다"는 뜻이다.
새로 쓰거나 요약하지 않는다.** 실제로 새로 더하는 것은 `grant`·`needs` 두 줄뿐이다:

```json
  "programs": {
    "hangul": {
      "product": "한컴오피스 한글 2024",
      "publisher": "한글과컴퓨터",
      "version": "12.0.4.1",
      "size": "312MB",
      "setup": "한글2024_설치.exe",
      "grant": "hangul",
      "needs": "hangulOk",
      "missing": { …기존 그대로… },
      "blocked": { …기존 그대로… },
      "intro": [ …기존 그대로… ],
      "steps": [ …기존 그대로… ],
      "done": { …기존 그대로… },
      "already": { …기존 그대로… }
    }
  },
```

같은 파일 `다운로드` 폴더의 설치 파일 항목에 `program` 을 더한다:

```json
      {
        "id": "file_hangul_setup",
        "name": "한글2024_설치.exe",
        "program": "hangul",
        "content": "한컴오피스 한글 2024 설치 파일 (사내 배포본)\n\n설치에는 관리자 승인이 필요합니다."
      },
```

(`id` 가 이미 있으면 그대로 두고 `program` 만 추가한다.)

- [ ] **Step 4: Installer 가 프로그램을 파일에서 찾게 한다**

`src/apps/Installer.jsx` 의 `export default function Installer` 를 다음으로 바꾼다. `spec` 을 파일의 `program` 으로 찾고, `needs` 가 없으면 승인 화면을 건너뛰며, grant 키를 `spec.grant` 에서 읽는다:

```jsx
export default function Installer({ fileId, winId }) {
  const fs = useGame((s) => s.scenario.fs)
  const programs = useGame((s) => s.scenario.programs)
  const grants = useGame((s) => s.grants)
  const grant = useGame((s) => s.grant)
  const close = useGame((s) => s.closeWindow)
  const [step, setStep] = useState(-1)
  const file = findFile(fs, fileId)
  const spec = programs[file?.program]

  const running = spec && step >= 0 && step < spec.steps.length
  const finished = spec && step >= spec.steps.length

  // the progress bar walks the steps, then the install lands
  useEffect(() => {
    if (!running) return
    const t = setTimeout(() => setStep((s) => s + 1), TICK * 18)
    return () => clearTimeout(t)
  }, [step, running])

  useEffect(() => {
    if (!finished || grants[spec.grant]) return
    grant(spec.grant)
    play('ok')
  }, [finished])

  const shut = () => close(winId)

  if (!spec) return <div className="ins"><Panel kind="stop" title="실행할 수 없습니다"
    lines={['이 파일은 실행할 수 있는 프로그램이 아닙니다.']} /></div>

  if (grants[spec.grant] && step < 0) {
```

이 아래 `already` / `blocked` / 마법사 본문은 그대로 두되, 승인 검사 한 줄만 `needs` 를 보게 고친다:

```jsx
  if (spec.needs && !grants[spec.needs]) {
```

- [ ] **Step 5: Hwp 가 새 자리에서 안내문을 읽게 한다**

`src/apps/Hwp.jsx:9` 한 줄을 바꾼다:

```jsx
  const spec = useGame((s) => s.scenario.programs.hangul)
```

- [ ] **Step 6: 기존 한글 테스트를 새 자리로 옮긴다**

`test/hangul.test.js` 안의 `scenario.hangul` 세 곳을 `scenario.programs.hangul` 로 바꾼다:

```js
    const setup = scenario.fs['다운로드'].find((f) => f.name === scenario.programs.hangul.setup)
```
```js
    const h = scenario.programs.hangul
```
```js
    expect(approve.reply.join(' ')).toContain(scenario.programs.hangul.setup)
```
```js
    expect(scenario.programs.hangul.missing.lines.join(' ')).toContain('정보보안팀')
    expect(scenario.programs.hangul.blocked.lines.join(' ')).toContain('정보보안팀')
```

- [ ] **Step 7: 전체 테스트를 돌린다**

Run: `npm test -- --run`
Expected: PASS — 기존 272개 + programs.test.js 3개

- [ ] **Step 8: 커밋**

```bash
git add src/scenarios/workday.json src/apps/Installer.jsx src/apps/Hwp.jsx test/hangul.test.js test/programs.test.js
git commit -m "refactor: one wizard for many programs, not just 한글

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 프로그램별 감염과 바로가기

`danger` 프로그램은 설치가 끝나는 순간 PC 를 내리고, 재부팅 뒤 그 프로그램이 가진 `aftermath` 메시지가 온다. `shortcut` 이 있는 프로그램은 설치되면 바탕화면에 아이콘이 생긴다.

**Files:**
- Modify: `src/engine/store.js:190-214` (`crash`, `restart`, `reboot`), 상태에 `crashSource`
- Modify: `src/apps/Installer.jsx`
- Modify: `src/shell/Desktop.jsx`
- Test: `test/programs.test.js`

**Interfaces:**
- Consumes: `scenario.programs` (Task 1)
- Produces: `crash(source)` — `source` 는 프로그램 id 또는 생략(메일 첨부). `installedShortcuts(programs, grants)` → `[{ label, icon, app }]`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/programs.test.js` 끝에 붙인다:

```js
import { afterEach, beforeEach, vi } from 'vitest'
import { installedShortcuts, useGame } from '../src/engine/store.js'

describe('a program that turns out to be malware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ grants: {}, extraMessages: {}, crashed: false, crashSource: null })
  })
  afterEach(() => vi.useRealTimers())

  it('names its own aftermath instead of the phishing mail one', () => {
    for (const [id, p] of programs) {
      if (!p.danger) continue
      expect(p.aftermath.thread, id).toBeTruthy()
      expect(p.aftermath.lines.length, id).toBeGreaterThan(0)
      expect(p.aftermath.from, id).toBeTruthy()
    }
    expect(programs.some(([, p]) => p.danger)).toBe(true)
  })

  it('sends the program its own warning after the reboot', () => {
    const [id, p] = programs.find(([, x]) => x.danger)
    useGame.getState().crash(id)
    expect(useGame.getState().crashed).toBe(true)
    useGame.getState().reboot()
    const said = (useGame.getState().extraMessages[p.aftermath.thread] ?? []).map((m) => m.text)
    expect(said).toEqual(p.aftermath.lines)
    expect(useGame.getState().grants.infected).toBe(true)
  })

  it('still falls back to the phishing aftermath when no program is named', () => {
    useGame.getState().crash()
    useGame.getState().reboot()
    const after = scenario.malware.aftermath
    const said = (useGame.getState().extraMessages[after.thread] ?? []).map((m) => m.text)
    expect(said).toEqual(after.lines)
  })
})

describe('shortcuts a program leaves behind', () => {
  it('shows none before the install and one after', () => {
    const withIcon = programs.find(([, p]) => p.shortcut)
    expect(withIcon, 'no program has a shortcut').toBeTruthy()
    const [id, p] = withIcon
    expect(installedShortcuts(scenario.programs, {})).toEqual([])
    expect(installedShortcuts(scenario.programs, { [p.grant]: true }))
      .toEqual([p.shortcut])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/programs.test.js`
Expected: FAIL — `installedShortcuts is not a function`, 그리고 `no program has a shortcut`

- [ ] **Step 3: store 에 crashSource 와 installedShortcuts 를 더한다**

`src/engine/store.js` 상태 목록에 `crashed: false` 바로 아래를 더한다:

```js
  crashed: false,
  // Which program took the machine down, so the reboot knows who to blame.
  crashSource: null,
```

`crash` / `restart` / `reboot` 를 다음으로 바꾼다:

```js
  // Running a malicious installer takes the machine down. Progress is kept —
  // what is lost is every open window and whatever was on screen in them.
  crash: (source = null) => {
    play('error')
    set({ crashed: true, crashSource: source, toast: null })
  },
  restart: () => set({ crashed: false, crashSource: null, booted: false, windows: [], toast: null, locked: false }),
```

```js
  reboot: () => {
    const s = get()
    const program = s.scenario.programs[s.crashSource]
    const after = program?.aftermath ?? s.scenario.malware.aftermath
    if (!s.grants.infected) {
      after.lines.forEach((text) => s.pushMessage(after.thread, { from: after.from, text }))
      s.grant('infected')
    }
    s.restart()
    setTimeout(() => get().showToast({
      from: after.from, text: after.lines[0],
      app: 'messenger', source: after.source, thread: after.thread
    }), 3200)
  },
```

같은 파일의 순수 헬퍼 구역(`export function siteView` 앞)에 더한다:

```js
// Installing something can leave an icon on the desktop. Which ones are there
// is a question about grants, so the shell never has to keep its own list.
export const installedShortcuts = (programs = {}, grants = {}) =>
  Object.values(programs).filter((p) => p.shortcut && grants[p.grant]).map((p) => p.shortcut)
```

- [ ] **Step 4: Installer 가 danger 프로그램에서 PC 를 내리게 한다**

`src/apps/Installer.jsx` 에서 `crash` 를 꺼내 쓴다. `const close = useGame((s) => s.closeWindow)` 아래에 더한다:

```jsx
  const crash = useGame((s) => s.crash)
```

설치 완료 effect 를 다음으로 바꾼다:

```jsx
  useEffect(() => {
    if (!finished || grants[spec.grant]) return
    if (spec.danger) return crash(file.program)
    grant(spec.grant)
    play('ok')
  }, [finished])
```

- [ ] **Step 5: 바탕화면이 설치된 바로가기를 그리게 한다**

`src/shell/Desktop.jsx` 의 import 와 본문을 고친다:

```jsx
import { installedShortcuts, useGame, fileOpener, fsView } from '../engine/store.js'
```

```jsx
export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const grants = useGame((s) => s.grants)
  const openWindow = useGame((s) => s.openWindow)
  const pinFile = useGame((s) => s.pinFile)
  const restored = useGame((s) => s.restored)
  const desktop = fsView(scenario.fs, { pinned, restored })['바탕화면']
  const work = useFileDrop(pinFile)
  const icons = [...SHORTCUTS, ...installedShortcuts(scenario.programs, grants)]
  return (
    <div className="desktop-icons">
      {icons.map((s) => (
```

(`{SHORTCUTS.map((s) => (` 를 `{icons.map((s) => (` 로 바꾸는 것이 전부다. 나머지는 그대로.)

- [ ] **Step 6: 테스트를 돌린다**

Run: `npm test -- --run test/programs.test.js`
Expected: `still falls back to the phishing aftermath` 는 PASS. `danger` 프로그램과 `shortcut`
프로그램이 아직 하나도 없으므로 `names its own aftermath`·`sends the program its own warning`·
`shows none before the install and one after` 셋은 FAIL. 각각 Task 8(가짜 뷰어)과
Task 4(VPN)에서 데이터가 들어오면 통과한다. 여기서 멈추지 말고 다음 단계로 넘어간다.

- [ ] **Step 7: 커밋**

```bash
git add src/engine/store.js src/apps/Installer.jsx src/shell/Desktop.jsx test/programs.test.js
git commit -m "feat: a program can carry its own aftermath and desktop icon

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 브라우저 다운로드 버튼과 vendor 레이아웃

사이트에서 파일을 내려받는 공용 UI. 회사 홈페이지 한 장짜리 레이아웃 `vendor` 도 같이 만든다 — Task 6(파트너 사이트)과 Task 7(스팸 사이트)이 이걸 쓴다.

**Files:**
- Create: `src/apps/Vendor.jsx`
- Create: `src/apps/Download.jsx`
- Modify: `src/apps/Browser.jsx` (import, `view === 'ready'` 분기)
- Modify: `src/shell/shell.css` (`.dl`, `.vd` 블록)
- Test: `test/programs.test.js`

**Interfaces:**
- Consumes: `restoreFile(id)`, `findFile(fs, fileId)`
- Produces: `<Download item={{ fileId, name, size, label }} />` — 누르면 `restoreFile` + 토스트.
  `<Vendor site={site} />` — `site.vendor = { brand, tagline, theme, lines[], download, notes[] }`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/programs.test.js` 끝에 붙인다:

```js
describe('everything a site offers to download', () => {
  const byId = new Map(allFiles(scenario.fs).map((f) => [f.id, f]))
  const offers = scenario.sites
    .filter((s) => s.vendor?.download)
    .map((s) => ({ where: s.url, item: s.vendor.download }))

  it('offers at least one download somewhere', () => {
    expect(offers.length).toBeGreaterThan(0)
  })

  it('hands out files that exist and stay hidden until saved', () => {
    for (const { where, item } of offers) {
      const file = byId.get(item.fileId)
      expect(file, where).toBeTruthy()
      expect(file.name, where).toBe(item.name)
      expect(file.attached, where).toBe(true)
    }
  })

  it('gives every vendor page something to say', () => {
    for (const s of scenario.sites.filter((x) => x.layout === 'vendor')) {
      expect(s.vendor.brand, s.url).toBeTruthy()
      expect(s.vendor.lines.length, s.url).toBeGreaterThan(0)
      expect(['corp', 'spam']).toContain(s.vendor.theme)
    }
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/programs.test.js`
Expected: FAIL — `offers at least one download somewhere` (vendor 사이트가 아직 없다)

- [ ] **Step 3: 다운로드 버튼을 만든다**

`src/apps/Download.jsx`:

```jsx
import { useGame } from '../engine/store.js'
import { play } from '../shell/sound.js'

// Every download on the web works the same way: the file lands in 다운로드 and
// the button remembers that it did. Which folder it lands in is the file's own
// business — this only flips it from hidden to there.
export default function Download({ item }) {
  const restored = useGame((s) => s.restored)
  const restoreFile = useGame((s) => s.restoreFile)
  const showToast = useGame((s) => s.showToast)
  const saved = Boolean(restored[item.fileId])

  const take = () => {
    if (saved) return
    restoreFile(item.fileId)
    play('ok')
    showToast({ from: '다운로드 완료', text: `${item.name} — 다운로드 폴더에 저장했습니다.`, app: 'explorer' })
  }

  return (
    <div className="dl">
      <div className="dl-mid">
        <span className="dl-name">{item.name}</span>
        {item.size && <span className="dl-size">{item.size}</span>}
      </div>
      <button className="dl-btn" onClick={take} disabled={saved}>
        {saved ? '다운로드 폴더에 저장됨' : (item.label ?? '다운로드')}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: vendor 레이아웃을 만든다**

`src/apps/Vendor.jsx`:

```jsx
import Download from './Download.jsx'

// A one-page company site. The honest ones and the ones that are not look
// nothing alike, so the theme picks the whole skin rather than one accent.
export default function Vendor({ site }) {
  const v = site.vendor
  return (
    <div className={'vd vd-' + v.theme}>
      <header className="vd-top">
        <span className="vd-brand">{v.brand}</span>
        <span className="vd-tag">{v.tagline}</span>
      </header>
      <div className="vd-body">
        {v.lines.map((line, i) => <p key={i} className="vd-line">{line}</p>)}
        {v.download && <Download item={v.download} />}
        {(v.notes ?? []).map((n, i) => <p key={i} className="vd-note">{n}</p>)}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 브라우저가 vendor 를 그리게 한다**

`src/apps/Browser.jsx` 의 import 에 한 줄 더한다:

```jsx
import Vendor from './Vendor.jsx'
```

`view === 'ready'` 분기의 `: site.layout === 'lotto' ? <Lotto site={site} />` 바로 아래에 더한다:

```jsx
              : site.layout === 'vendor' ? <Vendor site={site} />
```

- [ ] **Step 6: 스타일을 더한다**

`src/shell/shell.css` 맨 끝에 붙인다:

```css
/* ── 다운로드 버튼 ─────────────────────────────────────── */
.dl { display: flex; align-items: center; gap: 12px; margin: 18px 0;
      padding: 12px 14px; border: 1px solid #d8dbe0; border-radius: 8px; background: #fbfcfd; }
.dl-mid { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.dl-name { font-size: 13px; font-weight: 600; color: #1b1d21; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-size { font-size: 11px; color: #7b8089; }
.dl-btn { padding: 8px 16px; border: 0; border-radius: 6px; background: #2a6cf0; color: #fff;
          font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.dl-btn:disabled { background: #e6e8ec; color: #8d9299; cursor: default; }

/* ── 거래처·광고 사이트 ─────────────────────────────────── */
.vd { height: 100%; overflow: auto; }
.vd-top { display: flex; align-items: baseline; gap: 12px; padding: 20px 28px; }
.vd-brand { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; }
.vd-tag { font-size: 12px; }
.vd-body { padding: 8px 28px 32px; max-width: 620px; }
.vd-line { font-size: 13.5px; line-height: 1.85; margin: 0 0 10px; }
.vd-note { font-size: 11.5px; color: #7b8089; margin: 6px 0 0; }

.vd-corp { background: #fff; color: #23262b; }
.vd-corp .vd-top { border-bottom: 2px solid #123a7a; }
.vd-corp .vd-brand { color: #123a7a; }
.vd-corp .vd-tag { color: #6b7280; }

.vd-spam { background: #fffbe8; color: #2b2b2b; }
.vd-spam .vd-top { background: linear-gradient(90deg, #ff3d3d, #ff9a00); color: #fff; }
.vd-spam .vd-brand { color: #fff; text-shadow: 0 1px 0 #0004; }
.vd-spam .vd-tag { color: #fff; font-weight: 700; }
.vd-spam .vd-line { font-weight: 600; }
.vd-spam .dl { border: 2px dashed #ff3d3d; background: #fff4f4; }
.vd-spam .dl-btn { background: #e01414; font-size: 14px; padding: 11px 22px; animation: dl-blink 1.1s infinite; }
.vd-spam .dl-btn:disabled { background: #e6e8ec; color: #8d9299; animation: none; }
@keyframes dl-blink { 50% { background: #ff6a3d; } }
```

- [ ] **Step 7: 테스트를 돌린다**

Run: `npm test -- --run`
Expected: `offers at least one download somewhere` 만 FAIL (Task 7 의 파트너 사이트가 첫 vendor 다운로드다). Task 2 의 shortcut·danger 테스트도 아직 FAIL. 그 셋 말고는 전부 PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/apps/Download.jsx src/apps/Vendor.jsx src/apps/Browser.jsx src/shell/shell.css test/programs.test.js
git commit -m "feat: download a file from a site, and a one-page vendor site to do it on

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: VPN — 프로그램·앱·hosts

사내포털 자료실에서 받은 `AR-VPN_Setup.exe` 를 설치하면 바탕화면에 **AR VPN** 이 생기고, hosts 에 `192.168.10.5 vpn.ar.local` 을 적어야 연결된다. 연결되면 세션 ID 가 보인다.

**Files:**
- Modify: `src/scenarios/workday.json` (`programs.vpn`, `hosts.required`, `vpn` 블록, `다운로드` 폴더 파일 셋)
- Create: `src/apps/Vpn.jsx`
- Create: `src/icons/vpn.svg`
- Modify: `src/icons/Icon.jsx`
- Modify: `src/apps/registry.jsx`
- Modify: `src/engine/store.js` (상태 `vpn`, `setVpn`, PROGRESS, `restart`)
- Test: `test/vpn.test.js` (신규)

**Interfaces:**
- Consumes: `hostResolves(scenario, edits, url)`, `installedShortcuts` (Task 2), `Download` (Task 3)
- Produces: store `vpn: boolean`, `setVpn(on)`. `scenario.vpn = { server, ip, session, connecting, notFound }`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/vpn.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, findFile, hostResolves, useGame } from '../src/engine/store.js'

const HOSTS = findFile(scenario.fs, scenario.hosts.file)
const files = allFiles(scenario.fs)
const line = `${scenario.hosts.required['vpn.ar.local']} vpn.ar.local`

describe('the VPN client', () => {
  it('will not connect until hosts knows the server', () => {
    expect(hostResolves(scenario, {}, 'vpn.ar.local')).toBe(false)
    expect(hostResolves(scenario, { [HOSTS.id]: `${HOSTS.content}\n${line}` }, 'vpn.ar.local')).toBe(true)
  })

  it('refuses an address that is close but wrong', () => {
    const wrong = { [HOSTS.id]: `${HOSTS.content}\n192.168.10.6 vpn.ar.local` }
    expect(hostResolves(scenario, wrong, 'vpn.ar.local')).toBe(false)
  })

  it('keeps the session id out of everything written down in advance', () => {
    const threads = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads))
    const beats = scenario.days.flatMap((d) => [d.opening, ...(d.asks ?? [])].filter(Boolean))
    const said = beats.flatMap((b) => b.lines ?? [])
    const hints = beats.flatMap((b) => (b.ask?.no ?? []).flat())
    const written = JSON.stringify({
      threads, said, hints, files, sites: scenario.sites, news: scenario.news, qna: scenario.qna
    })
    expect(written).not.toContain(scenario.vpn.session)
  })

  it('puts the hosts line in the guide, where a stuck player can find it', () => {
    const guide = files.find((f) => f.id === 'file_vpn_guide')
    expect(guide).toBeTruthy()
    expect(guide.content).toContain(scenario.hosts.required['vpn.ar.local'])
    expect(guide.content).toContain('vpn.ar.local')
  })
})

describe('the VPN switch', () => {
  beforeEach(() => useGame.setState({ vpn: false }))

  it('turns on and off, and a restart drops it', () => {
    useGame.getState().setVpn(true)
    expect(useGame.getState().vpn).toBe(true)
    useGame.getState().restart()
    expect(useGame.getState().vpn).toBe(false)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/vpn.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'session')`

- [ ] **Step 3: 시나리오에 VPN 데이터를 넣는다**

`src/scenarios/workday.json` 최상위 `"hosts"` 를 다음으로 바꾼다:

```json
  "hosts": {
    "file": "file_hosts",
    "required": {
      "drive.ar.local": "192.168.10.21",
      "vpn.ar.local": "192.168.10.5"
    }
  },
```

최상위에 `"vpn"` 블록을 더한다(`"hosts"` 바로 뒤):

```json
  "vpn": {
    "server": "vpn.ar.local",
    "account": "hb.kim@ar.co.kr",
    "ip": "10.8.0.23",
    "session": "ARV-7K3Q-92XF",
    "connecting": "사내망에 연결하는 중…",
    "notFound": "서버 vpn.ar.local 을(를) 찾을 수 없습니다. (DNS 이름을 확인할 수 없음)"
  },
```

`programs` 에 `vpn` 을 더한다:

```json
    "vpn": {
      "product": "AR 사내망 VPN 클라이언트",
      "publisher": "AR 주식회사 정보전략팀",
      "version": "3.1.0",
      "size": "42MB",
      "setup": "AR-VPN_Setup.exe",
      "grant": "vpnInstalled",
      "shortcut": { "label": "AR VPN", "icon": "vpn", "app": "vpn" },
      "intro": [
        "이 마법사를 통해 AR 사내망 VPN 클라이언트를 설치합니다.",
        "계속하려면 [설치]를 클릭하십시오."
      ],
      "steps": [
        "설치 준비 중…",
        "가상 네트워크 어댑터를 등록하는 중…",
        "인증서를 배포하는 중…",
        "바로가기를 만드는 중…",
        "설치를 마무리하는 중…"
      ],
      "done": {
        "title": "설치가 완료되었습니다",
        "lines": [
          "AR 사내망 VPN 클라이언트 설치가 완료되었습니다.",
          "바탕화면의 'AR VPN' 에서 연결할 수 있습니다."
        ]
      },
      "already": {
        "title": "이미 설치되어 있습니다",
        "lines": ["AR 사내망 VPN 클라이언트가 이미 설치되어 있습니다."]
      }
    },
```

`다운로드` 폴더 배열에 파일 셋을 더한다(전부 `attached: true`):

```json
      {
        "id": "file_vpn_setup",
        "name": "AR-VPN_Setup.exe",
        "program": "vpn",
        "attached": true,
        "content": "AR 사내망 VPN 클라이언트 설치 파일 (정보전략팀 배포본)"
      },
      {
        "id": "file_vpn_guide",
        "name": "AR-VPN_설치안내.pdf",
        "attached": true,
        "content": "AR 사내망 VPN 접속 안내\n\n정보전략팀 · 2026-08-20 개정\n\n1. 자료실에서 AR-VPN_Setup.exe 를 내려받아 실행합니다.\n2. 설치가 끝나면 바탕화면에 'AR VPN' 아이콘이 생깁니다.\n3. 아이콘을 실행하고 [연결] 을 누릅니다.\n4. 연결되면 창에 표시되는 세션 ID 를 정보보안팀에 알려 주십시오.\n\n[문제 해결]\n※ 사내 배포 PC 일부에서 vpn.ar.local 이름 해석이 되지 않는 경우가 확인되었습니다.\n   이 경우 hosts 파일(C:\\Windows\\System32\\drivers\\etc\\hosts)에 아래 한 줄을 추가하십시오.\n\n   192.168.10.5    vpn.ar.local\n\n※ 세션 ID 는 접속할 때마다 새로 발급되므로 문서에 적어두지 마십시오."
      },
      {
        "id": "file_pledge",
        "name": "보안서약서_양식.hwp",
        "attached": true,
        "content": "[정보보안 서약서]\n\n본인은 AR 주식회사의 정보자산을 업무 목적으로만 사용하며,\n사내 자료를 외부로 반출하지 않을 것을 서약합니다.\n\n소속: ______________\n성명: ______________  (서명)\n일자: 2026년 ____월 ____일\n\n※ 본 양식은 신규 입사자 및 보직 변경자에 한해 제출합니다."
      },
```

- [ ] **Step 4: store 에 vpn 상태를 더한다**

`src/engine/store.js` 의 PROGRESS 배열 끝에 `'vpn'` 을 더한다:

```js
  'day', 'misses', 'failed', 'scratch', 'ended', 'locks', 'overtime', 'slips', 'edits', 'drawn', 'vpn']
```

상태에 더한다(`edits` 근처):

```js
  // The VPN tunnel. Kept across a save, dropped by a restart the way a real one is.
  vpn: restored?.vpn ?? false,
```

액션을 더한다(`unlockSite` 위):

```js
  setVpn: (on) => set({ vpn: on }),
```

`restart` 를 고친다(Task 2 에서 고친 줄에 `vpn: false` 를 더한다):

```js
  restart: () => set({ crashed: false, crashSource: null, booted: false, windows: [], toast: null, locked: false, vpn: false }),
```

- [ ] **Step 5: 테스트를 돌린다**

Run: `npm test -- --run test/vpn.test.js`
Expected: PASS (5개)

- [ ] **Step 6: VPN 앱을 만든다**

`src/icons/vpn.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#1f5aa8" d="M16 2.5 5 6.5v9.2c0 6.6 4.5 12 11 13.8 6.5-1.8 11-7.2 11-13.8V6.5z"/><path fill="#3b82f6" d="M16 5.2 7.6 8.2v7.5c0 5.2 3.5 9.5 8.4 11z"/><path fill="#fff" d="M13.4 14.2v-2.1a2.6 2.6 0 0 1 5.2 0v2.1h.9v6h-7v-6zm1.8 0h1.6v-2.1a.8.8 0 0 0-1.6 0z"/></svg>
```

`src/icons/Icon.jsx` — import 와 `SRC` 에 더한다:

```jsx
import trophy from './trophy.svg'
import vpn from './vpn.svg'
import workchat from './workchat.svg'
```
```jsx
const SRC = { chat, cmd, doc, folder, globe, hwp, image, mail, notepad, pdf, phone, ppt, trash, trophy, vpn, workchat, xls }
```

`src/apps/Vpn.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useGame, hostResolves } from '../engine/store.js'
import { play } from '../shell/sound.js'

// The client only knows how to dial a name. Whether that name means anything
// is the hosts file's business, so a broken tunnel looks like DNS, not like
// a wrong password.
export default function Vpn() {
  const scenario = useGame((s) => s.scenario)
  const edits = useGame((s) => s.edits)
  const connected = useGame((s) => s.vpn)
  const setVpn = useGame((s) => s.setVpn)
  const v = scenario.vpn
  const [dialing, setDialing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dialing) return
    const t = setTimeout(() => {
      setDialing(false)
      setVpn(true)
      play('ok')
    }, 1800)
    return () => clearTimeout(t)
  }, [dialing])

  const connect = () => {
    if (!hostResolves(scenario, edits, v.server)) {
      play('error')
      return setError(v.notFound)
    }
    setError('')
    setDialing(true)
  }
  const drop = () => {
    setVpn(false)
    play('click')
  }

  const state = connected ? '연결됨' : dialing ? '연결 중' : '연결 안 됨'

  return (
    <div className="vp">
      <div className="vp-head">
        <span className={'vp-dot ' + (connected ? 'on' : dialing ? 'busy' : 'off')} />
        <span className="vp-state">{state}</span>
      </div>

      <dl className="vp-meta">
        <div><dt>서버</dt><dd>{v.server}</dd></div>
        <div><dt>계정</dt><dd>{v.account}</dd></div>
        {connected && <div><dt>할당 IP</dt><dd>{v.ip}</dd></div>}
        {connected && <div><dt>세션 ID</dt><dd className="vp-session">{v.session}</dd></div>}
      </dl>

      {dialing && <p className="vp-busy">{v.connecting}</p>}
      {error && <p className="vp-err">{error}</p>}

      <div className="vp-foot">
        {connected
          ? <button className="sm-cancel" onClick={drop}>연결 끊기</button>
          : <button className="btn-primary" onClick={connect} disabled={dialing}>연결</button>}
      </div>
    </div>
  )
}
```

`src/apps/registry.jsx` — import 와 `APPS` 에 더한다:

```jsx
import Vpn from './Vpn.jsx'
```
```jsx
  vpn: { title: 'AR VPN', icon: 'vpn', comp: Vpn, w: 400, h: 330, theme: '#1f5aa8' },
```

`src/shell/shell.css` 끝에 더한다:

```css
/* ── VPN 클라이언트 ─────────────────────────────────────── */
.vp { height: 100%; display: flex; flex-direction: column; gap: 14px; padding: 20px 22px; background: #f6f7f9; }
.vp-head { display: flex; align-items: center; gap: 9px; }
.vp-dot { width: 10px; height: 10px; border-radius: 50%; }
.vp-dot.on { background: #16a34a; box-shadow: 0 0 0 3px #16a34a22; }
.vp-dot.busy { background: #f59e0b; }
.vp-dot.off { background: #b6bac1; }
.vp-state { font-size: 14px; font-weight: 700; color: #1b1d21; }
.vp-meta { margin: 0; font-size: 12.5px; }
.vp-meta > div { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid #e6e8ec; }
.vp-meta dt { width: 66px; color: #7b8089; }
.vp-meta dd { margin: 0; color: #23262b; }
.vp-session { font-family: Consolas, monospace; font-weight: 700; letter-spacing: 0.4px; }
.vp-busy { font-size: 12px; color: #7b8089; margin: 0; }
.vp-err { font-size: 12px; color: #c02626; line-height: 1.6; margin: 0; }
.vp-foot { margin-top: auto; display: flex; justify-content: flex-end; }
```

- [ ] **Step 7: 전체 테스트를 돌린다**

Run: `npm test -- --run`
Expected: `test/programs.test.js` 의 shortcut 테스트가 이제 PASS. `offers at least one download` (Task 7 대기) 와 danger 둘 (Task 8 대기) 만 FAIL.

- [ ] **Step 8: 커밋**

```bash
git add src/scenarios/workday.json src/engine/store.js src/apps/Vpn.jsx src/apps/registry.jsx src/icons/vpn.svg src/icons/Icon.jsx src/shell/shell.css test/vpn.test.js
git commit -m "feat: a VPN client that dials a name hosts has to know

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 사내포털 자료실과 둘째 날 요청

포털에 자료실 패널을 붙이고, 둘째 날 정보보안팀이 VPN 세션 ID 를 묻는다. 셋째 날 드라이브는 VPN 을 켜야 열린다.

**Files:**
- Modify: `src/scenarios/workday.json` (`sites[portal].portal` 에 `files`, `days[1].requests`·`asks`, `pool.fixed`, `objectives`, `drive.ar.local` 에 `requiresVpn`, 셋째 날 정보보안팀 대사)
- Modify: `src/apps/Portal.jsx`
- Modify: `src/engine/store.js` (`siteView` 에 `vpn`)
- Modify: `src/apps/Browser.jsx` (`siteView` 호출, `view === 'vpn'` 화면)
- Modify: `src/shell/shell.css`
- Test: `test/vpn.test.js`

**Interfaces:**
- Consumes: `Download` (Task 3), store `vpn` (Task 4)
- Produces: `siteView(site, { grants, unlocked, resolves, vpn })` → `'blocked' | 'vpn' | 'error' | 'login' | 'ready'`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/vpn.test.js` 끝에 붙인다:

```js
import { siteView } from '../src/engine/store.js'

const site = (url) => scenario.sites.find((s) => s.url === url)
const hostsWith = (...lines) => ({ [HOSTS.id]: [HOSTS.content, ...lines].join('\n') })

describe('the drive behind the tunnel', () => {
  const drive = () => site('drive.ar.local')
  const ok = hostsWith('192.168.10.21 drive.ar.local')

  it('asks for the VPN before it complains about the name', () => {
    expect(siteView(drive(), { grants: {}, unlocked: {}, resolves: true, vpn: false })).toBe('vpn')
  })

  it('opens once the tunnel is up and the name resolves', () => {
    expect(hostResolves(scenario, ok, 'drive.ar.local')).toBe(true)
    expect(siteView(drive(), { grants: {}, unlocked: {}, resolves: true, vpn: true })).toBe('ready')
  })

  it('still fails on the name when the tunnel is up but hosts is empty', () => {
    expect(siteView(drive(), { grants: {}, unlocked: {}, resolves: false, vpn: true })).toBe('error')
  })

  it('leaves the anonymous room outside the tunnel', () => {
    expect(siteView(site('sotong.ar.local'), { grants: {}, unlocked: {}, resolves: true, vpn: false }))
      .toBe('ready')
  })
})

describe('the day that asks for a session id', () => {
  const day = scenario.days.find((d) => d.requests.includes('vpn'))

  it('is the second day, and its core matches the pool', () => {
    expect(day.n).toBe(2)
    expect([...day.requests].sort()).toEqual([...scenario.pool.fixed[2]].sort())
  })

  it('accepts the session id and nothing else', () => {
    const beat = day.asks.find((a) => a.thread === 'security')
    expect(beat.ask.grants).toBe('vpn')
    expect(beat.ask.accept).toEqual([scenario.vpn.session])
    expect(beat.ask.no.length).toBeGreaterThan(2)
  })

  it('has an objective the progress list can show', () => {
    expect(scenario.objectives.find((o) => o.id === 'vpn').grant).toBe('vpn')
  })

  it('puts the installer in the portal 자료실, not in the folder tree', () => {
    const shelf = site('portal.ar.co.kr').files
    expect(shelf.some((f) => f.download.fileId === 'file_vpn_setup')).toBe(true)
    for (const f of shelf) {
      const file = files.find((x) => x.id === f.download.fileId)
      expect(file, f.download.fileId).toBeTruthy()
      expect(file.attached, f.download.fileId).toBe(true)
    }
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/vpn.test.js`
Expected: FAIL — `expected 'ready' to be 'vpn'`

- [ ] **Step 3: siteView 에 vpn 게이트를 더한다**

`src/engine/store.js` 의 `siteView` 를 다음으로 바꾼다:

```js
// Exactly one state per visited site: no tunnel means no name, no approval
// means no login form, no login means no content. Returning a single value
// keeps them mutually exclusive.
export function siteView(site, { grants, unlocked, resolves = true, vpn = false }) {
  if (!site) return 'error'
  if (site.requiresIp && !grants.ip) return 'blocked'
  if (site.requiresVpn && !vpn) return 'vpn'
  if (site.requiresHost && !resolves) return 'error'
  if (site.login && !unlocked[site.url]) return 'login'
  return 'ready'
}
```

- [ ] **Step 4: 브라우저가 vpn 화면을 그리게 한다**

`src/apps/Browser.jsx` 에서 store 값을 하나 더 꺼낸다. `const edits = useGame(...)` 근처에 더한다:

```jsx
  const vpn = useGame((s) => s.vpn)
```

`siteView` 호출을 고친다:

```jsx
  const view = page.kind === 'site'
    ? siteView(site, {
      grants, unlocked, vpn,
      resolves: !site?.requiresHost || hostResolves(scenario, edits, site.url)
    })
    : null
```

`{view === 'blocked' && (` 블록 바로 위에 더한다:

```jsx
        {view === 'vpn' && (
          <div className="blk">
            <div className="blk-card">
              <Lock size={30} strokeWidth={1.6} />
              <h2>사내망 전용 페이지입니다</h2>
              <p>
                이 페이지는 사내망에서만 열람할 수 있습니다.<br />
                VPN 에 연결한 뒤 다시 시도해 주세요.
              </p>
              <div className="blk-help">바탕화면의 <b>AR VPN</b> 에서 연결할 수 있습니다.</div>
              <div className="blk-code">AR-NET-511 · {site.url}</div>
            </div>
          </div>
        )}
```

- [ ] **Step 5: 포털에 자료실을 붙인다**

`portal.ar.co.kr` 사이트 항목에 최상위 키 `"files"` 를 하나 더한다. `site.portal` 은 **객체**이고
`Portal.jsx` 가 `{ ...site.portal, ...today }` 로 펼쳐 쓰므로, 자료실 데이터를 그 안에 넣으면 안 된다.
`site.portal` 은 손대지 않는다 — 자료실을 그릴지 말지는 컴포넌트의 `{site.files && …}` 가 정한다.
즉 사이트 항목이 다음처럼 된다:

```json
    {
      "url": "portal.ar.co.kr",
      "title": "AR 포털",
      "layout": "portal",
      "portal": { …지금 파일에 있는 portal 객체를 그대로… },
      "files": [
        {
          "desc": "사내망 VPN 클라이언트 설치 파일입니다. 8/31 부터 사내 시스템은 VPN 접속만 허용됩니다.",
          "download": { "fileId": "file_vpn_setup", "name": "AR-VPN_Setup.exe", "size": "42MB" }
        },
        {
          "desc": "설치 순서와 문제 해결 방법이 정리되어 있습니다. 연결이 안 되면 마지막 장을 보세요.",
          "download": { "fileId": "file_vpn_guide", "name": "AR-VPN_설치안내.pdf", "size": "0.4MB" }
        },
        {
          "desc": "신규 입사자 및 보직 변경자 제출용 양식입니다.",
          "download": { "fileId": "file_pledge", "name": "보안서약서_양식.hwp", "size": "88KB" }
        }
      ],
      "login": { …지금 파일에 있는 login 블록을 그대로… },
      "requiresIp": true
    },
```

`src/apps/Portal.jsx` — import 에 `Download` 를 더한다:

```jsx
import Download from './Download.jsx'
```

`<Panel title="사내 소식">` 블록 바로 **아래**(같은 `<main>` 안)에 더한다:

```jsx
          {site.files && (
            <Panel title="자료실" more="전체보기">
              {site.files.map((f) => (
                <div key={f.download.fileId} className="pt-file">
                  <p className="pt-file-desc">{f.desc}</p>
                  <Download item={f.download} />
                </div>
              ))}
            </Panel>
          )}
```

`src/shell/shell.css` 끝에 더한다:

```css
.pt-file { padding: 4px 0 2px; }
.pt-file + .pt-file { border-top: 1px solid #eceef1; margin-top: 6px; }
.pt-file-desc { font-size: 12px; color: #5d626b; line-height: 1.6; margin: 8px 0 0; }
.pt-file .dl { margin: 8px 0 4px; }
```

- [ ] **Step 6: 둘째 날 요청을 넣는다**

`objectives` 배열에 더한다:

```json
    { "id": "vpn", "title": "정보보안팀에 VPN 세션 ID 알려주기", "grant": "vpn" },
```

`days[1].requests` 를 다음으로 바꾼다:

```json
      "requests": ["quote_b", "address", "pub", "booking", "gyul", "deadline", "vpn"],
```

`pool.fixed["2"]` 를 똑같이 바꾼다:

```json
    "2": ["quote_b", "address", "pub", "booking", "gyul", "deadline", "vpn"],
```

`days[1].asks` 배열 끝에 정보보안팀 beat 를 더한다:

```json
    {
      "source": "workMessenger",
      "thread": "security",
      "from": "정보보안팀",
      "lines": [
        "김한별 대리님, 안내드릴 것이 있습니다.",
        "8/31 부터 사내 시스템 접속이 VPN 필수로 전환됩니다. 대리님 계정은 아직 전환 전이라 미리 준비해 주셔야 합니다.",
        "사내 포털 > 자료실 에 VPN 클라이언트를 올려두었습니다. 내려받아 설치해 주세요.",
        "설치 권한은 승인해 두었으니 바로 실행하시면 됩니다.",
        "연결이 되면 클라이언트 창에 세션 ID 가 뜹니다. 그 번호를 알려 주시면 전환 처리하겠습니다."
      ],
      "ask": {
        "placeholder": "VPN 세션 ID를 입력해 주세요",
        "accept": ["ARV-7K3Q-92XF"],
        "grants": "vpn",
        "ok": [
          "확인했습니다. 전환 처리해 두겠습니다.",
          "이제 사내 시스템은 VPN 을 켜신 상태에서 접속해 주세요."
        ],
        "no": [
          [
            "그 번호는 저희 쪽 기록과 다릅니다.",
            "클라이언트 창에 표시된 세션 ID 를 그대로 보내주세요."
          ],
          [
            "설치는 하셨나요? 사내 포털 > 자료실 에 AR-VPN_Setup.exe 가 있습니다.",
            "설치하면 바탕화면에 AR VPN 아이콘이 생깁니다."
          ],
          [
            "연결할 때 서버를 못 찾는다고 나오면 이름 등록이 빠진 겁니다.",
            "자료실의 설치안내 PDF 마지막 장, 문제 해결 항목을 그대로 따라 해보세요."
          ],
          [
            "메모장으로 C:\\Windows\\System32\\drivers\\etc\\hosts 를 열어 안내서에 적힌 한 줄을 추가하고 저장하시면 됩니다.",
            "그 다음 AR VPN 에서 다시 [연결] 을 눌러 주세요."
          ]
        ],
        "next": []
      }
    }
```

- [ ] **Step 7: 셋째 날 드라이브를 VPN 뒤로 옮긴다**

`sites` 의 `drive.ar.local` 항목에 한 줄 더한다:

```json
      "requiresVpn": true,
```

`days[2].asks` 의 정보보안팀 beat `lines` 마지막 줄을 다음으로 바꾼다:

```json
        "등록되면 VPN 을 켜신 상태에서 브라우저로 열립니다. 열리는지 확인만 해주시면 됩니다."
```

- [ ] **Step 8: 테스트를 돌린다**

Run: `npm test -- --run`
Expected: `test/vpn.test.js` 전부 PASS. `test/programs.test.js` 의 `offers at least one download` 와 danger 두 개만 FAIL (각각 Task 7·8 에서 통과한다).

- [ ] **Step 9: 커밋**

```bash
git add src/scenarios/workday.json src/apps/Portal.jsx src/apps/Browser.jsx src/engine/store.js src/shell/shell.css test/vpn.test.js
git commit -m "feat: 자료실, a session id to report, and the drive behind the tunnel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 정부25 보안 프로그램

발급 카드를 누르면 본인확인 전에 키보드 보안 프로그램을 설치하라고 막는다.

**Files:**
- Modify: `src/scenarios/workday.json` (`programs.anysign`, `gov.security`, `다운로드` 파일, 셋째 날 회계팀 힌트)
- Modify: `src/apps/Gov.jsx`
- Modify: `src/shell/shell.css`
- Test: `test/gov.test.js`

**Interfaces:**
- Consumes: `Download` (Task 3), `programs` (Task 1)
- Produces: `site.gov.security = { title, lines[], download{fileId,name,size}, recheck, notReady }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/gov.test.js` 끝의 `describe` 안에 붙인다(파일 맨 끝, 마지막 `})` 앞):

```js
  it('makes you install the keyboard security program first', () => {
    const gov = scenario.sites.find((s) => s.url === 'gov25.go.kr').gov
    expect(gov.security.download.fileId).toBe('file_anysign')
    expect(gov.security.download.name).toBe(scenario.programs.anysign.setup)
    expect(gov.security.lines.length).toBeGreaterThan(0)
    expect(gov.security.recheck).toBeTruthy()
    expect(gov.security.notReady).toBeTruthy()
  })

  it('hides that installer until the site hands it over', () => {
    const setup = allFiles(scenario.fs).find((f) => f.id === 'file_anysign')
    expect(setup).toBeTruthy()
    expect(setup.attached).toBe(true)
    expect(setup.program).toBe('anysign')
  })
```

`test/gov.test.js` 상단 import 에 `allFiles` 가 없으면 더한다:

```js
import { allFiles, codeFits, fileOpener, fsView, siteView, useGame } from '../src/engine/store.js'
```

(이미 import 되어 있는 이름은 중복해서 쓰지 않는다 — 기존 import 줄을 확인하고 빠진 것만 더한다.)

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/gov.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'download')`

- [ ] **Step 3: 시나리오에 anysign 을 더한다**

`programs` 에 더한다:

```json
    "anysign": {
      "product": "AnySign4PC 키보드보안",
      "publisher": "한국전자인증",
      "version": "4.2.1.9",
      "size": "18MB",
      "setup": "AnySign4PC_Setup.exe",
      "grant": "anysign",
      "intro": [
        "이 마법사를 통해 AnySign4PC 키보드보안을(를) 설치합니다.",
        "계속하려면 [설치]를 클릭하십시오."
      ],
      "steps": [
        "설치 준비 중…",
        "보안 모듈을 등록하는 중…",
        "브라우저 확장을 구성하는 중…",
        "설치를 마무리하는 중…"
      ],
      "done": {
        "title": "설치가 완료되었습니다",
        "lines": [
          "AnySign4PC 키보드보안 설치가 완료되었습니다.",
          "정부25 화면으로 돌아가 [설치 확인] 을 눌러 주세요."
        ]
      },
      "already": {
        "title": "이미 설치되어 있습니다",
        "lines": ["AnySign4PC 키보드보안이(가) 이미 설치되어 있습니다."]
      }
    },
```

`다운로드` 폴더에 더한다:

```json
      {
        "id": "file_anysign",
        "name": "AnySign4PC_Setup.exe",
        "program": "anysign",
        "attached": true,
        "content": "AnySign4PC 키보드보안 설치 파일 (한국전자인증)"
      },
```

`gov25.go.kr` 사이트의 `gov` 객체에 `security` 를 더한다(`verify` 옆):

```json
        "security": {
          "title": "보안 프로그램 설치 필요",
          "lines": [
            "안전한 본인확인을 위해 키보드보안 프로그램 설치가 필요합니다.",
            "아래 파일을 내려받아 설치한 뒤 [설치 확인] 을 눌러 주세요.",
            "설치 파일은 다운로드 폴더에 저장됩니다."
          ],
          "recheck": "설치 확인",
          "notReady": "보안 프로그램이 아직 설치되지 않았습니다. 내려받은 파일을 실행해 설치를 완료해 주세요.",
          "download": { "fileId": "file_anysign", "name": "AnySign4PC_Setup.exe", "size": "18MB" }
        },
```

- [ ] **Step 4: Gov 가 보안 게이트를 그리게 한다**

`src/apps/Gov.jsx` — import 에 더한다:

```jsx
import Download from './Download.jsx'
```

store 값과 로컬 상태를 더한다(`const sendCode = ...` 아래):

```jsx
  const anysign = useGame((s) => Boolean(s.grants.anysign))
  const [secErr, setSecErr] = useState('')
```

`step` 계산과 `pick` / `home` 사이에 게이트 조건을 더한다. 다음 세 줄을 `const step = ...` 바로 아래에 넣는다:

```jsx
  // The real thing makes you install a plugin before it will take your name.
  const gate = Boolean(service) && !verified && !anysign
```

`pick` 과 `home` 을 고친다:

```jsx
  const pick = (svc) => {
    setService(svc)
    setError('')
    setSecErr('')
  }
  const home = () => {
    setService(null)
    setError('')
    setSecErr('')
  }
```

`{service && !verified && (` 블록의 조건을 `{service && !verified && !gate && (` 로 바꾸고, 그 블록 **바로 위**에 보안 화면을 더한다:

```jsx
      {gate && (
        <div className="gov-panel">
          <h2>{gov.security.title}</h2>
          {gov.security.lines.map((line) => <p key={line} className="gov-sub">{line}</p>)}
          <Download item={gov.security.download} />
          <button className="gov-btn wide primary"
                  onClick={() => setSecErr(gov.security.notReady)}>
            {gov.security.recheck}
          </button>
          {secErr && <p className="pw-error">{secErr}</p>}
          <button className="gov-back" onClick={home}>← 민원 목록으로</button>
        </div>
      )}
```

`gate` 가 `anysign` 을 보고 있으므로 설치가 끝나면 이 화면은 저절로 사라지고 본인확인이 나온다. `[설치 확인]` 은 아직 안 깔렸을 때만 메시지를 남기면 된다.

`gov-steps` 의 단계 표시도 게이트를 반영한다. `const step = !service ? 0 : verified ? 2 : 1` 은 그대로 둔다 — 보안 설치는 본인확인 단계 안의 일이다.

- [ ] **Step 5: 회계팀 힌트에 한 줄 더한다**

`src/scenarios/workday.json` 의 셋째 날 회계팀 beat 에서 `ask.no` 두 번째 힌트 배열 끝에 다음 문자열을 더한다(기존 줄은 그대로 두고 배열에 항목 하나 추가):

```json
            "보안 프로그램 깔라고 뜨면 안내대로 설치하셔야 다음으로 넘어갑니다."
```

찾는 법: `grep -n '"grants": "insurance"' src/scenarios/workday.json` 으로 해당 ask 를 찾고 그 안의 `"no"` 배열 두 번째 원소에 넣는다.

- [ ] **Step 6: 테스트를 돌린다**

Run: `npm test -- --run test/gov.test.js`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/scenarios/workday.json src/apps/Gov.jsx test/gov.test.js
git commit -m "feat: 정부25 wants a keyboard security plugin first

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 거래처 전용 뷰어

넷째 날 D유통 메일에 `.dcx` 첨부가 붙는다. 품의번호가 그 안에만 있고, 파일은 파트너 사이트에서 받은 뷰어를 설치해야 열린다.

**Files:**
- Modify: `src/scenarios/workday.json` (`programs.dviewer`, `file_d_terms`, `file_dyviewer`, `partner.dyutong.co.kr`, `days[3].mails[0].attach`, `days[3].goal`)
- Modify: `src/engine/store.js` (`fileOpener` 에 `.dcx`)
- Create: `src/apps/Dcx.jsx`
- Modify: `src/apps/registry.jsx`
- Modify: `src/shell/shell.css`
- Test: `test/dcx.test.js` (신규)

**Interfaces:**
- Consumes: `Vendor` (Task 3), `programs` (Task 1)
- Produces: `fileOpener(file)` 가 `.dcx` 에 `{ app: 'dcx', icon: 'doc' }` 를 돌려준다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/dcx.test.js`:

```js
import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener, goalFor, searchSites } from '../src/engine/store.js'

const files = allFiles(scenario.fs)
const terms = files.find((f) => f.id === 'file_d_terms')
const goal = goalFor(scenario, 4)
const APPROVAL = 'DY-PR-260826'

describe('the partner document', () => {
  it('opens in its own viewer, not in 메모장', () => {
    expect(terms).toBeTruthy()
    expect(terms.name.endsWith('.dcx')).toBe(true)
    expect(fileOpener(terms).app).toBe('dcx')
  })

  it('arrives as an attachment on the D유통 mail', () => {
    const mail = scenario.days[3].mails[0]
    expect(mail.attach.fileId).toBe('file_d_terms')
    expect(mail.attach.name).toBe(terms.name)
    expect(terms.attached).toBe(true)
  })

  it('is the only place the approval number is written', () => {
    expect(terms.content).toContain(APPROVAL)
    const elsewhere = JSON.stringify({
      ...scenario,
      fs: allFiles(scenario.fs).filter((f) => f.id !== 'file_d_terms')
    })
    expect(elsewhere).not.toContain(APPROVAL)
  })

  it('is what the day asks you to quote back', () => {
    expect(goal.requiredKeywords).toContain(APPROVAL)
    expect(goal.requiredKeywords).toContain('2,070,000')
  })
})

describe('the viewer that opens it', () => {
  const partner = scenario.sites.find((s) => s.url === 'partner.dyutong.co.kr')

  it('is handed out by the partner site, which you can find by searching', () => {
    expect(partner.layout).toBe('vendor')
    expect(partner.vendor.download.fileId).toBe('file_dyviewer')
    expect(searchSites(scenario.sites, 'D유통').map((s) => s.url)).toContain(partner.url)
  })

  it('is a program with a grant of its own', () => {
    const p = scenario.programs.dviewer
    expect(p.setup).toBe(partner.vendor.download.name)
    expect(p.grant).toBe('dviewer')
    expect(p.missing.lines.join(' ')).toContain(partner.url)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/dcx.test.js`
Expected: FAIL — `expected undefined to be truthy` (`file_d_terms` 가 없다)

- [ ] **Step 3: fileOpener 에 .dcx 를 더한다**

`src/engine/store.js` 의 `fileOpener` 를 고친다. `.pdf` 줄 다음에 한 단계를 더한다:

```js
export const fileOpener = (file) =>
  file.image ? { app: 'viewer', icon: 'image' }
    : file.name.endsWith('.exe') ? { app: 'installer', icon: 'cmd' }
      : file.name.endsWith('.xlsx') ? { app: 'sheet', icon: 'xls' }
      : file.name.endsWith('.pptx') ? { app: 'slides', icon: 'ppt' }
        : file.name.endsWith('.hwp') ? { app: 'hwp', icon: 'hwp' }
          : file.name.endsWith('.pdf') ? { app: 'pdf', icon: 'pdf' }
            : file.name.endsWith('.dcx') ? { app: 'dcx', icon: 'doc' }
              : { app: 'notepad', icon: 'doc' }
```

- [ ] **Step 4: 시나리오에 파일·프로그램·사이트를 더한다**

`다운로드` 폴더에 더한다:

```json
      {
        "id": "file_d_terms",
        "name": "D유통_거래조건서.dcx",
        "attached": true,
        "content": "[D유통 거래 재개 조건서]\n\n수신: AR 주식회사 영업1팀 김한별 대리\n발신: D유통 구매팀 윤서아\n\n1. 품목 : 무선 바코드 스캐너 BS-200\n2. 수량 : 60대\n3. 납품처 : D유통 신규 물류센터 (경기 이천)\n4. 결제 : 납품 후 30일 이내 현금\n5. 사내 품의번호 : DY-PR-260826\n\n※ 회신 메일 본문에 위 품의번호를 반드시 기재해 주십시오.\n   품의번호가 없는 견적서는 내부 결재 상신이 불가합니다.\n\n※ 본 문서는 D유통 파트너 전용 형식(.dcx)입니다."
      },
      {
        "id": "file_dyviewer",
        "name": "DYViewer_Setup.exe",
        "program": "dviewer",
        "attached": true,
        "content": "D유통 파트너 문서 뷰어 설치 파일"
      },
```

`programs` 에 더한다:

```json
    "dviewer": {
      "product": "DY Viewer 파트너 문서 뷰어",
      "publisher": "D유통 정보시스템팀",
      "version": "2.4.0",
      "size": "26MB",
      "setup": "DYViewer_Setup.exe",
      "grant": "dviewer",
      "missing": {
        "title": "이 문서를 열 수 없습니다",
        "lines": [
          "D유통 파트너 전용 형식(.dcx) 문서입니다.",
          "이 형식은 D유통에서 배포하는 전용 뷰어로만 열 수 있습니다.",
          "partner.dyutong.co.kr 에서 뷰어를 내려받아 설치해 주세요."
        ],
        "code": "연결된 프로그램 없음 (.dcx)"
      },
      "intro": [
        "이 마법사를 통해 DY Viewer 파트너 문서 뷰어를(를) 설치합니다.",
        "계속하려면 [설치]를 클릭하십시오."
      ],
      "steps": [
        "설치 준비 중…",
        "문서 형식을 등록하는 중…",
        "글꼴을 배포하는 중…",
        "설치를 마무리하는 중…"
      ],
      "done": {
        "title": "설치가 완료되었습니다",
        "lines": [
          "DY Viewer 설치가 완료되었습니다.",
          ".dcx 문서를 다시 열어 보세요."
        ]
      },
      "already": {
        "title": "이미 설치되어 있습니다",
        "lines": ["DY Viewer 파트너 문서 뷰어가 이미 설치되어 있습니다."]
      }
    },
```

`sites` 배열에 더한다:

```json
    {
      "url": "partner.dyutong.co.kr",
      "title": "D유통 파트너 포털",
      "layout": "vendor",
      "vendor": {
        "brand": "D유통 파트너 포털",
        "tagline": "협력사 전용 문서 서비스",
        "theme": "corp",
        "lines": [
          "D유통과 거래하는 협력사를 위한 문서 서비스입니다.",
          "당사가 발송하는 거래조건서·정산서는 파트너 전용 형식(.dcx)으로 제공됩니다.",
          "아래 뷰어를 설치하시면 해당 문서를 열람하실 수 있습니다."
        ],
        "download": { "fileId": "file_dyviewer", "name": "DYViewer_Setup.exe", "size": "26MB", "label": "뷰어 다운로드" },
        "notes": [
          "지원 환경: Windows 10 이상",
          "문의: D유통 정보시스템팀 02-777-0200"
        ]
      }
    },
```

- [ ] **Step 5: 넷째 날 메일과 목표를 고친다**

`days[3].mails[0]` (`mail_dyutong`) 의 `body` 를 다음으로 바꾸고 `attach` 를 더한다:

```json
          "body": "김한별 대리님, 안녕하세요. D유통 구매팀 윤서아입니다.\n\n지난주 이준호 대리님과 협의한 대로, 신규 물류센터에 무선 바코드 스캐너 BS-200 60대를 도입하려 합니다.\n오랜만에 다시 거래하게 되어 반갑습니다.\n\n내부 품의를 위해 아래 부탁드립니다.\n1. D유통 견적서 파일 첨부\n2. 메일 본문에 60대 기준 총액 기재\n3. 메일 본문에 당사 품의번호 기재 (첨부한 거래조건서에 있습니다)\n\n첨부 문서는 저희 파트너 전용 형식이라 partner.dyutong.co.kr 에서 뷰어를 받으셔야 열립니다.\n오늘 오후 결재 일정이 있어 오전 중 회신 부탁드립니다.\n윤서아 드림",
          "attach": {
            "name": "D유통_거래조건서.dcx",
            "size": "62KB",
            "fileId": "file_d_terms"
          },
```

`days[3].goal` 을 고친다:

```json
        "requiredKeywords": [
          "2,070,000",
          "DY-PR-260826"
        ],
        "missingKeywordReply": "파일은 잘 받았습니다. 그런데 본문에 60대 기준 총액과 저희 품의번호가 모두 있어야 상신이 됩니다. 첨부드린 거래조건서를 확인하시고 다시 보내주시겠어요?",
```

팀장의 넷째 날 개막 대사 마지막 줄 뒤에 한 줄 더한다:

```json
          "아, 거기 붙여 보낸 조건서는 지들 전용 뷰어로만 열린대요. 안 열리면 D유통 파트너 사이트 찾아봐요."
```

- [ ] **Step 6: Dcx 뷰어를 만든다**

`src/apps/Dcx.jsx`:

```jsx
import { useGame, findFile } from '../engine/store.js'

// A vendor's own document format: the file is right there and still unreadable
// until their viewer is installed. Same shape of refusal Windows gives for .hwp.
export default function Dcx({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const spec = useGame((s) => s.scenario.programs.dviewer)
  const installed = useGame((s) => Boolean(s.grants.dviewer))
  const file = findFile(fs, fileId)
  if (!file) return <div className="hwp-none">문서를 열 수 없습니다.</div>

  if (!installed) {
    return (
      <div className="hwp-missing">
        <div className="hwp-missing-card">
          <div className="hwp-missing-file">{file.name}</div>
          <h2>{spec.missing.title}</h2>
          {spec.missing.lines.map((line) => <p key={line}>{line}</p>)}
          <div className="hwp-missing-code">{spec.missing.code}</div>
        </div>
      </div>
    )
  }

  const [title, ...rest] = file.content.split('\n')
  return (
    <div className="dcx">
      <div className="hwp-bar">
        <span className="hwp-name">{file.name}</span>
        <span className="dcx-badge">DY Viewer</span>
      </div>
      <div className="hwp-canvas">
        <div className="dcx-page">
          <h1 className="dcx-title">{title}</h1>
          <pre className="dcx-text">{rest.join('\n').replace(/^\n+/, '')}</pre>
          <div className="dcx-foot">D유통 파트너 문서 · 무단 배포 금지</div>
        </div>
      </div>
    </div>
  )
}
```

`src/apps/registry.jsx` — import 와 `APPS` 에 더한다:

```jsx
import Dcx from './Dcx.jsx'
```
```jsx
  dcx: { title: 'DY Viewer', icon: 'doc', comp: Dcx, w: 660, h: 580, theme: '#123a7a' },
```

`src/shell/shell.css` 끝에 더한다:

```css
/* ── 거래처 전용 문서 뷰어 ───────────────────────────────── */
.dcx { height: 100%; display: flex; flex-direction: column; }
.dcx-badge { font-size: 10.5px; font-weight: 700; color: #fff; background: #123a7a;
             padding: 2px 7px; border-radius: 3px; letter-spacing: 0.2px; }
.dcx-page { width: 540px; margin: 22px auto; padding: 40px 44px; background: #fff;
            border: 1px solid #dfe2e7; box-shadow: 0 2px 14px #0000000f; }
.dcx-title { font-size: 17px; font-weight: 800; color: #123a7a; margin: 0 0 20px;
             padding-bottom: 12px; border-bottom: 2px solid #123a7a; }
.dcx-text { font-size: 12.5px; line-height: 1.95; white-space: pre-wrap; margin: 0; color: #23262b; }
.dcx-foot { margin-top: 28px; padding-top: 10px; border-top: 1px dashed #cfd4da;
            font-size: 10.5px; color: #9aa0a8; text-align: center; }
```

- [ ] **Step 7: 테스트를 돌린다**

Run: `npm test -- --run`
Expected: `test/dcx.test.js` 전부 PASS. `test/programs.test.js` 의 `offers at least one download` 도 이제 PASS. danger 두 개만 남는다 (Task 8 에서 통과).

- [ ] **Step 8: 커밋**

```bash
git add src/scenarios/workday.json src/engine/store.js src/apps/Dcx.jsx src/apps/registry.jsx src/shell/shell.css test/dcx.test.js
git commit -m "feat: D유통 sends a document only their own viewer opens

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 무료 한글 뷰어 함정

검색 결과 맨 위 광고에서 받은 설치 파일을 실행하면 감염된다.

**Files:**
- Modify: `src/scenarios/workday.json` (`ads`, `programs.fakeviewer`, `file_fakeviewer`, `hwpviewer-free.com`)
- Modify: `src/engine/store.js` (`searchAds`)
- Modify: `src/apps/Browser.jsx` (광고 블록)
- Modify: `src/shell/shell.css`
- Test: `test/dcx.test.js`, `test/programs.test.js`

**Interfaces:**
- Consumes: `Vendor` (Task 3), `crash(source)` (Task 2)
- Produces: `searchAds(ads, q)` → `[{ id, title, url, desc, tags }]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/dcx.test.js` 끝에 붙인다:

```js
import { searchAds } from '../src/engine/store.js'

describe('the ad at the top of the results', () => {
  const spam = scenario.sites.find((s) => s.url === 'hwpviewer-free.com')

  it('turns up when a stuck player searches for a 한글 viewer', () => {
    const hits = searchAds(scenario.ads, '한글 뷰어')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].url).toBe(spam.url)
  })

  it('never turns up as an ordinary site result', () => {
    for (const q of ['한글', '뷰어', 'hwp', '무료']) {
      expect(searchSites(scenario.sites, q).map((s) => s.url)).not.toContain(spam.url)
    }
  })

  it('hands out a program that takes the machine down', () => {
    const p = scenario.programs.fakeviewer
    expect(spam.vendor.download.name).toBe(p.setup)
    expect(spam.vendor.theme).toBe('spam')
    expect(p.danger).toBe(true)
    expect(p.aftermath.thread).toBe('security')
    expect(p.aftermath.lines.join(' ')).toContain(spam.url)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --run test/dcx.test.js`
Expected: FAIL — `searchAds is not a function`

- [ ] **Step 3: searchAds 를 더한다**

`src/engine/store.js` 의 `searchSites` 줄 위에 더한다:

```js
// Sponsored results are not sites the portal indexed — they are bought, so they
// match on the words the buyer paid for and never show up in a plain site search.
export const searchAds = (ads, q) => searchIn(ads, q, ['title', 'desc', 'tags'])
```

`searchSites` 는 광고 사이트를 제외한다:

```js
export const searchSites = (sites, q) => searchIn(sites.filter((s) => !s.unlisted), q, ['title', 'url'])
```

- [ ] **Step 4: 시나리오에 광고와 사이트를 더한다**

최상위에 `"ads"` 를 더한다(`"blogs"` 옆):

```json
  "ads": [
    {
      "id": "ad_hwpviewer",
      "title": "한글 뷰어 무료 다운로드 | hwp 파일 바로 열기",
      "url": "hwpviewer-free.com",
      "desc": "설치 3초, 결제 없음. hwp·hwpx 전부 지원. 지금 바로 무료로 받으세요!",
      "tags": ["한글", "한글뷰어", "뷰어", "hwp", "무료", "다운로드", "문서"]
    }
  ],
```

`programs` 에 더한다. `danger` 프로그램은 grant 를 받기 전에 PC 가 내려가므로 `already` 화면에는
영원히 닿지 않는다 — 그래도 사전의 모든 프로그램이 같은 모양이어야 Task 1 의 검사가 성립하므로
자리를 채워 둔다. 덕분에 다시 실행하면 또 감염되는데, 그것이 맞는 동작이다:

```json
    "fakeviewer": {
      "product": "HWP Viewer Free",
      "publisher": "확인되지 않은 게시자",
      "version": "1.0.0",
      "size": "3MB",
      "setup": "HwpViewer_Free_Setup.exe",
      "grant": "fakeviewerInstalled",
      "danger": true,
      "intro": [
        "이 마법사를 통해 HWP Viewer Free을(를) 설치합니다.",
        "계속하려면 [설치]를 클릭하십시오."
      ],
      "steps": [
        "설치 준비 중…",
        "구성 요소를 내려받는 중…",
        "설치를 마무리하는 중…"
      ],
      "done": {
        "title": "설치가 완료되었습니다",
        "lines": ["설치가 완료되었습니다."]
      },
      "already": {
        "title": "이미 설치되어 있습니다",
        "lines": ["HWP Viewer Free이(가) 이미 설치되어 있습니다."]
      },
      "aftermath": {
        "source": "workMessenger",
        "thread": "security",
        "from": "정보보안팀",
        "lines": [
          "김한별 대리님, 방금 PC에서 악성코드가 탐지되어 강제 종료했습니다.",
          "hwpviewer-free.com 에서 내려받은 설치 파일이던데, 저희가 배포한 프로그램이 아닙니다.",
          "검색으로 나오는 무료 뷰어 광고는 대부분 이런 식입니다. 출처가 확인되지 않은 exe 는 실행하지 말아 주세요.",
          "한글은 사내 배포본이 따로 있습니다. 필요하시면 저희에게 말씀해 주세요."
        ]
      }
    },
```

`다운로드` 폴더에 더한다:

```json
      {
        "id": "file_fakeviewer",
        "name": "HwpViewer_Free_Setup.exe",
        "program": "fakeviewer",
        "attached": true,
        "content": "HWP Viewer Free 설치 파일"
      },
```

`sites` 에 더한다(`unlisted: true` 로 사이트 검색에서 뺀다):

```json
    {
      "url": "hwpviewer-free.com",
      "title": "한글 뷰어 무료 다운로드",
      "layout": "vendor",
      "unlisted": true,
      "vendor": {
        "brand": "HWP VIEWER FREE",
        "tagline": "설치 3초! 평생 무료!",
        "theme": "spam",
        "lines": [
          "★ hwp / hwpx 전부 지원! 결제 없이 평생 무료! ★",
          "오늘만 12,847명이 다운로드했습니다.",
          "복잡한 설치 과정 없이 클릭 한 번이면 끝납니다.",
          "지금 바로 아래 버튼을 눌러 주세요!"
        ],
        "download": { "fileId": "file_fakeviewer", "name": "HwpViewer_Free_Setup.exe", "size": "3MB", "label": "지금 무료 다운로드" },
        "notes": [
          "본 프로그램은 제휴 프로그램이 함께 설치될 수 있습니다.",
          "고객센터 운영시간: 확인되지 않음"
        ]
      }
    },
```

- [ ] **Step 5: 브라우저가 광고를 그리게 한다**

`src/apps/Browser.jsx` — import 에 `searchAds` 를 더한다:

```jsx
import {
  useGame, searchAds, searchBlogs, searchCompanies, searchNews, searchPlaces, searchQna,
  searchSites, searchTerms, siteView, latestNews, hostResolves
} from '../engine/store.js'
```

검색 결과 계산에 한 줄 더한다:

```jsx
  const promos = page.kind === 'search' ? searchAds(scenario.ads, page.q) : []
```

`{page.kind === 'search' && (` 블록 안, `<p className="results-head">` **바로 아래**에 광고 블록을 넣는다:

```jsx
            {promos.map((ad) => (
              <div key={ad.id} className="ad" onClick={() => open(ad.url)}>
                <div className="ad-top">
                  <span className="ad-badge">AD</span>
                  <span className="ad-title">{ad.title}</span>
                </div>
                <div className="ad-url">{ad.url}</div>
                <div className="ad-desc">{ad.desc}</div>
              </div>
            ))}
```

결과 건수와 '결과 없음' 조건은 광고를 세지 않는다 — 검색 결과가 광고뿐일 때 "검색 결과가 없습니다" 와 광고가 함께 보이는 것이 실제 포털의 모습이다. 두 식을 바꾸지 않는다.

`src/shell/shell.css` 끝에 더한다:

```css
/* ── 검색 광고 ─────────────────────────────────────────── */
.ad { padding: 12px 14px; margin-bottom: 14px; border: 1px solid #e6e8ec;
      border-radius: 8px; background: #fcfcfd; cursor: pointer; }
.ad:hover { background: #f6f8fb; }
.ad-top { display: flex; align-items: center; gap: 7px; }
.ad-badge { font-size: 9.5px; font-weight: 800; color: #7b5b00; background: #ffe9a8;
            border-radius: 3px; padding: 1.5px 5px; letter-spacing: 0.3px; }
.ad-title { font-size: 14px; color: #1a56c4; font-weight: 600; }
.ad-url { font-size: 11.5px; color: #1a7f37; margin-top: 3px; }
.ad-desc { font-size: 12.5px; color: #4b5058; line-height: 1.6; margin-top: 4px; }
```

- [ ] **Step 6: 전체 테스트를 돌린다**

Run: `npm test -- --run`
Expected: 전부 PASS — `test/programs.test.js` 의 danger 테스트 둘도 이제 통과한다.

- [ ] **Step 7: 커밋**

```bash
git add src/scenarios/workday.json src/engine/store.js src/apps/Browser.jsx src/shell/shell.css test/dcx.test.js
git commit -m "feat: the free 한글 viewer at the top of the search results

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 마무리 — README 와 전체 점검

**Files:**
- Modify: `README.md`
- Test: 전부

- [ ] **Step 1: 전체 테스트를 돌린다**

Run: `npm test -- --run`
Expected: PASS, 실패 0

- [ ] **Step 2: 빌드가 되는지 본다**

Run: `npm run build`
Expected: 오류 없이 `dist/` 생성

- [ ] **Step 3: README 를 고친다**

`README.md` 의 "앱 12종" 문단을 다음으로 바꾼다(앱이 15종이 되었다):

```markdown
**앱 15종** — 메일(웹메일 스타일 작성 화면), 업무용/사설 메신저, 브라우저,
파일 탐색기, 메모장, 사진 뷰어, 한글 문서(인쇄), PDF 뷰어, 거래처 전용 문서 뷰어,
슬라이드, 스프레드시트(셀 편집), VPN 클라이언트, 설치 마법사,
명령 프롬프트(`ipconfig /all`, `ping`). 화면 잠금은 시작 메뉴·Ctrl+Alt+L·4분 방치.
```

"브라우저 안의 인터넷" 문단 끝에 한 문장 더한다:

```markdown
거래처 파트너 포털과, 검색 결과 맨 위에 붙는 수상한 무료 프로그램 광고까지.
```

"진행 방식" 문단의 둘째 날 설명에 다음을 더한다(둘째 날 문장 뒤):

```markdown
둘째 날에는 정보보안팀이 사내 VPN 전환을 알려옵니다. 사내 포털 자료실에서 클라이언트를
내려받아 설치하고, 서버 이름이 해석되지 않으면 hosts 파일에 직접 한 줄을 적어야 연결됩니다.
연결하면 뜨는 세션 ID 를 보고해야 하고, 셋째 날 사내 드라이브도 이 VPN 을 켠 채로만 열립니다.
```

넷째 날 설명 뒤에 더한다:

```markdown
넷째 날 D유통이 보내온 거래조건서는 자기네 전용 형식이라, 파트너 사이트에서 뷰어를
받아 설치해야 열립니다. 그 안에만 적혀 있는 품의번호가 회신에 들어가야 합니다.
```

"엔딩은 여섯입니다" 문단 앞에 한 문단 더한다:

```markdown
받아서 실행하는 것이 늘 안전하지는 않습니다. 정부25는 본인확인 전에 키보드 보안
프로그램을 깔라고 하고, 검색창에 '한글 뷰어'를 넣으면 결과 맨 위에 광고가 하나 붙습니다.
정식 배포본과 그렇지 않은 것을 가르는 것은 어디서 받았는지뿐입니다.
```

`npm test` 옆의 테스트 개수도 실제 수로 고친다:

```bash
npm test         # <실제 개수> tests
```

실제 개수는 `npm test -- --run` 마지막 줄 `Tests  N passed` 에서 읽는다.

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: downloads, the VPN, and the ad at the top of the results

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 검토 메모

- **일부 테스트는 뒤 Task 까지 빨간불로 남는다.** 의도된 것이다 — 뼈대가 먼저 있어야 데이터를 넣을 수 있고, 테스트가 그 데이터를 기다린다. 남는 것은 정확히 셋이다:
  - Task 2 `shortcut` 테스트 → Task 4 (VPN 이 첫 `shortcut` 프로그램)
  - Task 2 `danger` 테스트 둘 → Task 8 (가짜 뷰어가 유일한 `danger` 프로그램)
  - Task 3 `offers at least one download` → Task 7 (파트너 사이트가 첫 `vendor` 다운로드. 정부25는 `gov.security.download`, 포털 자료실은 `site.files` 라 이 검사에 잡히지 않는다)
  각 Task 의 "테스트를 돌린다" 단계가 무엇이 남아야 정상인지 적어 두었다. 그 목록에 없는 실패가 나오면 멈추고 원인을 찾는다.
- **`pool.fixed[2]` 와 `days[1].requests` 는 반드시 같이 고친다.** 한쪽만 고치면 `test/pool.test.js` 의 `never pools a request some day already pins` 가 깨진다. `sizes[2]` 는 9 그대로 둔다 — 고정분이 6→7 로 늘고 뽑는 수가 3→2 로 줄 뿐이다.
- **세션 ID 와 품의번호는 힌트 대사에 절대 적지 않는다.** 힌트는 어디를 보라고만 말한다.
  다만 `ask.accept` 에는 정답 문자열이 그대로 들어간다(엔진에 템플릿이 없다) — 누출 테스트는
  검사 표면을 좁혀서 쓴다. 팀장 대사에는 "품의번호" 라는 말만 넣고 번호는 넣지 않는다.
