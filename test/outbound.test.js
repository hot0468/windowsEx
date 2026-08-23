import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { checkOutbound } from '../src/engine/goal.js'
import { allFiles, entriesAt, findFile, fsView } from '../src/engine/store.js'

const day = scenario.days.find((d) => d.fetch)
const fetch = day.fetch
const polite = (middle) => `김영민 대리님, 안녕하세요. AR 김한별입니다.\n\n${middle}\n\n감사합니다.\n김한별 드림`

describe('a mail the player sends first', () => {
  it('bounces an address nobody has', () => {
    expect(checkOutbound(fetch, { to: 'nobody@ctech.co.kr', body: polite('발주 계획서') }).reason).toBe('address')
    expect(checkOutbound(undefined, { to: fetch.to, body: polite('발주 계획서') }).reason).toBe('address')
  })

  it('forgives case and spacing in the address', () => {
    expect(checkOutbound(fetch, { to: ' YM.Kim@ctech.co.kr ', body: polite('발주 계획서') }).ok).toBe(true)
  })

  it('notices a mail with no greeting or no sign-off', () => {
    expect(checkOutbound(fetch, { to: fetch.to, body: '발주 계획서 보내주세요' }).reason).toBe('rude')
    expect(checkOutbound(fetch, { to: fetch.to, body: '안녕하세요. 발주 계획서 보내주세요' }).reason).toBe('rude')
    expect(checkOutbound(fetch, { to: fetch.to, body: '발주 계획서 보내주세요. 감사합니다.' }).reason).toBe('rude')
  })

  it('asks again when the body never says what is wanted', () => {
    const v = checkOutbound(fetch, { to: fetch.to, body: polite('지난번 자료 좀 보내주세요.') })
    expect(v.reason).toBe('keyword')
    expect(v.reply.attach).toBeUndefined()
  })

  it('sends the document back for a proper request', () => {
    const v = checkOutbound(fetch, { to: fetch.to, body: polite('하반기 발주 계획서 공유 부탁드립니다.') })
    expect(v.ok).toBe(true)
    expect(v.reply.attach.fileId).toBeTruthy()
  })

  it('keeps the address findable and the attachment hidden until saved', () => {
    const world = JSON.stringify(allFiles(scenario.fs))
    expect(world).toContain(fetch.to)
    const id = fetch.reply.attach.fileId
    expect(findFile(scenario.fs, id)).toBeTruthy()
    expect(allFiles(fsView(scenario.fs, {})).some((f) => f.id === id)).toBe(false)
    expect(entriesAt(fsView(scenario.fs, { restored: { [id]: true } }), ['다운로드']).some((f) => f.id === id)).toBe(true)
  })

  it('has a bounce to send and a scolding for a rude mail', () => {
    expect(scenario.goal.bounce.body).toContain('{to}')
    expect(fetch.rude.length).toBeGreaterThan(1)
    expect(day.requests).toContain(scenario.objectives.find((o) => o.grant === fetch.grants).id)
  })
})
