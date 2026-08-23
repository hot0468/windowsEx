import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { searchBlogs } from '../src/engine/store.js'

const blogs = scenario.blogs
const titles = (q) => searchBlogs(blogs, q).map((b) => b.title)

describe('blog search', () => {
  it('turns up reviews for the terms a player would try', () => {
    expect(titles('맛집').length).toBeGreaterThan(0)
    expect(titles('맥주').length).toBeGreaterThan(0)
  })

  it('matches on tags as well as the headline', () => {
    expect(titles('해장').length).toBeGreaterThan(0)
    expect(titles('평양냉면').length).toBeGreaterThan(0)
  })

  it('returns nothing for a blank or unknown term', () => {
    expect(searchBlogs(blogs, '   ')).toEqual([])
    expect(searchBlogs(blogs, '양자역학')).toEqual([])
  })

  it('gives every post a byline and something to read', () => {
    for (const b of blogs) {
      expect(b.blog && b.author && b.date).toBeTruthy()
      expect(b.body.length).toBeGreaterThan(2)
      expect(b.tags.length).toBeGreaterThan(0)
    }
  })

  it('stays colour only — no post states a fact the player must look up', () => {
    const text = JSON.stringify(blogs)
    const wiki = scenario.sites.find((s) => s.layout === 'wiki')
    const portal = scenario.sites.find((s) => s.layout === 'portal')
    const secrets = [
      ...scenario.goal.requiredKeywords,     // the confirmed price
      wiki.login.password,                   // the intranet password
      scenario.network.ip,                   // the approved IP
      portal.portal.footer.address           // the office address 엄마 asks for
    ]
    for (const secret of secrets) expect(text).not.toContain(secret)
  })

  it('may name a pub, because naming one does not say which one they went to', () => {
    const beers = blogs.filter((b) => b.tags.includes('맥주'))
    expect(beers.length).toBeGreaterThan(1)
  })
})
