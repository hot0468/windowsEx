import { create } from 'zustand'
import scenario from '../scenarios/workday.json'
import { checkGoal, checkOutbound } from './goal.js'
import { play } from '../shell/sound.js'

const SAVE_KEY = 'windowsEx.save'        // the player's explicit checkpoint
const SESSION_KEY = 'windowsEx.session'  // autosaved, so a refresh continues where you were
const PENDING_KEY = 'windowsEx.pendingLoad'

// The fields worth carrying across sessions: progress, not view state.
const PROGRESS = ['windows', 'nextZ', 'msgCount', 'readMails', 'seenThreads', 'extraMails',
  'starred', 'pinned', 'restored', 'sheetEdits', 'unlocked', 'grants', 'extraMessages', 'pendingAsks', 'bookings',
  'day', 'misses', 'failed', 'scratch', 'ended', 'locks', 'overtime', 'slips', 'edits', 'drawn', 'vpn']

const snapshot = (s) => {
  const out = { at: Date.now() }
  for (const k of PROGRESS) out[k] = s[k]
  return out
}

function read(key) {
  try {
    const save = JSON.parse(localStorage.getItem(key))
    return save && Array.isArray(save.windows) ? save : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function savedAt() {
  return read(SAVE_KEY)?.at ?? null
}

// Normally a fresh page picks up the autosave. Loading the checkpoint reloads the
// page (see loadGame) so every app remounts clean, and this flag — set just before
// that reload — tells the new session to start from the checkpoint instead.
function startingPoint() {
  try {
    if (sessionStorage.getItem(PENDING_KEY) === '1') {
      sessionStorage.removeItem(PENDING_KEY)
      return read(SAVE_KEY)
    }
  } catch {
    // fall through to the autosave
  }
  return read(SESSION_KEY)
}

const restored = startingPoint()

let winId = Math.max(0, ...(restored?.windows ?? []).map((w) => w.id))
let toastId = 0

export const useGame = create((set, get) => ({
  scenario,
  booted: false,
  toast: null,
  crashed: false,
  // Which program took the machine down, so the reboot knows who to blame.
  crashSource: null,
  locked: false,
  windows: restored?.windows ?? [],
  nextZ: restored?.nextZ ?? 10,
  msgCount: restored?.msgCount ?? 0,
  readMails: restored?.readMails ?? {},
  starred: restored?.starred ?? {},
  pinned: restored?.pinned ?? [],
  restored: restored?.restored ?? {},
  sheetEdits: restored?.sheetEdits ?? {},
  // Which conversation each messenger is showing, and how much of it has been read.
  // Both live here so a toast can open a thread in an already-running window.
  openThread: {},
  seenThreads: restored?.seenThreads ?? {},
  typing: {},
  extraMails: restored?.extraMails ?? [],
  extraMessages: restored?.extraMessages ?? {},
  pendingAsks: restored?.pendingAsks ?? {},
  unlocked: restored?.unlocked ?? {},
  grants: restored?.grants ?? {},
  bookings: restored?.bookings ?? {},
  day: restored?.day ?? 1,
  misses: restored?.misses ?? 0,
  failed: restored?.failed ?? false,
  ended: restored?.ended ?? false,
  locks: restored?.locks ?? 0,
  // Which days the player chose to stay late on, and whether tonight's offer
  // has been answered yet.
  overtime: restored?.overtime ?? {},
  // Every wrong answer of the week, typed or mailed. Unlike misses this is
  // never reset: accuracy is judged over the whole week.
  slips: restored?.slips ?? 0,
  // Text files the player has typed into, kept by id on top of the scenario.
  edits: restored?.edits ?? {},
  // Which requests each day drew from the pool. Day one never draws.
  drawn: restored?.drawn ?? {},
  scratch: restored?.scratch ?? '',
  // The VPN tunnel. Kept across a save, dropped by a restart the way a real one is.
  vpn: restored?.vpn ?? false,

  setBooted: () => {
    play('boot')
    set({ booted: true })
  },
  // The id lets the view remount each toast so its entrance animation replays,
  // even when two toasts carry identical text.
  showToast: (toast) => {
    play('notify')
    set({ toast: { ...toast, id: ++toastId } })
  },
  clearToast: () => set({ toast: null }),
  deliverMessage: () =>
    set((s) => ({ msgCount: Math.min(s.msgCount + 1, s.scenario.messenger.length) })),

  openWindow: (app, props = {}) =>
    set((s) => {
      const key = app + JSON.stringify(props)
      const existing = s.windows.find((w) => w.key === key)
      if (existing) {
        return {
          windows: s.windows.map((w) =>
            w.id === existing.id ? { ...w, minimized: false, z: s.nextZ } : w),
          nextZ: s.nextZ + 1
        }
      }
      const n = s.windows.length
      return {
        windows: [...s.windows, {
          id: ++winId, key, app, props,
          x: 120 + (n % 5) * 36, y: 60 + (n % 5) * 32,
          z: s.nextZ, minimized: false, maximized: false
        }],
        nextZ: s.nextZ + 1
      }
    }),
  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  focusWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.nextZ, minimized: false } : w)),
      nextZ: s.nextZ + 1
    })),
  minimizeWindow: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) })),
  toggleMaximize: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)) })),
  moveWindow: (id, x, y) => {
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 1920) - 60
    const maxY = (typeof window !== 'undefined' ? window.innerHeight : 1080) - 90
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, x: Math.max(-500, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) }
          : w)
    }))
  },

  saveGame: () => {
    const s = get()
    s.showToast(write(SAVE_KEY, snapshot(s))
      ? { from: '게임 저장', text: '현재 진행 상황을 저장했습니다.' }
      : { from: '게임 저장', text: '저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요.' })
  },
  loadGame: () => {
    if (!read(SAVE_KEY)) return get().showToast({ from: '불러오기', text: '저장된 게임이 없습니다.' })
    try {
      sessionStorage.setItem(PENDING_KEY, '1')
    } catch {
      return get().showToast({ from: '불러오기', text: '불러오지 못했습니다. 브라우저 저장공간을 확인해 주세요.' })
    }
    location.reload()
  },
  newGame: () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // nothing to clear
    }
    location.reload()
  },

  resizeWindow: (id, rect) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...rect } : w)) })),

  // Running a malicious installer takes the machine down. Progress is kept —
  // what is lost is every open window and whatever was on screen in them.
  crash: (source = null) => {
    play('error')
    set({ crashed: true, crashSource: source, toast: null })
  },
  restart: () => set({ crashed: false, crashSource: null, booted: false, windows: [], toast: null, locked: false, vpn: false }),
  // Windows keep running behind the lock screen; only the screen is covered.
  // Every lock is counted: a week with none means the player never once left.
  lock: () => set((s) => ({ locked: true, toast: null, locks: s.locks + 1 })),
  unlock: () => {
    play('ok')
    set({ locked: false })
  },
  reboot: () => {
    const s = get()
    const program = s.scenario.programs[s.crashSource]
    const after = program?.aftermath ?? s.scenario.malware.aftermath
    if (!s.grants.infected) {
      after.lines.forEach((text) => s.pushMessage(after.thread, { from: after.from, text }))
      s.grant('infected')
    }
    s.restart()
    setTimeout(() => get().showToast({
      from: after.from, text: after.lines[0],
      app: 'messenger', source: after.source, thread: after.thread
    }), 3200)
  },

  // Staying late brings three more requests tonight; going home closes the
  // offer for good. Either way the day can only be finished once.
  workLate: () => {
    const s = get()
    const extra = s.scenario.overtime.days[s.day]
    if (!extra || s.overtime[s.day]) return
    set((st) => ({ overtime: { ...st.overtime, [st.day]: true } }))
    const beats = [extra.opening, ...(extra.asks ?? [])].filter(Boolean)
    beats.forEach((beat, i) => setTimeout(() => {
      beat.lines.forEach((text) => get().pushMessage(beat.thread, { from: beat.from, text }))
      if (beat.ask) get().queueAsk(beat.thread, beat.ask)
      get().showToast({
        from: beat.from, text: beat.lines[0],
        app: 'messenger', source: beat.source, thread: beat.thread
      })
    }, 1200 + i * 3600))
  },
  goHome: () => set((s) => (s.overtime[s.day] !== undefined ? s : { overtime: { ...s.overtime, [s.day]: false } })),
  slip: () => set((s) => ({ slips: s.slips + 1 })),
  // Saving hosts can put a name on the network; the objective is the site
  // opening, so nothing else has to happen here.
  editFile: (fileId, text) => set((s) => ({ edits: { ...s.edits, [fileId]: text } })),
  // The layoff comes as a message, and the answer to it is the ending.
  layOff: (choice) => set({ ended: 'layoff:' + choice, toast: null, locked: false }),

  // Clocking off restarts the machine and brings tomorrow's work with it.
  startDay: (n) => {
    const s = get()
    const day = s.scenario.days[n - 1]
    if (!day) return
    const drawn = s.drawn[n] ?? drawFor(s.scenario, n, s.drawn)
    set({ day: n, misses: 0, drawn: { ...s.drawn, [n]: drawn } })
    if (day.mails) set((st) => ({ extraMails: [...st.extraMails, ...day.mails] }))
    const beats = [day.opening, ...(day.asks ?? []), ...beatsFor(s.scenario, drawn)].filter(Boolean)
    beats.forEach((beat, i) => setTimeout(() => {
      beat.lines.forEach((text) => get().pushMessage(beat.thread, { from: beat.from, text }))
      if (beat.ask) get().queueAsk(beat.thread, beat.ask)
      get().showToast({
        from: beat.from, text: beat.lines[0],
        app: 'messenger', source: beat.source, thread: beat.thread
      })
    }, 3600 + i * 4200))
  },
  finishDay: () => {
    const s = get()
    const next = s.day + 1
    if (!s.scenario.days[next - 1]) return s.endGame(endingFor(s.scenario.ending, { ...s, days: s.scenario.days.length }))
    set((st) => ({ overtime: { ...st.overtime } }))
    s.restart()
    setTimeout(() => get().startDay(next), 100)
  },
  // The last clock-off brings either a weekend or the truth, depending on
  // what the player has read along the way.
  endGame: (kind) => set({ ended: kind, toast: null, locked: false }),
  // Opening the obituary is the moment the week stops making sense. It is
  // remembered without a chime, and the boss answers a beat later.
  witness: () => {
    const s = get()
    if (s.grants[CLUE.mail]) return
    set({ grants: { ...s.grants, [CLUE.mail]: true } })
    const ev = s.scenario.ending.event
    setTimeout(() => {
      ev.lines.forEach((text) => get().pushMessage(ev.thread, { from: ev.from, text }))
      get().showToast({ from: ev.from, text: ev.lines[ev.lines.length - 1], app: 'messenger', source: ev.source, thread: ev.thread })
    }, ev.delay)
  },

  markMailRead: (id, read = true) =>
    set((s) => ({ readMails: { ...s.readMails, [id]: read } })),
  toggleStar: (id) => set((s) => ({ starred: { ...s.starred, [id]: !s.starred[id] } })),
  pinFile: (id) => set((s) => (s.pinned.includes(id) ? s : { pinned: [...s.pinned, id] })),
  unpinFile: (id) => set((s) => ({ pinned: s.pinned.filter((x) => x !== id) })),
  restoreFile: (id) => set((s) => ({ restored: { ...s.restored, [id]: true } })),
  // Typing into a cell is the whole interaction; an objective that names that
  // cell is met the moment the value fits.
  editCell: (fileId, sheet, r, c, value) => {
    set((s) => ({ sheetEdits: { ...s.sheetEdits, [cellKey(fileId, sheet, r, c)]: value } }))
    const { scenario, sheetEdits, grants, grant } = get()
    scenario.objectives
      .filter((o) => o.cell && !grants[o.grant] && cellMatches(o, sheetEdits))
      .forEach((o) => grant(o.grant))
  },
  setVpn: (on) => set({ vpn: on }),
  unlockSite: (url) => set((s) => ({ unlocked: { ...s.unlocked, [url]: true } })),
  grant: (key) => {
    play('ok')
    set((s) => ({ grants: { ...s.grants, [key]: true } }))
    // some mail only shows up once the player has got somewhere
    const mw = get().scenario.malware
    if (mw.after !== key || get().extraMails.some((m) => m.id === mw.mail.id)) return
    setTimeout(() => {
      set((s) => ({ extraMails: [...s.extraMails, mw.mail] }))
      get().showToast({ from: mw.mail.from, text: mw.notice, app: 'mail' })
    }, mw.delay)
  },
  book: (place, details) =>
    set((s) => ({ bookings: { ...s.bookings, [place]: details } })),
  setAsk: (threadId, ask) =>
    set((s) => ({ pendingAsks: { ...s.pendingAsks, [threadId]: ask } })),
  // A day can raise two questions in the same conversation. The second waits
  // behind the first instead of replacing it, so neither goes unanswered.
  queueAsk: (threadId, ask) =>
    set((s) => {
      const waiting = s.pendingAsks[threadId]
      return { pendingAsks: { ...s.pendingAsks, [threadId]: waiting ? appendAsk(waiting, ask) : ask } }
    }),
  pushMessage: (threadId, msg) =>
    set((s) => ({
      extraMessages: { ...s.extraMessages, [threadId]: [...(s.extraMessages[threadId] ?? []), msg] }
    })),
  setScratch: (scratch) => set({ scratch }),
  // A government site verifies you by phone: the code lands in 톡톡, the way
  // a real SMS would, and the toast points at that conversation.
  sendCode: (gov) => {
    const v = gov.verify
    const text = smsFor(v)
    get().pushMessage(v.thread, { from: v.from, text })
    get().showToast({ from: v.from, text: text.split('\n')[0], app: 'chat', source: v.source, thread: v.thread })
  },
  setOpenThread: (source, id) =>
    set((s) => ({ openThread: { ...s.openThread, [source]: id } })),
  setTyping: (id, on) =>
    set((s) => (!!s.typing[id] === on ? s : { typing: { ...s.typing, [id]: on } })),
  markThreadSeen: (id, count) =>
    set((s) => (s.seenThreads[id] === count ? s : { seenThreads: { ...s.seenThreads, [id]: count } })),

  sendReply: ({ attachmentId, body }) => {
    const s = get()
    const goal = goalFor(s.scenario, s.day)
    const original = [...s.scenario.mails, ...s.extraMails].find((m) => m.id === goal.replyToMail)
    const verdict = checkGoal(goal, { attachmentId, body })
    setTimeout(() => {
      set((st) => ({
        extraMails: [...st.extraMails, {
          id: 'reply_' + Date.now(),
          from: original.from,
          subject: 'RE: ' + original.subject,
          date: '방금',
          body: verdict.reply
        }]
      }))
      get().showToast({ from: original.from, text: `새 메일이 도착했습니다: RE: ${original.subject}`, app: 'mail' })
      if (verdict.ok) setTimeout(() => get().grant(goal.grants), 2200)
    }, 1800)

    if (verdict.ok) return verdict.ok

    // A bad reply reaches the client before it reaches you, so the complaint
    // comes back through the boss a moment after their reply lands.
    const c = goal.complain
    const misses = s.misses + 1
    s.slip()
    const { spent, lines } = complaintFor(goal, verdict.reason, misses)
    set({ misses })

    get().nag(lines, () => spent && setTimeout(() => set({ failed: true }), 2600))
    return verdict.ok
  },

  // The boss types a moment after the client's reply lands, one line at a time.
  nag: (lines, after) => {
    const c = get().scenario.goal.complain
    setTimeout(() => {
      get().setTyping(c.thread, true)
      lines.forEach((text, i) => setTimeout(() => {
        get().pushMessage(c.thread, { from: c.from, text })
        if (i === lines.length - 1) {
          get().setTyping(c.thread, false)
          get().showToast({ from: c.from, text, app: 'messenger', source: c.source, thread: c.thread })
          after?.()
        }
      }, i * 1600))
    }, 3600)
  },

  // A mail the player starts. Only the day's brief knows which address is real;
  // everything else bounces. `{to}` and `{subject}` in the reply are filled in.
  sendMail: ({ to, subject, body }) => {
    const s = get()
    const fetch = s.scenario.days[s.day - 1]?.fetch
    const verdict = checkOutbound(fetch, { to, body })
    const fill = (t = '') => t.replace('{to}', to).replace('{subject}', subject)
    const reply = verdict.reply ?? s.scenario.goal.bounce
    setTimeout(() => {
      const mail = { ...reply, id: 'in_' + Date.now(), date: '방금', subject: fill(reply.subject), body: fill(reply.body) }
      set((st) => ({ extraMails: [...st.extraMails, mail] }))
      get().showToast({ from: mail.from, text: `새 메일이 도착했습니다: ${mail.subject}`, app: 'mail' })
      if (verdict.ok) setTimeout(() => get().grant(fetch.grants), 2200)
      if (verdict.reason === 'rude') get().nag(fetch.rude)
    }, 1800)
    return verdict.ok
  }
}))

