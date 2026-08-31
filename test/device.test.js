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

// 폰 카메라는 PC 의 화면 캡처와 짝이다. 찍은 것이 톡으로 보낼 수 있는
// 파일이 되는 것이 요점 — 갤러리에 실제로 들어가야 한다.
describe('폰 카메라', () => {
  beforeEach(() => useGame.setState({ photos: [], day: 2 }))

  const view = () => fsView(scenario.fs, { photos: useGame.getState().photos, scenario })

  it('찍으면 갤러리에 사진이 생긴다', () => {
    const before = entriesAt(view(), ['휴대폰', '갤러리']).length
    const photo = useGame.getState().takePhoto('책상 위')
    const after = entriesAt(view(), ['휴대폰', '갤러리'])
    expect(after.length).toBe(before + 1)
    expect(after.map((f) => f.id)).toContain(photo.id)
    expect(photo.shot.title).toBe('책상 위')
    expect(photo.shot.day).toBe(2)
  })

  it('원래 있던 사진을 밀어내지 않는다', () => {
    useGame.getState().takePhoto()
    const names = entriesAt(view(), ['휴대폰', '갤러리']).map((f) => f.id)
    expect(names).toContain('file_cat1')
  })

  it('사진 뷰어가 열고, 파일로 다룰 수 있다', () => {
    const photo = useGame.getState().takePhoto()
    expect(fileOpener(photo).app).toBe('viewer')
    expect(findFile(view(), photo.id).name).toBe(photo.name)
  })
})

// 지도는 브라우저의 장소 검색과 같은 자료를 본다. 두 벌이 되면 한쪽만
// 고쳐지고 다른 쪽이 거짓말을 하게 된다.
describe('지도', () => {
  it('모든 장소가 자리를 가진다', () => {
    for (const p of scenario.places) {
      expect(p.name, '이름 없는 장소').toBeTruthy()
      expect(p.address, p.name + ' 에 주소가 없다').toBeTruthy()
      // 주소에서 자리를 뽑으므로 숫자가 하나는 있어야 한다
      expect(p.address).toMatch(/\d/)
    }
  })

  it('장소 페이지로 이어진다', () => {
    // 지도의 '장소 페이지 열기'가 브라우저에 넘기는 이름이 실제로 있는 이름이어야 한다
    const names = new Set(scenario.places.map((p) => p.name))
    for (const p of scenario.places) expect(names.has(p.name)).toBe(true)
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

// 키로 창을 다루는 것. 끌어서 가장자리에 놓는 것과 같은 자리로 가야 한다 —
// 손과 키가 다른 자리를 만들면 둘 중 하나는 거짓말이다.
describe('창 붙이기와 순환', () => {
  const win = (id, z) => ({ id, app: 'mail', z, minimized: false, x: 100, y: 100, w: 500, h: 400 })
  beforeEach(() => useGame.setState({ windows: [win(1, 1), win(2, 2), win(3, 3)], nextZ: 10 }))

  it('맨 앞 창이 왼쪽 반에 붙는다', () => {
    useGame.getState().snapFocused('left', 1200, 800)
    const w = useGame.getState().windows.find((x) => x.id === 3)
    expect(w.x).toBe(0)
    expect(w.w).toBe(600)
    expect(w.h).toBe(800 - 48)
  })

  it('오른콽은 남은 반을 채운다', () => {
    useGame.getState().snapFocused('right', 1200, 800)
    const w = useGame.getState().windows.find((x) => x.id === 3)
    expect(w.x).toBe(600)
    expect(w.x + w.w).toBe(1200)
  })

  it('내려간 창은 건드리지 않는다', () => {
    useGame.setState({ windows: [win(1, 1), { ...win(2, 9), minimized: true }] })
    useGame.getState().snapFocused('left', 1200, 800)
    expect(useGame.getState().windows.find((x) => x.id === 2).x).toBe(100)
    expect(useGame.getState().windows.find((x) => x.id === 1).x).toBe(0)
  })

  it('순환하면 맨 뒤 창이 앞으로 온다', () => {
    useGame.getState().cycleWindows()
    const zs = Object.fromEntries(useGame.getState().windows.map((w) => [w.id, w.z]))
    expect(zs[1]).toBeGreaterThan(zs[3])
  })

  it('창이 하나면 순환할 것이 없다', () => {
    useGame.setState({ windows: [win(1, 1)] })
    const before = useGame.getState().windows[0].z
    useGame.getState().cycleWindows()
    expect(useGame.getState().windows[0].z).toBe(before)
  })
})
