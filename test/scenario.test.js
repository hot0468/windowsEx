import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'

const files = Object.values(scenario.fs).flat()
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

describe('ep1 scenario integrity', () => {
  it('goal attachment file exists in the filesystem', () => {
    expect(files.some((f) => f.id === scenario.goal.requiredAttachment)).toBe(true)
  })

  it('goal reply mail exists and is replyable', () => {
    const m = scenario.mails.find((m) => m.id === scenario.goal.replyToMail)
    expect(m?.canReply).toBe(true)
  })

  it('locked wiki page contains every required keyword', () => {
    const wiki = scenario.sites.find((s) => s.password)
    for (const k of scenario.goal.requiredKeywords) expect(wiki.content).toContain(k)
  })

  it('every messenger thread has either live delivery or its own messages', () => {
    for (const t of threads) expect(t.live || t.messages.length > 0).toBeTruthy()
  })

  it('messenger thread ids are unique', () => {
    const ids = threads.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the one live thread is backed by the timed messenger script', () => {
    expect(threads.filter((t) => t.live)).toHaveLength(1)
    expect(scenario.messenger.length).toBeGreaterThan(0)
  })

  it('file ids are unique', () => {
    const ids = files.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
