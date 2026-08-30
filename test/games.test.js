import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, useGame } from '../src/engine/store.js'
import { APPS, phoneApps, startMenuApps } from '../src/apps/registry.jsx'
import {
  COLS, MINES, ROWS, flagCount, freshBoard, isLost, isWon, minedBoard, openCell, placeMines, toggleFlag
} from '../src/apps/Minesweeper.jsx'
import {
  canMove, deal, draw, isWon as solWon, move, pileOf, sendToFoundation
} from '../src/apps/solitaire.js'

// 딴짓거리 둘. 게임이 재미없어지는 방식은 셋이다 — 판이 규칙대로 안 굴러가거나,
// 폰에서 판을 끝낼 수 없거나, 딴짓을 아무도 모른 척하거나.

describe('지뢰찾기', () => {
  it('첫 클릭은 절대 지뢰가 아니다', () => {
    // 첫 판에서 밟고 죽으면 그건 게임이 아니라 벌이다.
    for (let safe = 0; safe < ROWS * COLS; safe += 7) {
      const board = placeMines(freshBoard(), safe)
      expect(board[safe].mine, `safe=${safe}`).toBe(false)
      expect(board.filter((c) => c.mine)).toHaveLength(MINES)
    }
  })

  it('빈 칸을 열면 이어진 빈 구역이 함께 열린다', () => {
    // 한 칸씩만 열리면 9×9를 71번 눌러야 한다.
    const board = minedBoard([80])           // 오른쪽 아래 구석 하나
    const opened = openCell(board, 0)
    expect(opened.filter((c) => c.open).length).toBeGreaterThan(70)
    expect(opened[80].open).toBe(false)
  })

  it('깃발 꽂은 칸은 열리지 않는다', () => {
    const board = toggleFlag(minedBoard([80]), 0)
    expect(openCell(board, 0)[0].open).toBe(false)
    expect(flagCount(board)).toBe(1)
  })

  it('지뢰가 아닌 칸을 다 열면 이기고, 밟으면 진다', () => {
    const board = minedBoard([80])
    const cleared = board.map((c, i) => (i === 80 ? c : { ...c, open: true }))
    expect(isWon(cleared)).toBe(true)
    expect(isLost(cleared)).toBe(false)
    expect(isLost(openCell(board, 80))).toBe(true)
  })
})