// Autosave on a trailing debounce: dragging a window fires a state change per
// pointer move, and localStorage writes are synchronous.
let autosaveTimer
useGame.subscribe(() => {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => write(SESSION_KEY, snapshot(useGame.getState())), 400)
})

// A staging folder on the desktop holding copies of files the player pinned, so
// attaching them later is one click instead of a dig through the tree.
export const WORK_FOLDER = '작업 폴더'

export function fsWithPinned(fs, pinned) {
  const copies = pinned.map((id) => findFile(fs, id)).filter(Boolean)
  return { ...fs, 바탕화면: [...fs['바탕화면'], { name: WORK_FOLDER, children: copies }] }
}

// The bin is a view: a file flagged `deleted` in the scenario sits in 휴지통
// until restored, then reappears where the data always kept it.
export function fsView(fs, { pinned = [], restored = {} } = {}) {
  const binned = []
  const strip = (entries) => entries.flatMap((e) => {
    if (e.children) return [{ ...e, children: strip(e.children) }]
    if (e.deleted && !restored[e.id]) { binned.push(e); return [] }
    // a mail attachment is nowhere until it is saved from the mail
    if (e.attached && !restored[e.id]) return []
    return [e]
  })
  const out = Object.fromEntries(Object.entries(fs).map(([root, entries]) => [root, strip(entries)]))
  out['휴지통'] = [...(out['휴지통'] ?? []), ...binned]
  return fsWithPinned(out, pinned)
}

