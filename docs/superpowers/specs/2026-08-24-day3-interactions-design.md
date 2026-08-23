# 3일차 · Cmd 퍼즐 · 시트 편집 · 파일 드래그 답변 · 화면 잠금 — 설계

2026-08-24. 네 가지 상호작용을 추가하고, 그 요청들을 담을 셋째 날을 만든다.

## 셋째 날 (8월 25일 수)

- 메일 과제: C테크 김영민 대리 `mail_ctech` — "견적서 재발송 + 본문에 총액" → `file_qc` + `256,000`. (2일차에 이준호가 이미 같은 금액을 물어봤으므로 아는 값으로 하루를 연다.)
- 요청 6개: `quote_c`(메일) · `mac`(Cmd) · `print`(프린터, 2일차에서 이동) · `orders`(시트 셀) · `review`(이준호에게 파일) · `catpic`(엄마에게 사진).
- 2일차 요청은 `print`를 빼서 6개. 1/2/3일 = 6/6/6.
- 프린터 요청 대사는 "C테크 견적서 한 부 출력"으로 바꾼다.
- opening/closing/portal(notice·news)은 3일차 고유 내용.

## ① Cmd

- `scenario.network`에 `mac`(예: `00-1A-7D-4C-9E-21`), `pingMs`(예: 2) 추가.
- `Cmd.jsx`: `ipconfig /all` — 호스트 이름, 물리적 주소, DHCP 사용, IPv4, 서브넷, 게이트웨이, DNS 서버. `ping <host>` — 응답 4줄 + 통계(평균 pingMs). HELP 갱신. 명령은 소문자 비교, 인수는 공백 분리.
- 3일차 ask(정보보안팀): "보안 점검 중, PC 물리적 주소(MAC) 알려주세요" — accept `[mac]`, grant `mac`, 힌트 3단계(명령 프롬프트 → `ipconfig /all` → '물리적 주소' 항목).

## ② 시트 셀 편집

- `Sheet.jsx`: 셀 더블클릭 → `<input>`; Enter 저장, Esc 취소. 헤더 행은 편집 불가.
- store: `sheetEdits: {}` (PROGRESS에 포함) + `editCell(fileId, sheet, r, c, value)`. 키 `${fileId}:${sheet}:${r}:${c}`, 표시 시 `sheetEdits[key] ?? 원본`.
- `editCell`은 저장 후 `scenario.objectives` 중 `cell` 조건(`{file, sheet, row, col, value}`)이 일치하는 것을 찾아 `grant(o.grant)`.
- 순수 헬퍼 `cellKey(fileId, sheet, r, c)`, `cellMatches(objective, sheetEdits)` (양쪽 trim 비교).
- 3일차 beat(박 팀장, ask 없음): "거래처_발주현황.xlsx에서 A상사 상태를 '견적 회신 완료'로 고쳐 놔요." objective `orders = {grant:'orders', cell:{file:'file_xls_orders', sheet:'2026', row:0, col:3, value:'견적 회신 완료'}}`.

## ③ 파일 드래그로 답하기

- `ask.files: [id...]` — `accept` 대신 파일을 원하는 질문. 여러 id면 아무거나 정답.
- `Messenger.jsx` `sendFile`: 현재 ask에 `files`가 있으면 포함 여부로 정답/오답 판정(정답 → ok·grants·then·next, 오답 → `hintAfter`). `files` 없는 ask나 ask 없음 → 기존 `reactTo`. 타이핑 입력은 `files` ask에서 항상 오답(힌트).
- 입력창 placeholder는 ask.placeholder 그대로("파일을 끌어다 놓거나 클립으로 보내주세요").
- 3일차 asks: 이준호 "C테크 신규거래 검토 파일 좀 보내줘" files `[file_ctech_review]` grant `review`; 엄마 "제주도 고양이 사진 하나만 보내줘" files `[file_cat1, file_cat2]` grant `catpic`.

## ④ 화면 잠금

- `scenario.lock = { password: '2104', hint: '사번 뒤 4자리', idleMs: 240000 }`.
- store: `locked: false` (저장 안 함), `lock()`, `unlock()`.
- `shell/Lock.jsx`: 전체 화면. 시계·날짜(오늘 날짜 = `days[day-1].date`), 사용자 이름, 비밀번호 입력, 틀리면 "비밀번호가 올바르지 않습니다" + 힌트 표시. 맞으면 `unlock()`.
- 트리거: 시작 메뉴 **잠금** 항목, `Ctrl+Alt+L`, `idleMs` 동안 pointer/key 입력 없으면 자동. App에서 `locked`면 데스크톱 위에 Lock 렌더(창은 유지).
- 잠금 중 타이머(메신저 스크립트 등)는 그대로 흐른다 — 자리 비운 사이 메시지가 쌓이는 게 자연스럽다.

## 테스트

- 기존: `makes every typed answer obtainable` — `files` ask는 파일 존재 검사로 분기. `never hands a typed answer over` — `accept` 없는 ask 건너뜀. `ties every objective` — `cell` objective의 grant 인정 + 파일·시트 존재 검사.
- 신규: `cmd.test.js`(ipconfig /all에 MAC, ping 평균), `sheet.test.js`(cellKey/cellMatches, orders objective의 파일·시트·열 실제 존재), `lock.test.js`(비밀번호가 사원증 alt에서 유도 가능, lock/unlock 상태), day-3 무결성은 기존 days 테스트로 커버.
