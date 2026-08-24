# 대답하는 한 주 — 설계

2026-08-24. 여덟 가지를 더한다. 셋은 한 주가 플레이어를 되받아치게 하고(주간보고,
전자결재, 비밀번호 변경), 하나는 감염에 꼬리를 달고(명의도용), 둘은 톡톡을 살아 있게
만들고(잡음, 친구 셋), 둘은 끝을 갈라놓는다(모범사원 에필로그, 엄마 답장).

새 시스템은 만들지 않는다. 파문(`ripples`), 질문(`ask`), 폼(`Place` 예약), grant —
이미 있는 동사 위에 전부 얹는다.

| # | 무엇 | 어디에 붙나 |
|---|---|---|
| 1 | 주간보고 `weekly` | 다섯째 날 고정 요청 |
| 2 | 전자결재 기안 `appr` | 넷째 날 고정 요청 + 포털 결재작성 |
| 3 | PC 비밀번호 변경 `repass` | 다섯째 날 고정 요청 + 시작 메뉴 |
| 4 | 명의도용 체인 `cardstop` | 파문 둘 + 강제 요청 |
| 5 | 톡톡 잡음 `chatter` | 하루 중 흩어져 도착 |
| 6 | 친구 셋 | 톡톡 친구 섹션 |
| 7 | 모범사원 에필로그 | 평범 엔딩 장면 분기 |
| 8 | 엄마 답장 | 진실 엔딩 장면 분기 |

## 공통: 조건부 엔딩 장면

엔딩 장면에 선택적 `when`을 허용한다. 순수 헬퍼가 걸러내고, `Ending.jsx`는
`ending.scenes` 대신 이것을 쓴다.

```js
// A scene may name the week it belongs to. One that names nothing always plays.
export const scenesFor = (ending, state = {}) =>
  ending.scenes.filter((sc) => sceneHolds(sc.when, state))

export function sceneHolds(when, { slips = 0, overtime = {}, grants = {}, days = 5 } = {}) {
  if (!when) return true
  if (when.slipsAtMost !== undefined && slips > when.slipsAtMost) return false
  if (when.noOvertime && Array.from({ length: days }, (_, i) => overtime[i + 1]).some(Boolean)) return false
  if (when.grant && !grants[when.grant]) return false
  if (when.notGrant && grants[when.notGrant]) return false
  return true
}
```

파문의 `rippleHolds`를 재사용하지 않는다 — 그쪽은 "아침에 도착하는 사건"의 문법이고
이쪽은 "이 장면을 트냐"의 문법이다. 섞으면 둘 다 읽기 어려워진다.

`Ending.jsx`는 `const scenes = scenesFor(ending, state)` 하나만 바뀌고, 나머지
(`i`, `shown`, 클릭 진행)는 그대로다.

## 1. 주간보고 `weekly`

다섯째 날, 요청이 끝나갈 무렵 팀장이 부른다.

- objective `{ id: "weekly", title: "팀장에게 주간보고 회신하기", grant: "weekly" }`.
  `days[4].requests` + `pool.fixed["5"]` 양쪽에 넣는다(고정 1→2, 뽑는 수 -1,
  `sizes["5"]`는 그대로 21).
- beat(`boss`): "가기 전에 주간보고 하나만. 이번 주 견적 나간 거래처 다섯 곳,
  한 줄로 정리해서 줘요. 순서는 상관없어요."
- `accept: [["A상사", "B물산", "C테크", "D유통", "E마트"]]` — 배열 항목은 모든 조각이
  다 들어가야 맞는 기존 문법이다. 엔진은 손대지 않는다.
- 힌트 3단: 받은편지함에 닷새치가 다 있다 → 거래처 이름만 → 발주현황 시트에도 있다.
- **뽑힌 요청에 따라 답이 달라지게 하지 않는다.** 지나간 날의 뽑기 결과는 플레이어가
  되짚을 수 없어 "찾을 수 있는 답"이 아니게 된다. 고정 다섯 곳은 메일함에 남아 있다.

## 2. 전자결재 기안 `appr`

포털 내문서 패널의 **결재작성**(지금은 장식)이 진짜가 된다.

- objective `{ id: "appr", title: "D유통 건 품의 올리기", grant: "appr" }`,
  `days[3].requests` + `pool.fixed["4"]`.