// An entry with `children` is a folder; anything else is a file.
export function allFiles(fs) {
  const out = []
  const walk = (entries) =>
    entries.forEach((e) => (e.children ? walk(e.children) : out.push(e)))
  Object.values(fs).forEach(walk)
  return out
}

// Dialogue fields hold either one set of lines or several used in order, so the
// data can stay flat where nothing changes and escalate where it should.
const FALLBACK_QUICK = ['네, 알겠습니다', '감사합니다']

export const lineSets = (lines) => (Array.isArray(lines?.[0]) ? lines : [lines])

export const quickSets = (thread) => lineSets(thread.quick ?? FALLBACK_QUICK)

// Loose match: spacing and case are forgiven. An entry may be an array, in
// which case every part of it has to appear — a pasted receipt has to carry both
// the place and the time, not just one of them.
const loose = (v) => v.replace(/\s/g, '').toLowerCase()

export function answerFits(ask, text) {
  return ask.accept.some((entry) =>
    (Array.isArray(entry) ? entry : [entry]).every((part) => loose(text).includes(loose(part))))
}

// Which ending the week earned: the truth if the obituary was opened, the
// overwork variant if the screen never once locked, an ordinary weekend otherwise.
// Once the obituary has been opened the ticket is worthless: the dead cannot
// collect. Until then, a confirmed win is the one way the week ends well.
// Working late every single night earns the overwork ending on its own.
export const endingFor = (ending, { grants, locks, overtime = {}, days = 5 }) =>
  awareOf(ending, grants) ? 'true'
    : grants.lotto ? 'lotto'
      : workedEveryNight(overtime, days) || locks === 0 ? 'overwork' : 'plain'

