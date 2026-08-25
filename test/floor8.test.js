import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import {
  digDepth, endingFor, hostNames, hostResolves, roomTopic, siteView, useGame, wentUp
} from '../src/engine/store.js'

const f8 = scenario.floor8
const site = scenario.sites.find((s) => s.url === f8.host)
const room = scenario.sites.find((s) => s.url === 'sotong.ar.local').board
const drive = scenario.sites.find((s) => s.url === 'drive.ar.local').wiki
const hosts = () => {
  const all = []
  const walk = (es) => es.forEach((e) => (e.children ? walk(e.children) : all.push(e)))
  Object.values(scenario.fs).forEach(walk)
  return all.find((x) => x.id === scenario.hosts.file)
}

describe('the trail to the eighth floor', () => {
  it('takes three steps, in order', () => {
    expect(f8.steps).toEqual(['asked', 'found', 'entered'])
    expect(wentUp({})).toBe(false)
    expect(wentUp({ asked: true })).toBe(false)
    expect(wentUp({ asked: true, found: true })).toBe(false)
    expect(wentUp({ asked: true, found: true, entered: true })).toBe(true)
    // no shortcut: walking in without having heard of it does not count
    expect(wentUp({ entered: true })).toBe(false)
    expect(digDepth(scenario, { asked: true, found: true })).toBe(2)
  })

  it('only opens up after the room is pressed more than once', () => {
    expect(f8.askThreshold).toBeGreaterThan(1)
    const topic = room.ask.topics.find((t) => t.keys.includes('8층'))
    // the answers that only come to someone who keeps asking
    const said = topic.replies.map((r) => r.text)
    for (const r of f8.pressed) expect(said).toContain(r.text)
    expect(topic.replies.length).toBeGreaterThan(f8.pressed.length)
  })

  it('recognises a question about it, and only that question', () => {
    expect(roomTopic(room.ask, '8층에 뭐가 있나요')).toBe('floor8')
    expect(roomTopic(room.ask, '그 괴담 진짜예요?')).toBe('floor8')
    expect(roomTopic(room.ask, '단가는 어디서 봐요')).toBeNull()
    expect(roomTopic(room.ask, '')).toBeNull()
  })

  it('leaves a post that outlived whoever wrote it', () => {
    const ghost = room.posts.find((p) => p.id === 'sb_ghost')
    expect(ghost.body.join(' ')).toMatch(/삭제/)
    expect(ghost.comments.length).toBeGreaterThan(3)
    // the comments span years and never get an answer
    expect(ghost.comments.some((c) => c.text.includes('2026'))).toBe(true)
  })

  it('keeps a name on the payroll that nobody can take off it', () => {
    const rows = drive.pages.attend.table.rows
    const ghost = rows.find((r) => r[0] === 'AR-1877')
    expect(ghost).toBeTruthy()
    expect(ghost[4]).toBe('재직')
    expect(ghost[3]).toBe('2023-11-14')
    // the room points at that badge number, so the page is findable
    expect(JSON.stringify(f8.pressed)).toContain('AR-1877')
    expect(drive.nav.some((s) => s.pages.some((p) => p.id === 'attend'))).toBe(true)
  })

  it('will not resolve until the player writes it into hosts themselves', () => {
    expect(hostNames(hosts().content)[f8.host]).toBeUndefined()
    expect(hostResolves(scenario, {}, f8.host)).toBe(false)
    const written = { [hosts().id]: hosts().content + `\n${f8.ip}  ${f8.host}` }
    expect(hostResolves(scenario, written, f8.host)).toBe(true)
    expect(siteView(site, { grants: {}, unlocked: {}, resolves: false })).toBe('error')
    expect(siteView(site, { grants: {}, unlocked: {}, resolves: true })).toBe('ready')
  })

  it('never advertises the address anywhere the player could just copy it', () => {
    const world = JSON.stringify({
      board: scenario.sites.filter((s) => s.layout === 'board'),
      threads: [scenario.workMessenger, scenario.privateMessenger],
      news: scenario.news, qna: scenario.qna
    })
    expect(world).not.toContain(f8.ip)
  })
})

describe('going up', () => {
  beforeEach(() => useGame.setState({
    digging: {}, roomQuestions: 0, ended: false, day: scenario.days.length,
    grants: {}, locks: 3, overtime: {}
  }))

  it('counts only questions about the eighth floor toward the trail', () => {
    useGame.getState().askedRoom(null)
    useGame.getState().askedRoom(null)
    expect(useGame.getState().digging.asks).toBeUndefined()
    expect(useGame.getState().roomQuestions).toBe(2)
    for (let i = 0; i < f8.askThreshold; i++) useGame.getState().askedRoom('floor8')
    expect(useGame.getState().digging.asked).toBe(true)
  })

  it('remembers each step once it happens', () => {
    useGame.getState().foundMissing()
    useGame.getState().enterFloor8()
    expect(useGame.getState().digging).toMatchObject({ found: true, entered: true })
  })

  it('outranks every other ending the week could have earned', () => {
    const dug = { asked: true, found: true, entered: true }
    expect(endingFor(scenario.ending, { grants: {}, locks: 3, digging: dug })).toBe('missing')
    expect(endingFor(scenario.ending, { grants: { lotto: true }, locks: 3, digging: dug })).toBe('missing')
    expect(endingFor(scenario.ending, { grants: { clue_obituary: true }, locks: 0, digging: dug })).toBe('missing')
    // and changes nothing for a player who never went
    expect(endingFor(scenario.ending, { grants: {}, locks: 3, digging: { asked: true, found: true } })).toBe('plain')
  })

  it('ends the week there, whatever else was going on', () => {
    useGame.setState({ digging: { asked: true, found: true, entered: true } })
    useGame.getState().finishDay()
    expect(useGame.getState().ended).toBe('missing')
  })

  it('tells the story without ever naming the player', () => {
    const told = JSON.stringify(scenario.ending.missing)
    expect(told).not.toContain(scenario.player.name)
    expect(scenario.ending.missing.scenes.length).toBeGreaterThan(3)
    for (const sc of scenario.ending.missing.scenes) expect(sc.lines.length).toBeGreaterThan(0)
    // the log ends with the player's own badge number, not the missing person's
    expect(told).toContain('AR-2104')
    expect(scenario.ending.missing.end.title).toBe('실종')
  })
})