- beat(`boss`): "D유통 재거래 건, 견적 나가기 전에 품의부터 올려요. 포털 내문서에서
  결재작성. 금액은 견적서 총액 그대로, 결재자는 나로 해요."
- `scenario.appr`:
  ```json
  {
    "title": "전자결재 기안",
    "fields": { "title": "제목", "amount": "금액", "approver": "결재자" },
    "needsTitle": "D유통",
    "amount": "2070000",
    "approver": "박민석",
    "hint": "결재자는 이름으로 입력합니다.",
    "ok": { "state": "진행", "note": "상신되었습니다. 결재자 확인을 기다립니다." },
    "bad": {
      "title": "제목에 어느 건인지 드러나야 합니다.",
      "amount": "금액이 견적서 총액과 다릅니다.",
      "approver": "결재선에 그런 사람이 없습니다."
    },
    "approved": {
      "source": "workMessenger", "thread": "boss", "from": "박 팀장", "delay": 4200,
      "lines": ["결재 올라온 거 봤어요. 승인했습니다.", "이제 견적서 보내도 돼요."]
    }
  }
  ```
- 순수 판정 `apprFits(spec, form)` → `null`(통과) 또는 틀린 필드 키. 금액은 쉼표·공백·
  '원' 무시하고 비교, 제목은 `needsTitle` 포함 여부, 결재자는 공백 무시 일치.
- `submitAppr(form)`: 통과면 `grant('appr')` + `approved` beat 예약. 아니면 `slip()`과
  해당 `bad` 문구 반환(폼에 그대로 표시).
- **팀장 실명을 게임 안에 먼저 심는다.** 확인해 보니 게임 전체에 "박 팀장"만 103번
  나오고 실명은 어디에도 없다. 심지 않고 정답으로 쓰면 찾을 수 없는 답이 된다.
  실명은 **박민석**, 세 곳에 심는다:
  - 포털 직원 현황: `{ id: "boss", name: "박민석 팀장", team: "영업1팀 팀장", note: "재실" }`
    — 지금 `name`이 "박 팀장"인 항목을 고친다. 다른 둘(이준호 대리·최민서 사원)은
    이미 실명이라 결이 맞는다.
  - 사내위키 '사내 계정 안내'나 결재 규정 문서의 담당자 줄에 한 번.
  - A상사 견적 품의 등 기존 내문서 목록의 기안자/결재자 표기에 한 번.
  대화에서는 계속 "박 팀장"이다. 날마다 얘기하던 상사의 이름을 결재 칸 앞에서야
  찾아보게 되는 것이 이 퍼즐의 맛이다.
  `apprFits`는 "박민석"과 "박민석 팀장"을 모두 받는다(직함은 있어도 없어도 통과).
- 승인 뒤 내문서 목록 맨 위에 `{ state: "진행", title: "D유통 BS-200 견적서 발송 품의",
  date: "방금" }` 한 줄이 붙는다(`grants.appr`일 때만).

## 3. PC 비밀번호 변경 `repass`

- objective `{ id: "repass", title: "PC 잠금 비밀번호 변경하기", grant: "repass" }`,
  `days[4].requests` + `pool.fixed["5"]`. (2번과 합쳐 다섯째 날 고정은 셋이 된다.)
- beat(`security`): "분기 보안점검입니다. PC 잠금 비밀번호를 오늘 중 변경해 주세요.
  시작 메뉴 > 비밀번호 변경. 변경되면 저희 쪽에 자동으로 기록되니 따로 회신 안 하셔도
  됩니다." — **답장 없는 요청**이다. 폼을 제출하면 끝난다.
- 시작 메뉴 '게임' 목록 옆에 **비밀번호 변경** 항목. 폼 세 칸: 현재 / 새 비밀번호 /
  힌트(필수).
- `scenario.lock.change`:
  ```json
  {
    "title": "비밀번호 변경",
    "fields": { "old": "현재 비밀번호", "next": "새 비밀번호", "hint": "비밀번호 힌트" },
    "rules": { "minLength": 4 },
    "bad": {
      "old": "현재 비밀번호가 올바르지 않습니다.",
      "next": "새 비밀번호는 4자 이상이어야 하며, 현재 비밀번호와 달라야 합니다.",
      "hint": "힌트를 입력해 주세요. 잊었을 때 잠금 화면에 표시됩니다."
    },
    "done": "비밀번호가 변경되었습니다."
  }
  ```
