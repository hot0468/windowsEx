import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { looksLikeAddress, searchSites } from '../src/engine/store.js'

// 주소창은 주소만 받는 자리가 아니다. 사이트 이름만 아는 채로 '퇴근길' 이라고
// 쳤을 때 "사이트를 찾을 수 없습니다" 를 띄우는 것은 퍼즐이 아니라 벌이다.
const addr = (raw, edits = {}) => looksLikeAddress(scenario, edits, raw)

describe('주소창에 친 것이 주소인가 검색어인가', () => {
  it('점이 있으면 주소다', () => {
    for (const t of ['ctech.co.kr', 'https://wiki.ar.co.kr', 'sotong.ar.local', '192.168.10.1', '127.0.0.1']) {
      expect(addr(t), t).toBe(true)
    }
  })

  it('경로가 붙어 있어도 주소다', () => {
    expect(addr('portal.ar.co.kr/hr/leave')).toBe(true)
  })

  it('점 없는 말은 검색어다', () => {
    for (const t of ['퇴근길', '라인업', 'BS-200 단가', '역전할머니맥주']) {
      expect(addr(t), t).toBe(false)
    }
  })

  it('빈 칸이나 공백만 있으면 주소가 아니다', () => {
    expect(addr('')).toBe(false)
    expect(addr('   ')).toBe(false)
  })

  // hosts 를 고쳐야 열리는 주소는 여전히 주소여야 한다. 검색으로 새 버리면
  // "이름 풀이 실패" 를 못 보고, 그 오류가 hosts 퍼즐의 입구다.
  it('아직 안 열리는 사내 주소도 주소로 본다', () => {
    const hidden = scenario.sites.filter((s) => s.requiresHost)
    expect(hidden.length).toBeGreaterThan(0)
    for (const s of hidden) expect(addr(s.url), s.url).toBe(true)
  })

  it('게임의 모든 사이트 주소는 주소로 읽힌다', () => {
    for (const s of scenario.sites) expect(addr(s.url), s.url).toBe(true)
  })

  // 검색으로 보내는 것이 실제로 쓸모가 있으려면 결과가 나와야 한다.
  it('사이트 이름을 치면 검색 결과에 그 사이트가 나온다', () => {
    expect(searchSites(scenario.sites, '퇴근길').map((s) => s.url)).toContain('toegeun.kr')
  })
})
