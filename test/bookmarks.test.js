import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ myBookmarks: [] }))

describe('즐겨찾기', () => {
  const { toggleBookmark } = useGame.getState()

  it('별을 누르면 얹히고 다시 누르면 빠진다', () => {
    toggleBookmark('sotong.ar.local')
    expect(useGame.getState().myBookmarks).toEqual(['sotong.ar.local'])
    toggleBookmark('sotong.ar.local')
    expect(useGame.getState().myBookmarks).toEqual([])
  })

  it('같은 주소를 두 번 얹지 않는다', () => {
    toggleBookmark('sotong.ar.local')
    toggleBookmark('127.0.0.1')
    toggleBookmark('sotong.ar.local')
    expect(useGame.getState().myBookmarks).toEqual(['127.0.0.1'])
  })

  // 처음부터 실려 있으면 플레이어가 찾아낼 이유가 없다. 소통방은 hosts를
  // 고쳐야 열리는 곳이고, 그 발견이 퍼즐이다.
  it('주소를 알아내야 닿는 곳은 회사가 깔아 두지 않는다', () => {
    const hidden = new Set(scenario.sites.filter((s) => s.requiresHost).map((s) => s.url))
    expect(hidden.size).toBeGreaterThan(0)
    for (const b of scenario.bookmarks) expect(hidden.has(b.url), b.url).toBe(false)
  })

  it('기본 즐겨찾기는 실재하는 사이트를 가리킨다', () => {
    for (const b of scenario.bookmarks) {
      expect(scenario.sites.some((s) => s.url === b.url), b.url).toBe(true)
    }
  })
})