- 순수 판정 `passFits(lock, state, form)` → `null` 또는 틀린 필드 키.
- store: `pcPassword`, `pcHint`(둘 다 PROGRESS). `changePassword(form)`가 세팅하고
  `grant('repass')`.
- `Lock.jsx`: `pcPassword ?? scenario.lock.password`, 힌트도 `pcHint ?? scenario.lock.hint`.
  **소프트락이 없다** — 힌트는 본인이 쓴 문구고, 틀리면 화면에 뜬다.
- 기존 `test/lock.test.js`(사원증에 초기 비밀번호가 적혀 있다)는 그대로 통과한다.

## 4. 명의도용 체인 `cardstop`

감염(`grants.infected`)의 꼬리. 지금은 잔소리 한 번으로 끝난다.

- 파문 `idtheft_signs` — `when: { grant: "infected" }`.
  - beat는 카드 봇으로 간다: `thread: "card"`, 새벽 해외승인
    "[Web발신] 우리카드 승인 한*별님 / USD 1,299.00 / 08/26 03:41 / MYSTERY ELECTRONICS".
  - `effect: { extraRequest: "cardstop" }`.
- objective `{ id: "cardstop", title: "정보보안팀에 부정승인 가맹점 알려주기", grant: "cardstop" }`.
  요청 beat는 파문과 같은 아침에 `security`로 온다: "감염 시점에 카드정보가 함께
  유출된 정황이 있습니다. 카드사 정지는 저희가 넣었고, 확인차 **승인 문자에 찍힌
  가맹점명**을 그대로 알려주세요."
  - `accept: ["MYSTERY ELECTRONICS"]`. 힌트는 톡톡 우리카드 알림을 보라고만 한다.
  - 처리하면 카드 봇이 닫는다: "해외 승인 1건이 취소되었습니다. 카드가 정지되었습니다."
- 파문 `idtheft_ignored` — `when: { grant: "infected", notGrant: "cardstop", afterDays: 2 }`,
  `effect: { slipPenalty: 3 }`, beat(`boss`): "경리팀에서 연락 왔어요. 카드 도용 건,
  법인 경비 카드였으면 어쩔 뻔했어요."
  - `afterDays`는 기존 `forgery_unreported`와 같은 문법이라 `doneLongEnough`가
    `ripples['_' + when.grant]`를 읽는다. 확인함: `watched(scenario, key)`는
    `when.grant`를 쓰는 파문이 있으면 참이 되고 `grant()`가 그때 날짜 도장을 찍으므로,
    이 파문을 추가하는 것만으로 `infected`가 자동으로 감시 대상이 된다. 코드 변경 없음.
- 가맹점명은 **파문이 push하는 메시지에만** 존재한다. 시나리오 정적 텍스트에 없다 —
  테스트로 강제한다.

## 5. 톡톡 잡음 `chatter`

하루 중 흩어져 도착하고, 대부분은 조용히 쌓인다.

```json
"chatter": {
  "perDay": { "1": 2, "2": 3, "3": 4, "4": 5, "5": 6 },
  "spread": [40000, 240000],
  "pool": [ { "id": "...", "thread": "...", "from": "...", "lines": ["..."], "toast": false } ]
}
```

- `startDay(n)`이 `chatterFor(scenario, n, chattered, pick)`으로 그날치를 뽑는다.
  요청 풀과 같은 규칙 — **한 번 뽑힌 건 다시 안 뽑는다**(`chattered`, PROGRESS 포함).
  주마다 조합이 다르다.
- 예약 간격은 `spread` 사이를 개수만큼 나눠 흩뿌린다. 업무 beat(3.6초+4.2초 간격)와
  겹치지 않게 훨씬 느슨하다.
- 기본 `toast: false` — 진동 없이 **미읽음 배지만** 늘어난다. `unreadOf`가 이미
  계산하므로 셸은 손댈 것이 없다.
