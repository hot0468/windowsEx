# 브라우저에서 내려받아 실행하기 — 설계

2026-08-24. 지금까지 실행 파일은 "이미 다운로드 폴더에 있는 것"(한글)과 "메일 첨부"(가짜 백신)
둘뿐이었다. 브라우저에서 파일을 **내려받아** 실행하는 단계 네 가지를 더한다.

| # | 날 | 무엇 | 어디서 받나 | 성격 |
|---|---|---|---|---|
| 1 | 셋째 | 정부25 보안 프로그램 `AnySign4PC` | 정부25 발급 화면 | 정식 퍼즐 (기존 4대보험 흐름 앞에 끼움) |
| 2 | 둘째 | 사내 VPN `AR-VPN` + hosts | 사내포털 자료실 | 정식 퍼즐 (새 요청 `vpn`) |
| 3 | 넷째 | 거래처 전용 뷰어 `DY Viewer` | D유통 파트너 사이트 | 정식 퍼즐 (기존 `quote_d`에 조건 추가) |
| 4 | 언제든 | "무료 한글 뷰어" | 검색 결과 광고 | 함정 (감염 → 재부팅) |

## 공통: 프로그램 사전 `scenario.programs`

`scenario.hangul`을 `scenario.programs.hangul`로 옮기고, 같은 꼴로 네 개를 더한다.
Installer는 어떤 프로그램인지를 **파일**에서 안다: 실행 파일 항목에 `program: "vpn"` 키.

```
programs.<id> = {
  product, publisher, version, size, setup,     // 기존 한글과 동일
  intro[], steps[], done{title,lines}, already{title,lines},
  grant: "vpnInstalled",                        // 설치 완료 시 grant
  needs: "hangulOk",                            // (선택) 없으면 blocked 패널. 한글만 씀
  blocked: {...},                               // needs가 있을 때만
  shortcut: { label, icon, app },               // (선택) 설치되면 바탕화면·시작 메뉴에 생김
  danger: true,                                 // (선택) 설치 끝나면 crash()
  aftermath: { source, thread, from, lines[] }  // danger일 때 재부팅 후 오는 메시지
}
```

- `Installer`는 `programs[file.program]`을 읽는다. `needs`가 없으면 승인 패널 없이 바로 마법사.
  `danger`면 진행률이 100%가 된 순간 `crash(programId)`.
- `Hwp.jsx`와 `test/hangul.test.js`는 `scenario.programs.hangul`을 읽도록 고친다
  (`missing` 블록은 한글 항목에 그대로 둔다).
- `Desktop`의 `SHORTCUTS` 뒤에 `programs` 중 `shortcut`이 있고 `grants[grant]`인 것을 붙인다.
  시작 메뉴도 같은 목록을 쓴다.

### 감염 일반화

지금 `crash()`/`reboot()`는 `scenario.malware.aftermath` 하나만 안다. `crash(source)`가
`crashSource`를 기억하고, `reboot()`는 `source`가 프로그램 id면 그 프로그램의 `aftermath`를,
아니면 `malware.aftermath`를 밀어넣는다. `infected` grant는 두 경우 모두 같다
(한 번 감염되면 다시 메시지를 보내지 않는 기존 규칙 유지).

## 공통: 브라우저 다운로드

사이트 데이터의 다운로드 항목은 `{ fileId, name, size, label? }`. 공용 컴포넌트
`<Download item />`(Browser 안): 클릭 → `restoreFile(fileId)` + 토스트 "다운로드 완료 — {name}"
+ 버튼이 "다운로드 폴더에 저장됨"으로 바뀌고 비활성. 메일 첨부 저장과 같은 규칙이므로 파일은
`다운로드` 폴더에 `attached: true`로 미리 들어 있다.

### 새 레이아웃 `vendor`

회사 홈페이지 한 장. 정식 파트너 사이트(3)와 스팸 광고 사이트(4)가 같이 쓴다.

```
{ url, title, layout: "vendor", vendor: {
    brand, tagline, theme: "corp" | "spam",
    lines[],                 // 소개 문단
    download: { fileId, name, size, label },
    notes[]                  // 다운로드 버튼 아래 작은 글씨
} }
```

`theme: "spam"`은 원색 배너, 깜빡이는 "지금 다운로드", 가짜 카운터 등 딱 봐도 수상한 톤.
`corp`는 `.lg` 톤의 단정한 기업 페이지.

## 1. 정부25 보안 프로그램

