import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { fsView, place, useGame } from '../src/engine/store.js'

// 요청의 86%가 '찾아서 타이핑'이었다. 행동으로 푸는 요청은 ask가 텍스트
// 대신 grant를 기다린다 — 그 행동이 일어나면 창이 닫혀 있어도 답이 온다.
const DEED = { deed: 'orders', placeholder: '시트를 고쳐 저장하면 확인됩니다', ok: ['고쳤네요, 감사합니다.'], no: [['a'], ['b'], ['c']], next: [] }

describe('행동을 기다리는 질문', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ grants: {}, pendingAsks: {}, extraMessages: {}, windows: [], openThread: {}, beatQueue: [], beatAsk: null, branches: {}, day: 2 })
  })

  it('그 grant가 켜지면 ok를 말하고 질문이 닫힌다', () => {
    useGame.setState({ pendingAsks: { boss: DEED } })
    useGame.getState().grant('orders')
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(null)
    expect(useGame.getState().extraMessages.boss.map((m) => m.text)).toEqual(DEED.ok)
  })

  it('다른 grant에는 꿈쩍하지 않는다', () => {
    useGame.setState({ pendingAsks: { boss: DEED } })
    useGame.getState().grant('wifi')
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(DEED)
    expect(useGame.getState().extraMessages.boss).toBeUndefined()
  })

  it('체인 가운데의 행동은 다음 질문으로 넘긴다', () => {
    const next = { placeholder: '다음', accept: ['x'], ok: ['끝'], no: [['a'], ['b'], ['c']], next: [] }
    useGame.setState({ pendingAsks: { boss: { ...DEED, then: next } } })
    useGame.getState().grant('orders')
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(next)
  })

  it('마지막 단계의 grants도 같이 켠다', () => {
    useGame.setState({ pendingAsks: { boss: { ...DEED, grants: 'orders' } } })
    useGame.getState().grant('orders')
    vi.runAllTimers()
    expect(useGame.getState().grants.orders).toBe(true)
    // 두 번 켜지지 않는다 — ok 대사가 두 번 오면 그게 증거다
    expect(useGame.getState().extraMessages.boss.map((m) => m.text)).toEqual(DEED.ok)
  })

  it('행동이 먼저 일어나 있으면 그 단계에 이르는 순간 답한다', () => {
    const first = { placeholder: '먼저', accept: ['x'], ok: ['응'], no: [['a'], ['b'], ['c']], next: [], then: DEED }
    useGame.setState({ pendingAsks: { boss: first } })
    useGame.getState().grant('orders')           // 아직 첫 단계 — 아무 일 없다
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(first)
    useGame.getState().setAsk('boss', first.then) // 첫 단계를 넘긴다
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(null)
    expect(useGame.getState().extraMessages.boss.map((m) => m.text)).toEqual(DEED.ok)
  })
})

// 새 메일 쓰기는 그날의 fetch 하나만 알았다. 이제 아직 안 켜진 메일 목표
// 전부가 후보다 — 수신자가 맞는 것을 고르고, 첨부·키워드·예절을 본다.
describe('메일로 푸는 요청', () => {
  const SPEC = {
    id: 'deed_t_mail', title: 't', grant: 'deed_t_mail',
    mail: {
      to: 'ym.kim@ctech.co.kr', requiredAttachment: 'file_qc', requiredKeywords: ['견적서'],
      reply: { from: '김영민 <ym.kim@ctech.co.kr>', subject: 'RE: {subject}', body: '받았습니다.' },
      wrongAttachmentReply: { from: '김영민 <ym.kim@ctech.co.kr>', subject: 'RE: {subject}', body: '첨부가 다릅니다.' },
      unclearReply: { from: '김영민 <ym.kim@ctech.co.kr>', subject: 'RE: {subject}', body: '무엇을 보내신 건지요.' }
    }
  }
  const polite = '안녕하세요, AR주식회사 김한별 대리입니다.\n요청하신 견적서 첨부합니다.\n감사합니다.\n김한별 드림'
  const withSpec = () => useGame.setState({
    scenario: { ...scenario, objectives: [...scenario.objectives, SPEC] },
    grants: {}, extraMails: [], pendingAsks: { boss: { deed: 'deed_t_mail', placeholder: 'p', ok: ['보냈군요.'], no: [['a'], ['b'], ['c']], next: [] } },
    extraMessages: {}, windows: [], openThread: {}, day: 2
  })
  beforeEach(() => { vi.useFakeTimers(); withSpec() })

  it('수신자·첨부·키워드가 맞으면 답장이 오고 요청이 닫힌다', () => {
    const ok = useGame.getState().sendMail({ to: 'ym.kim@ctech.co.kr', subject: '[AR주식회사] 견적서 송부', body: polite, attachmentId: 'file_qc' })
    expect(ok).toBe(true)
    vi.runAllTimers()
    expect(useGame.getState().extraMails.at(-1).body).toBe('받았습니다.')
    expect(useGame.getState().grants.deed_t_mail).toBe(true)
    expect(useGame.getState().pendingAsks.boss).toBe(null)
  })

  it('첨부가 틀리면 그 답장이 오고 요청은 그대로다', () => {
    const ok = useGame.getState().sendMail({ to: 'ym.kim@ctech.co.kr', subject: '[AR주식회사] 견적서', body: polite, attachmentId: 'file_qb' })
    expect(ok).toBe(false)
    vi.runAllTimers()
    expect(useGame.getState().extraMails.at(-1).body).toBe('첨부가 다릅니다.')
    expect(useGame.getState().grants.deed_t_mail).toBeUndefined()
    expect(useGame.getState().pendingAsks.boss).not.toBe(null)
  })

  it('아무 후보도 아닌 주소는 되돌아온다', () => {
    useGame.getState().sendMail({ to: 'nobody@nowhere.kr', subject: 'x', body: polite, attachmentId: null })
    vi.runAllTimers()
    expect(useGame.getState().extraMails.at(-1).from).toContain('mailer-daemon')
  })

  it('그날의 fetch는 예전처럼 그대로 된다', () => {
    useGame.setState({ day: 3 })
    const f = scenario.days[2].fetch
    const body = `안녕하세요, AR주식회사 김한별 대리입니다.\n${f.requiredKeywords[0]} 자료 부탁드립니다.\n감사합니다.\n김한별 드림`
    expect(useGame.getState().sendMail({ to: f.to, subject: '[AR주식회사] 자료 요청', body, attachmentId: null })).toBe(true)
  })
})