- 풀은 잡음 20여 개 + `real` 섞임 몇 개. `real` 항목도 **정답 문자열을 담지 않고**
  어디를 보라고만 한다(소통방 규칙과 동일). 그날 뽑힌 요청과 연동하지 않는다 —
  어긋날 수 있다. 항상 유효한 확인 사살만 넣는다:
  - 지현 "아 맞다 복합기 7층 거 맞지? 저번에 거기서 봤는데"
  - 한진택배 "부재중이라 경비실에 맡겨두었습니다"
  - 강 사장님 "귤 사진 잘 받았어요? 안 왔으면 다시 보낼게요"
- 잡음 예시: 다온쇼핑 세일, 0508 대출 광고, 다온모바일 데이터 소진, 지현의 "야 이거
  봐봐 ㅋㅋㅋ / 아 링크 안 보내짐", 엄마의 반찬 사진 예고.

## 6. 친구 셋

친구 섹션이 셋(지현·엄마·강 사장님)뿐이라 34살 직장인 톡톡치고 비어 있다. 셋을 더한다.
얼굴 에셋은 없어도 색상 원으로 렌더되므로 새 svg는 만들지 않는다.

- **정우진 `woojin` · 전 직장 동료** — 먼저 이직해 나간 선배. 밖에서 회사를 비추는
  거울: 연봉·야근·워크숍을 비교한다. 과거 메시지 5~6개.
  `real` 잡음 하나를 여기로: "너희 아직 그 복합기 쓰냐 ㅋㅋ 7층 거."
- **고등학교 단톡방 `class3` · `room: true`, `muted: true`** — 5명이 떠드는 단톡.
  결혼·집값·애 얘기. 나는 거의 안 읽는다. 잡음 발생기로 최적이고, 미읽음이 쌓이는 게
  자연스러운 유일한 자리다. 발신자 이름으로 얼굴을 찾는 기존 `room` 문법을 쓴다.
- **러닝크루 `crew` · `room: true`** — 취미 모임. "오늘 저녁 7시 한강 오실 분?"이
  매일 뜨는데 나는 야근이라 못 간다.
  - 파문 하나를 붙인다: `missed_crew` — `when: { overtimeStreak: 3 }`,
    beat(`crew`): "한별님 요즘 통 안 보이시네요. 무리하지 마시고 컨디션 되면 나오세요."
    잔소리가 아니라 초대여서 과로 테마에 더 아프게 붙는다.

## 7. 모범사원 에필로그

평범 엔딩에 장면 하나가 조건부로 붙는다. 잠금 조건은 넣지 않는다 — 잠금 0회면
애초에 과로 엔딩이라 평범 엔딩에 닿지 않는다.

- `ending.plain.scenes`의 지현 장면과 엄마 장면 사이에:
  ```json
  {
    "style": "chat", "who": "박 팀장",
    "when": { "slipsAtMost": 2, "noOvertime": true },
    "lines": [
      "김대리, 아까 부장님이 물어보셨어요. 복귀한 사람이 제일 멀쩡하다고.",
      "이번 주 회신 하나도 안 틀렸고, 야근도 없었죠. 그게 제일 어려운 건데.",
      "다음 주도 그렇게 해요. 딱 그만큼만."
    ],
    "note": "칭찬받을 만한 한 주였습니다. 아무 일도 없었다는 뜻입니다."
  }
  ```
- 금요일 아침의 `clean_week` 파문(실수 ≤2 칭찬)과 짝이 된다 — 아침에 예고, 엔딩에서 회수.

## 8. 엄마 답장

부고를 연 뒤, 엄마가 한 통 더 보낸다. 답장하느냐 마느냐로 진실 엔딩의 엄마 장면이
갈린다.

- `ending.mother`:
  ```json
  {
    "source": "privateMessenger", "thread": "mom", "from": "엄마", "delay": 8200,
    "lines": ["한별아 자니", "엄마가 이상한 꿈을 꿨어. 목소리 한번 듣고 싶어서", "바쁘면 답장 안 해도 돼. 밥은 챙겨 먹고"],
    "ask": {
      "placeholder": "엄마에게 답장하기",
      "open": true,
      "grants": "momReply",
      "ok": ["…", "그래. 자라 우리 딸"]
    }
  }
  ```
- **열린 질문** — `ask.open`이면 `Messenger.answer()`가 `answerFits` 없이 무엇이든
  정답으로 친다. 오답도 `slip`도 없다. 무슨 말을 하느냐가 아니라 하느냐가 전부라
  정답 목록이 없는 게 맞다. 한 줄 분기다:
  ```js
  if (ask.open || (!ask.files && answerFits(ask, text))) solved()
  ```
