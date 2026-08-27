import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, useGame } from '../src/engine/store.js'

const notes = scenario.sites.find((s) => s.layout === 'notes').notes

beforeEach(() => useGame.setState({ myNotes: [], day: 1 }))

describe('전 사용자가 남긴 서버에 내 메모 붙이기', () => {
  it('원래 있던 기록은 2023년의 것이고, 문장 중간에서 끊긴다', () => {
    const last = notes.entries[notes.entries.length - 1]
    expect(last.cut).toBe(true)
    // 이 문장에 답이 붙는 것이 이 기능의 전부다
    expect(last.lines.join(' ')).toContain('이 컴퓨터 쓰게 될 사람이 있으면')
  })

  it('쓴 메모가 그날 날짜로 남는다', () => {
    useGame.setState({ day: 1 })
    useGame.getState().writeNote('첫날. 아무것도 모르겠다')
    const [note] = useGame.getState().myNotes
    expect(note.text).toBe('첫날. 아무것도 모르겠다')
    expect(note.day).toBe(1)
  })

  it('며칠에 걸쳐 쓴 것이 순서대로 쌓인다', () => {
    useGame.setState({ day: 1 })
    useGame.getState().writeNote('월요일')
    useGame.setState({ day: 5 })
    useGame.getState().writeNote('금요일')
    expect(useGame.getState().myNotes.map((n) => n.text)).toEqual(['월요일', '금요일'])
    expect(useGame.getState().myNotes.map((n) => n.day)).toEqual([1, 5])
  })

  it('빈 메모는 남지 않는다', () => {
    useGame.getState().writeNote('   ')
    useGame.getState().writeNote('')
    expect(useGame.getState().myNotes).toEqual([])
  })

  it('앞뒤 공백은 지우고 저장한다', () => {
    useGame.getState().writeNote('  가운데만 남는다  ')
    expect(useGame.getState().myNotes[0].text).toBe('가운데만 남는다')
  })

  it('닷새가 지나도 남아 있다 — 저장에 실린다', () => {
    expect(PROGRESS).toContain('myNotes')
  })

  it('퍼즐도 엔딩도 건드리지 않는다', () => {
    useGame.setState({ grants: {} })
    useGame.getState().writeNote('아무 말이나')
    // 메모를 쓴다고 열리는 것은 없다
    expect(useGame.getState().grants).toEqual({})
  })
})
