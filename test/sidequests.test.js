import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, canPick, postComments, useGame } from '../src/engine/store.js'

// 사이드퀘스트 넷 — 엄마 스미싱, 모니터암 나눔, 복합기 질문(은혜 갚기),
// 푸딩 사건. 전부 곁길이라 (a) 답하지 않아도 하루가 막히지 않고 (b) 엔딩을
// 움직이지 않아야 하며, (c) 답한 사람에게는 뒷이야기가 반드시 돌아와야 한다.

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const room = scenario.sites.find((s) => s.url === 'sotong.ar.local').board
const post = (id) => room.posts.find((p) => p.id === id)
const ripple = (id) => scenario.ripples.find((r) => r.id === id)

describe('잡담이 건네는 선택지 (엄마 스미싱)', () => {
  const smish = scenario.chatter.find((c) => c.id === 'ch_mom_smish')

  it('묻되 막지 않는다 — ask가 아니라 next다', () => {
    expect(smish.beat.ask).toBeUndefined()
    expect(smish.beat.next.length).toBeGreaterThan(1)
  })

  it('어느 쪽을 골라도 대화가 답을 안다', () => {
    const t = threads.find((x) => x.id === smish.beat.thread)
    for (const c of smish.beat.next) {
      const hit = t.reactions.find((r) => r.choice === c)
      expect(hit, c).toBeTruthy()
      expect(hit.reply.length, c).toBeGreaterThan(0)
      // 고른 쪽이 남아야 다음날 후일담이 짝을 찾는다
      expect(hit.grants, c).toBeTruthy()
    }
  })

  it('말린 쪽과 무시한 쪽의 다음날이 다르다', () => {
    const t = threads.find((x) => x.id === smish.beat.thread)
    const outcomes = smish.beat.next.map((c) => t.reactions.find((r) => r.choice === c).grants)
    const followups = outcomes.map((g) => scenario.ripples.find((r) => r.when.grant === g))
    for (const [i, f] of followups.entries()) {
      expect(f, outcomes[i] + '를 기다리는 ripple이 없다').toBeTruthy()
      expect(f.beat.thread).toBe('mom')
    }
    expect(new Set(followups.map((f) => f.id)).size).toBe(followups.length)
  })

  it('잡담이 실제로 선택지를 걸어 준다', () => {
    vi.useFakeTimers()
    useGame.setState({
      day: 2, chatted: {}, branches: {}, toast: null, queuedToasts: [],
      extraMessages: {}, windows: [], openThread: {},
      grants: { a: true, b: true }
    })
    // 짝수 번째 해결이 잡담을 부른다. pick을 고정해 스미싱이 뽑히게 한다.
    const idles = scenario.chatter.filter((c) => c.days?.includes(2))
    const at = idles.indexOf(smish)
    expect(at).toBeGreaterThanOrEqual(0)
    useGame.getState().chat('b', () => at / idles.length)
    vi.runAllTimers()
    expect(useGame.getState().branches.mom).toEqual(smish.beat.next)
    vi.useRealTimers()
  })
})

describe('게시판 글에 답하기', () => {
  beforeEach(() => useGame.setState({ boardPicks: {}, grants: {}, day: 3 }))

  const share = post('sd_share_arm')
  const jam = post('sd_jam_help')

  it('나눔 글에 답하면 grant가 서고, 그 grant를 기다리는 후일담이 있다', () => {
    const option = share.picks[0]
    useGame.getState().pickOnPost('sotong.ar.local', share.id, option)
    const s = useGame.getState()
    expect(s.grants[option.grant]).toBe(true)
    expect(s.boardPicks['sotong.ar.local/' + share.id].text).toBe(option.text)
    expect(ripple('arm_arrived') ?? scenario.ripples.find((r) => r.when.grant === option.grant)).toBeTruthy()
  })

  it('한 글에는 한 번만 답한다', () => {
    const option = share.picks[0]
    useGame.getState().pickOnPost('sotong.ar.local', share.id, option)
    const before = useGame.getState().boardPicks
    useGame.getState().pickOnPost('sotong.ar.local', share.id, option)
    expect(useGame.getState().boardPicks).toBe(before)
    expect(canPick(share, before['sotong.ar.local/' + share.id], {})).toBe(false)
  })

  it('내 답은 바로 붙고, 글쓴이의 답글은 다음날 아침에 달린다', () => {
    const option = share.picks[0]
    const pick = { text: option.text, day: 3 }
    const today = postComments(share, pick, 3)
    expect(today.at(-1).me).toBe(true)
    expect(today.at(-1).text).toBe(option.text)
    const tomorrow = postComments(share, pick, 4)
    expect(tomorrow.at(-1)).toBe(option.reply)
    // 답하지 않았으면 원래 댓글 그대로
    expect(postComments(share, undefined, 4)).toBe(share.comments)
  })

  it('복합기 질문은 그 일을 해 본 사람에게만 답 버튼을 연다', () => {
    expect(jam.pickNeeds).toBe('print')
    // 'print'는 실제 목표라야 한다 — 오타면 아무도 영영 답하지 못한다
    expect(scenario.objectives.some((o) => o.id === jam.pickNeeds)).toBe(true)
    expect(canPick(jam, undefined, {})).toBe(false)
    expect(canPick(jam, undefined, { print: true })).toBe(true)
    // 답은 정답(자기 PC의 IP)이 아니라 어디를 봐야 하는지만 말한다 — 이 방의 규칙
    expect(jam.picks[0].text).toContain('위키')
    expect(jam.picks[0].text).not.toContain(scenario.network.ip)
    expect(JSON.stringify(jam)).not.toContain(scenario.printer.receipt)
  })

  it('답을 저장이 기억한다', () => {
    expect(PROGRESS).toContain('boardPicks')
  })
})

describe('푸딩 사건', () => {
  const days = [3, 4, 5].map((d) => room.posts.filter((p) => p.day === d && p.id.startsWith('sd_pudding')))

  it('사흘에 걸쳐 전개되고 금요일에 끝난다', () => {
    for (const [i, posts] of days.entries()) {
      expect(posts.length, (i + 3) + '일차').toBe(1)
      expect(posts[0].comments.length).toBeGreaterThan(1)
    }
    // 결말은 마지막 글 안에 있어야 한다 — 시작만 있는 미스터리는 소프트락과 같다
    expect(days[2][0].body.join(' ')).toContain('유통기한')
  })

  it('아무것도 요구하지 않는다 — 읽는 사람의 사건이다', () => {
    for (const posts of days) {
      expect(posts[0].picks).toBeUndefined()
      expect(posts[0].pickNeeds).toBeUndefined()
    }
  })
})

describe('곁길은 엔딩을 건드리지 않는다', () => {
  it('사이드퀘스트 grant는 어느 엔딩 조건에도 없다', () => {
    const endingText = JSON.stringify(scenario.ending)
    for (const g of ['smish_warned', 'smish_shrugged', 'arm_claimed', 'jam_helped']) {
      expect(endingText).not.toContain(g)
    }
  })
})
