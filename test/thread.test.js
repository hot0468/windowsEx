import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { findFile, readUpTo, threadMessages, unreadCount, useGame } from '../src/engine/store.js'

beforeEach(() => useGame.setState({ openThread: {}, seenThreads: {}, typing: {}, readMails: {}, starred: {} }))

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

describe('mail flags', () => {
  it('can put a mail back to unread', () => {
    useGame.getState().markMailRead('mail_client')
    expect(useGame.getState().readMails.mail_client).toBe(true)
    useGame.getState().markMailRead('mail_client', false)
    expect(useGame.getState().readMails.mail_client).toBe(false)
  })

  it('toggles the star both ways', () => {
    useGame.getState().toggleStar('mail_client')
    expect(useGame.getState().starred.mail_client).toBe(true)
    useGame.getState().toggleStar('mail_client')
    expect(useGame.getState().starred.mail_client).toBe(false)
  })
})

// The boss thread is the only live one, and a live thread used to show the
// timed script INSTEAD of the lines it came with — silently hiding the year
// before the accident that the week is supposed to explain.
describe('what a conversation shows', () => {
  const threads = [scenario.workMessenger, scenario.privateMessenger]
    .flatMap((m) => m.sections.flatMap((s) => s.threads))
  const boss = threads.find((t) => t.live)

  it('keeps a live thread history, and puts today after it', () => {
    expect(boss.messages.length).toBeGreaterThan(0)
    const shown = threadMessages(boss, scenario, scenario.messenger.length)
    expect(shown).toHaveLength(boss.messages.length + scenario.messenger.length)
    expect(shown[0].text).toBe(boss.messages[0].text)
    expect(shown.at(-1).text).toBe(scenario.messenger.at(-1).text)
  })

  it('dates the script as today, whatever the history above it says', () => {
    const shown = threadMessages(boss, scenario, scenario.messenger.length)
    expect(shown.slice(boss.messages.length).every((m) => m.day === 1 && m.date === undefined)).toBe(true)
  })

  // A message is either something said before the week — carrying the date it
  // was said on — or something the week itself brought, carrying its day. The
  // unread count reads that difference, so a message may never carry both.
  it('never dates a message two ways at once', () => {
    for (const t of threads) {
      for (const m of t.messages ?? []) {
        expect(m.date !== undefined && m.day !== undefined, `${t.id}: ${m.text}`).toBe(false)
      }
    }
  })

  // The badge counts history as read by treating the dated run at the front as
  // seen. Were a dated line to turn up after an undated one, that arithmetic
  // would mark a real message read and the player would never see it arrive.
  it('keeps history in one run at the front, so the badge can skip it', () => {
    for (const t of threads) {
      const msgs = t.messages ?? []
      const last = msgs.findLastIndex((m) => m.date !== undefined)
      expect(msgs.slice(0, last + 1).every((m) => m.date !== undefined), t.id).toBe(true)
    }
  })

  // A photo in the log is a real file on the machine, and showing one that some
  // request wants attached would hand the player the answer in the chat window.
  it('shows only photos that exist, and never one a request asks for', () => {
    const chain = (a) => (a ? [a, ...chain(a.then)] : [])
    const asks = [
      ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(chain),
      ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))),
      ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => chain(a.ask))),
      ...scenario.pool.requests.flatMap((r) => chain(r.beat.ask))
    ].filter(Boolean)
    const wanted = new Set([
      ...asks.flatMap((a) => a.files ?? []),
      ...threads.flatMap((t) => (t.reactions ?? []).flatMap((r) => r.files ?? []))
    ])
    const shown = threads.flatMap((t) => (t.messages ?? []).filter((m) => m.photo).map((m) => [t.id, m.photo]))
    expect(shown.length).toBeGreaterThan(0)
    for (const [id, photo] of shown) {
      expect(findFile(scenario.fs, photo)?.image, `${id}: ${photo}`).toBeTruthy()
      expect(wanted.has(photo), `${id} shows ${photo}, which a request asks to be sent`).toBe(false)
    }
  })

  // Dates are read off a fictional calendar, so nothing checks them but this.
  it('never runs the history backwards', () => {
    const at = (label) => {
      const [, mo, d] = label.match(/(\d+)월 (\d+)일/).map(Number)
      return mo * 100 + d
    }
    for (const t of threads) {
      const dates = (t.messages ?? []).filter((m) => m.date).map((m) => at(m.date))
      expect([...dates].sort((a, b) => a - b), t.id).toEqual(dates)
    }
  })

  it('shows every other thread the lines it came with', () => {
    for (const t of threads.filter((t) => !t.live && t.messages?.length)) {
      expect(threadMessages(t, scenario), t.id).toHaveLength(t.messages.length)
    }
  })

  it('adds what the week pushed in, dated by the day it arrived', () => {
    const pushed = { [boss.id]: [{ from: 'x', text: 'y', day: 3 }] }
    expect(threadMessages(boss, scenario, 0, pushed).at(-1)).toMatchObject({ day: 3 })
  })
})

