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

describe('two questions in one conversation', () => {
  beforeEach(() => useGame.setState({ pendingAsks: {} }))

  it('asks the first question when the thread has none waiting', () => {
    const first = { placeholder: '하나', accept: ['a'] }
    useGame.getState().queueAsk('boss', first)
    expect(useGame.getState().pendingAsks.boss).toBe(first)
  })

  it('queues the second behind the first instead of dropping it', () => {
    const first = { placeholder: '하나', accept: ['a'] }
    const second = { placeholder: '둘', accept: ['b'] }
    useGame.getState().queueAsk('boss', first)
    useGame.getState().queueAsk('boss', second)
    const waiting = useGame.getState().pendingAsks.boss
    expect(waiting.placeholder).toBe('하나')
    expect(waiting.then).toBe(second)
  })

  it('keeps a question a day already chained, and waits behind it', () => {
    const chained = { placeholder: '하나', accept: ['a'], then: { placeholder: '둘', accept: ['b'] } }
    const third = { placeholder: '셋', accept: ['c'] }
    useGame.getState().queueAsk('boss', chained)
    useGame.getState().queueAsk('boss', third)
    const waiting = useGame.getState().pendingAsks.boss
    expect(waiting.then.placeholder).toBe('둘')
    expect(waiting.then.then).toBe(third)
  })

  it('takes the next question straight over once the last one is answered', () => {
    useGame.getState().setAsk('boss', null)
    const next = { placeholder: '다음', accept: ['a'] }
    useGame.getState().queueAsk('boss', next)
    expect(useGame.getState().pendingAsks.boss).toBe(next)
  })
})
