import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ windows: [], nextZ: 10 }))

describe('window management', () => {
  it('opens windows with increasing z-order', () => {
    useGame.getState().openWindow('mail')
    useGame.getState().openWindow('browser')
    const [a, b] = useGame.getState().windows
    expect(b.z).toBeGreaterThan(a.z)
  })

  it('reopening the same app focuses the existing window', () => {
    useGame.getState().openWindow('mail')
    useGame.getState().openWindow('mail')
    expect(useGame.getState().windows).toHaveLength(1)
  })

  it('notepad windows for different files are separate', () => {
    useGame.getState().openWindow('notepad', { fileId: 'a' })
    useGame.getState().openWindow('notepad', { fileId: 'b' })
    expect(useGame.getState().windows).toHaveLength(2)
  })

  it('explorer windows for different start folders are separate', () => {
    useGame.getState().openWindow('explorer', { startFolder: '문서' })
    useGame.getState().openWindow('explorer', { startFolder: '휴지통' })
    expect(useGame.getState().windows).toHaveLength(2)
    useGame.getState().openWindow('explorer', { startFolder: '문서' })
    expect(useGame.getState().windows).toHaveLength(2)
  })

  it('focus unminimizes and raises z', () => {
    useGame.getState().openWindow('mail')
    const id = useGame.getState().windows[0].id
    useGame.getState().minimizeWindow(id)
    expect(useGame.getState().windows[0].minimized).toBe(true)
    const zBefore = useGame.getState().windows[0].z
    useGame.getState().focusWindow(id)
    const w = useGame.getState().windows[0]
    expect(w.minimized).toBe(false)
    expect(w.z).toBeGreaterThan(zBefore)
  })
})