// Five nights out of five, no exceptions.
export const workedEveryNight = (overtime, days) =>
  Array.from({ length: days }, (_, i) => overtime[i + 1]).every(Boolean)

// Too many wrong answers over the week and the company stops asking. Counted
// against every request the week actually raised, overtime included.
export function laidOff(layoff, { slips = 0, overtime = {}, drawn = {} }, scenario) {
  const asked = scenario.days.reduce((n, d, i) =>
    n + requestsOf(scenario, i + 1, overtime, drawn).length, 0)
  return asked > 0 && slips >= asked * layoff.ratio
}

// Tonight's extra work, if the day has any and the player has not answered yet.
export const overtimeOffer = (scenario, day, overtime) =>
  overtime[day] === undefined && scenario.overtime?.days?.[day] ? scenario.overtime : null

// The ticket's serial number, typed off the slip: hyphens and spaces forgiven.
export const serialFits = (lotto, text) => loose(text) === loose(lotto.serial).replace(/-/g, '') || loose(text) === loose(lotto.serial)

// The front page carries the freshest headlines, newest first.
export const latestNews = (news, n = 6) =>
  [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)

// The player knows once they have opened their own obituary.
export const CLUE = { mail: 'clue_mail' }
export const awareOf = (ending, grants) => Object.keys(ending.clues).every((k) => grants[CLUE[k]])

