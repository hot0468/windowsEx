import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ screens: [] }))

describe('화면 스택', () => {
  it('처음에는 홈이다', () => {
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().currentApp()).toBe(null)
  })

  it('앱을 열면 쌓인다', () => {
    useGame.getState().pushScreen('app:messenger')
    expect(useGame.getState().screens).toEqual(['app:messenger'])
    expect(useGame.getState().currentApp()).toBe('messenger')
  })

  it('앱 안에서 더 들어가도 앱은 그대로다', () => {
    useGame.getState().pushScreen('app:messenger')
    useGame.getState().pushScreen('thread:junho')
    expect(useGame.getState().currentApp()).toBe('messenger')
    expect(useGame.getState().screens).toHaveLength(2)
  })

  it('뒤로는 한 겹만 벗긴다', () => {
    useGame.getState().pushScreen('app:messenger')
    useGame.getState().pushScreen('thread:junho')
    useGame.getState().popScreen()
    expect(useGame.getState().screens).toEqual(['app:messenger'])
  })

  it('홈에서 뒤로를 눌러도 안전하다', () => {
    useGame.getState().popScreen()
    expect(useGame.getState().screens).toEqual([])
  })

  it('홈은 깊이와 무관하게 한 번에 간다', () => {
    useGame.getState().pushScreen('app:explorer')
    useGame.getState().pushScreen('folder:문서')
    useGame.getState().pushScreen('folder:2026')
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().currentApp()).toBe(null)
  })

  // goHome은 게임의 '퇴근하기'다. 폰 홈 버튼이 그걸 실행하면 그날 야근
  // 여부가 조용히 확정되어 overwork 엔딩이 망가진다.
  it('폰 홈은 퇴근시키지 않는다', () => {
    useGame.setState({ overtime: {}, day: 1 })
    useGame.getState().pushScreen('app:mail')
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().overtime[1]).toBeUndefined()
  })

  // 같은 화면을 두 번 밀면 뒤로가 헛돈다 — 눌린 것 같은데 안 나가는 버그가 된다.
  it('같은 키를 연속으로 밀지 않는다', () => {
    useGame.getState().pushScreen('app:mail')
    useGame.getState().pushScreen('app:mail')
    expect(useGame.getState().screens).toEqual(['app:mail'])
  })

  // 소프트락 방지: 어떤 깊이에서도 홈으로 나올 수 있어야 한다.
  it('아무리 깊어도 홈으로 나올 수 있다', () => {
    for (let i = 0; i < 30; i++) useGame.getState().pushScreen(`deep:${i}`)
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
  })
})
