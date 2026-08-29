import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { CLUE, allFiles, endingFor, searchSites, serialFits, siteView, useGame } from '../src/engine/store.js'

const site = scenario.sites.find((s) => s.layout === 'lotto')
const lotto = site.lotto
const files = allFiles(scenario.fs)
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const groups = lotto.serial.split('-')

describe('동행복권', () => {
  it('is a public site the search portal can find', () => {
    expect(siteView(site, { grants: {}, unlocked: {} })).toBe('ready')
    expect(searchSites(scenario.sites, '동행복권').map((s) => s.url)).toEqual([site.url])
  })

  it('prints a sixteen-digit serial in four groups', () => {
    expect(groups).toHaveLength(4)
    for (const g of groups) expect(g).toMatch(/^\d{4}$/)
  })

  it('accepts the serial with or without its hyphens, and nothing else', () => {
    expect(serialFits(lotto, lotto.serial)).toBe(true)
    expect(serialFits(lotto, ' ' + groups.join('') + ' ')).toBe(true)
    expect(serialFits(lotto, groups.join(' '))).toBe(true)
    expect(serialFits(lotto, groups.slice(0, 3).join('-'))).toBe(false)
    expect(serialFits(lotto, '')).toBe(false)
  })
})

describe('the slip, scattered', () => {
  const memo = files.find((f) => f.id === 'file_lotto_memo')
  const app = files.find((f) => f.id === 'file_lotto_app')
  const jihyun = threads.find((t) => t.id === 'jihyun')

  it('leaves the round in the news and the purchase on the card', () => {
    const article = scenario.news.find((n) => n.id === 'n_lotto')
    expect(article.body.join(' ')).toContain(String(lotto.round))
    expect(article.title).toContain('미수령')
    const card = threads.find((t) => t.id === 'card')
    expect(card.messages.some((m) => m.text.includes('동행복권'))).toBe(true)
  })

  // 파일에서 플레이어가 읽을 수 있는 글. 캡처 화면은 content 대신 alt 로
  // 적혀 있다 — 그림에 찍힌 글자를 옮겨 적은 것이라 읽히기는 매한가지다.
  const readable = (f) => f.content ?? f.alt ?? ''

  it('splits the serial across the memo, a friend and the phone', () => {
    expect(readable(memo)).toContain(groups[0] + '-' + groups[1])
    expect(jihyun.messages.some((m) => m.text.includes(groups[2]))).toBe(true)
    expect(readable(app)).toContain(groups[3])
    // each place holds its piece and no other
    expect(readable(memo)).not.toContain(groups[2])
    expect(readable(memo)).not.toContain(groups[3])
    expect(readable(app)).not.toContain(groups[0])
  })

  it('never writes the whole serial anywhere but the ending', () => {
    const world = JSON.stringify({ files, threads, news: scenario.news, sites: scenario.sites.filter((s) => s.layout !== 'lotto') })
    expect(world).not.toContain(lotto.serial)
    expect(world).not.toContain(groups.join(''))
  })
})

describe('the one who lived', () => {
  beforeEach(() => useGame.setState({ grants: {}, locks: 1, ended: false, day: scenario.days.length }))

  it('outranks overwork and the weekend, but not the truth', () => {
    expect(endingFor(scenario.ending, { grants: { lotto: true }, locks: 0 })).toBe('lotto')
    expect(endingFor(scenario.ending, { grants: { lotto: true, [CLUE.obituary]: true }, locks: 1 })).toBe('true')
    expect(site.lotto.gone).toMatch(/본인 확인/)
    useGame.getState().grant('lotto')
    useGame.getState().finishDay()
    expect(useGame.getState().ended).toBe('lotto')
  })

  it('finds the crumpled slip in the bag, and ends alive', () => {
    const scenes = scenario.ending.lotto.scenes
    expect(scenes.length).toBeGreaterThan(3)
    expect(scenes[1].lines.join(' ')).toMatch(/가방/)
    expect(scenes[1].lines.join(' ')).toContain(lotto.serial)
    for (const sc of scenes) expect(sc.lines.length).toBeGreaterThan(0)
    expect(scenario.ending.lotto.end.button).toBeTruthy()
    const story = JSON.stringify(scenes)
    expect(story).toMatch(/오기|정정/)
    expect(story).toContain('수령')
    expect(scenes[scenes.length - 1].lines.join(' ')).not.toMatch(/나타날 수 없/)
    expect(scenario.objectives.some((o) => o.grant === 'lotto')).toBe(false)
  })
})
