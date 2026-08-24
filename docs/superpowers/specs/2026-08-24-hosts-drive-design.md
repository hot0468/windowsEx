# hosts 파일과 사내 드라이브 — 설계

2026-08-24. 셋째 날, 정보보안팀이 사내 드라이브 접속을 부탁한다. 플레이어는 메모장으로
hosts 파일을 열어 한 줄을 직접 적어 넣어야 하고, 그 파일에서 아무도 설명해 주지 않는
주소를 하나 발견한다.

## 파일 시스템

- 새 루트 `로컬 디스크 (C:)` → `Windows/System32/drivers/etc/hosts`.
  `{ id: 'file_hosts', name: 'hosts', editable: true, content }` — 확장자가 없다(테스트 예외).
- 내용: MS 기본 주석, `127.0.0.1 localhost`, `::1 localhost`, 정보전략팀 배포본 두 줄
  (print/ntp.ar.local), 그리고 `192.168.10.77 sotong.ar.local` — "누가 적었는지 모르겠음.
  지우지 말라고 함".

## 편집

- `store.edits` (PROGRESS 포함) + `editFile(fileId, text)`. `contentOf(file, edits)`가
  저장본을 우선한다. `Notepad`는 `file.editable`이면 textarea + 저장 버튼(모노스페이스).
- `hostNames(text)`: 주석(#) 제거 후 `IP 이름…` 파싱. `hostResolves(scenario, edits, url)`:
  `scenario.hosts.required[url]`가 있으면 그 주소와 일치해야, 없으면 등재만 되어 있으면 해석.
- `siteView(site, {…, resolves})`: `site.requiresHost`인데 해석 안 되면 `'error'`
  (ERR_NAME_NOT_RESOLVED 화면 그대로). Browser가 `hostResolves`를 넘긴다.

## 두 사이트

- `drive.ar.local` (layout wiki, requiresHost) — 3분기 실적, 거래처 담당 이력, 경비 처리 지침.
  요청 `drive`는 site objective라 페이지가 열리는 순간 완료된다(`Wiki`가 `unlockSite`).
  hosts에 적어야 할 주소는 `192.168.10.21`, 3일차 정보보안팀 beat가 알려준다.
- `sotong.ar.local` (layout board, requiresHost) — 사내 익명 채팅방. hosts에 이미 적혀 있어
  주소만 브라우저에 치면 들어간다. 인력 조정 명단 소문, 복합기 순서 공유, "이 방 주소는
  지우지 마세요". 북마크·방문기록·검색 어디에도 없다.

## 소통방에 물어보기

- `board.ask = { placeholder, send, posting, waiting, topics[], fallback[] }`.
  `topics[i] = { keys[], replies[{author, text}] }`.
- `roomReply(ask, question, asked)`: 질문에서 공백·대소문자를 지우고 **가장 긴 키워드**가
  걸리는 주제를 고른다('빈자리'가 '자리'보다 우선). 답변은 `asked % replies.length`로 골라
  두 번째로 물으면 다른 사람이 답한다. 걸리는 주제가 없으면 `fallback`.
- 주제 12가지: 위키 비번, 단가·견적, 복합기, IP 승인, hosts·드라이브, 화면 잠금,
  인력 조정·실업급여, 야근, 로또, 괴담·근태, 정부25 서류, 워크숍·회식.
- 모든 답변은 **어디를 보라고만** 말한다. 정답 문자열(요청 accept, 메일 키워드, 위키 비번,
  접수번호, 로또 일련번호)이 답변에 들어가면 테스트가 실패한다.
- Board는 목록 화면에만 질문창을 띄우고, 1.6초 뒤 답이 달린다. 상태는 컴포넌트 로컬 —
  창을 닫으면 대화가 사라진다.

## 테스트 (`test/hosts.test.js`)

hosts의 위치와 편집 가능 여부, 주석 무시 파싱, 소통방이 이미 등재되어 있음, 드라이브는
정확한 주소를 적어야 열림, requiresHost 사이트의 error/ready, 저장 내용 기억, 요청 연결,
숨은 두 페이지에 퍼즐 정답 누출 없음.