// The verification text, with the code filled in where the template asks for it.
export const smsFor = (verify) => verify.sms.replace('{code}', verify.code)

// Six digits typed off a phone screen: spacing is forgiven, nothing else is.
export const codeFits = (verify, text) => loose(text) === loose(verify.code) && text.trim() !== ''

// A question may want a file instead of typed text; any of the ones it names will do.
export const fileFits = (ask, fileId) => Boolean(ask?.files?.includes(fileId))

// Hangs a question off the end of one still waiting, so a thread asked twice in
// a day keeps both — answering the first hands straight over to the second.
export const appendAsk = (ask, next) =>
  ask.then ? { ...ask, then: appendAsk(ask.then, next) } : { ...ask, then: next }

// Wrong answers get a firmer nudge each time, stopping at the clearest one.
export const hintAfter = (ask, wrongs) => {
  const sets = lineSets(ask.no)
  return sets[Math.min(wrongs, sets.length - 1)]
}

// Edited cells are kept flat, one key per cell, on top of the read-only workbook.
export const cellKey = (fileId, sheet, r, c) => `${fileId}:${sheet}:${r}:${c}`

export const cellMatches = (objective, sheetEdits) => {
  const { file, sheet, row, col, value } = objective.cell
  return (sheetEdits[cellKey(file, sheet, row, col)] ?? '').trim() === value.trim()
}

