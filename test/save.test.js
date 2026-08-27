import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// The store reads storage at import time, so each case stubs it, then imports.
const mem = () => {
  const m = new Map()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  }
}

beforeEach(() => {
  globalThis.localStorage = mem()
  globalThis.sessionStorage = mem()
  vi.resetModules()
})

const freshStore = async () => (await import('../src/engine/store.js')).useGame
// autosave is debounced by 400ms
const settle = () => new Promise((r) => setTimeout(r, 450))

describe('save / load', () => {
  it('carries progress into the next session', async () => {
    const useGame = await freshStore()
    useGame.setState({ unlocked: { 'wiki.ar.co.kr': true }, msgCount: 3, scratch: '입사일 0412', readMails: { mail_client: true } })
    useGame.getState().openWindow('browser')
    useGame.getState().saveGame()

    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    const next = (await freshStore()).getState()

    expect(next.unlocked['wiki.ar.co.kr']).toBe(true)
    expect(next.msgCount).toBe(3)
    expect(next.scratch).toBe('입사일 0412')
    expect(next.readMails).toEqual({ mail_client: true })
    expect(next.windows.map((w) => w.app)).toEqual(['browser'])
  })

  it('picks the autosave up again after a plain refresh', async () => {
    const useGame = await freshStore()
    useGame.setState({ unlocked: { 'wiki.ar.co.kr': true }, scratch: '메모' })
    await settle()

    vi.resetModules()
    const next = (await freshStore()).getState()
    expect(next.unlocked['wiki.ar.co.kr']).toBe(true)
    expect(next.scratch).toBe('메모')
  })

  it('drops the autosave when a new game starts', async () => {
    const useGame = await freshStore()
    useGame.setState({ unlocked: { 'wiki.ar.co.kr': true } })
    await settle()
    globalThis.location = { reload() {} }
    useGame.getState().newGame()

    vi.resetModules()
    expect((await freshStore()).getState().unlocked).toEqual({})
  })

  it('prefers the explicit checkpoint over the autosave', async () => {
    const useGame = await freshStore()
    useGame.setState({ msgCount: 1 })
    useGame.getState().saveGame()          // checkpoint at 1
    useGame.setState({ msgCount: 4 })
    await settle()                          // autosave at 4

    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    expect((await freshStore()).getState().msgCount).toBe(1)
  })

  it('ignores a corrupt save instead of crashing', async () => {
    globalThis.localStorage.setItem('windowsEx.save', '{ not json')
    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    const state = (await freshStore()).getState()

    expect(state.unlocked).toEqual({})
    expect(state.windows).toEqual([])
  })

  it('says so when there is nothing to load', async () => {
    const useGame = await freshStore()
    useGame.getState().loadGame()
    expect(useGame.getState().toast.text).toContain('저장된 게임이 없습니다')
  })
})

// The save is the whole of PROGRESS and nothing else. A field restored on boot
// but left out of the list comes back as its default every time the page
// reloads — the kind of loss that reads as "the game forgot", not as a crash.
describe('what survives a reload', () => {
  const src = readFileSync('src/engine/store.js', 'utf8')
  const listed = src.match(/export const PROGRESS = \[([\s\S]*?)\]/)[1]
    .match(/'[^']+'/g).map((s) => s.slice(1, -1))
  const restoredOnBoot = [...src.matchAll(/^ {2}(\w+): restored\?\./gm)].map((m) => m[1])

  it('saves every field the store restores on boot', () => {
    expect(restoredOnBoot.filter((f) => !listed.includes(f))).toEqual([])
  })

  it('restores every field it saves', () => {
    expect(listed.filter((f) => !restoredOnBoot.includes(f))).toEqual([])
  })

  it('carries the week: the day, the grants, and what was witnessed', () => {
    for (const k of ['day', 'grants', 'dreamt', 'drawn', 'overtime', 'digging', 'rumor']) {
      expect(listed, k).toContain(k)
    }
  })
})
