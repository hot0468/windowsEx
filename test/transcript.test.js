import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { threadMessages, unreadCount, useGame } from '../src/engine/store.js'

const security = scenario.workMessenger.sections
  .flatMap((s) => s.threads).find((t) => t.id === 'security')
const said = () => threadMessages(security, scenario, 0, useGame.getState().extraMessages)

// Closing the messenger window unmounts it. Anything the conversation kept in
// that component went with it, which is how a finished exchange came back empty.
describe('what a conversation remembers after the window closes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ extraMessages: {}, branches: {}, typing: {}, day: 1 })
  })
  afterEach(() => vi.useRealTimers())

  it('keeps what the player said', () => {
    useGame.getState().say('security', { text: '192.168.10.47' })
    expect(said().filter((m) => m.me).map((m) => m.text)).toEqual(['192.168.10.47'])
  })

  it('keeps a file the player sent', () => {
    useGame.getState().say('security', { file: '휴가신청서_사본.hwp' })
    expect(said().at(-1)).toMatchObject({ me: true, file: '휴가신청서_사본.hwp' })
  })

  it('keeps what the other side answered, and lands it a line at a time', () => {
    useGame.getState().sayBack('security', '차민혁', ['확인했습니다.', '승인 처리되었습니다.'])
    expect(useGame.getState().typing.security).toBe(true)
    vi.runAllTimers()
    expect(said().slice(-2).map((m) => m.text)).toEqual(['확인했습니다.', '승인 처리되었습니다.'])
    expect(said().at(-1).from).toBe('차민혁')
    expect(useGame.getState().typing.security).toBe(false)
  })

  it('finishes answering even if the window is gone before the last line', () => {
    useGame.getState().sayBack('security', '차민혁', ['하나', '둘', '셋'])
    // the window closing must not take the rest of the reply with it
    vi.runAllTimers()
    expect(said().slice(-3).map((m) => m.text)).toEqual(['하나', '둘', '셋'])
  })

  it('keeps the place the conversation reached', () => {
    useGame.getState().setBranch('security', ['한글 문서가 안 열리는데요'])
    expect(useGame.getState().branches.security).toEqual(['한글 문서가 안 열리는데요'])
  })
})

// The player's own lines now sit in the same list as everyone else's, so the
// badge has to know the difference.
describe('the unread badge', () => {
  const history = [{ date: '7월 23일 (금)', from: '차민혁', text: '공지' }]

  it('does not count what the player typed', () => {
    const all = [...history, { day: 1, me: true, text: '192.168.10.47' }]
    expect(unreadCount(all, 1)).toBe(0)
  })

  it('counts what came back', () => {
    const all = [...history, { day: 1, me: true, text: '보냈습니다' },
      { day: 1, from: '차민혁', text: '확인했습니다.' }]
    expect(unreadCount(all, 1)).toBe(1)
  })

  it('treats the history someone came back to as already read', () => {
    expect(unreadCount(history, 0)).toBe(0)
  })

  it('stops counting once the thread has been opened', () => {
    const all = [...history, { day: 1, from: '차민혁', text: '확인했습니다.' }]
    expect(unreadCount(all, all.length)).toBe(0)
  })
})
