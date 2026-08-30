import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener } from '../src/engine/store.js'

const threads = [...scenario.workMessenger.sections, ...scenario.privateMessenger.sections]
  .flatMap((s) => s.threads)
const security = threads.find((t) => t.id === 'security')

const files = allFiles(scenario.fs)

describe('hangul install gate', () => {
  it('does not leave the installer lying in Downloads — IT hands it over in the chat', () => {
    const setup = scenario.fs['다운로드'].find((f) => f.name === scenario.programs.hangul.setup)
    expect(setup).toBeTruthy()
    expect(setup.attached).toBe(true)
    expect(fileOpener(setup).app).toBe('installer')
    const approve = security.reactions.find((r) => r.grants === 'hangulOk')
    expect(approve.attach.fileId).toBe(setup.id)
    expect(approve.attach.name).toBe(setup.name)
  })

  it('cannot be the answer to anything — nobody can be asked for a file that is not there yet', () => {
    const blob = JSON.stringify({ days: scenario.days, pool: scenario.pool, overtime: scenario.overtime })
    expect(blob).not.toContain('file_hangul_setup')
  })

  it('gives the wizard every screen it has to draw', () => {
    const h = scenario.programs.hangul
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
    expect(approve.reply.join(' ')).toContain(scenario.programs.hangul.setup)
  })

  it('points a stuck player at the people who can approve it', () => {
    expect(scenario.programs.hangul.missing.lines.join(' ')).toContain('정보보안팀')
    expect(scenario.programs.hangul.blocked.lines.join(' ')).toContain('정보보안팀')
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
