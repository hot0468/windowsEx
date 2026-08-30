# 행동으로 푸는 요청 (deed asks) — 설계

## 왜

요청 단계 226개 중 194개(86%)가 "어딘가에서 값을 찾아 메신저에 타이핑", 32개가
"파일 찾아 첨부", 그 밖은 0이다. 게임 안에 이미 있는 다른 동사들(셀 고쳐 저장,
메일 보내기, 인쇄, 예약, 즐겨찾기…)은 1일차 고정 요청과 이스터에그에만 쓰이고
2~5일차를 채우는 pool 148건은 전부 "찾아서 타이핑"이다.

이 설계는 **완료 방식**을 늘린다. 답을 치는 대신 그 앱에서 그 일을 한다.
생각하는 방식(판단·비교·계산·거절)의 다양화는 다음 설계.

## 범위

- 엔진: `ask.deed` — 텍스트 대신 grant를 기다리는 ask.
- 행동 네 가지: **셀 고쳐 저장**(있음), **메일 보내기**, **파일 이동·이름 바꾸기**,
  **사내 드라이브에 올리기**.
- 콘텐츠: pool에 16건 추가(종류당 4). 기존 요청은 건드리지 않는다.

## 1. 엔진: `ask.deed`

```json
{ "deed": true, "grants": "<objective id>",
  "placeholder": "발주현황 시트를 고쳐 저장하면 확인됩니다",
  "ok": [...], "no": [[...],[...],[...]], "next": [] }
```

- `accept`·`files`와 배타. `grants`는 필수이며 검사 스펙을 가진 objective의 id.
- **메신저**: deed ask가 열려 있으면 입력창·보내기 버튼 대신 `placeholder`를
  안내문으로 보여 주고 힌트 버튼만 둔다. 파일을 떨어뜨리면 `shrug`.
- **해결**: `store.grant(key)`가 grant를 켠 뒤, `pendingAsks` 중 첫 단계가
  `deed && grants === key`인 스레드를 찾아 지금 `Messenger.solved()`가 하는
  일을 store 안에서 한다 — `setAsk(then)`, `setBranch(next)`, `saying(ok)`.
  창이 닫혀 있어도 대화는 진행된다. 이미 grant는 켜졌으므로 다시 켜지 않는다.
- 체인: deed 단계는 `then` 어디에나 올 수 있다. `grants`는 마지막 단계에만
  이라는 규칙은 deed 단계에 한해 예외 — deed의 `grants`는 "무엇을 기다리는지"
  이지 보상이 아니다. 테스트는 deed 단계의 grants가 objective id인지로 구분한다.
- `freshenAsks`/`stampAsks`: 변경 없음(자리표는 그대로 찍힌다).

## 2. 행동별 검사 (objective 스펙 + store 평가자)

| 행동 | objective 키 | 평가 시점 | 상태 |
|---|---|---|---|
| 셀 | `cell: {file, sheet, row, col, value}` | `saveSheet` → `checkCells` | `sheetEdits` (있음) |
| 메일 | `mail: {to, requiredAttachment?, requiredKeywords?, reply, wrongAttachmentReply?, missingKeywordReply?, unclearReply?}` | `sendMail` | `extraMails` (있음) |
| 이동 | `move: {file, into}` — `into`는 폴더 경로 `"문서/거래처/D유통"` | `placeFile` → `checkPlaced` | `placed` (신규) |
| 이름 | `rename: {file, name}` | 같음 | 같음 |
| 업로드 | `upload: {file, page}` — `page`는 드라이브 `wiki.pages` 키 | `uploadTo` → `checkUploaded` | `uploaded` (신규) |

### 메일
- `sendMail({to, subject, body, attachmentId})`: 지금은 그날 `fetch` 하나만 본다.
  후보를 `[fetch, ...아직 안 켜진 mail objective들]`로 넓혀 `to`가 맞는 첫
  후보를 고른다. 검사는 `checkOutbound`(키워드·예절) + 첨부 검사(`sendReply`가
  쓰는 것과 같은 규칙). 답장·잔소리는 그 후보의 것.
- `Compose`는 이미 `attachmentId`를 넘긴다. `sendMail`이 받아 쓰기만 하면 된다.
- 맞는 후보가 없으면 지금처럼 `goal.bounce`.

### 이동·이름 바꾸기
- 상태 `placed: {[fileId]: {into?: string, name?: string}}`, PROGRESS 등록.
- `fsView`가 적용: `into`가 있으면 원래 자리에서 빼고 목적 폴더 `children`에
  넣는다(폴더 없으면 무시하고 원래 자리). `name`이 있으면 이름을 바꾼다.
  `attached`/`restored`/`pinned`/타일 뷰와 순서를 맞춘다 — 뷰는 하나로 합성된다.