- `gov.security = { title, lines[], download: {fileId:"file_anysign", name:"AnySign4PC_Setup.exe", size:"18MB"}, recheck }`.
- 발급 카드를 누르면 `grants.anysign`이 없을 때 **security** 화면이 먼저 뜬다:
  "본인확인을 위해 키보드보안·인증서 프로그램(AnySign4PC) 설치가 필요합니다." + 다운로드 버튼
  + "설치 확인" 버튼(설치돼 있으면 verify로, 아니면 "아직 설치되지 않았습니다").
- `programs.anysign`: 승인 불필요, 단계 4개, `grant: "anysign"`. 바로가기 없음.
- 셋째 날 회계팀 힌트 2단계에 "보안 프로그램 깔라고 하면 깔아야 넘어간다"를 덧붙인다.
- 미끼 서류도 같은 게이트를 지난다 (Gov 컴포넌트 한 곳에서 처리).

## 2. 사내 VPN

### 둘째 날 요청 `vpn`

- objective `{ id: "vpn", title: "정보보안팀에 VPN 세션 ID 알려주기", grant: "vpn" }`, `days[1].requests`에 추가.
- `days[1].asks`에 정보보안팀 beat (`queueAsk`):
  - "다음 주부터 사내 시스템 접속이 VPN 필수로 바뀝니다. 사내포털 > 자료실에서 AR-VPN 받아
    설치하시고, 연결되면 클라이언트에 뜨는 세션 ID를 알려주세요."
  - ask: `accept: [vpn.session]`, `grants: "vpn"`, 힌트 3단계
    (자료실 → 실행하면 서버를 못 찾는다, 자료실의 설치 안내 PDF 끝까지 → hosts, 메모장).
- 세션 ID `vpn.session = "ARV-7K3Q-92XF"`. 시나리오 정적 텍스트 어디에도 없어야 한다(테스트).

### 사내포털 자료실

- `portal` 배열에 `"files"` 추가, 사이트 `files[]`:
  - `AR-VPN_Setup.exe` (fileId `file_vpn_setup`, program `vpn`)
  - `AR-VPN_설치안내.pdf` (fileId `file_vpn_guide`) — 설치 순서와 맨 끝에
    "※ 사내 배포 PC 일부에서 `vpn.ar.local` 이름 해석이 되지 않는 경우 hosts 파일에
    `192.168.10.5 vpn.ar.local` 을 추가하십시오."
  - `보안서약서_양식.hwp` (fileId `file_pledge`) — 미끼
- 각 항목에 `<Download>` 버튼. 항목 설명 한 줄.

### 프로그램과 앱

- `programs.vpn`: `grant: "vpnInstalled"`, `shortcut: { label: "AR VPN", icon: "vpn", app: "vpn" }`.
  아이콘 `vpn.svg`(방패/자물쇠) 추가.
- 새 앱 `apps/Vpn.jsx` (registry `vpn`, 380×300):
  - 서버 `vpn.ar.local`, 계정 = player.email, **연결** 버튼.
  - 연결 → `hostResolves(scenario, edits, "vpn.ar.local")` 실패면
    "서버 vpn.ar.local 을 찾을 수 없습니다. (DNS 이름을 확인할 수 없음)".
  - 성공이면 1.8초 "연결 중…" 뒤 상태 **연결됨**, 할당 IP `10.8.0.23`, 세션 ID 표시, **연결 끊기**.
  - `hosts.required["vpn.ar.local"] = "192.168.10.5"`.
- store: `vpn: false`, `setVpn(bool)`, PROGRESS에 포함. 재부팅·새 게임이면 끊긴다(`restart`에서 false).

### 셋째 날 드라이브

- `drive.ar.local`에 `requiresVpn: true`. `siteView`에 `vpn` 인자, 안 켜져 있으면 `'vpn'` 뷰
  ("사내망 전용 페이지입니다. VPN에 연결한 뒤 새로 고치세요."). 순서: blocked → vpn → error → ready.
- 정보보안팀 3일차 대사에 "VPN 켠 상태에서" 한 마디, 힌트에도 추가. `sotong.ar.local`은 그대로.

## 3. 거래처 전용 뷰어

- 넷째 날 D유통 메일에 첨부 `D유통_거래조건서.dcx` (fileId `file_d_terms`, 다운로드 폴더 `attached`).
  본문에 3번 항목: "회신 본문에 당사 **품의번호** 기재 (첨부 거래조건서 참조). 첨부는 D유통 파트너
  전용 문서라 partner.dyutong.co.kr 에서 뷰어를 받아야 열립니다."
