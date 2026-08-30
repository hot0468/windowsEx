# windowsEx — 작업 규칙

가짜 Windows 데스크톱 방탈출 게임. **게임 내용은 전부 `src/scenarios/workday.json`(23k줄) 하나에 있고, 코드는 그걸 그리는 뷰어다.** 콘텐츠 작업 = JSON 수정, 기능 작업 = store/컴포넌트 수정.

## 토큰 절약 수칙

- **workday.json을 cat/Read로 열지 마라.** `node scripts/query.mjs <명령>` 으로 조회한다 (`node scripts/query.mjs help`). 요청 한 건의 전 단계는 `ask <grants|pool:id>`, 잡담은 `chatter`, 부름은 `summons`. 구조 파악에 JSON 덤프가 필요했던 적은 없다.
- **shell.css(125KB)·store.js(80KB)도 통째로 Read 말고** `grep -n`으로 위치 찾아 offset/limit로 읽어라. `docs/superpowers/plans/`의 완료된 plan은 읽지 마라.
- 테스트는 먼저 관련 파일만: `npx vitest run test/<관련>.test.js | tail -5`, 마지막에 한 번만 전체 `npm run test:q` (점 리포터 — 실패한 것만 이름이 찍힌다). 문법 검사는 `npm run check` (조용한 빌드).
- JSON 수정은 node 스크립트로 (`JSON.parse` → 수정 → `JSON.stringify(s,null,2)+'\n'`). sed/Edit로 JSON을 건드리지 마라.
- **JS/JSX 수정 시 CRLF 주의**: 대부분 파일이 CRLF다. 스크립트로 고칠 땐 `\r\n→\n` 정규화 후 수정, 저장 시 `\n→\r\n` 복원. bash heredoc 안의 `\n` 리터럴은 자주 깨지니 파이썬(io, newline='') 또는 Edit 도구를 써라. **여러 줄 파이썬은 heredoc으로 넘기지 말고 스크래치패드에 `.py`로 써서 실행하라** — 따옴표·괄호가 섞이면 heredoc이 통째로 깨지고 아무것도 안 바뀐 채 한 턴을 태운다.
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
- 숨김 폴더/파일 안에만 있는 답은 마지막 `no` 힌트에 **'숨긴 항목'**이라는 말이 있어야 한다 (보기 팝오버 토글 안내). 없으면 소프트락으로 간주해 테스트 실패.
- **행동으로 푸는 ask**: `deed: <objective id>` (+ 마지막 단계면 `grants` 같은 값). accept 검사 면제 대신 그 objective에 `cell|mail|move|rename|upload` 스펙이 있어야 하고, 가리키는 파일·폴더·페이지·주소가 실존해야 한다 (`test/deed.test.js`). `attached` 파일은 쓰지 마라.

## 구조 요점

- `scenario.pool` — 2~5일차 요청은 여기서 무작위로 뽑힌다 (`fixed`/`sizes`/`after`/`before`/`requests[{id,beat}]`). 1일차는 고정. **난이도 곡선**: `before:3` = 위치를 친절히 설명하는 쉬운 요청(2~3일차 전용), `after:4` = 설명 없는 다단계 요청(4~5일차 우선 배정). 새 체인(`ask.then`)은 반드시 `after:4`, 첫 대사에 폴더/파일명을 쓰지 마라 (테스트가 강제).
- `scenario.overtime.days[n]` — 야근 시 추가 요청 3건. `scenario.ripples` — 전날 행동의 나비효과.
- `scenario.chatter` — 요청이 아닌 잡담(`ask` 없는 beat). `days:[..]`면 그날 한가한 잡담(짝수 번째 해결마다 1건, 하루 3건), `after:<objective id>`면 그 일이 끝난 직후 반응. `egg` 메모로 어떤 이스터에그(hint/reaction/lore)인지 적는다. 정답 문자열·ㅋㅋ 금지(테스트).
- 엔딩 10종: `endingFor` 우선순위 = missing(8층) > rumor_told/buried > true(부고) > **wake(부름받고 부고를 끝내 안 봄)** > lotto > overwork > plain. layoff는 오답 90%에서 별도 발동. 전제는 혼수상태 — **휴가 첫날(7/24) 공항 가는 길에 사고**, 제주도는 가지 못했고 닷새는 병상의 꿈. 부고는 5일차(금요일 취합)에만 게시되고, 본 순간에만 죽음이 확정된다 (`docs/endings.md`).
- **관측하면 사라진다**: 부고 스크롤 → `witness()`, 여행 블로그(`scenario.dream`) 끝까지 스크롤 → `readDream()`로 갤러리 사진 10장이 `missing` 처리(`dreamGallery`). 파일을 지우지 말고 이 경로를 쓸 것 — 퍼즐이 쓰는 사진(cat/gyul)은 남겨야 한다.
- **부름**(`scenario.summons`): 4일차 밤 이름 없는 계정이 여는 8단계 질답. 답은 전부 게임 안에 이미 있는 것만 묻고, 마지막 질문은 `free: true`(정답 없음 — 플레이어가 스스로 결론 내는 자리). `grants: summoned` → 부고를 끝내 안 보면 `wake`. **새 질문을 넣을 땐 정답이 게임 안에서 실제로 찾아지는지, 그리고 계정이 결론을 대신 말해버리지 않는지** 테스트가 검사한다.
- **달력은 하나**: `days[0].date`(8월 23일 월) 기준, 실제 2026년과 다르다. 날짜에 요일을 적을 땐 `test/friday.test.js`가 검사한다.
- 상태 저장 목록은 `store.js`의 `PROGRESS` 배열 — 새 진행 상태를 추가하면 반드시 여기에도.
- 설계 문서: `docs/superpowers/specs/`. 테스트 철학: UI가 아니라 "게임이 깨지는 방식"을 검사한다 — 새 퍼즐엔 (a) 답이 실제로 찾아지는가 (b) 답이 새지 않는가 테스트를 같이 넣어라.

## 명령

```bash
npm test                      # 전체 (1100+, 출력이 길다 — test:q 를 써라)
npx vitest run test/x.test.js # 부분
npm run check                 # JSX 문법 검증 (조용한 빌드 — node --check는 JSX 불가)
npm run test:q                # 전체 테스트, 점 리포터
node scripts/query.mjs help   # 시나리오 조회
```