- UI(FileExplorer): 파일 우클릭 메뉴에 **잘라내기 · 이름 바꾸기**, 폴더 빈자리
  우클릭에 **붙여넣기**. 단축키 Ctrl+X / Ctrl+V / F2. 잘라낸 것은 `clipboard`
  (세이브 안 함). 이름 바꾸기는 인라인 입력, 확장자는 그대로 두고 본문만 바꾼다.
- 폰 셸: 길게 누르기 대신 항목의 ⋯ 메뉴로 같은 셋.
- 파일 id는 옮겨도 그대로 — 첨부·objective·힌트가 id로 잡는다.

### 업로드
- 상태 `uploaded: {[pageKey]: fileId[]}`, PROGRESS 등록.
- Drive 페이지 상단에 **업로드** 버튼 → `FileDialog`(첨부에 쓰는 것) → 고른
  파일이 그 페이지 아래 "올린 파일" 표에 이름·크기·올린 사람(김한별)·시각
  (게임 시계)으로 붙는다. 같은 파일은 두 번 안 올라간다.
- `requiresVpn` 등 드라이브 접근 조건은 그대로 — 올리려면 먼저 들어가야 한다.

## 3. 콘텐츠 — pool 16건

종류당 4건. 2건은 `before:3`(무엇을 어디서 어떻게 바꿀지 말해 줌), 2건은
`after:4`(바꿀 값·보낼 곳·올릴 파일을 게임 안 다른 데서 찾아와야 함).
스레드는 기존 인물들에 고르게(boss/minseo/junho/soyoung/payroll/security).

예시(확정은 계획 단계에서):
- 셀: "발주현황의 C테크 상태를 '납품 완료'로" / "재고표 BS-200 수량을 B물산이
  회신한 수량으로" (값은 메일에 있음).
- 메일: "C테크 발주계획 파일 김영민 대리한테 회신 말고 새 메일로" / "D유통
  김과장한테 견적서 첨부해서 보내 줘" (주소는 D유통 파트너 포털에 있음).
- 이동: "다운로드에 받은 카탈로그 문서/거래처/B물산으로 옮겨 줘" / "견적서
  파일명 뒤에 _v2 붙여 줘".
- 업로드: "받은 발주계획 드라이브 '거래처 납품 이력' 페이지에 올려 둬" —
  fetch(메일로 받기) 뒤에 오는 체인.

규칙: 대사에 정답 문자열 없음(누출 테스트 그대로), 숨긴 항목 규칙, 힌트 3단계
(마지막은 파일·폴더·페이지·셀을 정확히 지목), `after:4` 첫 대사에 파일·폴더명
금지.

## 4. 테스트

시나리오 불변식(`scenario.test.js` 계열):
- deed ask는 accept 존재·충돌 검사를 **면제**받되, `grants`가 검사 스펙
  (`cell|mail|move|rename|upload`)을 가진 objective를 가리켜야 한다.
- `cell.file`·`move.file`·`rename.file`·`upload.file`은 실존 파일 id.
  `move.into`는 실존 폴더 경로, `upload.page`는 드라이브 페이지 키.
- `mail.to`는 게임 안 어딘가(사이트·메일·메시지·파일)에 글자 그대로 있어야 한다.
- 힌트 3단계 규칙, 숨긴 항목 규칙, ok/placeholder/next 필수 — deed에도 적용.
- deed 단계의 `grants`는 중간 단계 허용(그 grants가 스펙 있는 objective일 때만).

엔진(`deed.test.js`):
- 셀 저장 → 해당 스레드 ask가 `then`으로 넘어가고 `ok`가 대화에 남는다.
  저장 전 편집만으로는 아무 일도 없다.
- 맞는 수신자+첨부+키워드 메일 → ok. 수신자만 맞고 첨부 틀림 → 그 답장,
  ask는 그대로. 후보 없는 수신자 → bounce.
- 이동·이름 바꾸기 → `fsView`에 반영되고 ok. 다른 폴더로 옮기면 침묵.
  옮긴 뒤에도 파일 id로 첨부가 된다.
- 업로드 → 페이지에 목록이 붙고 ok. 다른 페이지에 올리면 침묵.
- 메신저 창이 닫힌 채로 행동해도 대화가 진행된다.
- 세이브 왕복: `placed`·`uploaded`가 살아남는다.

## 안 하는 것

- 파일 복사·삭제·새 폴더. 생각하는 방식의 다양화(판단·비교·계산). 기존 요청의
  행동형 전환.
