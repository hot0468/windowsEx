import { vi } from 'vitest'
import { useGame } from '../src/engine/store.js'

// The day says one thing at a time and waits for the question it just asked to
// be answered, so a test that wants a whole day has to play it: run the timers,
// answer whatever the day is holding on, repeat. Returns every question it
// raised, in the order it raised them.
export function playDay(limit = 60) {
  const raised = []
  for (let i = 0; i < limit; i++) {
    vi.runAllTimers()
    const s = useGame.getState()
    const held = s.beatAsk ? s.pendingAsks[s.beatAsk] : null
    if (held) {
      raised.push({ thread: s.beatAsk, ask: held })
      useGame.getState().setAsk(s.beatAsk, null)
    } else if (!s.beatQueue.length) break
  }
  return raised
}

export const askChain = (ask) => (ask ? [ask, ...askChain(ask.then)] : [])
export const grantsRaised = (raised) =>
  raised.flatMap((r) => askChain(r.ask)).map((a) => a.grants).filter(Boolean)
