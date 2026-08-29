import { describe, expect, it } from 'vitest'
import { justNow, mailTime, sortMails } from '../src/engine/store.js'

const at = (date) => ({ date })

describe('mail ordering', () => {
  it('reads the day and the time out of a Korean date line', () => {
    expect(mailTime('8월 21일 (금) 16:42')).toBeGreaterThan(mailTime('8월 21일 (금) 09:12'))
    expect(mailTime('8월 21일 (금) 09:12')).toBeGreaterThan(mailTime('8월 11일 (화) 10:03'))
    expect(mailTime('7월 24일')).toBeLessThan(mailTime('8월 1일'))
  })

  it('treats a reply the player just sent as the newest thing there is', () => {
    expect(mailTime('방금')).toBeGreaterThan(mailTime('12월 31일 (수) 23:59'))
  })

  it('puts the newest mail at the top', () => {
    const inbox = [
      at('8월 21일 (금) 16:42'), at('8월 11일 (화) 10:03'),
      at('8월 20일 (목) 09:12'), at('8월 18일 (화) 03:11')
    ]
    expect(sortMails(inbox).map((m) => m.date)).toEqual([
      '8월 21일 (금) 16:42', '8월 20일 (목) 09:12',
      '8월 18일 (화) 03:11', '8월 11일 (화) 10:03'
    ])
  })

  it('keeps the later of two mails that landed at the same moment on top', () => {
    const first = at('방금')
    const second = at('방금')
    expect(sortMails([first, second])[0]).toBe(second)
  })

  it('leaves the caller list alone', () => {
    const inbox = [at('8월 11일 (화) 10:03'), at('8월 21일 (금) 16:42')]
    sortMails(inbox)
    expect(inbox[0].date).toBe('8월 11일 (화) 10:03')
  })
})

// 회신에 딸려 오는 답장은 화면에 '방금' 이라고 적힌다. 그 말을 시각으로 삼아
// 상수를 돌려주면 그 메일이 영영 맨 위에 박히고, 다음 날 아침에 온 진짜 새
// 메일이 어제 보낸 회신 밑으로 내려간다 — 플레이어는 오늘 온 요청을 못 본다.
// 그래서 보낸 순간의 시각을 at 으로 따로 박는다.
describe('방금 온 메일과 어제 보낸 회신', () => {
  const scenario = { days: [{ date: '8월 23일 (월)' }, { date: '8월 24일 (화)' }, { date: '8월 25일 (수)' }] }

  it('오늘 보낸 회신은 오늘 아침에 온 메일보다 위에 온다', () => {
    const reply = { date: '방금', at: justNow(scenario, 2) }
    const morning = { date: '8월 24일 (화) 09:05' }
    expect(sortMails([morning, reply])[0]).toBe(reply)
  })

  it('내일 온 메일은 어제 보낸 회신보다 위에 온다 — 이것이 어긋나 있었다', () => {
    const yesterday = { date: '방금', at: justNow(scenario, 2) }
    const today = { date: '8월 25일 (수) 09:05' }
    expect(sortMails([yesterday, today])[0]).toBe(today)
  })

  it('같은 날 회신을 여러 번 보내면 나중 것이 위', () => {
    const first = { date: '방금', at: justNow(scenario, 2) }
    const second = { date: '방금', at: justNow(scenario, 2) }
    expect(sortMails([first, second])[0]).toBe(second)
  })

  it('at 이 없으면 예전처럼 날짜로 센다', () => {
    const dated = [{ date: '8월 21일 (금) 16:42' }, { date: '8월 11일 (화) 10:03' }]
    expect(sortMails(dated)[0].date).toBe('8월 21일 (금) 16:42')
  })
})
