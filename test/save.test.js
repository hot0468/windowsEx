import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('save / load', () => {
  it('carries progress into the next session', async () => {
    const useGame = await freshStore()
    useGame.setState({ wikiUnlocked: true, msgCount: 3, scratch: '입사일 0412', readMails: { mail_client: true } })
    useGame.getState().openWindow('browser')
    useGame.getState().saveGame()

    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    const next = (await freshStore()).getState()

    expect(next.wikiUnlocked).toBe(true)
    expect(next.msgCount).toBe(3)
    expect(next.scratch).toBe('입사일 0412')
    expect(next.readMails).toEqual({ mail_client: true })
    expect(next.windows.map((w) => w.app)).toEqual(['browser'])
  })

  it('starts fresh when no load was requested', async () => {
    const useGame = await freshStore()
    useGame.setState({ wikiUnlocked: true })
    useGame.getState().saveGame()

    vi.resetModules()
    expect((await freshStore()).getState().wikiUnlocked).toBe(false)
  })

  it('ignores a corrupt save instead of crashing', async () => {
    globalThis.localStorage.setItem('windowsEx.save', '{ not json')
    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    const state = (await freshStore()).getState()

    expect(state.wikiUnlocked).toBe(false)
    expect(state.windows).toEqual([])
  })

  it('says so when there is nothing to load', async () => {
    const useGame = await freshStore()
    useGame.getState().loadGame()
    expect(useGame.getState().toast.text).toContain('저장된 게임이 없습니다')
  })
})