// 옮기거나 이름을 바꾼 파일은 뷰에서 그 자리에 있다. id는 그대로라 첨부와
// 목표와 힌트는 아무것도 눈치채지 못한다 — 그래야 옮긴 뒤에도 게임이 산다.
describe('파일을 옮기고 이름을 바꾼다', () => {
  const at = (fs, path) => path.slice(1).reduce((es, n) => es.find((e) => e.name === n)?.children ?? [], fs[path[0]] ?? [])
  const ids = (es) => es.filter((e) => !e.children).map((e) => e.id)

  it('옮기면 원래 자리에서 빠지고 목적 폴더에 들어간다', () => {
    const fs = place(scenario.fs, { file_ppt_meeting: { into: '문서/발표자료' } })
    expect(ids(at(fs, ['다운로드']))).not.toContain('file_ppt_meeting')
    expect(ids(at(fs, ['문서', '발표자료']))).toContain('file_ppt_meeting')
  })

  it('없는 폴더로는 안 옮긴다', () => {
    const fs = place(scenario.fs, { file_ppt_meeting: { into: '문서/없는폴더' } })
    expect(ids(at(fs, ['다운로드']))).toContain('file_ppt_meeting')
  })

  it('이름을 바꿔도 id는 그대로다', () => {
    const fs = place(scenario.fs, { file_dummy_082: { name: '회의자료_0825.pptx' } })
    const f = at(fs, ['다운로드']).find((e) => e.id === 'file_dummy_082')
    expect(f.name).toBe('회의자료_0825.pptx')
  })

  it('fsView가 placed를 받는다', () => {
    const fs = fsView(scenario.fs, { placed: { file_ppt_meeting: { into: '문서/발표자료' } }, scenario })
    expect(ids(at(fs, ['문서', '발표자료']))).toContain('file_ppt_meeting')
  })

  it('목표가 가리키는 자리로 옮기면 grant, 다른 데면 침묵', () => {
    vi.useFakeTimers()
    const SPEC = { id: 'deed_t_move', title: 't', grant: 'deed_t_move', move: { file: 'file_ppt_meeting', into: '문서/발표자료' } }
    useGame.setState({ scenario: { ...scenario, objectives: [...scenario.objectives, SPEC] }, grants: {}, placed: {}, pendingAsks: {}, extraMessages: {} })
    useGame.getState().placeFile('file_ppt_meeting', '문서/개인')
    expect(useGame.getState().grants.deed_t_move).toBeUndefined()
    useGame.getState().placeFile('file_ppt_meeting', '문서/발표자료')
    expect(useGame.getState().grants.deed_t_move).toBe(true)
  })

  it('이름 목표도 같다', () => {
    const SPEC = { id: 'deed_t_rename', title: 't', grant: 'deed_t_rename', rename: { file: 'file_dummy_082', name: '회의자료_0825.pptx' } }
    useGame.setState({ scenario: { ...scenario, objectives: [...scenario.objectives, SPEC] }, grants: {}, placed: {}, pendingAsks: {}, extraMessages: {} })
    useGame.getState().renameFile('file_dummy_082', '회의자료_0825.pptx')
    expect(useGame.getState().grants.deed_t_rename).toBe(true)
  })

  it('placed는 세이브에 실린다', async () => {
    const { PROGRESS } = await import('../src/engine/store.js')
    expect(PROGRESS).toContain('placed')
  })
})
