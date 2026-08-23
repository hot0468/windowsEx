import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ openThread: {}, seenThreads: {}, typing: {} }))

describe('typing indicator', () => {
  it('marks only the thread whose sender is writing', () => {
    useGame.getState().setTyping('boss', true)
    expect(useGame.getState().typing.boss).toBe(true)
    expect(useGame.getState().typing.jihyun).toBeUndefined()
  })

  it('clears when the message lands', () => {
    useGame.getState().setTyping('boss', true)
    useGame.getState().setTyping('boss', false)
    expect(useGame.getState().typing.boss).toBe(false)
  })

  it('skips the update when the flag has not changed', () => {
    useGame.getState().setTyping('boss', true)
    const before = useGame.getState().typing
    useGame.getState().setTyping('boss', true)
    expect(useGame.getState().typing).toBe(before)
  })
})

describe('thread selection', () => {
  it('keeps each messenger on its own conversation', () => {
    useGame.getState().setOpenThread('workMessenger', 'boss')
    useGame.getState().setOpenThread('privateMessenger', 'jihyun')
    expect(useGame.getState().openThread).toEqual({
      workMessenger: 'boss', privateMessenger: 'jihyun'
    })
  })

  it('lets a notification switch an already-open messenger to another thread', () => {
    useGame.getState().setOpenThread('workMessenger', 'junho')
    useGame.getState().setOpenThread('workMessenger', 'boss')
    expect(useGame.getState().openThread.workMessenger).toBe('boss')
  })

  it('records how much of a thread has been read', () => {
    useGame.getState().markThreadSeen('boss', 3)
    expect(useGame.getState().seenThreads.boss).toBe(3)
  })

  it('skips the update when the read count has not moved', () => {
    useGame.getState().markThreadSeen('boss', 3)
    const before = useGame.getState().seenThreads
    useGame.getState().markThreadSeen('boss', 3)
    expect(useGame.getState().seenThreads).toBe(before)
  })
})
