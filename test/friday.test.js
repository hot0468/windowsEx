import { describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import {
  CLUE, PROGRESS, allFiles, answerFits, dreamGallery, endingFor, searchBlogs, useGame, visibleByDay
} from '../src/engine/store.js'
import { fileImage, newsShot, shotOf, wallpaper } from '../src/assets/photos.js'

// The week the game plays is dated by scenario.days — 8월 23일 (월) onward —
// and 다온 캘린더 draws August with the 1st on a Sunday. Every other weekday
// the scenario writes has to agree with that calendar, or a player who checks
// a date against the calendar app finds the seams.
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const dayOfYear = (m, d) => MONTH.slice(0, m - 1).reduce((a, b) => a + b, 0) + d

const anchor = scenario.days[0].date.match(/(\d+)월 (\d+)일 \((.)\)/)
const anchorDay = dayOfYear(+anchor[1], +anchor[2])
const anchorWeek = WEEK.indexOf(anchor[3])
const weekdayOf = (m, d) => WEEK[(((dayOfYear(m, d) - anchorDay) % 7) + anchorWeek + 7) % 7]

const DATED = /(?:\d{4}[-.년]\s*)?(\d{1,2})[-.월]\s*(\d{1,2})일?\s*\(([일월화수목금토])\)/g

const strings = (o, path = '$', out = []) => {
  if (Array.isArray(o)) o.forEach((v, i) => strings(v, `${path}[${i}]`, out))
  else if (o && typeof o === 'object') for (const k in o) strings(o[k], `${path}.${k}`, out)
  else if (typeof o === 'string') out.push([path, o])
  return out
}

describe('one calendar for the whole week', () => {
  it('starts the week on a Monday the calendar app agrees with', () => {
    const cal = scenario.sites.find((s) => s.layout === 'calendar').calendar
    expect(weekdayOf(cal.month, 1)).toBe(WEEK[cal.firstWeekday])
  })

  it('labels every dated weekday the way the calendar has it', () => {
    const wrong = []
    for (const [path, text] of strings(scenario)) {
      for (const [, m, d, w] of text.matchAll(DATED)) {
        if (weekdayOf(+m, +d) !== w) wrong.push(`${path}: ${m}월 ${d}일 (${w}) → (${weekdayOf(+m, +d)})`)
      }
    }
    expect(wrong).toEqual([])
  })
})

// The bereavement board says notices are compiled on Fridays. The week's own
// notice therefore cannot exist before the last day: the player is in a coma
// until Thursday night, and only Friday's list carries the name.
const portal = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
const board = portal.pages[scenario.ending.clues.obituary].board
const obituary = board.posts.find((p) => p.obituary)
const last = scenario.days.length
const lastDay = scenario.days[last - 1]
const player = scenario.player.name

describe('the notice that arrives on Friday', () => {
  it('is compiled on the last day, like the board says it is', () => {
    expect(board.note).toContain('금요일')
    expect(obituary.day).toBe(last)
    const [, m, d] = lastDay.date.match(/(\d+)월 (\d+)일/)
    expect(obituary.date).toBe(`2026.${m.padStart(2, '0')}.${d.padStart(2, '0')}`)
    expect(visibleByDay(board.posts, last - 1).some((p) => p.obituary)).toBe(false)
    expect(visibleByDay(board.posts, last).some((p) => p.obituary)).toBe(true)
  })

  it('keeps the earlier weeks there from the start, each posted on a Friday', () => {
    for (const p of board.posts) {
      const [, m, d] = p.date.match(/\d{4}\.(\d{2})\.(\d{2})/)
      expect(weekdayOf(+m, +d), p.id).toBe('금')
      if (!p.obituary) expect(p.day, p.id).toBeUndefined()
    }
  })

  it('says the crash left him in a coma, and dates the death to Thursday night', () => {
    const mine = JSON.stringify(obituary.sections.find((s) => s.mine))
    expect(mine).toMatch(/의식불명|혼수/)
    expect(mine).toContain('26일(목)')
    // the search portal only ever knows about the crash, not the death
    const article = scenario.news.find((n) => n.id === 'n_accident')
    expect(JSON.stringify(article)).not.toContain('숨')
    expect(JSON.stringify(article)).toMatch(/의식불명|중태/)
    // and the lottery counter knows the same date as the notice
    const lotto = scenario.sites.find((s) => s.lotto).lotto
    expect(lotto.gone).toContain('8월 26일')
  })
})

describe('the wedding question on the last day', () => {
  const beat = (lastDay.asks ?? []).find((a) => a.ask?.grants === 'wedding_venue')

  it('is asked on the last day and counted there', () => {
    expect(beat).toBeTruthy()
    expect(lastDay.requests).toContain('wedding_venue')
    expect(scenario.pool.fixed[last]).toContain('wedding_venue')
    expect(scenario.objectives.some((o) => o.id === 'wedding_venue' && o.grant === 'wedding_venue')).toBe(true)
  })

  it('is answered by the wedding at the top of the very notice that ends with the player', () => {
    const wedding = obituary.sections[0]
    expect(wedding.kind).toBe('결혼')
    expect(JSON.stringify(wedding)).toContain('8월 28일(토)')
    const rows = JSON.stringify(wedding.rows)
    for (const a of beat.ask.accept) expect(rows).toContain(a)
    expect(answerFits(beat.ask, wedding.rows.find(([k]) => k === '장소')[1])).toBe(true)
    // the answer lives nowhere else the player could have read it earlier
    const elsewhere = JSON.stringify({ ...portal, pages: { ...portal.pages, [scenario.ending.clues.obituary]: null } })
    for (const a of beat.ask.accept) expect(elsewhere).not.toContain(a)
  })

  it('says tomorrow, points the lost at the board, and never names it up front', () => {
    expect(beat.lines.join(' ')).toContain('내일')
    expect(beat.lines.join(' ')).not.toContain('경조사')
    expect(beat.ask.no.at(-1).join(' ')).toContain('경조사')
    expect(beat.lines.join(' ')).not.toContain(player)
  })
})

// Nobody in a coma buys a coffee. Anything the card announces after the crash
// has to be something that bills itself — a subscription, a standing transfer,
// a statement — and the phone the player carries has to agree.
describe('the card while he is not there', () => {
  const CRASH = '08/22'
  const card = scenario.privateMessenger.sections
    .flatMap((sec) => sec.threads).find((t) => t.id === 'card')
  const stamped = (text) => text.match(/\b(\d{2})\/(\d{2}) \d{2}:\d{2}\b/)

  it('announces nothing he had to be awake to buy', () => {
    const awake = []
    for (const m of card.messages) {
      const at = stamped(m.text)
      // 입금 is somebody else's doing; only what he would have paid counts
      if (!at || at[0] < CRASH || m.text.includes('입금')) continue
      if (!/정기결제|자동이체|자동결제/.test(m.text)) awake.push(m.text.replace(/\n/g, ' / '))
    }
    expect(awake).toEqual([])
  })

  it('still lets mother keep sending money, because she is the one sending it', () => {
    const gifts = card.messages.filter((m) => m.text.includes('입금') && m.text.includes('엄마'))
    expect(gifts.length).toBeGreaterThanOrEqual(2)
    for (const m of gifts) expect(m.text).not.toMatch(/정기결제|자동이체/)
  })

  it('keeps the lottery purchase, the one charge from before the holiday', () => {
    const ticket = card.messages.find((m) => m.text.includes('동행복권'))
    expect(ticket).toBeTruthy()
    expect(stamped(ticket.text)[0] < CRASH).toBe(true)
  })
})

// The holiday never happened. He was driving to the airport when the car left
// the road, and the month in Jeju is what a body dreams while it waits. What
// the office believes, and what the phone kept, both have to say so.
describe('the month that never happened', () => {
  const threads = [scenario.workMessenger, scenario.privateMessenger]
    .flatMap((m) => m.sections.flatMap((sec) => sec.threads))
  const thread = (id) => threads.find((t) => t.id === id)
  const said = (t) => JSON.stringify(t.messages)
  // the car left the road in the small hours of 7월 24일; a dated message is
  // his to send only if it was sent before that
  const before = (m) => {
    const at = (m.date ?? '').match(/(\d+)월 (\d+)일/)
    return at ? +at[1] * 100 + +at[2] < 724 : true
  }

  it('crashes him on the way out, the night he last clocked off', () => {
    const leave = JSON.stringify(scenario.fs).match(/기간: (2026-07-\d\d) ~ (2026-08-\d\d)/)
    expect(leave[1]).toBe('2026-07-24')
    const article = scenario.news.find((n) => n.id === 'n_accident')
    // the crash is dated to the start of the holiday, not the end of it
    expect(article.date).toMatch(/^2026\.07\.24$/)
    expect(article.body.join(' ')).toMatch(/공항|김포/)
    expect(JSON.stringify(article)).toMatch(/의식불명|중태/)
  })

  it('never lets him answer a message sent after the crash', () => {
    for (const id of ['mom', 'jihyun', 'guesthouse']) {
      const t = thread(id)
      for (const m of t.messages) {
        if (!m.me) continue
        expect(before(m), `${id}: ${m.date} ${m.text}`).toBe(true)
      }
    }
  })

  it('has the guesthouse stop at the check-in it was waiting on', () => {
    const g = thread('guesthouse')
    // the last thing it ever says is the question nobody answered
    const last = g.messages.at(-1)
    expect(last.me).toBeFalsy()
    expect(last.text).toMatch(/체크인/)
    expect(last.date).toBe('7월 25일 (일)')
    // and nothing in it speaks as though he ever arrived
    expect(said(g)).not.toMatch(/잘 들어가셨|묵던 방|묵으신|머무시는/)
  })

  it('leaves 지현 talking to someone who stopped answering', () => {
    const j = thread('jihyun')
    // nobody tells her, so nothing she says after the crash knows about it
    const after = j.messages.filter((m) => !before(m))
    expect(after.length).toBeGreaterThan(0)
    expect(JSON.stringify(after)).not.toMatch(/중환자|의식|장례|부고/)
    expect(said(j)).toMatch(/읽씹|왜 답이 없|읽고 있으면|살아있/)
  })

  // Day one sends the player into 엄마's thread for the company address, so
  // whatever is in it is read by everyone, always. It may never say where she
  // is: the same lines have to pass as an ordinary worried mother the first
  // time and as a month at a bedside the second.
  it('never lets 엄마 say where she has been sitting', () => {
    const mom = thread('mom')
    expect(JSON.stringify(mom)).not.toMatch(/병원|병실|중환자|의사|입원|상 차리는/)
    // she is still there every week, saying so without saying it
    expect(said(mom)).toMatch(/엄마 여기 있다/)
    expect(said(mom)).toMatch(/복숭아/)
    // and she keeps sending money either way
    const card = threads.find((t) => t.id === 'card')
    expect(card.messages.filter((m) => m.text.includes('입금') && m.text.includes('엄마')).length)
      .toBeGreaterThanOrEqual(2)
  })

  it('keeps the boarding pass real — he was on his way to it', () => {
    const pass = JSON.stringify(scenario.fs).match(/2026-07-24 (\d\d:\d\d) 출발, 좌석 (\w+), (\w+)/)
    expect(pass).toBeTruthy()
    for (const id of ['flight', 'e_seat', 'e_takeoff']) {
      const req = scenario.pool.requests.find((r) => r.beat.ask?.grants === id)
      expect(req, id).toBeTruthy()
      expect(pass[0]).toContain(req.beat.ask.accept[0])
    }
  })
})

// The photos are the last thing holding the holiday up. A travel blog carries
// the same pictures under somebody else's name, and reading it to the end
// takes them: the files go, but their names stay behind, broken, so the player
// knows they were there.
describe('the blog that takes the photos', () => {
  const blog = scenario.blogs.find((b) => b.id === scenario.dream?.blog)
  const gallery = scenario.fs.휴대폰.find((f) => f.name === '갤러리')
  const taken = () => scenario.dream.photos

  it('names the blog and the photos it claims, in the scenario', () => {
    expect(blog, 'scenario.dream.blog must name a real blog').toBeTruthy()
    expect(taken().length).toBeGreaterThanOrEqual(10)
    for (const id of taken()) {
      expect(gallery.children.some((p) => p.id === id), id).toBe(true)
    }
  })

  it('leaves the puzzles alone — nothing it takes is any question\'s answer', () => {
    const asked = JSON.stringify({
      pool: scenario.pool, days: scenario.days, overtime: scenario.overtime,
      work: scenario.workMessenger, priv: scenario.privateMessenger
    })
    for (const id of taken()) expect(asked, id).not.toContain(`"${id}"`)
  })

  it('is a real post the player could search up, dated before the crash', () => {
    expect(blog.tags.join(' ')).toMatch(/제주/)
    expect(searchBlogs(scenario.blogs, '제주').map((b) => b.id)).toContain(blog.id)
    // it went up while he was still at his desk, so he could have read it
    const [, mo, d] = blog.date.match(/(\d+)\.\s*(\d+)\.$/) ?? []
    expect(+mo * 100 + +d).toBeLessThan(724)
  })

  it('says the pictures are the blogger\'s own, and shows a face that is not his', () => {
    const said = JSON.stringify(blog.body)
    expect(said).toMatch(/제가|저희|내가/)
    expect(said).toMatch(/얼굴|셀카|사진 속|접니다|제 사진/)
  })

  it('keeps the gallery whole until the post is read to the end', () => {
    const before = dreamGallery(scenario, scenario.fs, false)
    const kept = before.휴대폰.find((f) => f.name === '갤러리').children
    expect(kept.map((p) => p.id)).toEqual(gallery.children.map((p) => p.id))
    for (const p of kept) expect(p.missing).toBeFalsy()
  })

  it('breaks exactly those files once it has been, and keeps their names', () => {
    const after = dreamGallery(scenario, scenario.fs, true)
    const shown = after.휴대폰.find((f) => f.name === '갤러리').children
    // the row stays, so the player can see what is gone
    expect(shown.map((p) => p.id)).toEqual(gallery.children.map((p) => p.id))
    for (const p of shown) {
      const gone = taken().includes(p.id)
      expect(Boolean(p.missing), p.id).toBe(gone)
      if (gone) expect(p.name).toBe(gallery.children.find((x) => x.id === p.id).name)
    }
    // the cat photos are the blogger's, and they are exactly what stays
    expect(shown.filter((p) => !p.missing).map((p) => p.id)).toContain('file_cat1')
  })

  it('remembers the reading, tells the player once, and survives a save', () => {
    vi.useFakeTimers()
    try {
      useGame.setState({ dreamt: false, extraMessages: {}, toast: null })
      useGame.getState().readDream()
      useGame.getState().readDream()
      expect(useGame.getState().dreamt).toBe(true)
      vi.runAllTimers()
      const note = scenario.dream.notice
      // said once, however many times the post was scrolled past
      expect(useGame.getState().extraMessages[note.thread].map((m) => m.text)).toEqual(note.lines)
      expect(useGame.getState().toast.thread).toBe(note.thread)
      expect(PROGRESS).toContain('dreamt')
    } finally {
      vi.useRealTimers()
    }
  })
})

// The month between the crash and the death is a month he was not there for.
// Nothing in the world may show him doing something during it: no document he
// authored, no meeting he sat in, no purchase he made.
describe('the month he was not there for', () => {
  const CRASH = 724
  // the dream starts on the Monday the game does; anything dated inside the
  // week is something the player is doing right now, and belongs there
  const [, wm, wd] = scenario.days[0].date.match(/(\d+)월 (\d+)일/)
  const WEEK_OPENS = +wm * 100 + +wd
  const inComa = (mm, dd) => {
    const n = +mm * 100 + +dd
    return n >= CRASH && n < WEEK_OPENS
  }
  const DATES = /(?:2026[-.])(\d{2})[-.](\d{2})|(\d{1,2})월\s*(\d{1,2})일/g

  const files = []
  const walkFs = (entries) => entries.forEach((e) => (e.children ? walkFs(e.children) : files.push(e)))
  Object.values(scenario.fs).forEach(walkFs)

  it('has him author nothing while he is in the hospital', () => {
    const wrong = []
    for (const f of files) {
      const text = `${f.name} ${f.content ?? ''}`
      if (!text.includes(player)) continue
      for (const [, y1, y2, k1, k2] of text.matchAll(DATES)) {
        const [mm, dd] = y1 ? [y1, y2] : [k1, k2]
        if (!inComa(mm, dd)) continue
        // naming him as absent is exactly right; claiming he acted is not
        if (/휴가|미참석|불참|복귀 후|복귀하면|대행/.test(text)) continue
        wrong.push(`${f.name}: ${mm}/${dd}`)
      }
    }
    expect([...new Set(wrong)]).toEqual([])
  })

  it('lets him buy nothing during it either', () => {
    const wrong = []
    for (const f of files) {
      const text = f.content ?? ''
      // what he paid for himself: a card approval with a時 stamp on it
      if (!/승인일시|주문번호/.test(text)) continue
      for (const [, y1, y2, k1, k2] of text.matchAll(DATES)) {
        const [mm, dd] = y1 ? [y1, y2] : [k1, k2]
        if (inComa(mm, dd) && !/정기결제|자동이체|자동결제/.test(text)) wrong.push(`${f.name}: ${mm}/${dd}`)
      }
    }
    expect([...new Set(wrong)]).toEqual([])
  })

  it('keeps every hint pointing at a file that really exists', () => {
    const named = new Set(files.map((f) => f.name))
    const asks = []
    const collect = (o) => {
      if (Array.isArray(o)) o.forEach(collect)
      else if (o && typeof o === 'object') { if (o.no) asks.push(o); for (const k in o) collect(o[k]) }
    }
    collect(scenario)
    const missing = []
    for (const ask of asks) {
      for (const hit of JSON.stringify(ask.no).matchAll(/[\w가-힣_-]+\.(?:hwp|txt|pdf|xlsx|pptx|jpg|exe)/g)) {
        if (!named.has(hit[0])) missing.push(hit[0])
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })
})

// Two people know the holiday never happened: 엄마 sat by the bed, and the
// guesthouse watched the check-in time pass. Neither may speak of Jeju as a
// place he went. And the player's own voice may never claim it either —
// only other people get to believe it.
describe('who is allowed to believe in the holiday', () => {
  const WENT = /제주(도)?(에|에서|를)?\s*(찍|갔|다녀|가서)|묵으셨던|두고 가신|타셨던|탔던|앉았댔|다시 오세요|또 갈게/
  const beats = []
  const collect = (o) => {
    if (Array.isArray(o)) o.forEach(collect)
    else if (o && typeof o === 'object') {
      if (o.thread && (o.lines || o.ask)) beats.push(o)
      for (const k in o) collect(o[k])
    }
  }
  collect({ pool: scenario.pool, days: scenario.days, overtime: scenario.overtime })

  it('never lets 엄마 or the guesthouse speak of a trip he took', () => {
    const wrong = []
    for (const b of beats) {
      if (b.thread !== 'mom' && b.thread !== 'guesthouse') continue
      const said = JSON.stringify({ lines: b.lines, ask: b.ask })
      for (const hit of said.match(WENT) ?? []) wrong.push(`${b.thread}: …${hit}…`)
    }
    expect([...new Set(wrong)]).toEqual([])
  })

  it('never puts the claim in the player\'s own mouth', () => {
    const mine = []
    for (const m of [scenario.workMessenger, scenario.privateMessenger]) {
      mine.push(m.me?.sub ?? '')
      for (const t of m.sections.flatMap((sec) => sec.threads)) {
        mine.push(...(t.messages ?? []).filter((x) => x.me).map((x) => x.text))
        mine.push(...(t.quick ?? []).flat())
        mine.push(...(t.reactions ?? []).map((r) => r.choice ?? ''))
      }
    }
    mine.push(...scenario.mails.map((m) => m.body))
    const wrong = mine.filter((t) => /다녀왔|다녀옴|또 갈게|잘 쉬다 왔/.test(t ?? ''))
    expect(wrong).toEqual([])
  })
})

// The portal knows the leave ran 7/24–8/22 and that August has no attendance
// row. Everything else that mentions those dates has to agree with it, or the
// player catches the game contradicting itself before the reveal does.
describe('one holiday, one set of dates', () => {
  const hr = portal.pages
  const leave = hr['/hr/leave']?.leave?.answer ?? hr['/hr/leave']?.answer

  it('runs the leave from the crash to the day before the week opens', () => {
    expect(leave.from).toBe('2026-07-24')
    expect(leave.to).toBe('2026-08-22')
    // the approved form in his own folder says the same
    expect(JSON.stringify(scenario.fs)).toContain(`기간: ${leave.from} ~ ${leave.to}`)
  })

  it('never has the calendar tell a different story', () => {
    const cal = scenario.sites.find((s) => s.layout === 'calendar').calendar
    const [, from] = leave.from.match(/-(\d{2})-(\d{2})/) ?? []
    for (const e of cal.events) {
      // no event may claim he departed or came back on a date the leave denies
      if (/출발|복귀|귀경/.test(e.title) && e.title !== '복귀 첫 출근') {
        expect(`${cal.month}/${e.day}`, e.title).toBe(`${+from}/${e.day}`)
      }
    }
    expect(JSON.stringify(cal.events)).not.toContain('제주 휴가 출발')
  })

  it('pays no August overtime without saying where it came from', () => {
    const pay = JSON.stringify(scenario.fs).match(/지급월 : 2026년 8월[\s\S]{0,1400}?발 행 처[^"]*/)?.[0] ?? ''
    expect(pay).toBeTruthy()
    // the attendance page has no August row at all, so the slip has to explain
    const att = hr['/hr/attendance'].attendance
    expect(att.rows.some((r) => r[0] === '2026-08')).toBe(false)
    if (/연장근로수당/.test(pay)) expect(pay).toMatch(/소급|근태 실적 없음/)
  })
})

// Most players never open the obituary and never read the blog to the end.
// For them the week is an ordinary one and the holiday simply happened. The
// coma may only ever be an inference the player draws, never a fact the game
// states where anyone can see it: whatever is visible unconditionally has to
// read true in both worlds.
describe('the week where nothing happened', () => {
  const files = []
  const walkFs = (entries) => entries.forEach((e) => (e.children ? walkFs(e.children) : files.push(e)))
  Object.values(scenario.fs).forEach(walkFs)

  // what a player sees without opening the obituary or finishing the blog
  const ALWAYS = JSON.stringify({
    files, sites: scenario.sites.filter((s) => s.url !== 'portal.ar.co.kr'),
    mails: scenario.mails, news: scenario.news, pool: scenario.pool,
    days: scenario.days, chatter: scenario.chatter, work: scenario.workMessenger
  })

  it('never settles, on its own, that the holiday did not happen', () => {
    // no artefact may carry the verdict: those belong to the obituary and blog
    for (const said of ['미탑승', '체크인 기록 없음', '탑승 기록 없음', '노쇼', '취소 처리']) {
      expect(ALWAYS, said).not.toContain(said)
    }
  })

  it('keeps the phone\'s own record of the trip intact until the blog is read', () => {
    const gallery = scenario.fs.휴대폰.find((f) => f.name === '갤러리').children
    // the ten borrowed photos are there, and nothing on them says they are not his
    for (const id of scenario.dream.photos) {
      const p = gallery.find((x) => x.id === id)
      expect(p, id).toBeTruthy()
      expect(p.missing, id).toBeFalsy()
      expect(`${p.alt ?? ''}`, id).not.toMatch(/블로그|받은|저장한|출처/)
    }
    // and the memo beside them does not give the game away either
    const memo = files.find((f) => f.id === 'file_cat')
    expect(memo.content).not.toMatch(/블로그|귤빛산책|받은 거라/)
  })

  it('lets the ordinary endings stay ordinary', () => {
    for (const kind of ['plain', 'lotto', 'overwork', 'wake']) {
      const said = JSON.stringify(scenario.ending[kind])
      expect(said, kind).not.toMatch(/미탑승|가지 못했|못 갔|한 번도 가/)
    }
    // only the truth may say it, and it must
    expect(JSON.stringify(scenario.ending.true)).toMatch(/가 보지 못했습니다/)
  })
})

// Somebody with no name asks whether you know. The questions never tell the
// player anything — every answer is already somewhere they have walked past —
// and the last one has no answer at all, because by then they have worked it
// out themselves. What it hands over at the end is the obituary: a summons,
// which the player may take or refuse.
describe('the account with no name', () => {
  const summons = scenario.summons
  const thread = scenario.privateMessenger.sections
    .flatMap((sec) => sec.threads).find((t) => t.id === summons?.thread)
  const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
  // 하룻밤에 몰아 묻지 않고 며칠 저녁에 나눠 묻는다. 물음을 세는 자리는
  // 밤을 순서대로 이어 붙인 것이다.
  const nights = Object.keys(summons?.nights ?? {}).map(Number).sort((a, b) => a - b)
  const chain = nights.flatMap((d) => steps(summons.nights[d].ask))
  const said = JSON.stringify(summons)

  it('며칠 저녁에 걸쳐, 이름 없는 자리에서 온다', () => {
    expect(summons).toBeTruthy()
    expect(nights.length).toBeGreaterThan(2)
    // 마지막 밤은 답할 다음 날이 있어야 한다 — 마지막 날 밤에 물으면 못 답한다.
    expect(Math.max(...nights)).toBeLessThan(scenario.days.length)
    expect(thread).toBeTruthy()
    // no name, no face, no last-seen: it must not read as a person
    expect(thread.name).toMatch(/알 수 없|^$/)
    expect(thread.face).toBeUndefined()
    expect(thread.sub ?? '').not.toMatch(/\w+@|팀|회사/)
  })

  it('opens like spam and then knows something only he could know', () => {
    const [hook, proof] = summons.nights[nights[0]].lines
    expect(hook).toMatch(/진실/)
    // the second line quotes the cloud backup receipt verbatim
    const cloud = scenario.privateMessenger.sections
      .flatMap((sec) => sec.threads).find((t) => t.id === 'cloud')
    const backup = cloud.messages[0].text
    expect(backup).toContain('23:41')
    expect(proof).toContain('23:41')
  })

  // 첫 밤은 묻지 않고 고르게 한다. 받으면 며칠 저녁이 이어지고, 물리면 끝난다.
  it('첫 밤은 받을지 물릴지 고르게 한다', () => {
    const first = summons.nights[nights[0]]
    expect(first.choices).toHaveLength(2)
    const answers = (thread.reactions ?? []).map((r) => r.choice)
    for (const c of first.choices) expect(answers, c).toContain(c)
    // 물리는 쪽은 표를 세워 그 뒤 밤을 막는다.
    const off = (thread.reactions ?? []).find((r) => r.grants === summons.off)
    expect(off, '물릴 길이 없다').toBeTruthy()
    expect(summons.off).toBeTruthy()
    expect(summons.off).not.toBe(summons.grant)
  })

  it('asks enough to build the case, and every answer is already in the game', () => {
    expect(chain.length).toBeGreaterThanOrEqual(6)
    const world = JSON.stringify({ fs: scenario.fs, sites: scenario.sites, priv: scenario.privateMessenger })
    for (const step of chain) {
      if (!step.accept) continue
      // findable: the answer exists somewhere the player can actually open
      expect(world, JSON.stringify(step.accept)).toContain(step.accept[0])
      expect(step.no.length).toBeGreaterThanOrEqual(2)
      expect(step.placeholder).toBeTruthy()
    }
  })

  it('never states the conclusion — it only ever asks', () => {
    for (const word of ['사고', '교통사고', '중환자', '혼수', '의식불명', '죽', '숨졌', '부고', '영안']) {
      expect(said, word).not.toContain(word)
    }
  })

  it('ends on a question with no answer, then hands over the obituary', () => {
    const last = chain.at(-1)
    expect(last.accept).toBeUndefined()
    expect(last.free).toBe(true)
    expect(last.grants).toBe(summons.grant)
    // whatever is typed, the reply is the path to the notice and nothing else
    expect(last.ok.join(' ')).toContain('경조사')
    expect(last.ok.join(' ')).toMatch(/나갔습니다|나갔다/)
  })

  it('grants only the summons, never the knowledge', () => {
    expect(summons.grant).not.toBe(CLUE.obituary)
    expect(scenario.objectives.some((o) => o.grant === summons.grant)).toBe(false)
  })
})

describe('taking the summons, or refusing it', () => {
  const E = scenario.ending
  const base = { grants: {}, locks: 3, overtime: {}, days: 5, digging: {}, rumor: {} }
  const called = { [scenario.summons.grant]: true }

  it('is an ordinary week for anyone the caller never reached', () => {
    expect(endingFor(E, base)).toBe('plain')
  })

  it('wakes him when he was called and never opened it', () => {
    expect(endingFor(E, { ...base, grants: called })).toBe('wake')
  })

  it('lets opening the notice outrank the refusal — the dead do not wake', () => {
    expect(endingFor(E, { ...base, grants: { ...called, [CLUE.obituary]: true } })).toBe('true')
  })

  it('outranks the ticket: what he refused matters more than what he won', () => {
    expect(endingFor(E, { ...base, grants: { ...called, lotto: true } })).toBe('wake')
  })

  it('still loses to the eighth floor and to the rumour', () => {
    const dug = { asked: true, found: true, entered: true }
    expect(endingFor(E, { ...base, grants: called, digging: dug })).toBe('missing')
    expect(endingFor(E, { ...base, grants: called, rumor: { heard: true, traced: true, acted: 'told' } }))
      .toBe('rumor_told')
  })

  it('tells a waking that is a refusal, not a rest', () => {
    const said = JSON.stringify(E.wake.scenes)
    expect(said).toContain('꿈')
    expect(said).toContain('회사 얘기')
    // the conversation is still open on the phone, unread
    expect(said).toMatch(/읽지 않|안 읽|나간 대화방|대화방/)
    expect(said).not.toMatch(/숨졌|부고|별세|노잣돈/)
  })
})

// The blog does not say the photographs are not his. It shows them: the same
// sea, the same wall, the same straw hat, worn by a face that is not his. Every
// picture it borrows has to resolve to a real file, and every scene it shows
// has to be one the gallery also holds — otherwise the pairing the whole
// reveal rests on is not there to be noticed.
describe('the pictures the blog actually shows', () => {
  const blog = scenario.blogs.find((b) => b.id === scenario.dream.blog)
  const shots = blog.body.filter((p) => p?.shot).map((p) => p.shot)

  it('shows enough of them to be a month of somebody\'s life', () => {
    expect(shots.length).toBeGreaterThanOrEqual(6)
    expect(new Set(shots).size).toBe(shots.length)
  })

  it('resolves every one to a bundled image', () => {
    for (const name of shots) expect(shotOf(name), name).toBeTruthy()
  })

  it('pairs each borrowed scene with the one in his gallery', () => {
    const gallery = scenario.fs.휴대폰.find((f) => f.name === '갤러리').children
    const borrowed = shots.filter((n) => /^jeju/.test(n))
    expect(borrowed.length).toBeGreaterThanOrEqual(6)
    for (const name of borrowed) {
      const twin = gallery.find((p) => p.id === `file_${name}`)
      expect(twin, `gallery has no twin for ${name}`).toBeTruthy()
      // and it is one of the ten the dream gives back when the post is read
      expect(scenario.dream.photos, name).toContain(twin.id)
    }
  })

  it('still never claims in words that they are not his', () => {
    const said = JSON.stringify(blog.body.filter((p) => typeof p === 'string'))
    expect(said).not.toMatch(/김한별|도용|훔쳐|같은 사진/)
  })
})

// Everything the game draws is webp; photos.js reads nothing else. A picture
// that stops resolving does not fail a render — it silently falls back to an
// icon or an empty frame — so the only way to know is to ask for all of them.
describe('every picture the game asks for', () => {
  it('resolves, whatever folder it lives in', () => {
    const unresolved = []
    for (const f of allFiles(scenario.fs)) {
      if (f.image && !fileImage(f.image)) unresolved.push(`file ${f.name} → ${f.image}`)
    }
    for (const b of scenario.blogs) {
      for (const p of b.body) if (p?.shot && !shotOf(p.shot)) unresolved.push(`blog ${b.id} → ${p.shot}`)
    }
    expect(unresolved).toEqual([])
  })

  it('still gives most headlines a thumbnail, and the wallpaper a picture', () => {
    expect(scenario.news.filter((n) => newsShot(n.id)).length).toBeGreaterThan(15)
    expect(wallpaper).toBeTruthy()
  })
})

// 본인 부고 끝에 놓인 표식이 화면에 들어오면 그것을 본 것으로 친다. 글이 한
// 화면에 다 들어가면 열자마자 발동해, 내려가며 알게 되는 대목이 통째로
// 사라진다 — 큰 모니터에서 창을 키우면 그렇게 된다. 위에 몇 건이 쌓여 있어야
// 한 번은 밀어 내리게 된다.
describe('본인 부고는 한 화면에 담기지 않는다', () => {
  const board = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
    .pages['/hr/bereavement'].board
  const post = board.posts.find((p) => p.obituary)

  it('부고가 실린 글이 하나 있다', () => {
    expect(post).toBeTruthy()
    expect(board.posts.filter((p) => p.obituary)).toHaveLength(1)
  })

  it('본인 것은 맨 아래에 있다', () => {
    const at = post.sections.findIndex((s) => s.mine)
    expect(at).toBe(post.sections.length - 1)
  })

  it('그 위에 넉넉히 쌓여 있다', () => {
    const above = post.sections.slice(0, -1)
    expect(above.length).toBeGreaterThanOrEqual(4)
    // 줄 수로도 재 둔다. 절만 늘리고 내용이 비면 여전히 한 화면에 들어간다.
    const rows = above.reduce((n, s) => n + s.rows.length, 0)
    expect(rows).toBeGreaterThanOrEqual(14)
  })

  it('본인 것이 아닌 절에는 표식이 없다', () => {
    expect(post.sections.filter((s) => s.mine)).toHaveLength(1)
  })
})
