import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { IP_ASKED, IP_THREAD, siteView, threadMessages, useGame } from '../src/engine/store.js'

const security = scenario.workMessenger.sections
  .flatMap((s) => s.threads).find((t) => t.id === IP_THREAD)
// what the messenger shows for a thread still waiting on something
const shown = (grants) =>
  threadMessages(security, scenario, 0, {}, security.wait && !grants[security.wait] ? 1 : 0)

describe('the IP approval request', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ grants: {}, toast: null, unlocked: {}, day: 1 })
  })
  afterEach(() => vi.useRealTimers())

  it('waits on the same grant the blocked page hands out', () => {
    expect(security.wait).toBe(IP_ASKED)
  })

  it('says nothing about today until the player is turned away', () => {
    const before = shown({})
    expect(before.some((m) => m.day === 1)).toBe(false)
    // the noticeboard it came with is still there
    expect(before.length).toBeGreaterThan(0)
    expect(shown({ [IP_ASKED]: true }).some((m) => m.day === 1)).toBe(true)
  })

  it('is what the intranet turns the player away with', () => {
    for (const site of scenario.sites.filter((s) => s.requiresIp)) {
      expect(siteView(site, { grants: {}, unlocked: {} })).toBe('blocked')
      expect(siteView(site, { grants: { ip: true }, unlocked: {} })).not.toBe('blocked')
    }
  })

  it('opens the conversation, and says so once', () => {
    useGame.getState().askedIp()
    expect(useGame.getState().grants[IP_ASKED]).toBe(true)
    vi.runAllTimers()
    const first = useGame.getState().toast
    expect(first?.thread).toBe(IP_THREAD)
    // a second blocked page is not a second notification
    useGame.setState({ toast: null })
    useGame.getState().askedIp()
    vi.runAllTimers()
    expect(useGame.getState().toast).toBe(null)
  })

  it('leaves the question itself on the thread, where the answer stays checked', () => {
    expect(security.ask.grants).toBe('ip')
    expect(security.ask.accept).toContain(scenario.network.ip)
  })
})
