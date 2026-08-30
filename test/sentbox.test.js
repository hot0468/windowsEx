import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, findFile, useGame } from '../src/engine/store.js'

// 보낸 메일이 남지 않으면, 거래처가 "그때 보내주신 것"을 말해도 맞추어 볼 수가
// 없다. 깨지는 방식은 둘 — 두 보내는 길 중 한쪽만 남기거나, 되돌아온 메일은
// 안 남겨서 "잘못 보냈다"는 사실이 사라지거나.

const goal = scenario.days[0].goal
const client = [...scenario.mails].find((m) => m.id === goal.replyToMail)

beforeEach(() => {
  vi.useFakeTimers()
  useGame.setState({
    day: 1, sentMails: [], extraMails: [], grants: {}, misses: 0, failed: false,
    readMails: {}, starred: {}, restored: {}, slips: 0
  })
})

describe('보낸메일함', () => {
  it('세이브에 실린다', () => {
    expect(PROGRESS).toContain('sentMails')
  })

  it('회신을 보내면 남는다 — 첨부 이름까지', () => {
    useGame.getState().sendReply({
      attachmentId: goal.requiredAttachment, subject: '[AR] 견적서 회신', body: goal.requiredKeywords[0]
    })
    const [mail] = useGame.getState().sentMails
    expect(mail).toBeTruthy()
    expect(mail.sent).toBe(true)
    expect(mail.to).toBe(client.from)
    expect(mail.body).toContain(goal.requiredKeywords[0])
    expect(mail.attach.name).toBe(findFile(scenario.fs, goal.requiredAttachment).name)
  })

  it('틀리게 보낸 것도 남는다 — 무엇을 보냈는지가 남아야 틀린 걸 안다', () => {
    useGame.getState().sendReply({ attachmentId: null, subject: '회신', body: '금액 빼먹음' })
    expect(useGame.getState().sentMails).toHaveLength(1)
    expect(useGame.getState().sentMails[0].attach).toBe(null)
  })

  it('새 메일도 같은 자리를 지난다 — 되돌아와도 남는다', () => {
    useGame.getState().sendMail({ to: 'nobody@nowhere.co.kr', subject: '문의', body: '안녕하세요' })
    const [mail] = useGame.getState().sentMails
    expect(mail.to).toBe('nobody@nowhere.co.kr')
    expect(mail.sent).toBe(true)
  })

  it('보낸 것마다 서로 다른 id 를 갖는다 — 같으면 목록에서 하나로 겹친다', () => {
    const s = useGame.getState()
    s.sendMail({ to: 'a@b.co.kr', subject: '1', body: 'x' })
    s.sendMail({ to: 'a@b.co.kr', subject: '2', body: 'y' })
    const ids = useGame.getState().sentMails.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('받은메일함으로 새지 않는다', () => {
    useGame.getState().sendMail({ to: 'a@b.co.kr', subject: '문의', body: 'x' })
    expect(useGame.getState().extraMails.some((m) => m.sent)).toBe(false)
  })
})