- `goal.requiredKeywords`에 품의번호 `"DY-PR-260826"` 추가, `missingKeywordReply`를 "금액 또는 품의번호가
  없다"로 고친다. 팀장 개막 대사에 "거기 서류는 지들 뷰어로만 열린대요" 한 줄.
- `fileOpener`: `.dcx` → `{ app: "dcx", icon: "doc" }`. 새 앱 `apps/Dcx.jsx`: `grants.dviewer`가 없으면
  한글의 `missing`과 같은 꼴의 안내 패널("D유통 파트너 뷰어가 필요합니다 — partner.dyutong.co.kr"),
  있으면 Pdf와 비슷한 문서 화면에 `content`.
- 사이트 `partner.dyutong.co.kr` (layout vendor, theme corp): 검색 "D유통"으로 찾힌다.
  다운로드 `DYViewer_Setup.exe` (fileId `file_dyviewer`, program `dviewer`).
- `programs.dviewer`: 승인 불필요, `grant: "dviewer"`, 바로가기 없음.
- `file_d_terms.content`: 거래 재개 조건, 품의번호 `DY-PR-260826`, 담당 윤서아. 품의번호는 이 파일에만 있다.

## 4. 무료 한글 뷰어 함정

- `scenario.ads[]` `{ id, title, url, desc, tags[] }` 하나: "한글 뷰어 무료 다운로드 | hwp 바로 열기"
  → `hwpviewer-free.com`, tags: 한글, hwp, 뷰어, 한글뷰어, 무료.
- 검색 결과 맨 위에 **광고** 블록(`searchIn(ads, q, ['title','desc','tags'])`), "AD" 배지.
- 사이트 `hwpviewer-free.com` (layout vendor, theme spam): `HwpViewer_Free_Setup.exe`
  (fileId `file_fakeviewer`, program `fakeviewer`). 검색 색인에 오르지 않는다(광고로만 노출).
- `programs.fakeviewer`: `danger: true`, 단계 3개, 마지막 단계에서 `crash("fakeviewer")`.
  `aftermath`: 정보보안팀 — "PC에서 악성코드가 탐지돼 강제 종료했습니다. hwpviewer-free.com 에서 받은
  파일이던데, 출처 모르는 설치 파일은 실행하지 마세요. 한글은 정식 배포본으로 설치해 드리겠습니다."
- 기존 복선(지식Q&A "임의로 설치하지 말고 IT팀 승인", 피싱 뉴스)이 이미 있으므로 추가 힌트는 없다.

## 요청 수

둘째 날에 `vpn`이 더해진다. "하루 열 건 이상"과 "날짜 간 편차 ≤ 2" 테스트를 먼저 돌려 보고,
편차가 깨지면 셋째 날 요청 수와 맞춰 조정한다(추가 요청은 만들지 않는다).

## 테스트

`test/programs.test.js`

- 모든 `programs.*.setup`은 다운로드 폴더에 있고 `.exe`이며 `program` 키가 프로그램 id와 맞는다.
- `needs`가 없는 프로그램은 grant 없이도 설치 가능(blocked 없음), `danger` 프로그램은 `aftermath`가 있다.
- 다운로드 항목(`portal.files`, `vendor.download`, `gov.security.download`, 메일 첨부)이 가리키는
  파일은 전부 `attached`이고 실제로 있다.
- `crash("fakeviewer")` → `reboot()`가 프로그램 aftermath를 정보보안팀 스레드에 남기고 `infected`.

`test/vpn.test.js`

- hosts에 vpn 줄이 없으면 `hostResolves` 실패, 적으면 성공.
- `drive.ar.local`은 vpn 꺼져 있으면 `'vpn'`, 켜고 hosts 맞으면 `'ready'`.
- 세션 ID가 정적 텍스트(메신저·게시판·PDF·포털)에 없다. 정보보안팀 ask는 세션 ID만 받는다.
- 설치안내 PDF에 hosts 주소가 있다.

`test/gov.test.js`에 추가: `gov.security.download`는 `programs.anysign.setup`이다.

`test/dcx.test.js`: `.dcx`는 `dcx` 앱, 품의번호는 `file_d_terms`에만 있고 `quote_d` 키워드에 들어 있다,
파트너 사이트가 "D유통" 검색에 나온다, 광고는 "한글 뷰어" 검색에 나오고 스팸 사이트는 사이트 검색에 안 나온다.