// The jammed printer wants the wiki's steps in order; a wrong press jams it again.
export const printerStep = (steps, done, id) => (steps[done] === id ? done + 1 : 0)

// The mail brief in force on a given day: shared rules (attempts, the boss's
// reaction, the failure screen) plus that day's client and figures.
export const goalFor = (scenario, day) =>
  ({ ...scenario.goal, ...(scenario.days[day - 1]?.goal ?? {}) })

// Today's work: the day names which objectives it wants, the objective says
// which state counts as done.
export function requestsOf(scenario, day, overtime = {}, drawn = {}) {
  const today = scenario.days[day - 1]
  if (!today) return []
  const extra = overtime[day] ? scenario.overtime?.days?.[day]?.requests ?? [] : []
  return [...today.requests, ...(drawn[day] ?? []), ...extra]
    .map((id) => scenario.objectives.find((o) => o.id === id)).filter(Boolean)
}

// Days after the first keep a fixed core and draw the rest, so no two weeks
// bring the same work. A request that reads a document from a later day waits
// for that day; nothing is ever drawn twice.
export function drawFor(scenario, day, drawn = {}, pick = Math.random) {
  const pool = scenario.pool
  if (!pool || day === 1) return []
  const taken = new Set(Object.values(drawn).flat())
  const want = pool.sizes[day] - (pool.fixed[day] ?? []).length
  const ready = pool.requests
    .filter((r) => !taken.has(r.id) && (pool.after[r.id] ?? 0) <= day)
    .map((r) => r.id)
  return shuffle(ready, pick).slice(0, Math.max(0, want))
}

// Fisher–Yates, with the source of randomness passed in so a test can pin it.
export function shuffle(list, pick = Math.random) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The messenger beats behind a drawn set, in the order they were drawn.
export const beatsFor = (scenario, ids = []) =>
  ids.map((id) => scenario.pool?.requests.find((r) => r.id === id)?.beat).filter(Boolean)

export const dayDone = (scenario, day, state) =>
  requestsOf(scenario, day, state.overtime ?? {}, state.drawn ?? {})
    .every((o) => objectiveDone(o, state))

