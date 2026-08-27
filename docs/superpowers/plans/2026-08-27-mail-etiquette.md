# 메일 예절 검사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이어가 보내는 메일의 제목 말머리·인사말·끝맺음말을 검사하고, 어기면 박 팀장이 거래처 항의를 전하는 잔소리를 보낸다.

**Architecture:** 순수 함수 `checkEtiquette`를 `src/engine/goal.js`에 추가한다. 답장(`sendReply`)에서는 성공/실패 판정과 무관한 별도 경로로 불러 기존 `nag()`만 재사용하고, 발신(`checkOutbound`)에서는 기존 `rude` 반려 분기를 사유 셋으로 갈라 그대로 유지한다. 규칙 데이터는 `scenario.etiquette` 최상위 블록에 두고, 가이드라인은 작성 화면 플레이스홀더로만 노출한다.

**Tech Stack:** React 18, Zustand(`src/engine/store.js`), Vitest, 순수 JSON 시나리오(`src/scenarios/workday.json`)

## Global Constraints

- **JSON은 절대 sed/Edit로 수정하지 않는다.** node 스크립트로 `JSON.parse` → 수정 → `JSON.stringify(s, null, 2) + '\n'`.
- **workday.json을 Read/cat으로 통째로 열지 않는다.** 조회는 `node scripts/query.mjs <명령>`.
- **JS/JSX는 CRLF다.** 스크립트로 고칠 땐 `\r\n→\n` 정규화 후 수정, 저장 시 `\n→\r\n` 복원. bash heredoc의 `\n` 리터럴은 깨지므로 파이썬(`io`, `newline=''`) 또는 Edit 도구를 쓴다.
- 테스트는 먼저 관련 파일만 (`npx vitest run test/<파일>`), 마지막에 한 번만 `npm test`.
- 회사 이름 `AR 주식회사`와 플레이어 이름 `김한별`은 `scenario.player`에서 읽는다. `etiquette` 데이터에 중복해 적지 않는다.
- 박 팀장 잔소리(`etiquette.nags`)에 완성된 말머리 형태(`[AR주식회사]`)를 그대로 쓰지 않는다.
- 이 계획은 새 진행 상태를 만들지 않으므로 `store.js`의 `PROGRESS` 배열은 건드리지 않는다.

---

### Task 1: `checkEtiquette` 순수 함수

예절 검사의 전부. 이후 태스크가 전부 이 함수에 의존하므로 먼저 만든다.

**Files:**
- Modify: `src/engine/goal.js` (파일 끝에 추가, 기존 함수는 건드리지 않음)
- Test: `test/etiquette.test.js` (신규)

**Interfaces:**
- Consumes: 없음 (기존 `norm()`을 파일 안에서 재사용)
- Produces: `checkEtiquette(rules, { subject, body, outbound })` → `string[]`
  - `rules`: `{ company: string, name: string, greetings: string[], closings: string[] }`
  - `subject`/`body`: 문자열. `body`는 `contentEditable`의 `innerText`
  - `outbound`: 불리언. 거짓이면 `subject`를 검사하지 않는다
  - 반환: 위반 사유 배열, 우선순위 순 `['subject', 'greeting', 'closing']`의 부분집합. 위반이 없으면 `[]`
  - 회사·이름은 호출부가 `scenario.player`에서 꺼내 `rules`에 얹어 넘긴다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/etiquette.test.js` 신규 생성:

```js
import { describe, expect, it } from 'vitest'
import { checkEtiquette } from '../src/engine/goal.js'

const rules = {
  company: 'AR 주식회사',
  name: '김한별',
  greetings: ['안녕하세요', '안녕하십니까', '수고 많으십니다'],
  closings: ['감사합니다', '드림', '올림', '부탁드립니다']
}
const ok = '안녕하세요, AR 주식회사 김한별입니다.\n\n견적서 보내드립니다.\n\n감사합니다.'
const check = (over = {}) =>
  checkEtiquette(rules, { subject: '[AR주식회사] 견적서', body: ok, outbound: true, ...over })

