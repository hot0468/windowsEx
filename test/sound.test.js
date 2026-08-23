import { beforeEach, describe, expect, it } from 'vitest'
import { isMuted, play, setMuted } from '../src/shell/sound.js'

const mem = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }
}

beforeEach(() => { globalThis.localStorage = mem() })

describe('sound', () => {
  it('stays silent rather than throwing where there is no audio', () => {
    expect(() => play('notify')).not.toThrow()
    expect(() => play('나팔')).not.toThrow()   // unknown name
  })

  it('remembers a mute preference', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    expect(globalThis.localStorage.getItem('windowsEx.muted')).toBe('1')
    setMuted(false)
    expect(isMuted()).toBe(false)
  })

  it('honours the preference even if it cannot be stored', () => {
    globalThis.localStorage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
    expect(() => setMuted(true)).not.toThrow()
    expect(isMuted()).toBe(true)
    setMuted(false)
  })
})
