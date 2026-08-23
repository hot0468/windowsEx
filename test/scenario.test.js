import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'

const files = Object.values(scenario.fs).flat()

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

  it('file ids are unique', () => {
    const ids = files.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
