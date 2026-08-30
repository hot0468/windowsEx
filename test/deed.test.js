import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fsView, place, useGame } from '../src/engine/store.js'

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

  it('부탁받기 전에 이미 해 둔 일이면 묻자마자 답한다', () => {
    useGame.setState({ grants: { orders: true }, pendingAsks: {} })
    useGame.getState().queueAsk('boss', DEED)
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

  it('점이 없는 이름도 그대로 바꿀 수 있다', () => {
    const fs = place(scenario.fs, { file_hosts: { name: 'hosts_old' } })
    const etc = ['로컬 디스크 (C:)', 'Windows', 'System32', 'drivers', 'etc']
    const f = at(fs, etc).find((e) => e.id === 'file_hosts')
    expect(f?.name).toBe('hosts_old')
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

// 드라이브 페이지에 올린 파일은 그 페이지 아래에 남는다. 올린 것이 눈에
// 보여야 한 일이 된다.
describe('드라이브에 올린다', () => {
  const SPEC = { id: 'deed_t_up', title: 't', grant: 'deed_t_up', upload: { file: 'file_qc', page: 'q3' } }
  beforeEach(() => useGame.setState({
    scenario: { ...scenario, objectives: [...scenario.objectives, SPEC] },
    grants: {}, uploaded: {}, pendingAsks: {}, extraMessages: {}
  }))

  it('올리면 페이지 목록에 붙고, 같은 파일은 한 번만', () => {
    useGame.getState().uploadTo('q3', 'file_qb')
    useGame.getState().uploadTo('q3', 'file_qb')
    expect(useGame.getState().uploaded.q3).toEqual(['file_qb'])
  })

  it('맞는 페이지에 맞는 파일이면 grant, 다른 페이지면 침묵', () => {
    useGame.getState().uploadTo('owner', 'file_qc')
    expect(useGame.getState().grants.deed_t_up).toBeUndefined()
    useGame.getState().uploadTo('q3', 'file_qc')
    expect(useGame.getState().grants.deed_t_up).toBe(true)
  })

  it('uploaded는 세이브에 실린다', async () => {
    const { PROGRESS } = await import('../src/engine/store.js')
    expect(PROGRESS).toContain('uploaded')
  })
})

// 행동으로 푸는 요청은 accept 검사를 면제받는 대신 이것을 지킨다: 기다리는
// objective 가 검사 스펙을 갖고, 그 스펙이 가리키는 파일·폴더·페이지·주소가
// 실제로 게임 안에 있다. 하나라도 어긋나면 그 요청은 영영 못 푼다.
describe('행동 요청의 스펙', () => {
  const steps = (a) => (a ? [a, ...steps(a.then)] : [])
  const deeds = scenario.pool.requests.flatMap((r) => steps(r.beat.ask)).filter((a) => a.deed)
  const files = new Set(allFiles(scenario.fs).map((f) => f.id))
  const folders = new Set()
  const walk = (es, trail) => es.forEach((e) => { if (e.children) { folders.add(trail + '/' + e.name); walk(e.children, trail + '/' + e.name) } })
  Object.entries(scenario.fs).forEach(([r, es]) => { folders.add(r); walk(es, r) })
  const drive = scenario.sites.find((s) => s.layout === 'drive').wiki.pages
  const world = JSON.stringify(scenario)

  it('열여섯 건이 있고 종류당 넷이다', () => {
    expect(deeds.length).toBeGreaterThanOrEqual(16)
    const kinds = deeds.map((a) => {
      const o = scenario.objectives.find((x) => x.id === a.deed)
      return ['cell', 'mail', 'move', 'rename', 'upload'].find((k) => o?.[k])
    })
    for (const k of ['cell', 'mail', 'upload']) expect(kinds.filter((x) => x === k).length, k).toBeGreaterThanOrEqual(4)
    expect(kinds.filter((x) => x === 'move' || x === 'rename').length).toBeGreaterThanOrEqual(4)
    expect(kinds.every(Boolean)).toBe(true)
  })

  it('스펙이 가리키는 것이 다 실존한다', () => {
    for (const a of deeds) {
      const o = scenario.objectives.find((x) => x.id === a.deed)
      if (o.cell) {
        const sheet = allFiles(scenario.fs).find((f) => f.id === o.cell.file)?.sheets?.find((s) => s.name === o.cell.sheet)
        expect(sheet?.rows[o.cell.row]?.[o.cell.col], a.deed).toBeDefined()
        expect(sheet.rows[o.cell.row][o.cell.col], a.deed).not.toBe(o.cell.value)
      }
      if (o.mail) {
        expect(world, a.deed).toContain(o.mail.to)
        if (o.mail.requiredAttachment) { expect(files.has(o.mail.requiredAttachment), a.deed).toBe(true); expect(o.mail.wrongAttachmentReply, a.deed).toBeTruthy() }
        if (o.mail.requiredKeywords?.length) expect(o.mail.unclearReply, a.deed).toBeTruthy()
        expect(o.mail.reply?.body, a.deed).toBeTruthy()
      }
      if (o.move) { expect(files.has(o.move.file), a.deed).toBe(true); expect(folders.has(o.move.into), a.deed).toBe(true) }
      if (o.rename) { expect(files.has(o.rename.file), a.deed).toBe(true); expect(o.rename.name, a.deed).toMatch(/\.[a-z]+$/) }
      if (o.upload) { expect(files.has(o.upload.file), a.deed).toBe(true); expect(drive[o.upload.page], a.deed).toBeTruthy() }
    }
  })

  it('말할 것과 힌트가 있다', () => {
    for (const a of deeds) {
      expect(a.placeholder, a.deed).toBeTruthy()
      expect(a.ok?.length, a.deed).toBeGreaterThan(0)
      expect(a.no?.length, a.deed).toBe(3)
      expect(a.next, a.deed).toEqual([])
    }
  })

  it('옮기는 파일은 이미 받은 것이어야 한다', () => {
    // 메일 첨부(attached)는 저장하기 전엔 어디에도 없다. 그런 파일을 옮기라고
    // 하면 못 받은 판에서 영영 못 푼다.
    const attached = new Set(allFiles(scenario.fs).filter((f) => f.attached).map((f) => f.id))
    for (const a of deeds) {
      const o = scenario.objectives.find((x) => x.id === a.deed)
      for (const id of [o.move?.file, o.rename?.file, o.upload?.file, o.mail?.requiredAttachment].filter(Boolean)) {
        expect(attached.has(id), a.deed + ' ' + id).toBe(false)
      }
    }
  })
})
