import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { goalFor } from '../src/engine/store.js'
import { searchBlogs } from '../src/engine/store.js'
import { shotOf } from '../src/assets/photos.js'

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
      ...goalFor(scenario, 1).requiredKeywords,     // the confirmed price
      wiki.login.password,                   // the intranet password
      scenario.network.ip,                   // the approved IP
      portal.portal.footer.address           // the office address 엄마 asks for
    ]
    for (const secret of secrets) expect(text).not.toContain(secret)
  })

  it('reviews other pubs but never the one they went to', () => {
    const pub = scenario.privateMessenger.sections
      .flatMap((s) => s.threads)
      .flatMap((t) => (t.reactions ?? []).map((r) => r.ask))
      .find((a) => a?.grants === 'pub')
    const text = JSON.stringify(blogs)
    for (const accepted of pub.accept) expect(text).not.toContain(accepted)
    expect(blogs.filter((b) => b.tags.includes('맥주')).length).toBeGreaterThan(0)
  })
})

describe('illustrations', () => {
  it('gives every place and every post a picture that resolves', () => {
    for (const p of scenario.places) expect(shotOf(p.photo)).toBeTruthy()
    for (const b of scenario.blogs) expect(shotOf(b.photo)).toBeTruthy()
  })

  it('resolves the photos dropped inside post bodies too', () => {
    const inline = scenario.blogs.flatMap((b) => b.body.filter((part) => part.shot))
    expect(inline.length).toBeGreaterThan(0)
    for (const part of inline) expect(shotOf(part.shot)).toBeTruthy()
  })

  it('keeps every post readable as text between the pictures', () => {
    for (const b of scenario.blogs) {
      expect(b.body.filter((part) => typeof part === 'string').length).toBeGreaterThan(2)
    }
  })
})
