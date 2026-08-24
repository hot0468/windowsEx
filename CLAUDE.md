# windowsEx — 작업 규칙

가짜 Windows 데스크톱 방탈출 게임. **게임 내용은 전부 `src/scenarios/workday.json`(14k줄) 하나에 있고, 코드는 그걸 그리는 뷰어다.** 콘텐츠 작업 = JSON 수정, 기능 작업 = store/컴포넌트 수정.

## 토큰 절약 수칙

- **workday.json을 cat/Read로 열지 마라.** `node scripts/query.mjs <명령>` 으로 조회한다 (`node scripts/query.mjs help`). 구조 파악에 JSON 덤프가 필요했던 적은 없다.
- 테스트는 먼저 관련 파일만: `npx vitest run test/<관련>.test.js`, 마지막에 한 번만 전체 `npm test`.
- JSON 수정은 node 스크립트로 (`JSON.parse` → 수정 → `JSON.stringify(s,null,2)+'\n'`). sed/Edit로 JSON을 건드리지 마라.
- **JS/JSX 수정 시 CRLF 주의**: 대부분 파일이 CRLF다. 스크립트로 고칠 땐 `\r\n→\n` 정규화 후 수정, 저장 시 `\n→\r\n` 복원. bash heredoc 안의 `\n` 리터럴은 자주 깨지니 파이썬(io, newline='') 또는 Edit 도구를 써라.
- 병렬 에이전트에게 콘텐츠를 맡길 땐 **조각(fragment) JSON을 스크래치패드에 쓰게 하고 병합은 메인이** 한다. 에이전트에게 이 파일(CLAUDE.md)을 먼저 읽으라고 지시하면 규칙 재설명이 필요 없다.
- 다른 Claude 세션이 같은 저장소에서 작업 중일 수 있다. 시작할 때 `git log --oneline -3`과 `git status --short`로 확인하라.

## 시나리오 데이터 불변 규칙 (테스트가 강제함)

새 질문(ask)을 넣을 때:
- `accept` 문자열은 `JSON.stringify({files(allFiles), sites, network, places, booking, printer})` 안에 **글자 그대로** 존재해야 한다.
- accept는 퇴근길/소통방 게시판, 봇 스레드 정적 메시지, `quick`/`next` 목록, `news/qna/terms/companies/blogs`, 급여명세서 내용에 있으면 안 된다.
- 기존 accept와 같거나, 포함하거나, 포함되면 안 된다. **숫자 accept는 자릿수 경계가 강제된다** (`answerFits`).
- `no`는 3단계 힌트(마지막은 폴더/파일/필드를 정확히 지목), `ok`/`placeholder`/`next:[]` 필수.
- **다단계 체인**: `ask.then`으로 잇는다. `grants`는 **마지막 단계에만** (중간 단계에 있으면 테스트 실패).
- objective는 `id === grant`, 전역 유일. 파일 ask는 `files:[실존 id]` (accept와 배타).
- 확장자는 hwp/txt/pptx/xlsx/exe/pdf만 (예외: `hosts`). xlsx `rows`는 열 수와 일치.

## 구조 요점

- `scenario.pool` — 2~5일차 요청은 여기서 무작위로 뽑힌다 (`fixed`/`sizes`/`after`/`requests[{id,beat}]`). 1일차는 고정.
- `scenario.overtime.days[n]` — 야근 시 추가 요청 3건. `scenario.ripples` — 전날 행동의 나비효과.
- 엔딩 9종: `endingFor` 우선순위 = missing(8층) > rumor_told/buried > true(부고) > lotto > overwork > plain. layoff는 오답 90%에서 별도 발동.
- 상태 저장 목록은 `store.js`의 `PROGRESS` 배열 — 새 진행 상태를 추가하면 반드시 여기에도.
- 설계 문서: `docs/superpowers/specs/`. 테스트 철학: UI가 아니라 "게임이 깨지는 방식"을 검사한다 — 새 퍼즐엔 (a) 답이 실제로 찾아지는가 (b) 답이 새지 않는가 테스트를 같이 넣어라.

## 명령

```bash
npm test                      # 전체 (382+)
npx vitest run test/x.test.js # 부분
npm run build                 # JSX 문법 검증 겸용 (node --check는 JSX 불가)
node scripts/query.mjs help   # 시나리오 조회
```
