# 정부25 · 4대보험 가입내역 확인서 발급 — 설계

2026-08-24. 회계팀이 공문서(4대 사회보험 가입내역 확인서)를 요구한다. 플레이어는
브라우저에서 **정부25**를 찾아 들어가고, 휴대폰(톡톡)으로 온 인증번호로 본인확인을
마친 뒤 PDF를 저장해 회계팀 대화방에 끌어다 놓는다.

## 셋째 날에 추가되는 요청

- `days[3].asks`에 회계팀 beat 하나 추가. 급여 오류 질문(`payroll`) 뒤에 줄을 선다
  (`queueAsk`).
  - 대사: 복귀 처리 서류로 4대 사회보험 가입내역 확인서가 필요하다. 정부25에서
    온라인 발급, PDF로 받아 이 대화방에 보내달라. 본인확인은 휴대폰으로.
  - ask: `files: ["file_insurance_cert"]`, `grants: "insurance"`, 힌트 3단계
    (다른 서류다 → 정부25에서 발급, 브라우저 검색 → 정부25 > 확인서 > 본인확인
    (인증번호는 톡톡) > PDF 저장 > 다운로드 폴더에서 끌어오기).
- objective `insurance` "회계팀에 4대보험 가입내역 확인서 보내주기".
- 셋째 날 요청은 11건이 된다. "하루 열 건" 테스트는 "열 건 이상"으로 완화하고,
  날짜 간 편차 ≤ 2 규칙은 그대로 둔다(10/10/11).

## 정부25 사이트

- `sites`에 `{ url: "gov25.go.kr", title: "정부25 - 대한민국 정부 대표 포털", layout: "gov", gov: {...} }`.
  공개 사이트: 로그인·IP 승인 없음. 검색 포털에서 "정부25"로 찾힌다. 북마크에는 없다.
- `gov` 데이터:
  - `services[]`: 발급 가능한 민원 목록. 각 `{ id, title, dept, fee, fileId? }`.
    정답 하나(`4대 사회보험 가입내역 확인서` → `file_insurance_cert`)와 미끼 둘
    (`주민등록표 등본` → `file_resident_cert`, `건강보험 자격득실 확인서` →
    `file_health_cert`). 미끼도 똑같이 발급되고 PDF가 생긴다 — 잘못 보내면
    회계팀 힌트가 잡아준다.
  - `verify`: `{ name: "김한별", code: "847213", source: "privateMessenger",
    thread: "gov", from: "정부25", sms: "[정부25] 본인확인 인증번호 [{code}] …" }`.
- 페이지 흐름(컴포넌트 로컬 상태, 창을 닫으면 처음으로):
  1. **home** — 로고·검색창·"자주 찾는 민원" 카드 목록. 카드의 **발급** → verify.
  2. **verify** — 이름·휴대폰번호 입력, **인증번호 받기** 버튼. 이름이
     `verify.name`과 다르거나 번호가 `010-0000-0000` 꼴이 아니면 오류.
     맞으면 `store.sendCode(gov)`: 톡톡 `gov` 스레드에 SMS 메시지를 `pushMessage`하고
     토스트(app `chat`)를 띄운다. 인증번호 입력칸이 열리고, `codeFits(verify, text)`
     이면 issue로. 틀리면 "인증번호가 일치하지 않습니다". 다시 받기 가능(같은 번호).
  3. **issue** — 문서 미리보기(파일 `content`)와 **PDF 저장**. 클릭하면
     `restoreFile(service.fileId)` → 다운로드 폴더에 나타남. 버튼은
     "다운로드 폴더에 저장됨"으로 바뀌고 비활성.
- 스타일: 관공서 포털 느낌(짙은 남색 헤더, 흰 카드, 단계 표시). 기존 `.lg`/`.blk`
  톤과 맞춘다.

## 톡톡 인증 스레드

- `privateMessenger.sections[알림].threads`에 bot 스레드 `gov`(이름 "정부25",
  sub "본인확인 · 발신전용"). 과거 메시지 2건(휴가 전 등본 발급 알림 등),
  `quick: ["수신 거부하기"]` + 반응 1개 — 기존 알림 봇 규칙을 그대로 따른다.
- 인증번호는 데이터에 미리 들어 있지 않고, `sendCode`가 `verify.sms`의 `{code}`를
  채워 밀어넣는다. 봇 스레드 정적 텍스트에 정답이 새지 않는다는 기존 테스트는
  그대로 통과한다.

## 파일과 PDF 뷰어

- 다운로드 폴더에 `.pdf` 파일 셋(`attached: true` — 저장 전까지는 어디에도 없음.
  메일 첨부와 같은 규칙이므로 `fsView`는 그대로).
  - `file_insurance_cert` `4대사회보험_가입내역확인서.pdf` — 사업장 AR주식회사,
    국민연금/건강보험/고용보험/산재보험 가입일 2021-04-12.
  - `file_resident_cert` `주민등록표등본.pdf`, `file_health_cert`
    `건강보험자격득실확인서.pdf` — 미끼.
- `fileOpener`: `.pdf` → `{ app: 'pdf', icon: 'pdf' }`. 아이콘 `pdf.svg` 추가.
- `apps/Pdf.jsx`: 이름·"PDF" 배지·확대 버튼, 회색 캔버스 위 흰 페이지에 `content`.
  첫 줄은 제목으로 크게, 나머지는 pre. 인쇄 없음.

## store

- `sendCode(gov)` — `pushMessage(verify.thread, { from, text })` + 토스트.
- 순수 헬퍼: `smsFor(verify)`(템플릿 채우기), `codeFits(verify, text)`(공백 무시 일치).

## 테스트 (`test/gov.test.js`)

- 정부25는 공개 사이트(`siteView` → ready)이고 검색 "정부25"로 찾힌다.
- 서비스가 가리키는 파일은 전부 실제로 있고 `.pdf`이며 저장 전에는 숨겨져 있다
  (`fsView`에 없음, `restored` 후 다운로드에 있음).
- `fileOpener`가 `.pdf`를 `pdf` 앱으로 연다.
- `sendCode`가 톡톡 `gov` 스레드에 인증번호를 남기고, `codeFits`가 그 번호를 받는다.
- 회계팀이 원하는 파일이 정부25가 발급하는 파일 중 하나다.
- 인증번호가 시나리오 정적 텍스트(봇 메시지·게시판)에 없다.
- 기존: 하루 요청 수 테스트를 `>= 10`으로 바꾼다.
