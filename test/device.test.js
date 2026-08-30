import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { entriesAt, findFile, fileOpener, fsView, useGame } from '../src/engine/store.js'

// 기기마다 다른 재미. 어느 쪽도 진행을 막지 않아야 한다 — PC 에만 있는 것도,
// 폰에만 있는 것도 퍼즐의 유일한 길이 되면 다른 기기로는 못 푸는 게임이 된다.
describe('화면 캡처', () => {
  beforeEach(() => useGame.setState({ shots: [], windows: [], locked: false, crashed: false, day: 1 }))

  const view = () => fsView(scenario.fs, { shots: useGame.getState().shots, scenario })

  it('찍기 전에는 스크린샷 폴더가 없다', () => {
    expect(entriesAt(view(), ['바탕화면']).some((e) => e.name === '스크린샷')).toBe(false)
  })

  it('찍으면 바탕화면 > 스크린샷 에 파일이 생긴다', () => {
    const shot = useGame.getState().capture()
    expect(shot.name).toMatch(/^화면캡처_\d{3}\.png$/)
    const folder = entriesAt(view(), ['바탕화면', '스크린샷'])
    expect(folder.map((f) => f.id)).toContain(shot.id)
    expect(findFile(view(), shot.id).name).toBe(shot.name)
  })

  it('무엇이 맨 앞에 있었는지 남는다', () => {
    useGame.setState({ windows: [
      { id: 1, app: 'mail', z: 1, minimized: false },
      { id: 2, app: 'browser', z: 5, minimized: false },
      { id: 3, app: 'hwp', z: 9, minimized: true }
    ] })
    expect(useGame.getState().capture().shot.title).toBe('browser')
  })

  it('사진 뷰어가 연다', () => {
    const shot = useGame.getState().capture()
    expect(fileOpener(shot).app).toBe('viewer')
  })

  // 잠긴 화면을 찍을 수 있으면 비밀번호를 우회하는 셈이 된다.
  it('잠겨 있을 때는 찍히지 않는다', () => {
    useGame.setState({ locked: true })
    expect(useGame.getState().capture()).toBe(null)
    expect(useGame.getState().shots).toHaveLength(0)
  })
})

describe('바탕화면 보기', () => {
  beforeEach(() => useGame.setState({
    peeked: [],
    windows: [
      { id: 1, app: 'mail', z: 1, minimized: false },
      { id: 2, app: 'browser', z: 2, minimized: true }
    ]
  }))

  it('한 번 누르면 모두 내려간다', () => {
    useGame.getState().showDesktop()
    expect(useGame.getState().windows.every((w) => w.minimized)).toBe(true)
  })

  // 원래 내려가 있던 창까지 올라오면, 눌러 본 사람이 보고 있던 자리를 잃는다.
  it('한 번 더 누르면 방금 내린 것만 돌아온다', () => {
    useGame.getState().showDesktop()
    useGame.getState().showDesktop()
    const byId = Object.fromEntries(useGame.getState().windows.map((w) => [w.id, w]))
    expect(byId[1].minimized).toBe(false)
    expect(byId[2].minimized).toBe(true)
  })
})
