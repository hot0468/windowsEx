import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { quickSets, threadMessages } from '../src/engine/store.js'

const thread = scenario.privateMessenger.sections
  .flatMap((s) => s.threads).find((t) => t.id === 'guesthouse')
const beat = scenario.days[1].asks.find((a) => a.thread === 'guesthouse')
// what the messenger draws for a thread still waiting to be spoken to
const shown = (extras = {}, day = 2) => {
  const spoke = threadMessages(thread, scenario, 0, extras).some((m) => m.day === day && !m.me)
  return threadMessages(thread, scenario, 0, extras, thread.awaits && !spoke ? day : 0)
}

// 7월 25일: 한별님, 체크인 시간이 지났는데 언제쯤 오세요? He never got an answer,
// and the player is in no position to give one now.
describe('the guesthouse', () => {
  it('ends its history on the question nobody answered', () => {
    const last = thread.messages.at(-1)
    expect(last.me).toBeUndefined()
    expect(last.text).toContain('체크인')
  })

  it('is never answered by the player picking a line under it', () => {
    // the only thing the thread can say is a reply to what he asks next
    expect(quickSets(thread).flat()).toEqual(['네 말씀하세요!'])
    for (const r of thread.reactions) expect(r.choice ?? '').not.toContain('갈게요')
  })

  it('says nothing at all until he writes again', () => {
    expect(thread.awaits).toBe(true)
    const quiet = shown({})
    expect(quiet.some((m) => m.day === 2)).toBe(false)
    // the history he did send is still there to read
    expect(quiet.length).toBeGreaterThan(0)
  })

  it('opens once his own message lands', () => {
    const extras = { guesthouse: beat.lines.map((text) => ({ day: 2, from: beat.from, text })) }
    const open = shown(extras)
    expect(open.filter((m) => m.day === 2).map((m) => m.text)).toEqual(beat.lines)
  })

  it('is him asking, not the player picking up an old thread', () => {
    expect(beat.from).toBe(thread.name)
    expect(beat.lines.at(-1)).toContain('부탁')
  })
})
