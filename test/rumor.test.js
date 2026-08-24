import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import {
  endingFor, roomTopic, rumorPending, toldRumor, useGame
} from '../src/engine/store.js'

const r = scenario.rumor
const room = scenario.sites.find((s) => s.url === 'sotong.ar.local').board
const drive = scenario.sites.find((s) => s.url === 'drive.ar.local').wiki
const b10 = scenario.sites.find((s) => s.layout === 'board').board.posts.find((p) => p.id === 'b10')

describe('following the rumour', () => {
  it('takes the same three steps, in order', () => {
    expect(r.steps).toEqual(['heard', 'traced', 'acted'])
    expect(toldRumor({})).toBe(false)
    expect(toldRumor({ heard: true, traced: true })).toBe(false)
    expect(toldRumor({ heard: true, traced: true, acted: 'told' })).toBe(true)
    // acting without tracing is not a path the game can produce, and does not count
    expect(toldRumor({ acted: 'told' })).toBe(false)
  })

  it('offers the choice only at the moment the name is known', () => {
    expect(rumorPending({ heard: true, traced: true })).toBe(true)
    expect(rumorPending({ heard: true })).toBe(false)
    expect(rumorPending({ heard: true, traced: true, acted: 'buried' })).toBe(false)
  })

  it('turns the lens on the observer, not the couple', () => {
    // the pressed replies never confirm the affair; they point at the writer
    const said = JSON.stringify(r.pressed)
    expect(said).toMatch(/글쓴이|이직/)
    expect(r.who.badge).toBeTruthy()
    // and the drive's print log carries that badge, so it is findable
    expect(JSON.stringify(drive.pages.printlog.table.rows)).toContain(r.who.badge)
    expect(drive.nav.some((s) => s.pages.some((p) => p.id === 'printlog'))).toBe(true)
  })

  it('recognises a question about the affair as its own topic', () => {
    expect(roomTopic(room.ask, '그 불륜 소문 진짜예요?')).toBe('rumor')
    expect(roomTopic(room.ask, '탕비실관찰자 누구예요')).toBe('rumor')
    expect(roomTopic(room.ask, '8층 얘기')).toBe('floor8')   // not confused with the ghost trail
  })

  it('keeps b10, the rumour it grows out of, intact', () => {
    expect(b10.author).toBe('탕비실관찰자')
    expect(b10.body.join(' ')).toMatch(/7층/)
  })
})

describe('the two ways it ends', () => {
  beforeEach(() => useGame.setState({
    rumor: {}, roomQuestions: 0, ended: false, day: scenario.days.length,
    grants: {}, locks: 3, overtime: {}, digging: {}
  }))

  it('counts only affair questions toward the trail', () => {
    useGame.getState().askedRoom('floor8')
    expect(useGame.getState().rumor.asks).toBeUndefined()
    for (let i = 0; i < r.askThreshold; i++) useGame.getState().askedRoom('rumor')
    expect(useGame.getState().rumor.heard).toBe(true)
  })

  it('names the observer when the print log is read, and remembers the choice', () => {
    useGame.getState().traceObserver()
    expect(useGame.getState().rumor.traced).toBe(true)
    useGame.getState().actOnRumor('told')
    expect(useGame.getState().rumor.acted).toBe('told')
    expect(useGame.getState().ended).toBe('rumor_told')
  })

  it('has a distinct ending for telling and for burying', () => {
    for (const how of ['told', 'buried']) {
      const e = scenario.ending['rumor_' + how]
      expect(e, how).toBeTruthy()
      expect(e.scenes.length).toBeGreaterThan(3)
      for (const sc of e.scenes) expect(sc.lines.length).toBeGreaterThan(0)
      expect(e.end.button).toBeTruthy()
    }
    // both land on the same truth: the rumour was wrong, and it hurt anyway
    expect(JSON.stringify(scenario.ending.rumor_told)).toMatch(/이직|틀렸/)
    expect(JSON.stringify(scenario.ending.rumor_buried)).toMatch(/이직|틀렸/)
  })

  it('the choice, once made, outranks the ordinary week', () => {
    const acted = { heard: true, traced: true, acted: 'told' }
    expect(endingFor(scenario.ending, { grants: {}, locks: 3, rumor: acted })).toBe('rumor_told')
    // but not the disappearance — walking into 8층 is still the end of everything
    const gone = { asked: true, found: true, entered: true }
    expect(endingFor(scenario.ending, { grants: {}, locks: 3, rumor: acted, digging: gone })).toBe('missing')
  })

  it('names no one who did not put their own name forward', () => {
    // the couple are never given real names; the observer is named only because
    // the player chose to expose them
    const told = JSON.stringify(scenario.ending.rumor_told)
    const buried = JSON.stringify(scenario.ending.rumor_buried)
    expect(told).not.toContain(scenario.player.name)
    expect(buried).not.toContain(scenario.player.name)
    expect(buried).not.toContain(r.who.name)   // burying it never prints the observer's name
  })
})