// An objective is met when the state it names has been reached — the scenario
// says which, so adding a goal is a data change.
export function objectiveDone(objective, state) {
  if (objective.grant) return Boolean(state.grants[objective.grant])
  if (objective.site) return Boolean(state.unlocked[objective.site])
  return false
}

const ROOT_ICONS = { 휴지통: 'trash', 휴대폰: 'phone' }
export const rootIcon = (name) => ROOT_ICONS[name] ?? 'folder'

// Which app opens a file, decided by its name the way an OS does it.
export const fileOpener = (file) =>
  file.image ? { app: 'viewer', icon: 'image' }
    : file.name.endsWith('.exe') ? { app: 'installer', icon: 'cmd' }
      : file.name.endsWith('.xlsx') ? { app: 'sheet', icon: 'xls' }
      : file.name.endsWith('.pptx') ? { app: 'slides', icon: 'ppt' }
        : file.name.endsWith('.hwp') ? { app: 'hwp', icon: 'hwp' }
          : file.name.endsWith('.pdf') ? { app: 'pdf', icon: 'pdf' }
            : file.name.endsWith('.dcx') ? { app: 'dcx', icon: 'doc' }
              : { app: 'notepad', icon: 'doc' }

export function findFile(fs, fileId) {
  return allFiles(fs).find((f) => f.id === fileId) ?? null
}

// What the boss says after a bad reply, and whether that was the last straw.
// `misses` is the count including the one that just happened.
export function complaintFor(goal, reason, misses) {
  const c = goal.complain
  const limit = goal.attempts ?? 3
  if (misses >= limit) return { spent: true, lines: c.final }
  const warn = misses === limit - 1 ? [c.lastChance] : []
  return { spent: false, lines: [...c[reason], ...warn] }
}

// What a file says now: the player's saved text if they have edited it.
export const contentOf = (file, edits = {}) => (file ? edits[file.id] ?? file.content : '')

// A hosts line is an address, whitespace, a name — comments after # ignored.
export function hostNames(text = '') {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim()
    const [ip, ...names] = line.split(/\s+/).filter(Boolean)
    if (!ip || !names.length) continue
    for (const name of names) out[name.toLowerCase()] = ip
  }
  return out
}

// A .local name resolves only once it is in the player's hosts file, at the
// address the request named.
export function hostResolves(scenario, edits, url) {
  const file = findFile(scenario.fs, scenario.hosts.file)
  const names = hostNames(contentOf(file, edits))
  const wanted = scenario.hosts.required[url]
  return wanted ? names[url] === wanted : Boolean(names[url])
}

// The anonymous room answers by keyword. Whoever replies is picked by how
// many times the player has already asked, so a second ask reads as a second
// voice rather than the same line twice.
export function roomReply(ask, question, asked = 0) {
  const q = loose(question)
  if (!q) return null
  // The longest keyword wins, so '빈자리' reaches the rumour topic rather than
  // the screen-lock one that merely says '자리'.
  let hit = null, best = 0
  for (const topic of ask.topics) {
    for (const k of topic.keys) {
      const key = loose(k)
      if (q.includes(key) && key.length > best) { hit = topic; best = key.length }
    }
  }
  const pool = hit ? hit.replies : ask.fallback
  return pool[asked % pool.length]
}

// Installing something can leave an icon on the desktop. Which ones are there
// is a question about grants, so the shell never has to keep its own list.
export const installedShortcuts = (programs = {}, grants = {}) =>
  Object.values(programs).filter((p) => p.shortcut && grants[p.grant]).map((p) => p.shortcut)

// Exactly one state per visited site: no tunnel means no name, no approval
// means no login form, no login means no content. Returning a single value
// keeps them mutually exclusive.
export function siteView(site, { grants, unlocked, resolves = true, vpn = false }) {
  if (!site) return 'error'
  if (site.requiresIp && !grants.ip) return 'blocked'
  if (site.requiresVpn && !vpn) return 'vpn'
  if (site.requiresHost && !resolves) return 'error'
  if (site.login && !unlocked[site.url]) return 'login'
  return 'ready'
}

// Local listings for the portal's search: matched on name and tags so a broad
// term like 맥주 brings back every candidate, not just the one that matters.
export const searchPlaces = (places, q) => searchIn(places, q, ['name', 'category', 'tags'])

