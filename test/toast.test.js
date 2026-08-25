import { beforeEach, describe, expect, it } from 'vitest'
import { useGame, watchingThread } from '../src/engine/store.js'

const chat = { from: '차민혁', text: '보냈습니다', app: 'messenger', source: 'workMessenger', thread: 'boss' }

beforeEach(() => useGame.setState({ toast: null, windows: [], openThread: {}, day: 1 }))

describe('a notification for a conversation already on screen', () => {
  it('does not ring while that thread is the one open', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: false }], openThread: { workMessenger: 'boss' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast).toBe(null)
  })

  it('rings when the window is showing a different thread', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: false }], openThread: { workMessenger: 'jihyun' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast?.thread).toBe('boss')
  })

  it('rings when the window is minimized', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: true }], openThread: { workMessenger: 'boss' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast?.thread).toBe('boss')
  })

  it('rings when the other messenger is the one open', () => {
    useGame.setState({ windows: [{ id: 1, app: 'chat', minimized: false }], openThread: { workMessenger: 'boss' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast?.thread).toBe('boss')
  })

  it('leaves toasts that are not about a conversation alone', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: false }] })
    expect(watchingThread(useGame.getState(), { from: '다운로드 완료', text: '저장했습니다', app: 'explorer' })).toBe(false)
  })
})
