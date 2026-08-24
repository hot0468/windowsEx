# 주소창으로 할 수 있는 것들 — 설계

2026-08-24. 주소창을 입력 장치로 만든다: 경로, IP, 특수 주소, 그리고 그 위에 얹는 사이트 7종과 풀 요청 4건.

## 해석 (store, 순수 함수)

- `parseAddress(raw)` → `{ host, path }`. 프로토콜 제거, 소문자, 첫 `/`에서 분리, 끝 `/` 제거.
- `resolveSite(scenario, edits, host)` → site | null. 정확한 `url` 일치 우선. host가 IPv4이면 hosts 파일(기본+편집)과 `hosts.required`에서 그 IP를 가진 이름을 찾아 그 사이트를 돌려준다 (IP로 들어오면 이름 등록 여부는 묻지 않는다).
- `specialPage(host)` → `'blank' | 'refused' | null` (`about:blank`, `localhost`/`127.0.0.1`).
- `pathKnown(site, path)` → 경로 없음이면 true; wiki는 `wiki.pages[path.slice(1)]`, portal은 `site.pages[path]`, 그 외 false. 모르는 경로는 404 화면(`site.notFound` 안내문 포함).
- Browser: `page = { kind:'site', url: host, path }`. IP인데 사이트가 없으면 `ERR_CONNECTION_TIMED_OUT`, 이름이면 기존 `ERR_NAME_NOT_RESOLVED`.

## 사이트

| url | layout | 비고 |
|---|---|---|
| `192.168.10.1` | `router` | 공유기 관리 — 접속 기기표(이름·IP·MAC). unlisted |
| `print.ar.local` (= `192.168.10.9`) | `printerweb` | 복합기 웹 관리 — 상태·토너·대기열·오류 로그. 접수번호는 싣지 않는다. requiresHost(기본 hosts에 있음) |
| `asangsa.co.kr` `bmulsan.co.kr` `ctech.co.kr` | `vendor`(corp) | 회사 소개·오시는 길(도로명 주소)·대표번호·팩스. `companies[].url`로 검색 결과에서 링크 |
| `wiki.ar.co.kr/asset` | (wiki 숨은 페이지) | IT 자산 관리 대장. nav에 없고 경로로만. wiki `notFound`가 규칙을 알려줌 |
| `ar-security.co.kr` | `phish` | 진짜처럼 생긴 통합 로그인. 무엇이든 제출하면 `phished` grant + 정보보안팀 질책. unlisted |
| `emart-corp.co.kr` | (generic) | 만료된 도메인 파킹 페이지. unlisted |
| `portal.ar.co.kr/hr/events` | (portal 경로 페이지) | 워크숍 참가 표명 폼 → 접수번호. 포털 상단 nav '인사관리'가 링크 |

## 풀 요청

- `aaddr` 박 팀장 — A상사 방문 주소(도로명) → `asangsa.co.kr`에만 있음.
- `cfax` 이준호 — C테크 팩스번호 → `ctech.co.kr`에만.
- `assetno` 회계팀 — 복합기 자산번호 → `wiki.ar.co.kr/asset`에만. 대사가 "주소 뒤에 /asset"을 알려준다.
- `rsvp` 박 팀장 — 워크숍 참가 표명 접수번호 → 폼 제출 화면에만.

accept는 전부 기존 148개와 겹치지 않고, 게시판·봇·뉴스·기업정보에는 싣지 않는다.

## 테스트

`test/url.test.js`: 해석 함수들, IP→사이트, 404 판정, 숨은 위키 페이지가 nav에 없음, 피싱/파킹/공유기가 unlisted·북마크·기록에 없음, 새 답이 각자 한 곳에만 있음, 새 레이아웃 4종 렌더 스모크.
