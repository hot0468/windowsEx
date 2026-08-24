import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { boardPosts, latestNews, portalFeed, visibleByDay } from '../src/engine/store.js'

const days = scenario.days.length
const boards = ['toegeun.kr', 'sotong.ar.local']
  .map((url) => scenario.sites.find((s) => s.url === url).board)
const base = scenario.sites.find((s) => s.layout === 'portal').portal

describe('what a day brings', () => {
  it('shows an untagged item always, a tagged one only from its day', () => {
    const items = [{ id: 'a' }, { id: 'b', day: 3 }]
    expect(visibleByDay(items, 1).map((x) => x.id)).toEqual(['a'])
    expect(visibleByDay(items, 3).map((x) => x.id)).toEqual(['a', 'b'])
    expect(visibleByDay(items, 5).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('floats the newest day to the top of a board, keeping authored order within it', () => {
    const posts = [{ id: 'old1' }, { id: 'old2' }, { id: 'd3a', day: 3 }, { id: 'd3b', day: 3 }, { id: 'd2', day: 2 }]
    expect(boardPosts(posts, 1).map((x) => x.id)).toEqual(['old1', 'old2'])
    expect(boardPosts(posts, 3).map((x) => x.id)).toEqual(['d3a', 'd3b', 'd2', 'old1', 'old2'])
  })

  it('piles the portal up: today first, then earlier days, then the pinned base', () => {
    const feed1 = portalFeed(scenario, base, 1)
    const feed3 = portalFeed(scenario, base, 3)
    expect(feed3.length).toBeGreaterThan(feed1.length)
    // day 3 opens with day 3's own announcements
    expect(feed3[0]).toEqual(scenario.days[2].portal.news[0])
    // and never loses the base notices
    for (const n of base.news) expect(feed3).toContainEqual(n)
    // growing strictly as the week goes on
    for (let n = 2; n <= days; n++) {
      expect(portalFeed(scenario, base, n).length)
        .toBeGreaterThan(portalFeed(scenario, base, n - 1).length)
    }
  })
})

describe('the feeds the scenario ships', () => {
  it('adds a steady number of news articles every day', () => {
    for (let n = 2; n <= days; n++) {
      const arrived = scenario.news.filter((x) => x.day === n)
      expect(arrived.length, `day ${n}`).toBeGreaterThanOrEqual(2)
    }
    // and the front page reflects the calendar
    const early = latestNews(visibleByDay(scenario.news, 1))
    expect(early.some((x) => (x.day ?? 0) > 1)).toBe(false)
  })

  it('adds posts to both boards every day', () => {
    for (const board of boards) {
      for (let n = 2; n <= days; n++) {
        expect(board.posts.filter((p) => p.day === n).length, `day ${n}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('keeps every day-tagged post as complete as the ones that were always there', () => {
    for (const board of boards) {
      for (const p of board.posts.filter((x) => x.day)) {
        expect(p.id && p.title && p.author && p.time).toBeTruthy()
        expect(p.body.length).toBeGreaterThan(0)
        for (const c of p.comments) expect(c.author && c.text).toBeTruthy()
      }
    }
    for (const n of scenario.news.filter((x) => x.day)) {
      expect(n.id && n.title && n.press && n.date).toBeTruthy()
      expect(n.body.length).toBeGreaterThan(1)
    }
  })

  it('dates each arrival to the day it arrives', () => {
    const dates = { 2: '8월 24일', 3: '8월 25일', 4: '8월 26일', 5: '8월 27일' }
    for (const board of boards) {
      for (const p of board.posts.filter((x) => x.day)) {
        expect(p.time, p.id).toContain(dates[p.day])
      }
    }
  })
})
