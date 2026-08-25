import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { roomReply, roomTopic } from '../src/engine/store.js'

const room = scenario.sites.find((s) => s.url === 'sotong.ar.local').board
const ask = room.ask
const chain = (a) => (a ? [a, ...chain(a.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const answers = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(chain),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => chain(a.ask)))
].flatMap((a) => a?.accept?.flat() ?? [])

describe('asking the room', () => {
  it('is offered only in the room, not on the public board', () => {
    expect(ask.placeholder && ask.send).toBeTruthy()
    const outside = scenario.sites.find((s) => s.url === 'toegeun.kr').board
    expect(outside.ask).toBeUndefined()
  })

  it('answers on any keyword of a topic, spacing and case forgiven', () => {
    for (const topic of ask.topics) {
      expect(topic.replies.length).toBeGreaterThan(0)
      for (const key of topic.keys) {
        const reply = roomReply(ask, `혹시 ${key} 어떻게 하나요?`, 0)
        expect(topic.replies, key).toContain(reply)
      }
    }
    expect(roomReply(ask, '위 키   비번요')).toBe(ask.topics[0].replies[0])
  })

  it('sends a second asker a different voice, and never runs out', () => {
    const first = roomReply(ask, '단가 어디서 봐요', 0)
    const second = roomReply(ask, '단가 어디서 봐요', 1)
    expect(second).not.toBe(first)
    expect(roomReply(ask, '단가 어디서 봐요', 99)).toBeTruthy()
  })

  it('shrugs at a question it has no topic for', () => {
    expect(ask.fallback.length).toBeGreaterThan(1)
    expect(ask.fallback).toContain(roomReply(ask, '에어컨 온도 누가 정해요', 0))
    expect(roomReply(ask, '   ')).toBeNull()
  })

  it('lets the longer keyword win, so the trail is never hijacked', () => {
    // 층 belongs to the toilets topic and 8층 to the one that ends the week;
    // 최종 to file names and 단가 to prices. The longest match decides.
    expect(roomTopic(ask, '8층에 뭐가 있어요')).toBe('floor8')
    expect(roomTopic(ask, '8층 괴담 진짜인가요')).toBe('floor8')
    const of = (q) => ask.topics.find((t) => t.replies.includes(roomReply(ask, q, 0)))
    expect(of('화장실 왜 이렇게 붐벼요').keys[0]).toBe('화장실')
    expect(of('7층 복합기 또 고장났나요').keys[0]).toBe('복합기')
    expect(of('단가표 최종본 어디 있어요').keys[0]).toBe('단가')
    expect(of('최종 파일 어떤 게 진짜예요').keys[0]).toBe('파일명')
  })

  it('answers the everyday things this building actually talks about', () => {
    for (const [q, first] of [
      ['커피 캡슐 누가 다 가져가요', '커피'],
      ['우리 팀장 왜 이래요', '팀장'],
      ['파일명 어떻게 지으세요', '파일명'],
      ['연봉 언제 오르나요', '연봉'],
      ['주차 어디에 해요', '주차'],
      ['화장실 왜 항상 만석이죠', '화장실']
    ]) {
      const topic = ask.topics.find((t) => t.keys[0] === first)
      expect(topic, first).toBeTruthy()
      expect(topic.replies, q).toContain(roomReply(ask, q, 0))
    }
  })

  it('gives no keyword to two topics at once', () => {
    const seen = new Set()
    for (const t of ask.topics) {
      for (const k of t.keys) {
        expect(seen.has(k), k).toBe(false)
        seen.add(k)
      }
    }
  })

  it('has opinions about lunch, because everyone here does', () => {
    const lunch = ask.topics.find((t) => t.keys.includes('맛집'))
    expect(lunch.replies.length).toBeGreaterThan(2)
    for (const q of ['회사 근처 맛집 어디예요', '점심 뭐 먹지', '배달 되는 데 있나요']) {
      expect(lunch.replies, q).toContain(roomReply(ask, q, 0))
    }
    // and it still points rather than tells: the places it hints at are
    // answers to other requests, so none of them may be named outright
    const said = JSON.stringify(lunch.replies)
    for (const p of scenario.places) {
      if (answers.includes(p.name)) expect(said, p.name).not.toContain(p.name)
    }
    expect(said).toContain('검색')
  })

  it('points at where to look and never hands over an answer', () => {
    const said = JSON.stringify({ topics: ask.topics, fallback: ask.fallback })
    for (const answer of new Set(answers)) expect(said, answer).not.toContain(answer)
    for (const k of scenario.days.flatMap((d) => d.goal.requiredKeywords)) expect(said).not.toContain(k)
    expect(said).not.toContain(scenario.sites.find((s) => s.layout === 'wiki').login.password)
    expect(said).not.toContain(scenario.printer.receipt)
    expect(said).not.toContain(scenario.sites.find((s) => s.layout === 'lotto').lotto.serial)
  })

  it('every reply is signed and says something', () => {
    for (const r of [...ask.topics.flatMap((t) => t.replies), ...ask.fallback]) {
      expect(r.author).toBeTruthy()
      expect(r.text.length).toBeGreaterThan(10)
    }
  })
})
