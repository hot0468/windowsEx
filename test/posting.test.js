import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, myPosts, useGame } from '../src/engine/store.js'

const board = scenario.sites.find((s) => s.url === 'toegeun.kr').board
const compose = board.compose

const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const answers = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask))
].filter((a) => a?.accept).flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

beforeEach(() => useGame.setState({ posted: {}, day: 1, grants: {} }))

describe('퇴근길에 글 쓰기', () => {
  it('글감은 고르는 것이지 쓰는 것이 아니다', () => {
    // 자유 입력이면 키워드로 반응을 고를 수밖에 없고, 그러면 반드시 헛다리를
    // 짚는다. 글감마다 댓글을 미리 써 두는 쪽이 읽고 답하는 것처럼 보인다.
    expect(compose.options.length).toBeGreaterThanOrEqual(4)
    for (const o of compose.options) {
      expect(o.pick, o.id).toBeTruthy()
      expect(o.title, o.id).toBeTruthy()
      expect(o.body.length, o.id).toBeGreaterThan(0)
      expect(Array.isArray(o.comments), o.id).toBe(true)
    }
    expect(new Set(compose.options.map((o) => o.id)).size).toBe(compose.options.length)
  })

  it('올리면 목록 맨 위에 내 글로 선다', () => {
    useGame.getState().postTo('toegeun.kr', 'w_boss')
    const mine = myPosts(scenario, useGame.getState(), 'toegeun.kr')
    expect(mine).toHaveLength(1)
    expect(mine[0].author).toBe(compose.author)
    expect(mine[0].title).toBe(compose.options.find((o) => o.id === 'w_boss').title)
  })

  it('올린 날에는 댓글이 없다 — 다음 날 달린다', () => {
    useGame.setState({ day: 2 })
    useGame.getState().postTo('toegeun.kr', 'w_boss')
    expect(myPosts(scenario, useGame.getState(), 'toegeun.kr')[0].comments).toEqual([])

    useGame.setState({ day: 3 })
    const next = myPosts(scenario, useGame.getState(), 'toegeun.kr')[0]
    expect(next.comments.length).toBeGreaterThan(0)
  })

  it('같은 글을 두 번 올리지 않는다', () => {
    useGame.getState().postTo('toegeun.kr', 'w_boss')
    useGame.getState().postTo('toegeun.kr', 'w_boss')
    expect(myPosts(scenario, useGame.getState(), 'toegeun.kr')).toHaveLength(1)
  })

  it('8층 글은 아무도 답하지 않고, 이틀 뒤 사라진다', () => {
    useGame.setState({ day: 1 })
    useGame.getState().postTo('toegeun.kr', 'w_floor8')
    expect(myPosts(scenario, useGame.getState(), 'toegeun.kr')).toHaveLength(1)

    useGame.setState({ day: 3 })
    // 조용히 없어질 뿐, 아무것도 열리지 않는다
    expect(myPosts(scenario, useGame.getState(), 'toegeun.kr')).toHaveLength(0)
    expect(useGame.getState().grants).toEqual({})
  })

  it('무엇을 올리든 아무것도 열리지 않는다', () => {
    for (const o of compose.options) {
      useGame.setState({ posted: {}, grants: {} })
      useGame.getState().postTo('toegeun.kr', o.id)
      expect(useGame.getState().grants, o.id).toEqual({})
    }
  })

  it('올린 글은 저장에 실린다', () => {
    expect(PROGRESS).toContain('posted')
  })

  it('어떤 정답도 흘리지 않는다', () => {
    const said = JSON.stringify(compose)
    for (const a of new Set(answers)) expect(said, a).not.toContain(a)
  })

  it('댓글은 사람이 쓴 것처럼 갈린다', () => {
    // 한쪽으로만 쏠린 댓글은 게시판이 아니라 응원단이다
    const boss = compose.options.find((o) => o.id === 'w_boss')
    expect(boss.comments.some((c) => c.dislikes > c.likes / 2)).toBe(true)
    expect(new Set(boss.comments.map((c) => c.author)).size).toBeLessThan(boss.comments.length)
  })
})
