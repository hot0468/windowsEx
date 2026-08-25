import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'

const css = readFileSync('src/shell/shell.css', 'utf8')
const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const asks = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask))
].filter((a) => a?.accept)
const answers = [...new Set(asks.flatMap((a) => a.accept.flat()))]

// The desktop turns text selection off so the shell feels like an application.
// Anywhere the player has to read an answer back out has to turn it on again,
// or the answer is on screen and still out of reach.
const rule = (selector) => {
  const at = css.indexOf(selector + ' {')
  return at === -1 ? null : css.slice(at, css.indexOf('}', at))
}

describe('text the player has to copy', () => {
  it('turns selection off on the desktop as a whole', () => {
    expect(rule('body')).toContain('user-select: none')
  })

  it('turns it back on for everything the browser renders', () => {
    // one rule for the viewport, not one per page — the portal footer was
    // missed for exactly as long as it was a list of individual opt-ins
    expect(rule('.page')).toContain('user-select: text')
  })

  it('covers the places the answers actually are', () => {
    // whatever else moves, these have to stay selectable: web pages, the text
    // of a document, and the dialogs that hand out a value to type elsewhere
    for (const sel of ['.page', '.np-body', '.hwp-text', '.pr-err', '.pr-receipt']) {
      expect(rule(sel), sel).toContain('user-select: text')
    }
  })

  it('keeps the copier address readable off the print dialog', () => {
    // the address the print error names is the copier's own web page
    const mfp = scenario.sites.find((x) => x.printerweb)
    expect(scenario.printer.error.help).toContain(mfp.ip)
    expect(rule('.pr-err')).toContain('user-select: text')
  })

  it('still has answers sitting on a portal page', () => {
    const portal = JSON.stringify(scenario.sites.find((s) => s.url === 'portal.ar.co.kr'))
    expect(answers.filter((a) => portal.includes(a)).length).toBeGreaterThan(5)
    expect(portal).toContain('테헤란로 122')
  })
})
