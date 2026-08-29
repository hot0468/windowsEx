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
const onThisPage = (id, text = here) => acceptsOf(id).filter((a) => text.includes(a))

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

// 주민등록표 등본도 같은 자리다. 힌트가 "'주소' 줄이 있어요", "전입일 칸을
// 그대로", "주소 줄 맨 끝" 이라고 칸을 이름으로 부른다 — 서식을 다시 짜면서
// 그 이름이 사라지면 게임은 멀쩡히 도는데 안내만 없는 곳을 가리킨다.
describe('등본의 칸 이름', () => {
  const files = []
  const walk = (list) => {
    for (const c of list) {
      files.push(c)
      if (c.children) walk(c.children)
    }
  }
  for (const v of Object.values(scenario.fs)) walk(v)
  const cert = files.find((f) => f.id === 'file_resident_cert')
  const form = cert?.form
  const pairs = () => form.blocks.flatMap((b) => b.pairs ?? [])
  const columns = () => form.blocks.flatMap((b) => b.columns ?? [])

  it('서식으로 적혀 있다', () => {
    expect(form, '등본이 서식이 아니다').toBeTruthy()
  })

  it("'주소' 라는 이름의 줄이 있다", () => {
    const [addr] = onThisPage('homeaddr', JSON.stringify(cert))
    const row = pairs().find(([k]) => k === '주소')
    expect(row, "'주소' 줄이 없다").toBeTruthy()
    expect(row[1]).toContain(addr)
  })

  it('주소 줄 맨 끝에 호수가 있다', () => {
    const row = pairs().find(([k]) => k === '주소')
    expect(row[1].trim().endsWith('302호'), row[1]).toBe(true)
  })

  it("'전입일' 이라는 이름의 칸이 있다", () => {
    const [when] = onThisPage('p2_movein', JSON.stringify(cert))
    expect(columns()).toContain('전입일')
    expect(JSON.stringify(cert)).toContain(when)
  })
})

// 위 검사는 C테크 한 곳만 본다. 회사 사이트가 늘 때마다 검사를 베껴 쓰는
// 대신, 답이 실린 칸의 이름을 규칙으로 못 박는다 — 힌트가 "'오시는 길' 줄",
// "'대표번호 · 팩스' 줄" 이라고 칸을 이름으로 부르기 때문이다.
describe('회사 사이트가 답을 실어 둔 칸의 이름', () => {
  const corps = scenario.sites.filter((s) => s.layout === 'corp')
  const all = []
  const gather = (n) => {
    if (Array.isArray(n)) return n.forEach(gather)
    if (n && typeof n === 'object') {
      for (const a of [].concat(n.accept ?? [])) if (typeof a === 'string') all.push(a)
      Object.values(n).forEach(gather)
    }
  }
  gather(scenario)

  it('회사 사이트가 둘 이상이다', () => {
    expect(corps.length).toBeGreaterThan(1)
  })

  it('주소가 답인 곳은 그 칸 이름이 오시는 길이다', () => {
    for (const c of corps) {
      const addr = c.corp.map?.address
      if (!addr || !all.some((a) => addr.includes(a))) continue
      expect(c.corp.map.title, c.url).toBe('오시는 길')
    }
  })

  it('연락처가 답인 곳은 대표번호와 팩스가 한 줄에 있다', () => {
    for (const c of corps) {
      const line = c.corp.footer?.contact
      if (!line || !all.some((a) => line.includes(a))) continue
      expect(line, c.url).toContain('대표번호')
      expect(line, c.url).toContain('팩스')
    }
  })
})
