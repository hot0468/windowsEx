import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'

// 마지막 힌트는 폴더·파일·줄을 정확히 지목한다. 그래서 그 줄을 다른 말로
// 바꾸거나 화면을 다시 짜면, 게임은 멀쩡히 돌아가는데 힌트만 없는 곳을
// 가리키게 된다 — 답을 못 찾는 플레이어에게 마지막으로 남은 안내가 거짓이
// 되는 셈이라 소프트락과 같다. C테크 홈페이지가 그 자리다.
const site = (url) => scenario.sites.find((s) => s.url === url)
const ctech = site('ctech.co.kr')
const here = JSON.stringify(ctech)

// 번호나 주소를 여기 베껴 적으면 값이 바뀔 때 검사만 낡는다. 요청이 받는
// 정답에서 읽어 온다 — 무엇이 답이냐가 바뀌어도 검사는 따라온다.
const acceptsOf = (id) => {
  const req = scenario.pool.requests.find((r) => r.id === id)
  const out = []
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    for (const a of [].concat(n.accept ?? [])) if (typeof a === 'string') out.push(a)
    Object.values(n).forEach(walk)
  }
  walk(req)
  return out
}
// 이 페이지에서 찾게 되어 있는 답: 팩스번호(cfax)와 새 본사 주소(h_deck_ctech).
const onThisPage = (id) => acceptsOf(id).filter((a) => here.includes(a))

describe('힌트가 이름으로 부르는 자리는 실제로 있다', () => {
  it('C테크 홈페이지가 열린다', () => {
    expect(ctech).toBeTruthy()
  })

  // "대표번호 옆에 팩스 적혀 있을 거야" / "'대표번호 · 팩스' 줄"
  it('대표번호와 팩스가 한 줄에 같이 있다', () => {
    const [fax] = onThisPage('cfax')
    expect(fax, 'cfax 의 답이 이 페이지에 없다').toBeTruthy()
    const contact = ctech.corp.footer.contact
    expect(contact).toContain('대표번호')
    expect(contact).toContain('팩스')
    expect(contact, '팩스번호가 대표번호와 같은 줄에 없다').toContain(fax)
  })

  // "'오시는 길' 줄에 있어요"
  it('오시는 길이라는 이름의 자리에 본사 주소가 있다', () => {
    const [addr] = onThisPage('h_deck_ctech')
    expect(addr, '주소 답이 이 페이지에 없다').toBeTruthy()
    expect(ctech.corp.map.title).toBe('오시는 길')
    expect(ctech.corp.map.address).toContain(addr)
  })

  it('이 페이지에서 답을 찾는 요청이 둘 다 답을 찾는다', () => {
    expect(onThisPage('cfax')).toHaveLength(1)
    expect(onThisPage('h_deck_ctech')).toHaveLength(1)
  })
})
