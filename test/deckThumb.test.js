import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { allFiles } from '../src/engine/store.js'
import { deckThumb } from '../src/icons/Icon.jsx'

// 발표 자료는 사진처럼 아이콘 자리에 첫 장이 보인다. 여기서 깨지는 방식은
// 미리보기가 빈 카드가 되는 것 — 첫 슬라이드에 제목이 없거나, 슬라이드 없는
// 파일이 카드로 그려지는 것.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))
const files = allFiles(scenario.fs)
const decks = files.filter((f) => f.slides)

describe('발표 자료 미리보기', () => {
  it('덱이 있다', () => {
    expect(decks.length).toBeGreaterThan(5)
  })

  it('모든 덱의 첫 장에 제목이 있어 미리보기가 비지 않는다', () => {
    for (const f of decks) {
      const t = deckThumb(f)
      expect(t, f.name).toBeTruthy()
      expect(t.title.trim(), f.name).toBeTruthy()
      expect(t.count, f.name).toBe(f.slides.length)
    }
  })

  it('슬라이드가 없는 파일은 카드가 아니다', () => {
    for (const f of files.filter((x) => !x.slides)) expect(deckThumb(f), f.name).toBe(null)
    expect(deckThumb(null)).toBe(null)
    expect(deckThumb({ name: 'x.pptx', slides: [] })).toBe(null)
  })

  // 덱은 전부 .pptx 다 — 카드로 그려지는데 다른 앱으로 열리면 안 된다.
  it('덱은 슬라이드 뷰어로 열리는 파일이다', () => {
    for (const f of decks) expect(f.name, f.name).toMatch(/\.pptx$/)
  })

  it('작은 아이콘에서는 카드를 그리지 않는다', () => {
    const src = readFileSync(new URL('../src/icons/Icon.jsx', import.meta.url), 'utf8')
    expect(src).toMatch(/photo >= DECK_MIN/)
    expect(src).toMatch(/const DECK_MIN = \d+/)
  })
})
