import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'

// 사내 포털의 2단계 인증. 번호는 메일과 문자 양쫽으로 간다 — 문자는 폰에만
// 있으니, 메일이 없으면 PC 로 하는 사람은 포털에 못 들어간다.
describe('로그인 인증번호', () => {
  const url = 'portal.ar.co.kr'
  beforeEach(() => useGame.setState({ codes: {}, sms: [], extraMails: [], day: 1, toast: null }))

  it('포털만 2단계고, 위키는 비밀번호 하나다', () => {
    expect(scenario.sites.find((s) => s.url === url).login.otp).toBeTruthy()
    expect(scenario.sites.find((s) => s.url === 'wiki.ar.co.kr').login.otp).toBeUndefined()
  })

  it('여섯 자리 번호가 메일과 문자로 함께 간다', () => {
    const code = useGame.getState().issueCode(url)
    expect(code).toMatch(/^\d{6}$/)
    const st = useGame.getState()
    expect(st.extraMails).toHaveLength(1)
    expect(st.extraMails[0].body).toContain(code)
    expect(st.sms).toHaveLength(1)
    expect(st.sms[0].text).toContain(code)
  })

  it('맞는 번호만 통과한다', () => {
    const code = useGame.getState().issueCode(url)
    expect(useGame.getState().verifyCode(url, code)).toBe(true)
    expect(useGame.getState().verifyCode(url, ' ' + code + ' ')).toBe(true)
    expect(useGame.getState().verifyCode(url, '000000')).toBe(code === '000000')
    expect(useGame.getState().verifyCode('wiki.ar.co.kr', code)).toBe(false)
  })

  // 다시 받으면 옛 번호는 죽는다 — 둘 다 살아 있으면 한 번호로 두 번 들어간다.
  it('다시 받으면 옛 번호는 죽는다', () => {
    const first = useGame.getState().issueCode(url)
    let second = useGame.getState().issueCode(url)
    while (second === first) second = useGame.getState().issueCode(url)
    expect(useGame.getState().verifyCode(url, first)).toBe(false)
    expect(useGame.getState().verifyCode(url, second)).toBe(true)
  })

  it('2단계가 없는 사이트에는 번호가 나가지 않는다', () => {
    expect(useGame.getState().issueCode('wiki.ar.co.kr')).toBe(null)
    expect(useGame.getState().sms).toHaveLength(0)
  })

  // 번호가 시나리오 문구에 미리 적혀 있으면 인증이 아니다.
  it('문구는 자리만 두고 번호는 그때 만든다', () => {
    const otp = scenario.sites.find((s) => s.url === url).login.otp
    expect(otp.text).toContain('{code}')
    expect(otp.text).not.toMatch(/\d{6}/)
  })
})