- **발동 조건** — `grants.address`가 이미 있을 때만 보낸다. 엄마 스레드에는 둘째 날
  회사 주소 ask가 살아 있고, pendingAsk가 그것을 영구히 가려버리면 안 된다.
  부고를 주소 요청보다 먼저 여는 경우를 위해 `grant()`에도 훅을 건다 — `address`가
  들어오는 순간, 부고를 이미 봤다면 그때 보낸다. 놓치는 순서가 없다.
- **엔딩 분기** — 진실 엔딩의 엄마 장면(현재 index 3)이 둘로 갈린다.
  - `when: { notGrant: "momReply" }` — 지금 그대로. "귤은 상 위에 올라갔습니다.
    통장에 들어온 돈은 노잣돈이었습니다."
  - `when: { grant: "momReply" }` — 같은 대사, 다른 note:
    "답장은 도착하지 않았습니다. 그래도 엄마는 휴대폰을 오래 들여다봤습니다.
    보낸 사람 없는 답장이 하나, 임시저장함에 남아 있었습니다."
  - 죽은 사람의 답장은 **전송되지 않는다**. 플레이어는 보냈지만 세계는 받지 못했다.
    진실 엔딩의 규칙(죽음은 사실이다)을 깨지 않으면서 플레이어의 행동을 회수한다.

## 테스트

`test/paperwork.test.js` — 주간보고·전자결재·비밀번호
- `weekly`의 accept가 배열 하나이고 거래처 다섯이 다 들어 있다. 다섯 곳이 전부
  받은편지함 메일 제목에 실제로 등장한다.
- `apprFits`: 통과, 그리고 세 필드 각각의 오답이 그 필드 키를 돌려준다. 금액은
  쉼표·'원'·공백을 용서한다. 결재자는 직함이 있어도 없어도 통과한다.
- **결재자 실명이 게임 안에서 찾아진다**: 포털 직원 현황에 있고, 그 밖에도 최소
  한 곳 더 등장한다. 그리고 그 이름이 어떤 힌트 대사에도 들어 있지 않다.
- `passFits`: 현재 비밀번호 불일치, 너무 짧음, 현재와 같음, 힌트 없음 — 각각 그 키.
  통과 후 `pcPassword`/`pcHint`가 서고 `grants.repass`가 선다.
- `weekly`/`appr`/`repass`가 `days[n].requests`와 `pool.fixed[n]`에 짝으로 들어 있고,
  `pool.sizes`는 변하지 않았다.

`test/idtheft.test.js`
- `idtheft_signs`는 `infected` 없이는 안 뜨고, 있으면 뜬다. `cardstop`을 강제 요청으로
  얹는다.
- 가맹점명이 시나리오 정적 텍스트 어디에도 없다(파문 beat 안에만 있다).
- `idtheft_ignored`는 `cardstop`을 처리하면 영영 안 뜨고, 이틀 방치하면 뜬다.
- `watched(scenario, 'infected')`가 참이라 도장이 찍힌다.

`test/chatter.test.js`
- `perDay` 합이 풀 크기를 넘지 않는다(한 주에 다 뽑아도 모자라지 않는다).
- 뽑기는 중복이 없고, 뽑힌 것은 다시 안 뽑힌다.
- 모든 `chatter.pool[].thread`가 실제 톡톡 스레드 id다.
- `real` 항목을 포함해 어떤 chatter 텍스트도 게임의 어떤 `ask.accept` 값을 담지 않는다.
- 친구 셋이 톡톡 친구 섹션에 있고, `room: true` 둘은 발신자가 여럿이다.

`test/ending.test.js`에 추가
- `sceneHolds`: 조건 없는 장면은 항상, `slipsAtMost`/`noOvertime`/`grant`/`notGrant`
  각각이 맞는 주에만.
- 모범사원 장면은 깨끗한 주에만 나오고, 야근 한 번이라도 있으면 안 나온다.
- 진실 엔딩의 엄마 장면은 `momReply` 유무로 정확히 하나만 나온다(둘 다 나오지 않는다).
- `ask.open`은 아무 문자열이나 받고 `slips`를 올리지 않는다.
- 엄마 이벤트는 `address` 없이는 안 오고, 부고를 열지 않으면 안 온다.