describe('솔리테어', () => {
  const state = deal(20260830)

  it('한 벌 52장이 빠짐없이 깔린다', () => {
    const all = [...state.stock, ...state.tableau.flat()]
    expect(all).toHaveLength(52)
    expect(new Set(all.map((c) => c.id)).size).toBe(52)
    expect(state.stock).toHaveLength(24)
  })

  it('작업 더미는 맨 위 한 장만 앞면이다', () => {
    state.tableau.forEach((pile, i) => {
      expect(pile).toHaveLength(i + 1)
      expect(pile.filter((c) => c.faceUp)).toHaveLength(1)
      expect(pile[pile.length - 1].faceUp).toBe(true)
    })
  })

  it('기초 더미는 A부터, 같은 무늬로만 받는다', () => {
    const board = { stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []] }
    const card = (id, suit, rank) => ({ id, suit, rank, faceUp: true })
    const two = { ...board, waste: [card('a', 'spades', 2)] }
    expect(canMove(two, 'waste', 0, 'f0')).toBe(false)          // A가 아니다
    const ace = { ...board, waste: [card('b', 'spades', 1)] }
    expect(canMove(ace, 'waste', 0, 'f0')).toBe(true)
    const onAce = { ...board, foundations: [[card('b', 'spades', 1)], [], [], []], waste: [card('c', 'hearts', 2)] }
    expect(canMove(onAce, 'waste', 0, 'f0')).toBe(false)        // 무늬가 다르다
  })

  it('작업 더미는 색을 번갈아 내려가고 빈 자리는 K만 받는다', () => {
    const card = (id, suit, rank) => ({ id, suit, rank, faceUp: true })
    const board = {
      stock: [], waste: [card('w', 'hearts', 9)], foundations: [[], [], [], []],
      tableau: [[card('t', 'spades', 10)], [card('u', 'clubs', 10)], []]
    }
    expect(canMove(board, 'waste', 0, 't0')).toBe(true)         // 빨강 9 → 검정 10
    expect(canMove(board, 'waste', 0, 't1')).toBe(true)
    expect(canMove(board, 'waste', 0, 't2')).toBe(false)        // 빈 자리는 K만
    const king = { ...board, waste: [card('k', 'hearts', 13)] }
    expect(canMove(king, 'waste', 0, 't2')).toBe(true)
  })

  it('옮기고 나면 드러난 카드가 뒤집힌다', () => {
    const card = (id, suit, rank, faceUp) => ({ id, suit, rank, faceUp })
    const board = {
      stock: [], waste: [], foundations: [[], [], [], []],
      tableau: [[card('hidden', 'clubs', 4, false), card('ace', 'spades', 1, true)], []]
    }
    const next = move(board, 't0', 1, 'f0')
    expect(next.tableau[0][0].faceUp).toBe(true)
    expect(next.foundations[0]).toHaveLength(1)
  })

  it('산이 비면 뽑아 놓은 카드가 되돌아간다 — 판이 막히지 않는다', () => {
    let s = state
    for (let i = 0; i < 24; i++) s = draw(s)
    expect(s.stock).toHaveLength(0)
    expect(s.waste).toHaveLength(24)
    s = draw(s)
    expect(s.stock).toHaveLength(24)
    expect(s.stock.every((c) => !c.faceUp)).toBe(true)
  })

  it('갈 곳 없는 카드는 더블클릭해도 움직이지 않는다', () => {
    expect(sendToFoundation({ ...state, waste: [] }, 'waste')).toBe(null)
  })

  it('52장이 다 올라가야 이긴다', () => {
    expect(solWon(state)).toBe(false)
    const suits = ['spades', 'hearts', 'diamonds', 'clubs']
    const full = suits.map((suit) =>
      Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 1}`, suit, rank: i + 1, faceUp: true })))
    expect(solWon({ ...state, foundations: full })).toBe(true)
  })

  it('없는 더미를 물어도 터지지 않는다', () => {
    expect(pileOf(state, 't99')).toEqual([])
  })
})

describe('게임을 여는 자리', () => {
  it('시작 메뉴와 폰 홈 양쪽에 있다 — 설치가 필요 없는 기본 프로그램이다', () => {
    const menu = startMenuApps({}).map(([key]) => key)
    expect(menu).toContain('mine')
    expect(menu).toContain('solitaire')
    const home = phoneApps({}).map((a) => a.id)
    expect(home).toContain('mine')
    expect(home).toContain('solitaire')
  })

  it('아이콘이 서로 다르다 — 시작 메뉴에서 두 게임이 구분된다', () => {
    expect(APPS.mine.icon).not.toBe(APPS.solitaire.icon)
  })
})

describe('딴짓하다 걸린다', () => {
  const nag = scenario.slacking

  beforeEach(() => useGame.setState({ slacked: false, windows: [], grants: {}, chatted: {}, day: 1 }))

  it('실제로 있는 게임 창과 실제로 있는 대화방을 가리킨다', () => {
    for (const app of nag.apps) expect(APPS[app], app).toBeTruthy()
    const threads = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads)).map((t) => t.id)
    expect(threads).toContain(nag.thread)
    expect(nag.lines.length).toBeGreaterThan(0)
  })

  it('세이브에 실린다 — 다시 켜면 팀장이 같은 잔소리를 반복하지 않는다', () => {
    expect(PROGRESS).toContain('slacked')
  })

  it('게임을 안 켰으면 아무 말도 없다', () => {
    vi.useFakeTimers()
    useGame.getState().grant('anything')
    vi.runAllTimers()
    expect(useGame.getState().slacked).toBe(false)
    vi.useRealTimers()
  })

  it('게임을 켜 둔 채로 일을 끝내면 팀장이 본다 — 딱 한 번', () => {
    vi.useFakeTimers()
    useGame.setState({ windows: [{ id: 1, key: 'solitaire', app: 'solitaire', z: 1 }] })
    useGame.getState().grant('something')
    vi.runAllTimers()
    expect(useGame.getState().slacked).toBe(true)
    const said = useGame.getState().extraMessages[nag.thread] ?? []
    expect(said.some((m) => m.text === nag.lines[0])).toBe(true)

    const before = said.length
    useGame.getState().grant('another')
    vi.runAllTimers()
    expect((useGame.getState().extraMessages[nag.thread] ?? []).length).toBe(before)
    vi.useRealTimers()
  })
})