// One matcher for every kind of portal result. Each caller names the fields it
// wants searched, which is also how a locked page keeps its contents private.
export function searchIn(items = [], q, fields) {
  const term = q.trim().toLowerCase()
  if (!term) return []
  return items.filter((item) =>
    fields
      .map((f) => (Array.isArray(item[f]) ? item[f].join(' ') : item[f] ?? ''))
      .join(' ')
      .toLowerCase()
      .includes(term))
}

export const searchBlogs = (blogs, q) => searchIn(blogs, q, ['title', 'excerpt', 'tags'])
export const searchNews = (news, q) => searchIn(news, q, ['title', 'summary', 'tags', 'press'])
export const searchQna = (qna, q) => searchIn(qna, q, ['q', 'a', 'tags'])
export const searchCompanies = (list, q) =>
  searchIn(list, q, ['name', 'en', 'field', 'tags'])
export const searchTerms = (list, q) =>
  searchIn(list, q, ['word', 'reading', 'body', 'tags'])

// mail dates read like "8월 21일 (금) 16:42". a reply the player just sent is
// dated "방금" — that one belongs at the very top, so it sorts as the latest.
const JUST_NOW = 1e9
export function mailTime(date = '') {
  const day = date.match(/(\d+)월\s*(\d+)일/)
  if (!day) return JUST_NOW
  const [, h = 0, m = 0] = date.match(/(\d+):(\d+)/) ?? []
  return ((+day[1] * 31 + +day[2]) * 24 + +h) * 60 + +m
}

// newest first; same timestamp falls back to the order they arrived in
export const sortMails = (mails) => mails
  .map((m, i) => [m, i])
  .sort(([a, i], [b, j]) => mailTime(b.date) - mailTime(a.date) || j - i)
  .map(([m]) => m)

// Titles and addresses only. Matching page contents would surface the wiki's
// price table in results and let a player skip its password gate entirely.
export const searchSites = (sites, q) => searchIn(sites, q, ['title', 'url'])

// path is ['문서', '업무자료', '2026'] — the first name picks the root drive.
export function entriesAt(fs, path) {
  return path.slice(1).reduce(
    (entries, name) => entries.find((e) => e.name === name)?.children ?? [],
    fs[path[0]] ?? []
  )
}

// Smallest a window may be dragged down to, in px.
export const MIN_SIZE = { w: 360, h: 220 }

// New rect for a resize drag. `dir` names the edges being pulled ('se', 'n', …).
// Dragging a left or top edge moves the window's corner, but only by as much as
// the window actually shrank — so it stops dead once it hits the minimum.
export function resizeRect(start, dir, dx, dy, min = MIN_SIZE) {
  const rect = { x: start.x, y: start.y, w: start.w, h: start.h }
  if (dir.includes('e')) rect.w = Math.max(min.w, start.w + dx)
  if (dir.includes('s')) rect.h = Math.max(min.h, start.h + dy)
  if (dir.includes('w')) {
    rect.w = Math.max(min.w, start.w - dx)
    rect.x = start.x + (start.w - rect.w)
  }
  if (dir.includes('n')) {
    rect.h = Math.max(min.h, start.h - dy)
    rect.y = start.y + (start.h - rect.h)
  }
  return rect
}

// Files under `path` whose name matches, each with the folder trail that leads to
// it. Explorer searches subfolders too — in a tree this messy that is the point.
export function searchFiles(fs, path, q) {
  const term = q.trim().toLowerCase()
  if (!term) return []
  const out = []
  const walk = (entries, trail) => {
    for (const e of entries) {
      if (e.children) walk(e.children, [...trail, e.name])
      else if (e.name.toLowerCase().includes(term)) out.push({ file: e, trail })
    }
  }
  walk(entriesAt(fs, path), [])
  return out
}

// Pull a window up when its cascade offset would push its bottom past the taskbar,
// so a tall window opens anchored to the top instead of hanging off a short screen.
export function fitY(y, height, viewportH, taskbar = 48) {
  const avail = viewportH - taskbar
  const shown = Math.min(height, avail)
  return y + shown > avail ? Math.max(0, avail - shown) : y
}
