import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import Board from '../src/apps/Board.jsx'
import scenario from '../src/scenarios/workday.json'

const site = scenario.sites.find((s) => s.layout === 'board')

describe('퇴근길 page', () => {
  it('actually renders its post list instead of throwing', () => {
    const html = renderToString(createElement(Board, { site }))
    expect(html).toContain(site.board.name)
    for (const p of site.board.posts.slice(0, 3)) expect(html).toContain(p.title)
  })
})
