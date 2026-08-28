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
    ['라우터 표', '.rt-table td']
  ]

  for (const [what, sel] of spots) {
    it(`${what} — ${sel}`, () => expect(selectable(sel)).toBe(true))
  }
})
