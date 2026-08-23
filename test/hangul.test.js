import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener } from '../src/engine/store.js'

const threads = [...scenario.workMessenger.sections, ...scenario.privateMessenger.sections]
  .flatMap((s) => s.threads)
const security = threads.find((t) => t.id === 'security')

const files = allFiles(scenario.fs)

describe('hangul install gate', () => {
  it('keeps the installer where IT says it left it', () => {
    const setup = scenario.fs['다운로드'].find((f) => f.name === scenario.hangul.setup)
    expect(setup).toBeTruthy()
    expect(fileOpener(setup).app).toBe('installer')
  })

  it('gives the wizard every screen it has to draw', () => {
    const h = scenario.hangul
    for (const screen of [h.missing, h.blocked, h.done, h.already]) {
      expect(screen.title.length).toBeGreaterThan(0)
      expect(screen.lines.length).toBeGreaterThan(0)
    }
    expect(h.intro.length).toBeGreaterThan(0)
    expect(h.steps.length).toBeGreaterThan(2)
  })

  it('lets IT hand out the install approval in the chat', () => {
    const approve = security.reactions.find((r) => r.grants === 'hangulOk')
    expect(approve).toBeTruthy()
    expect(approve.reply.join(' ')).toContain(scenario.hangul.setup)
  })

  it('points a stuck player at the people who can approve it', () => {
    expect(scenario.hangul.missing.lines.join(' ')).toContain('정보보안팀')
    expect(scenario.hangul.blocked.lines.join(' ')).toContain('정보보안팀')
  })

  it('has paperwork worth unlocking behind the gate', () => {
    // if this ever hits zero the whole install beat is pointless
    expect(files.filter((f) => f.name.endsWith('.hwp')).length).toBeGreaterThan(5)
  })

  it('never blocks a day on the install alone', () => {
    // the install is a gate, not an errand — it must not eat a request slot
    const grants = scenario.objectives.map((o) => o.grant)
    expect(grants).not.toContain('hangul')
    expect(grants).not.toContain('hangulOk')
  })
})
