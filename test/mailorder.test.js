import { describe, expect, it } from 'vitest'
import { mailTime, sortMails } from '../src/engine/store.js'

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
