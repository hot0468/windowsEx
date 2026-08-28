import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// body가 user-select: none이라, 값을 보여주는 자리는 하나하나 다시 켜 줘야
// 한다. 안 켜면 화면에는 멀쩡히 보이는데 끌어서 복사가 안 된다 — 크래시도
// 아니고 로그도 안 남아서, 그 값을 손으로 받아치다 오타를 내야 알게 된다.
// VPN 세션 ID가 그랬다.
const css = readFileSync('src/shell/shell.css', 'utf8')

// 이 셀렉터를 그대로 이름으로 가진 규칙들의 본문. 정규식 대신 중괄호로 자른다
// — 셀렉터에 점과 대괄호가 섞여 있어 이스케이프가 오히려 위험하다.
// 주석은 걷어낸다 — 규칙 바로 위에 붙은 주석이 셀렉터 이름에 섞여 든다.
const bare = css.split('/*')
  .map((part, i) => (i ? part.slice(part.indexOf('*/') + 2) : part))
  .join('')

const bodies = (sel) => bare.split('}')
  .map((block) => block.split('{'))
  .filter(([head, body]) => body && head.split(',').map((s) => s.trim()).includes(sel))
  .map(([, body]) => body)

const selectable = (sel) => bodies(sel).some((b) => b.includes('user-select: text'))

describe('옮겨 적어야 하는 값은 고를 수 있다', () => {
  it('body는 기본으로 선택을 끈다 — 이 검사가 필요한 이유', () => {
    expect(bodies('body').some((b) => b.includes('user-select: none'))).toBe(true)
  })

  // 답이 실제로 적혀 있는 자리들. 새 화면을 만들 때 여기 한 줄 늘리는 것이
  // 플레이어가 복사 안 된다고 알려 주는 것보다 싸다.
  const spots = [
    ['설정·상태 패널의 값 (VPN 세션 ID, 복합기 등록 IP, 라우터 게이트웨이)', 'dd'],
    ['한글 문서', '.hwp-text'],
    ['PDF', '.pdf-text'],
    ['메모장', '.np-body'],
    ['시트 셀', '.xl-grid td'],
    ['슬라이드 본문', '.sl-slide li'],
    ['메일 본문', '.md-body'],
    ['웹 사이트', '.page'],
    ['명령 프롬프트', '.cmd-out'],
    ['위키 표', '.wk-table td'],
    ['라우터 표', '.rt-table td'],
    ['메일 보낸사람', '.md-chip'],
    ['메일 제목', '.md-head h3'],
    ['메일 날짜', '.md-date'],
    ['첨부 파일명', '.md-attach-name'],
    ['메신저 말풍선', '.bubble']
  ]

  for (const [what, sel] of spots) {
    it(`${what} — ${sel}`, () => expect(selectable(sel)).toBe(true))
  }
})

// 브라우저는 사이트를 그릴 때 .page 에 bleed 를 붙여 패딩을 이미 0으로 만든다
// (Browser.jsx의 className 계산). 그걸 모르고 화면 쪽에서 음수 마진으로 패딩을
// 또 빼면 컨테이너보다 넓어져 가로 스크롤이 생기고, 머리 쪽이 왼쪽으로 밀린다.
// C테크 홈페이지가 그랬다. 창 폭을 꽉 쓰는 화면들이 같은 길로 가지 않게 막는다.
describe('창 폭을 꽉 쓰는 화면은 패딩을 두 번 빼지 않는다', () => {
  it('.page.bleed 가 패딩을 이미 0으로 만든다', () => {
    expect(bodies('.page.bleed').some((b) => b.includes('padding: 0'))).toBe(true)
  })

  for (const sel of ['.cp', '.dr', '.wk']) {
    it(`${sel} 이 음수 마진으로 빠져나가지 않는다`, () => {
      for (const b of bodies(sel)) expect(b.includes('margin: -'), sel).toBe(false)
    })
  }
})