// Messenger.jsx는 사진 반응을 한 번만 내보내려고 "이 반응의 첫 줄을 이미
// 들었는가"를 대화 기록에서 찾는다. 컴포넌트 state가 아니라 기록을 읽어야
// 창을 닫았다 열어도 같은 반응이 다시 오지 않는다. 그 판정이 서려면 첫 줄이
// 반응마다 달라야 하고, 스레드가 처음부터 갖고 있던 말과 겹쳐도 안 된다.
describe('a photo reaction only lands once', () => {
  const threads = [scenario.workMessenger, scenario.privateMessenger]
    .flatMap((m) => m.sections.flatMap((s) => s.threads))
  const fileReactions = threads.flatMap(
    (t) => (t.reactions ?? []).filter((r) => r.files).map((r) => [t, r]))

  it('has reactions to react to', () => {
    expect(fileReactions.length).toBeGreaterThan(0)
  })

  it('opens each one with a line no other reaction opens with', () => {
    const openers = fileReactions.map(([, r]) => r.reply[0])
    expect(new Set(openers).size).toBe(openers.length)
  })

  it('never opens with a line the thread already said', () => {
    for (const [t, r] of fileReactions) {
      const already = (t.messages ?? []).map((m) => m.text)
      expect(already, t.id + ' / ' + r.files.join(',')).not.toContain(r.reply[0])
    }
  })
})

// 대화를 열면 곧바로 다 읽은 것으로 표시되므로, 열기 직전의 자리를 붙잡아
// "여기까지 읽었습니다" 금을 긋는다. 그 자리는 뱃지가 세는 자리와 같아야
// 한다 — 다르면 "안 읽음 3" 인데 금 아래에 두 줄만 있는 식이 된다.
describe('여기까지 읽었습니다', () => {
  const old = (n) => Array.from({ length: n }, (_, i) => ({ from: 'x', text: 't' + i, date: '8월 1일' }))
  const today = (n) => Array.from({ length: n }, (_, i) => ({ from: 'x', text: 'n' + i, day: 2 }))

  it('금 아래 남는 줄 수가 안 읽음 수와 같다', () => {
    const msgs = [...old(5), ...today(3)]
    const at = readUpTo(msgs, 0)
    expect(msgs.length - at).toBe(unreadCount(msgs, 0))
  })

  it('처음 여는 대화라도 지난 기록 위에는 긋지 않는다', () => {
    const msgs = [...old(5), ...today(3)]
    expect(readUpTo(msgs, 0)).toBe(5)
  })

  it('읽은 뒤 다시 열면 금이 사라진다', () => {
    const msgs = [...old(5), ...today(3)]
    expect(readUpTo(msgs, msgs.length)).toBe(msgs.length)
    expect(unreadCount(msgs, msgs.length)).toBe(0)
  })

  it('내가 한 말은 안 읽음으로 세지 않는다', () => {
    const msgs = [...old(2), { me: true, text: '네' }]
    expect(unreadCount(msgs, 2)).toBe(0)
  })
})
