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

  // 답이 실제로 적혀 있는 자리들. 파일 내용을 보여주는 뷰어는 하나도 빠지면
  // 안 된다 — .dcx 뷰어가 빠져 있어서 거래조건서의 결제 조건을 손으로
  // 받아쳐야 했다. 새 화면을 만들 때 여기 한 줄 늘리는 것이
  // 플레이어가 복사 안 된다고 알려 주는 것보다 싸다.
  const spots = [
    ['설정·상태 패널의 값 (VPN 세션 ID, 복합기 등록 IP, 라우터 게이트웨이)', 'dd'],
    ['한글 문서', '.hwp-text'],
    ['PDF', '.pdf-text'],
    ['메모장', '.np-body'],
    ['D유통 전용 뷰어(.dcx)', '.dcx-text'],
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

// 할 일이 길어지면 목록이 아래로 자라 '오늘 업무 마치기' 를 화면 밖으로,
// 또는 작업표시줄 뒤로 밀어냈다. 하루를 끝낼 수가 없으니 그 자리에서 막힌다.
// 패널이 화면에 맞춰 묶여 있고, 줄어드는 쪽이 목록이어야 한다.
describe('오늘 할 일 패널은 버튼을 화면 안에 둔다', () => {
  const pg = bodies('.pg').join(' ')
  const list = bodies('.pg-list').join(' ')

  it('패널의 키가 화면에 묶여 있다', () => {
    expect(pg).toContain('max-height')
    expect(pg).toContain('100vh')
  })

  it('패널이 세로로 쌓이고, 넘치면 줄어드는 쪽은 목록이다', () => {
    expect(pg).toContain('flex-direction: column')
    expect(list).toContain('overflow-y: auto')
    // min-height: 0 이 없으면 flex 아이템이 내용만큼 버티며 안 줄어든다.
    expect(list).toContain('min-height: 0')
  })

  it('버튼은 줄어들지 않는다', () => {
    for (const sel of ['.pg-badge', '.pg-close']) {
      expect(bodies(sel).join(' '), sel).toContain('flex-shrink: 0')
    }
  })
})