describe('메일 예절 검사', () => {
  it('세 항목을 갖춘 메일은 위반이 없다', () => {
    expect(check()).toEqual([])
  })

  it('제목 맨 앞의 회사 이름은 괄호 종류를 가리지 않는다', () => {
    for (const subject of ['[AR주식회사] 견적서', '(AR 주식회사) 견적서', 'AR주식회사입니다. 견적서', '【AR주식회사】견적서', 'AR 주식회사 견적서']) {
      expect(check({ subject })).toEqual([])
    }
  })

  it('회사 이름이 맨 앞이 아니면 잡는다', () => {
    expect(check({ subject: '견적서 [AR주식회사]' })).toEqual(['subject'])
    expect(check({ subject: 'RE: [AR주식회사] 견적서' })).toEqual(['subject'])
  })

  it('회사 이름을 줄여 쓰면 잡는다', () => {
    expect(check({ subject: '[AR] 견적서' })).toEqual(['subject'])
    expect(check({ subject: '견적서' })).toEqual(['subject'])
  })

  it('인사말만 있고 실명 자기소개가 없으면 잡는다', () => {
    expect(check({ body: '안녕하세요.\n\n견적서 보내드립니다.\n\n감사합니다.' })).toEqual(['greeting'])
  })

  it('플레이스홀더를 그대로 베끼면 잡는다', () => {
    expect(check({ body: '안녕하세요, AR 주식회사 ○○○입니다.\n\n견적서.\n\n감사합니다.' })).toEqual(['greeting'])
  })

  it('끝맺음에만 이름이 있으면 자기소개로 치지 않는다', () => {
    expect(check({ body: '안녕하세요.\n\n견적서 보내드립니다.\n\n김한별 드림' })).toEqual(['greeting'])
  })

  it('자기소개는 있고 인사말이 없으면 잡는다', () => {
    expect(check({ body: 'AR 주식회사 김한별입니다.\n\n견적서.\n\n감사합니다.' })).toEqual(['greeting'])
  })

  it('끝맺음말이 없으면 잡는다', () => {
    expect(check({ body: '안녕하세요, 김한별입니다.\n\n견적서 보내드립니다.' })).toEqual(['closing'])
  })

  it('답장 경로에서는 제목을 보지 않는다', () => {
    expect(check({ subject: 'RE: [C테크] 견적서 요청', outbound: false })).toEqual([])
  })

  it('여러 개를 어기면 우선순위 순으로 전부 돌려준다', () => {
    expect(check({ subject: '견적서', body: '견적서 보내드립니다.' })).toEqual(['subject', 'greeting', 'closing'])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run test/etiquette.test.js
```

Expected: FAIL — `checkEtiquette is not a function`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/engine/goal.js` 파일 **끝**에 추가한다. 기존 `norm`은 파일 맨 위에 이미 있으므로 그대로 쓴다.

```js
// 메일 예절. 판정이 아니라 매너를 본다 — 어겼다고 메일이 막히는 것은 발신 메일
// 하나뿐이고(본퀘스트), 답장에서는 박 팀장의 잔소리로만 돌아온다.
// 여는 기호는 형식일 뿐이라 걷어내고 본다: [AR주식회사]든 (AR 주식회사)든
// 회사 이름이 제목 맨 앞에 오기만 하면 된다.
const OPENERS = /^[[\](){}<>【】「」『』"'“”‘’.,·:\-–—]+/

export function checkEtiquette(rules, { subject, body, outbound }) {
  const nbody = norm(body)
  const out = []

  if (outbound) {
    const head = norm(subject).replace(OPENERS, '')
    if (!head.startsWith(norm(rules.company))) out.push('subject')
  }

  // 인사를 했는지, 그리고 누가 쓰는지 밝혔는지. 이름 없는 '○○○입니다'는
  // 소개가 아니고, 끝맺음의 '김한별 드림'도 소개가 아니다.
  const greeted = rules.greetings.some((g) => nbody.includes(norm(g)))
  const named = nbody.includes(norm(rules.name) + '입니다')
  if (!greeted || !named) out.push('greeting')

  if (!rules.closings.some((c) => nbody.includes(norm(c)))) out.push('closing')

  return out
}
```

`norm`이 공백·쉼표를 지우므로 `OPENERS`에 공백을 넣을 필요가 없다.

- [ ] **Step 4: 테스트 통과를 확인한다**

```bash
npx vitest run test/etiquette.test.js
```

Expected: PASS — 11 tests

확인 포인트:
- `'AR주식회사입니다. 견적서'` → `norm` 후 `AR주식회사입니다.견적서`, `AR주식회사`로 시작하므로 통과
- `'RE: [AR주식회사] 견적서'` → `OPENERS`는 문자열 **선두**에서만 매치한다. `R`은 여는 기호가 아니라 아무것도 걷히지 않고 `RE:...`로 시작해 `subject` 위반. 발신 메일 제목에 `RE:`를 붙일 일이 없으니 이것이 의도다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/engine/goal.js test/etiquette.test.js
git commit -m "feat: check whether a mail says who is writing and to whom"
```

---

### Task 2: `scenario.etiquette` 데이터

규칙 목록과 박 팀장 잔소리 3벌. Task 1의 함수가 소비할 데이터를 시나리오로 옮긴다.

**Files:**
- Modify: `src/scenarios/workday.json` (최상위에 `etiquette` 추가, `days[2].fetch`에서 `greetings`/`closings` 제거)
- Test: `test/etiquette.test.js` (Task 1 파일에 describe 블록 추가)

**Interfaces:**
- Consumes: Task 1의 `checkEtiquette(rules, ...)`가 요구하는 `greetings`/`closings` 모양
- Produces: `scenario.etiquette = { greetings: string[], closings: string[], nags: { subject: string[], greeting: string[], closing: string[] } }` — Task 3(store)과 Task 4가 이 경로를 읽는다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/etiquette.test.js` 맨 위 import에 시나리오를 더한다:

```js
import scenario from '../src/scenarios/workday.json'
```

파일 끝에 추가:

```js
describe('예절 규칙 데이터', () => {
  const e = scenario.etiquette

  it('규칙과 잔소리가 모두 있다', () => {
    expect(e.greetings.length).toBeGreaterThan(1)
    expect(e.closings.length).toBeGreaterThan(1)
    for (const reason of ['subject', 'greeting', 'closing']) {
      expect(e.nags[reason]).toHaveLength(3)
    }
  })

  it('잔소리가 정답표가 되지 않는다', () => {
    const lines = Object.values(e.nags).flat().join('\n')
    expect(lines).not.toContain('[AR주식회사]')
    expect(lines).not.toContain('김한별입니다')
  })

  it('실제 시나리오 규칙으로 바른 메일이 통과한다', () => {
    const r = { ...e, company: scenario.player.company, name: scenario.player.name }
    const body = `안녕하세요, ${scenario.player.company} ${scenario.player.name}입니다.\n\n견적서 보내드립니다.\n\n감사합니다.`
    expect(checkEtiquette(r, { subject: '[AR주식회사] 견적서', body, outbound: true })).toEqual([])
  })

  it('발신 메일 규칙이 시나리오 한 곳에만 있다', () => {
    expect(scenario.days[2].fetch.greetings).toBeUndefined()
    expect(scenario.days[2].fetch.closings).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run test/etiquette.test.js
```

Expected: FAIL — `Cannot read properties of undefined` (`scenario.etiquette`가 없음)

- [ ] **Step 3: JSON을 고친다**

**node 스크립트로만** 수정한다. 스크래치패드에 `add-etiquette.mjs`로 저장해 실행한다.

```js
import fs from 'node:fs'
const p = 'src/scenarios/workday.json'
const s = JSON.parse(fs.readFileSync(p, 'utf8'))

const fetch3 = s.days[2].fetch
s.etiquette = {
  greetings: fetch3.greetings,
  closings: fetch3.closings,
  nags: {
    subject: [
      '김대리, 거래처에서 연락이 왔는데요.',
      '메일 제목만 봐서는 어느 회사에서 온 건지 몰라 한참 찾았답니다. 스팸으로 넘길 뻔했다고.',
      '제목 맨 앞에 우리 회사 이름부터 넣으세요. 그게 기본이에요.'
    ],
    greeting: [
      '김대리, 거래처에서 또 연락이 왔어요.',
      '메일에 인사도 없고 누가 보낸 건지도 안 적혀 있어서 당황했다는데요.',
      '첫 줄에 인사하고 본인 이름 밝히세요. 그쪽은 김대리가 누군지 모릅니다.'
    ],
    closing: [
      '김대리, 거래처에서 연락 왔어요.',
      '메일이 용건만 툭 끊겨 있어서 읽다 만 줄 알았답니다.',
      '끝맺음 인사 한 줄은 넣고 보내세요. 태도 문제로 봅니다.'
    ]
  }
}
delete fetch3.greetings
delete fetch3.closings

fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n')
console.log('etiquette 추가 완료')
```

- [ ] **Step 4: 테스트 통과를 확인한다**

```bash
npx vitest run test/etiquette.test.js
```

Expected: PASS — 15 tests

- [ ] **Step 5: 커밋한다**

```bash
git add src/scenarios/workday.json test/etiquette.test.js
git commit -m "feat: give the boss three ways to hear about your manners"
```

---

### Task 3: 답장 경로에 잔소리 붙이기 (사이드퀘스트)

답장은 매일 있는 주 과제다. 예절을 어겨도 메일은 그대로 나가고 목표도 정상 처리된다. `misses`/`slip()`/`failed` 어디에도 손대지 않는다.

**Files:**
- Modify: `src/engine/store.js:3` (import), `:698` (`sendReply` 시그니처와 본문), `:729` 앞 (`scold` 추가)
- Modify: `src/apps/Compose.jsx:43` (`onSend`에 `subject` 항상 포함)
- Test: `test/etiquette.test.js` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1의 `checkEtiquette`, Task 2의 `scenario.etiquette`, 기존 `nag(lines, after?)` (store.js:729)
- Produces: store 액션 `scold({ subject, body, outbound })` — 위반이 있으면 `nag(etiquette.nags[첫 사유])`를 부르고 아니면 아무것도 하지 않는다. `sendReply`의 반환값과 판정은 불변.

- [ ] **Step 1: 회귀 테스트를 쓴다**

`test/etiquette.test.js` 맨 위 import에 더한다:

```js
import { checkEtiquette, checkGoal } from '../src/engine/goal.js'
import { goalFor } from '../src/engine/store.js'
```

(첫 줄은 Task 1에서 만든 `checkEtiquette` import를 대체한다.)

파일 끝에 추가. 예절이 판정에 영향을 주지 않음을 못박는다:

```js
describe('답장에서 예절은 사이드퀘스트다', () => {
  const goal = goalFor(scenario, 1)
  // 끝맺음말 목록에 '부탁드립니다'가 있으므로 그 말을 피해야 closing까지 걸린다
  const rude = `${goal.requiredKeywords[0]} 확인해주세요`

  it('예절을 어겨도 답장 판정은 통과한다', () => {
    expect(checkGoal(goal, { attachmentId: goal.requiredAttachment, body: rude }).ok).toBe(true)
  })

  it('예절을 갖춰도 첨부가 틀리면 여전히 실패한다', () => {
    const polite = `안녕하세요, 김한별입니다.\n\n${goal.requiredKeywords[0]}\n\n감사합니다.`
    expect(checkGoal(goal, { attachmentId: 'file_wrong', body: polite }).ok).toBe(false)
  })

  it('그 답장은 예절 검사에서는 걸린다', () => {
    const r = { ...scenario.etiquette, company: scenario.player.company, name: scenario.player.name }
    expect(checkEtiquette(r, { body: rude, outbound: false })).toEqual(['greeting', 'closing'])
  })
})
```

- [ ] **Step 2: 실행해 본다**

```bash
npx vitest run test/etiquette.test.js
```

Expected: **전부 PASS**. 이 태스크의 테스트는 회귀 방지용이라 구현 전에도 통과해야 정상이다. 하나라도 실패하면 Task 1이나 2가 잘못된 것이므로 되돌아간다.

- [ ] **Step 3: `Compose.jsx`가 제목을 항상 넘기게 한다**

답장일 때 `subject`가 `undefined`로 가지 않게 원 제목을 채워 보낸다. Edit 도구로 고친다 (CRLF 보존).

찾을 문자열:

```
subject: subject.trim() || '(제목 없음)',
```

바꿀 문자열:

```
subject: mail ? 'RE: ' + mail.subject : subject.trim() || '(제목 없음)',
```

- [ ] **Step 4: store에 `scold`를 더하고 `sendReply`에서 부른다**

`src/engine/store.js`. Edit 도구로 네 군데를 고친다.

(4-a) import — 찾을 문자열:

```
import { checkGoal, checkOutbound } from './goal.js'
```

바꿀 문자열:

```
import { checkEtiquette, checkGoal, checkOutbound } from './goal.js'
```

(4-b) `sendReply` 시그니처 — 찾을 문자열:

```
  sendReply: ({ attachmentId, body }) => {
```

바꿀 문자열:

```
  sendReply: ({ attachmentId, subject, body }) => {
```

(4-c) 예절 경로 호출 — 찾을 문자열:

```
    const verdict = checkGoal(goal, { attachmentId, body })
    setTimeout(() => {
```

바꿀 문자열:

```
    const verdict = checkGoal(goal, { attachmentId, body })
    // 예절은 일과 별개다. 메일은 그대로 나가고 목표도 정상 처리되며, 실수
    // 횟수에도 들어가지 않는다. 잠시 뒤 박 팀장이 거래처 말을 옮길 뿐이다.
    get().scold({ subject, body, outbound: false })
    setTimeout(() => {
```

(4-d) `scold` 정의 — 찾을 문자열:

```
  // The boss types a moment after the client's reply lands, one line at a time.
  nag: (lines, after) => {
```

바꿀 문자열:

```
  // 어긴 게 여럿이어도 사유 하나만 고른다. 한 번에 셋을 지적하면 잔소리가
  // 아니라 체크리스트가 된다.
  scold: ({ subject, body, outbound }) => {
    const s = get()
    const e = s.scenario.etiquette
    if (!e) return
    const [reason] = checkEtiquette(
      { ...e, company: s.scenario.player.company, name: s.scenario.player.name },
      { subject, body, outbound }
    )
    if (reason) get().nag(e.nags[reason])
  },

  // The boss types a moment after the client's reply lands, one line at a time.
  nag: (lines, after) => {
```

- [ ] **Step 5: 빌드와 테스트를 확인한다**

```bash
npm run build
npx vitest run test/etiquette.test.js test/outbound.test.js
```

Expected: build 성공(JSX 문법 검증 겸용), 테스트 PASS

- [ ] **Step 6: 커밋한다**

```bash
git add src/engine/store.js src/apps/Compose.jsx test/etiquette.test.js
git commit -m "feat: the boss hears about your manners, but the work still lands"
```

---

### Task 4: 발신 경로의 사유를 셋으로 가르기 (본퀘스트)

3일차 발신 메일은 본퀘스트다. 예절을 어기면 지금처럼 반려된다. 다만 `rude` 하나였던 사유를 `subject`/`greeting`/`closing` 셋으로 갈라 거래처 회신과 잔소리를 사유별로 나눈다.

**Files:**
- Modify: `src/engine/goal.js:19` (`hasAny` 삭제), `:21-33` (`checkOutbound`)
- Modify: `src/scenarios/workday.json` (`days[2].fetch`의 `rudeReply`/`rude` → `rudeReplies`)
- Modify: `src/engine/store.js:752`, `:760` (`sendMail`)
- Test: `test/outbound.test.js`

**Interfaces:**
- Consumes: Task 1의 `checkEtiquette`, Task 2의 `scenario.etiquette`
- Produces: `checkOutbound(fetch, { to, subject, body }, etiquette, player)` — 인자가 넷으로 늘어난다. 반환 `reason`이 `'address' | 'subject' | 'greeting' | 'closing' | 'keyword' | null`. `fetch.rudeReplies[reason]`가 사유별 회신.

- [ ] **Step 1: 테스트를 새 시그니처로 고친다**

`test/outbound.test.js`. 상단 헬퍼를 바꾼다.

찾을 문자열:

```
const polite = (middle) => `김영민 대리님, 안녕하세요. AR 김한별입니다.\n\n${middle}\n\n감사합니다.\n김한별 드림`
```

바꿀 문자열:

```
const et = scenario.etiquette
const player = scenario.player
const polite = (middle) => `김영민 대리님, 안녕하세요. AR 주식회사 김한별입니다.\n\n${middle}\n\n감사합니다.\n김한별 드림`
const sub = '[AR주식회사] 자료 요청'
const send = (over = {}) =>
  checkOutbound(fetch, { to: fetch.to, subject: sub, body: polite('발주 계획서'), ...over }, et, player)
```

기존 it 블록들의 `checkOutbound(fetch, { ... })` 호출을 `send({ ... })`로 바꾼다:

- `'bounces an address nobody has'` → 첫 줄은 `send({ to: 'nobody@ctech.co.kr' }).reason`, `fetch`가 없는 경우는 `checkOutbound(undefined, { to: fetch.to, subject: sub, body: polite('발주 계획서') }, et, player).reason`
- `'forgives case and spacing in the address'` → `send({ to: ' YM.Kim@ctech.co.kr ' }).ok`
- `'asks again when the body never says what is wanted'` → `send({ body: polite('지난번 자료 좀 보내주세요.') })`
- `'sends the document back for a proper request'` → `send({ body: polite('하반기 발주 계획서 공유 부탁드립니다.') })`

`'notices a mail with no greeting or no sign-off'` it 블록을 **삭제**하고 그 자리에 넣는다:

```js
  it('말머리가 없으면 되돌아온다', () => {
    const v = send({ subject: '자료 요청' })
    expect(v.reason).toBe('subject')
    expect(v.ok).toBe(false)
    expect(v.reply.attach).toBeUndefined()
  })

  it('인사말이나 자기소개가 없으면 되돌아온다', () => {
    expect(send({ body: '발주 계획서 보내주세요' }).reason).toBe('greeting')
    expect(send({ body: '안녕하세요. 발주 계획서 보내주세요. 감사합니다.' }).reason).toBe('greeting')
  })

  it('끝맺음말이 없으면 되돌아온다', () => {
    expect(send({ body: '안녕하세요, 김한별입니다. 발주 계획서 보내주세요' }).reason).toBe('closing')
  })

  it('사유마다 다른 회신이 있다', () => {
    const bodies = ['subject', 'greeting', 'closing'].map((r) => fetch.rudeReplies[r].body)
    expect(bodies.every(Boolean)).toBe(true)
    expect(new Set(bodies).size).toBe(3)
  })
```

마지막 it 블록의 `fetch.rude` 참조도 고친다 — 찾을 문자열:

```
    expect(fetch.rude.length).toBeGreaterThan(1)
```

바꿀 문자열:

```
    expect(et.nags.subject.length).toBeGreaterThan(1)
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run test/outbound.test.js
```

Expected: FAIL — `fetch.rudeReplies`가 undefined이거나 `reason`이 `'rude'`

- [ ] **Step 3: `checkOutbound`를 고친다**

`src/engine/goal.js`. Edit 도구로 세 군데를 고친다.

(3-a) 찾을 문자열:

```
export function checkOutbound(fetch, { to, body }) {
  if (!fetch || norm(to).toLowerCase() !== norm(fetch.to).toLowerCase()) {
    return { ok: false, reason: 'address', reply: null }
  }
  if (!hasAny(body, fetch.greetings) || !hasAny(body, fetch.closings)) {
    return { ok: false, reason: 'rude', reply: fetch.rudeReply }
  }
```

바꿀 문자열:

```
export function checkOutbound(fetch, { to, subject, body }, etiquette, player) {
  if (!fetch || norm(to).toLowerCase() !== norm(fetch.to).toLowerCase()) {
    return { ok: false, reason: 'address', reply: null }
  }
  // 이 메일은 본퀘스트다. 답장과 달리 예절을 어기면 되돌아온다.
  const [rude] = checkEtiquette(
    { ...etiquette, company: player.company, name: player.name },
    { subject, body, outbound: true }
  )
  if (rude) {
    return { ok: false, reason: rude, reply: fetch.rudeReplies[rude] }
  }
```

(3-b) 이제 쓰이지 않는 `hasAny`를 지운다 — 찾을 문자열:

```
const hasAny = (body, words = []) => words.some((w) => norm(body).includes(norm(w)))

```

바꿀 문자열: 빈 문자열 (두 줄 삭제)

(3-c) 위쪽 주석의 `rude` 설명도 사유가 셋으로 갈렸으니 고친다 — 찾을 문자열:

```
// an unknown address bounces before anyone reads it (the caller owns the bounce); a mail with no greeting or
// sign-off gets a cool reply (and the boss hears about it); then the body has
// to actually name what is being asked for.
```

바꿀 문자열:

```
// an unknown address bounces before anyone reads it (the caller owns the bounce); a mail that skips
// the company name, the greeting, or the sign-off gets a cool reply naming the
// one it skipped (and the boss hears about it); then the body has to actually
// name what is being asked for.
```

- [ ] **Step 4: JSON의 `rudeReply`를 사유별로 나눈다**

node 스크립트로 수정한다. 스크래치패드에 `split-rude.mjs`로 저장해 실행한다.

```js
import fs from 'node:fs'
const p = 'src/scenarios/workday.json'
const s = JSON.parse(fs.readFileSync(p, 'utf8'))
const f = s.days[2].fetch
const from = '김영민 <ym.kim@ctech.co.kr>'
const re = 'RE: {subject}'

f.rudeReplies = {
  subject: {
    from,
    subject: re,
    body: '메일 받았습니다.\n\n제목에 회사명이 없어 스팸함에서 뒤늦게 찾았습니다.\n어느 회사에서 보내신 건지 제목에 밝혀 다시 보내주시겠습니까?\n\n김영민 드림'
  },
  greeting: {
    from,
    subject: re,
    body: '메일 받았습니다.\n\n실례지만 어느 분이신지요? 인사도 소속도 없이 용건만 있어 확인이 어렵습니다.\n정식으로 다시 보내주시면 회신드리겠습니다.\n\n김영민 드림'
  },
  closing: {
    from,
    subject: re,
    body: '메일 받았습니다.\n\n본문이 중간에 끊긴 것 같은데, 혹시 잘못 보내신 건 아닌지요?\n확인 후 다시 부탁드립니다.\n\n김영민 드림'
  }
}
delete f.rudeReply
delete f.rude

fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n')
console.log('rudeReplies 분리 완료')
```

- [ ] **Step 5: `sendMail` 호출부를 고친다**

`src/engine/store.js`. Edit 도구로 두 군데.

(5-a) 찾을 문자열:

```
    const verdict = checkOutbound(fetch, { to, body })
```

바꿀 문자열:

```
    const verdict = checkOutbound(fetch, { to, subject, body }, s.scenario.etiquette, s.scenario.player)
```

(5-b) 찾을 문자열:

```
      if (verdict.reason === 'rude') get().nag(fetch.rude)
```

바꿀 문자열:

```
      const nags = s.scenario.etiquette.nags[verdict.reason]
      if (nags) get().nag(nags)
```

- [ ] **Step 6: 테스트와 빌드를 확인한다**

```bash
npm run build
npx vitest run test/outbound.test.js test/etiquette.test.js
```

Expected: build 성공, 테스트 PASS

- [ ] **Step 7: 커밋한다**

```bash
git add src/engine/goal.js src/engine/store.js src/scenarios/workday.json test/outbound.test.js
git commit -m "feat: split the cold reply three ways, one per thing you forgot"
```

---

### Task 5: 작성 화면 플레이스홀더

가이드라인이 노출되는 유일한 자리. 제목은 발신일 때만, 본문은 CSS로.

**Files:**
- Modify: `src/apps/Compose.jsx:78-80` (제목 input), `:120-122` (본문 div)
- Modify: `src/shell/shell.css:967` (`.mw-body` 다음 줄)

**Interfaces:**
- Consumes: 없음 (순수 UI)
- Produces: 없음

- [ ] **Step 1: 제목 플레이스홀더를 고친다**

`src/apps/Compose.jsx`. Edit 도구로 고친다 (CRLF 보존). 이 input은 발신일 때만 렌더되므로 조건이 따로 필요 없다.

찾을 문자열:

```
                   placeholder="제목" aria-label="제목" spellCheck={false} />
```

바꿀 문자열:

```
                   placeholder="[AR주식회사] 제목을 입력하세요" aria-label="제목" spellCheck={false} />
```

- [ ] **Step 2: 본문에 플레이스홀더 속성을 붙인다**

`me`는 이미 컴포넌트 안에 있다 (`const me = useGame((s) => s.scenario.player)`, 28행).

찾을 문자열:

```
           role="textbox" aria-label="메일 본문"
           style={{ fontFamily: font, fontSize: size }} />
```

바꿀 문자열:

```
           role="textbox" aria-label="메일 본문"
           data-ph={`안녕하세요, ${me.company} ○○○입니다.\n\n(용건)\n\n감사합니다.`}
           style={{ fontFamily: font, fontSize: size }} />
```

- [ ] **Step 3: CSS를 더한다**

`src/shell/shell.css`. 찾을 문자열:

```
.mw-body { flex: 1; overflow: auto; padding: 18px 20px; outline: none; line-height: 1.7; user-select: text; }
```

바꿀 문자열:

```
.mw-body { flex: 1; overflow: auto; padding: 18px 20px; outline: none; line-height: 1.7; user-select: text; }
/* contentEditable은 placeholder 속성이 듣지 않는다. 한 글자만 들어와도 :empty가 풀린다. */
.mw-body:empty::before { content: attr(data-ph); white-space: pre-wrap; color: #b3b8c2; pointer-events: none; }
```

- [ ] **Step 4: 빌드로 확인한다**

```bash
npm run build
```

Expected: 성공

브라우저 확인이 가능하면 메일쓰기를 눌러 본문에 회색 안내가 뜨고 한 글자 입력하면 사라지는지 본다. 방법은 memory의 `windowsex-cdp-driving` 참고.

- [ ] **Step 5: 커밋한다**

```bash
git add src/apps/Compose.jsx src/shell/shell.css
git commit -m "feat: show the shape of a proper mail without spelling out the answer"
```

---

### Task 6: 전체 테스트와 마무리

**Files:**
- Modify: 실패하는 기존 테스트가 있으면 해당 파일

- [ ] **Step 1: 남은 참조를 찾는다**

```bash
grep -rn "rudeReply\b" src/ test/
grep -rn "fetch\.rude\b" src/ test/
grep -rn "checkOutbound" src/ test/
```

Expected: `rudeReply`(단수)와 `fetch.rude` 참조가 하나도 남지 않아야 한다. 남아 있으면 Task 4의 새 이름(`rudeReplies`, `etiquette.nags`)으로 고친다. `checkOutbound` 호출부는 전부 인자 4개여야 한다.

- [ ] **Step 2: 전체 테스트를 돌린다**

```bash
npm test
```

Expected: 382+ 통과

- [ ] **Step 3: 실패가 있으면 고친다**

예상 실패 지점:
- `test/scenario.test.js` — `days[2].fetch`의 사라진 키를 참조하는 곳
- `checkOutbound`를 부르는 다른 호출부 — 새 시그니처(인자 4개)로

고친 뒤 다시 `npm test`로 확인한다.

- [ ] **Step 4: 커밋한다**

```bash
git add -A
git commit -m "test: keep the rest of the suite green after the etiquette split"
```
