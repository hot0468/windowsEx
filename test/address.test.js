import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { VISITS, addressHints, useGame } from '../src/engine/store.js'

// 주소창이 거드는 것은 편의지만, 거드는 곳을 잘못 고르면 퍼즐을 대신 풀어 준다.
// 이 파일이 지키는 것은 하나다 — 자동완성은 플레이어가 이미 아는 곳만 안다.

const browser = readFileSync('src/apps/Browser.jsx', 'utf8')
const known = {
  visited: [{ url: 'wiki.ar.co.kr/price', title: '확정 단가표', day: 2 }],
  bookmarks: scenario.bookmarks,
  history: scenario.history
}

describe('주소창 제안', () => {
  it('아무것도 안 쳤으면 아무것도 안 내민다', () => {
    expect(addressHints('', known)).toEqual([])
    expect(addressHints('   ', known)).toEqual([])
  })

  it('주소로도 제목으로도 걸린다', () => {
    expect(addressHints('wiki', known).some((h) => h.url.includes('wiki'))).toBe(true)
    expect(addressHints('퇴근', known).some((h) => h.url === 'toegeun.kr')).toBe(true)
  })

  it('같은 곳을 두 번 내밀지 않는다', () => {
    const both = { ...known, visited: [{ url: 'toegeun.kr', title: '퇴근길', day: 1 }] }
    const urls = addressHints('toegeun', both).map((h) => h.url)
    expect(urls).toEqual([...new Set(urls)])
  })

  it('가 본 곳이 먼저다', () => {
    const both = { ...known, visited: [{ url: 'toegeun.kr', title: '퇴근길', day: 3 }] }
    expect(addressHints('.kr', both)[0].url).toBe('toegeun.kr')
  })

  it('내미는 수를 넘기지 않는다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ url: `x${i}.co.kr`, title: 't' + i }))
    expect(addressHints('.co.kr', { visited: many }, 6)).toHaveLength(6)
  })
})

describe('제안이 답을 말하지 않는다', () => {
  it('가 본 적 없는 곳은 이름도 모른다', () => {
    // 공유기 주소·8층·드라이브를 찾아내는 것이 각각 퍼즐이다. 아무것도 모르는
    // 상태에서 그 주소의 앞글자만 쳐도 나오면, 주소창이 답을 먼저 말한 것이다.
    const blank = { visited: [], bookmarks: [], history: [] }
    for (const url of [scenario.network.gateway, '8f.ar.local', 'drive.ar.local', 'ar-security.co.kr']) {
      expect(addressHints(url.slice(0, 4), blank), url).toEqual([])
    }
  })

  it('시나리오의 사이트 목록에서 거들지 않는다', () => {
    // 소스에 못 박는다. scenario.sites 를 넘기는 순간 위 테스트가 무의미해진다.
    const call = browser.match(/addressHints\([^)]*\)/)
    expect(call, '브라우저가 addressHints 를 부른다').toBeTruthy()
    expect(call[0]).not.toContain('sites')
  })

  it('열린 곳만 기록에 남는다 — 막힌 주소는 기록이 아니다', () => {
    expect(browser).toMatch(/view === 'ready' && site\) noteVisit/)
  })
})

describe('이번 주에 간 곳', () => {
  beforeEach(() => useGame.setState({ visited: [], day: 2 }))

  it('최근이 앞이다', () => {
    useGame.getState().noteVisit('a.kr', 'A')
    useGame.getState().noteVisit('b.kr', 'B')
    expect(useGame.getState().visited.map((v) => v.url)).toEqual(['b.kr', 'a.kr'])
  })

  it('같은 곳을 다시 가면 위로 올라올 뿐 늘지 않는다', () => {
    const s = useGame.getState()
    s.noteVisit('a.kr', 'A')
    s.noteVisit('b.kr', 'B')
    s.noteVisit('a.kr', 'A')
    expect(useGame.getState().visited.map((v) => v.url)).toEqual(['a.kr', 'b.kr'])
  })

  it('끝없이 쌓이지 않는다', () => {
    for (let i = 0; i < VISITS + 10; i++) useGame.getState().noteVisit(`x${i}.kr`, 'x')
    expect(useGame.getState().visited).toHaveLength(VISITS)
  })

  it('어느 날 갔는지 남는다', () => {
    useGame.getState().noteVisit('a.kr', 'A')
    expect(useGame.getState().visited[0].day).toBe(2)
  })
})
