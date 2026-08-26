import { create } from 'zustand'
import scenario from '../scenarios/workday.json'
import { checkGoal, checkOutbound } from './goal.js'
import { play } from '../shell/sound.js'

const SAVE_KEY = 'windowsEx.save'        // the player's explicit checkpoint
const SESSION_KEY = 'windowsEx.session'  // autosaved, so a refresh continues where you were
const PENDING_KEY = 'windowsEx.pendingLoad'

// The fields worth carrying across sessions: progress, not view state.
export const PROGRESS = ['windows', 'nextZ', 'msgCount', 'readMails', 'seenThreads', 'extraMails',
  'starred', 'pinned', 'restored', 'showHidden', 'sheetEdits', 'unlocked', 'grants', 'extraMessages', 'pendingAsks', 'bookings',
  'day', 'misses', 'failed', 'scratch', 'ended', 'locks', 'overtime', 'slips', 'edits', 'drawn', 'vpn', 'mining', 'cleaned',
  'roomQuestions', 'ripples', 'mercy', 'minedSince', 'bookedFor', 'digging', 'rumor', 'chatted', 'routerDown',
  'mfpFixed', 'beatQueue', 'beatAsk', 'branches', 'dreamt']

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

// How long the day waits between two things being said.
const BEAT_GAP = 3600
// And how long between consecutive lines of one conversation opening up:
// short enough to read as one person typing, long enough to read each toast.
const NUDGE_GAP = 2200
// Who asks for the IP, and the thread's own `wait` — the scenario names the
// same grant, so the conversation and its trigger cannot drift apart.
export const IP_THREAD = 'security'
export const IP_ASKED = 'ip_asked'
// What a conversation's `gate` names once the player has met the wall a
// program's absence puts up.
export const missingKey = (program) => `missing:${program}`
// The last thing the day said asked a question, and it has not been answered.
// Only the day's own questions hold it up: a thread's standing question is
// always there and would stop the day before it started.
const asking = (s) => Boolean(s.beatAsk && s.pendingAsks[s.beatAsk])

export const useGame = create((set, get) => ({
  scenario,
  booted: false,
  toast: null,
  crashed: false,
  // Which program took the machine down, so the reboot knows who to blame.
  crashSource: null,
  locked: false,
  windows: restored?.windows ?? [],
  // what the browser's console and network log show right now; the devtools window draws them
  browserDev: { console: [], network: [] },
  setBrowserDev: (dev) => set({ browserDev: dev }),
  nextZ: restored?.nextZ ?? 10,
  msgCount: restored?.msgCount ?? 0,
  readMails: restored?.readMails ?? {},
  starred: restored?.starred ?? {},
  pinned: restored?.pinned ?? [],
  restored: restored?.restored ?? {},
  showHidden: restored?.showHidden ?? false,
  sheetEdits: restored?.sheetEdits ?? {},
  // Which conversation each messenger is showing, and how much of it has been read.
  // Both live here so a toast can open a thread in an already-running window.
  openThread: {},
  // Which choices each conversation has moved on to — part of the exchange, so
  // it outlives the window the same way the messages do.
  branches: restored?.branches ?? {},
  seenThreads: restored?.seenThreads ?? {},
  typing: {},
  extraMails: restored?.extraMails ?? [],
  extraMessages: restored?.extraMessages ?? {},
  // which small talk has already come, and on what day
  chatted: restored?.chatted ?? {},
  pendingAsks: restored?.pendingAsks ?? {},
  // What the day still has to say, and the conversation it is waiting on
  // before it says the next thing.
  beatQueue: restored?.beatQueue ?? [],
  beatAsk: restored?.beatAsk ?? null,
  unlocked: restored?.unlocked ?? {},
  grants: restored?.grants ?? {},
  // Whether the travel blog has been read to the end. The photos go with it.
  dreamt: restored?.dreamt ?? false,
  bookings: restored?.bookings ?? {},
  day: restored?.day ?? 1,
  misses: restored?.misses ?? 0,
  failed: restored?.failed ?? false,
  ended: restored?.ended ?? false,
  locks: restored?.locks ?? 0,
  // Which days the player chose to stay late on, and whether tonight's offer
  // has been answered yet.
  overtime: restored?.overtime ?? {},
  // Whether the player has pressed "finish today" — view state, so a reload
  // simply asks for the click again.
  closing: false,
  // Every wrong answer of the week, typed or mailed. Unlike misses this is
  // never reset: accuracy is judged over the whole week.
  slips: restored?.slips ?? 0,
  // Text files the player has typed into, kept by id on top of the scenario.
  edits: restored?.edits ?? {},
  // Which requests each day drew from the pool. Day one never draws.
  drawn: restored?.drawn ?? {},
  // A miner that came bundled with a security plugin: running until the task
  // is ended, and still installed until the antivirus removes it.
  mining: restored?.mining ?? false,
  cleaned: restored?.cleaned ?? false,
  // How many questions the anonymous room has been asked, which ripples have
  // already landed, and whether today's wrong answers are being forgiven.
  roomQuestions: restored?.roomQuestions ?? 0,
  ripples: restored?.ripples ?? {},
  mercy: restored?.mercy ?? false,
  // The day the miner started and which day a table was booked for — two small
  // facts that come back later.
  minedSince: restored?.minedSince ?? null,
  bookedFor: restored?.bookedFor ?? null,
  // How far the player has followed the eighth floor: asked the room about it,
  // found who went missing, walked in.
  digging: restored?.digging ?? {},
  // Following the affair rumour: heard where it leads, traced who wrote it,
  // and then either told or buried it.
  rumor: restored?.rumor ?? {},
  scratch: restored?.scratch ?? '',
  // The VPN tunnel. Kept across a save, dropped by a restart the way a real one is.
  vpn: restored?.vpn ?? false,
  // The floor's router with its DHCP server stopped: nothing past it loads until it is started again.
  routerDown: restored?.routerDown ?? false,
  // Whether this PC is registered with the copier. Set on the copier's own web
  // page and read by the print dialog, so it lives here rather than in either.
  mfpFixed: restored?.mfpFixed ?? false,

  setBooted: () => {
    play('boot')
    set({ booted: true })
    // A save reloaded, or a crash rebooted, mid-day: the rest of the day is
    // still in the queue and nothing is left holding a timer for it.
    if (get().beatQueue.length) setTimeout(() => get().nextBeat(), BEAT_GAP)
  },
  // The id lets the view remount each toast so its entrance animation replays,
  // even when two toasts carry identical text.
  showToast: (toast) => {
    const s = get()
    // On the days that take it one request at a time, a conversation whose turn
    // has not come does not interrupt.
    const held = toast.thread ? heldThreads(s.scenario, s.day, s) : null
    if (held && held.has(toast.thread)) return
    // A message that lands in the conversation already on screen needs no
    // notification: the player is watching it arrive.
    if (watchingThread(s, toast)) return
    play('notify')
    set({ toast: { ...toast, id: ++toastId } })
  },
  // A conversation that has just opened says everything it has to say, one line
  // at a time, so the player sees it arrive the way the other side sent it —
  // 지현 opens with eight lines, and only the last of them used to ring.
  nudge: (threadId) => {
    const s = get()
    const t = allThreads(s.scenario).find((x) => x.id === threadId)
    const said = threadMessages(t, s.scenario, s.msgCount, s.extraMessages)
      .filter((m) => m.day === s.day && !m.me)
    if (!said.length) return
    const source = s.scenario.workMessenger.sections.some((sec) => sec.threads.some((x) => x.id === threadId))
      ? 'workMessenger' : 'privateMessenger'
    said.forEach((msg, i) => setTimeout(() => {
      if (i < said.length - 1) get().setTyping(threadId, true)
      else get().setTyping(threadId, false)
      get().showToast({
        from: msg.from, text: msg.text, app: appOf(source), source, thread: threadId
      })
    }, 1800 + i * NUDGE_GAP))
  },
  // The intranet turning the machine away is what starts the IP conversation:
  // the block card says to ask 정보보안팀, and 차민혁 gets there first. Until
  // then his thread is a noticeboard with nothing on it for today.
  askedIp: () => {
    const s = get()
    if (s.grants[IP_ASKED]) return
    set({ grants: { ...s.grants, [IP_ASKED]: true } })
    get().nudge(IP_THREAD)
  },
  // Windows refusing to open something is what gives the player the thing to
  // say about it. Until they have seen the refusal there is nothing to report.
  sawMissing: (program) => set((s) => (s.grants[missingKey(program)]
    ? s
    : { grants: { ...s.grants, [missingKey(program)]: true } })),
  clearToast: () => set({ toast: null }),
  deliverMessage: () =>
    set((s) => ({ msgCount: Math.min(s.msgCount + 1, s.scenario.messenger.length) })),

  openWindow: (app, props = {}) => {
    // A machine pinned at 96% cannot hold a new window: it appears and shuts.
    // The two ways out of this state are exempt, or the player would be stuck.
    const s0 = get()
    if (s0.mining && !opensWhileMining(app)) {
      play('error')
      return s0.showToast({ from: s0.scenario.miner.symptoms.title, text: s0.scenario.miner.symptoms.lines[0], app: 'taskmgr' })
    }
    return set((s) => {
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
    })
  },
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
  restart: () => set({ crashed: false, crashSource: null, booted: false, windows: [], toast: null, locked: false, vpn: false, closing: false }),
  // Finishing the last request does nothing on its own; the player clocks off
  // from the request list, and only then the evening (offer, then the door) begins.
  closeDay: () => set({ closing: true }),
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
    // Each infection source is tracked on its own key so a second infection
    // from a DIFFERENT source still delivers its own warning once, while a
    // repeat from the SAME source stays a no-op. `grants.infected` keeps
    // meaning "infected at least once" for every other reader of it.
    const seenKey = `infected:${s.crashSource ?? 'mail'}`
    const fresh = !s.grants[seenKey]
    if (fresh) {
      after.lines.forEach((text) => s.pushMessage(after.thread, { from: after.from, text }))
      s.grant(seenKey)
      if (!s.grants.infected) s.grant('infected')
    }
    s.restart()
    if (!fresh) return
    setTimeout(() => get().showToast({
      from: after.from, text: after.lines[0],
      app: appOf(after.source), source: after.source, thread: after.thread
    }), 3200)
  },

  // Staying late brings three more requests tonight; going home closes the
  // offer for good. Either way the day can only be finished once.
  workLate: () => {
    const s = get()
    const extra = s.scenario.overtime.days[s.day]
    if (!extra || s.overtime[s.day]) return
    set((st) => ({ overtime: { ...st.overtime, [st.day]: true }, closing: false }))
    get().queueBeats([extra.opening, ...(extra.asks ?? [])].filter(Boolean), 1200)
  },
  goHome: () => set((s) => (s.overtime[s.day] !== undefined ? s : { overtime: { ...s.overtime, [s.day]: false } })),
  slip: () => set((s) => ({ slips: s.slips + 1 })),
  askedRoom: (about) => set((s) => {
    const next = { roomQuestions: s.roomQuestions + 1 }
    // pressing the room about the eighth floor is the first step of the trail
    if (about === 'rumor') {
      const asked = (s.rumor.asks ?? 0) + 1
      return { ...next, rumor: { ...s.rumor, asks: asked, heard: s.rumor.heard || asked >= s.scenario.rumor.askThreshold } }
    }
    if (about !== 'floor8') return next
    const asked = (s.digging.asks ?? 0) + 1
    return {
      ...next,
      digging: {
        ...s.digging,
        asks: asked,
        asked: s.digging.asked || asked >= s.scenario.floor8.askThreshold
      }
    }
  }),
  // Reading the attendance page is what turns a rumour into a name.
  foundMissing: () => set((s) => (s.digging.found ? s : { digging: { ...s.digging, found: true } })),
  // The print log names the observer — traced, but not yet acted on.
  traceObserver: () => set((s) => (s.rumor.traced ? s : { rumor: { ...s.rumor, traced: true } })),
  // The one choice that decides which way this ends.
  actOnRumor: (how) => set({ rumor: { ...get().rumor, acted: how }, ended: 'rumor_' + how }),
  // Walking in is the last thing the player does.
  enterFloor8: () => set((s) => (s.digging.entered ? s : { digging: { ...s.digging, entered: true } })),
  // Something the player installed starts mining. The machine goes slow and
  // windows fall over until the task is ended.
  startMining: () => {
    const s = get()
    if (s.mining || s.cleaned) return
    set({ mining: true, minedSince: s.day })
    setTimeout(() => get().showToast({
      from: s.scenario.miner.symptoms.title,
      text: s.scenario.miner.symptoms.lines[0], app: 'taskmgr'
    }), 4200)
  },
  // Ending the task quiets the machine; the program is still on disk, and the
  // security team says so a moment later.
  killMiner: () => {
    const s = get()
    if (!s.mining) return
    set({ mining: false })
    play('ok')
    s.showToast({ from: '작업 관리자', text: s.scenario.miner.killed.toast, app: 'taskmgr' })
    const after = s.scenario.miner.after
    setTimeout(() => {
      after.lines.forEach((text) => get().pushMessage(after.thread, { from: after.from, text }))
      get().showToast({
        from: after.from, text: after.lines[1],
        app: appOf(after.source), source: after.source, thread: after.thread
      })
    }, 5200)
  },
  // The scan removes it for good.
  cleanPc: () => {
    const s = get()
    if (s.cleaned) return
    set({ mining: false, cleaned: true, minedSince: null })
    play('ok')
    s.showToast({ from: s.scenario.antivirus.name, text: s.scenario.antivirus.clean.toast, app: 'antivirus' })
    s.grant('cleanpc')
  },
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
    // What the player did yesterday decides what today says to them.
    const landing = ripplesFor(s.scenario, n, s)
    const cost = landing.reduce((n2, r) => n2 + (r.effect?.slipPenalty ?? 0), 0)
    set({
      day: n,
      misses: 0,
      // yesterday said everything it was going to say
      beatQueue: [],
      beatAsk: null,
      drawn: { ...s.drawn, [n]: drawn },
      mercy: landing.some((r) => r.effect?.hintMercy),
      // what it costs you, counted where the player cannot see it
      slips: s.slips + cost,
      ripples: { ...s.ripples, ...Object.fromEntries(landing.map((r) => [r.id, n])) }
    })
    if (day.mails) set((st) => ({ extraMails: [...st.extraMails, ...day.mails] }))
    // The caller waits until the day's work has been asked for: it speaks last,
    // and only on its own night.
    const called = s.scenario.summons?.day === n ? [s.scenario.summons.beat] : []
    get().queueBeats([day.opening, ...landing.map((r) => r.beat), ...(day.asks ?? []),
      ...beatsFor(s.scenario, drawn), ...called].filter(Boolean), 3600)
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
    if (s.grants[CLUE.obituary]) return
    set({ grants: { ...s.grants, [CLUE.obituary]: true } })
    const ev = s.scenario.ending.event
    setTimeout(() => {
      ev.lines.forEach((text) => get().pushMessage(ev.thread, { from: ev.from, text }))
      get().showToast({ from: ev.from, text: ev.lines[ev.lines.length - 1], app: appOf(ev.source), source: ev.source, thread: ev.thread })
    }, ev.delay)
  },

  // Reading the travel blog to the end is the moment the holiday stops being
  // his. The photos he remembers taking were always somebody else's, and the
  // cloud notices they are gone a beat later.
  readDream: () => {
    const s = get()
    if (s.dreamt) return
    set({ dreamt: true })
    const note = s.scenario.dream?.notice
    if (!note) return
    setTimeout(() => {
      note.lines.forEach((text) => get().pushMessage(note.thread, { from: note.from, text }))
      get().showToast({
        from: note.from, text: note.lines[note.lines.length - 1],
        app: appOf(note.source), source: note.source, thread: note.thread
      })
    }, note.delay)
  },

  markMailRead: (id, read = true) =>
    set((s) => ({ readMails: { ...s.readMails, [id]: read } })),
  toggleStar: (id) => set((s) => ({ starred: { ...s.starred, [id]: !s.starred[id] } })),
  pinFile: (id) => set((s) => (s.pinned.includes(id) ? s : { pinned: [...s.pinned, id] })),
  unpinFile: (id) => set((s) => ({ pinned: s.pinned.filter((x) => x !== id) })),
  restoreFile: (id) => set((s) => ({ restored: { ...s.restored, [id]: true } })),
  toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  // A maintenance command sent to the copier. Out of order, the paper jams
  // again and the sequence starts over.
  // Registering this PC with the copier. Only its own address will do: the
  // machine has to be on the network for the copier to find it.
  registerMfp: (text) => {
    const s = get()
    if (s.mfpFixed) return 'taken'
    if (!ipFits(s.scenario.network.ip, text)) {
      play('error')
      return 'bad'
    }
    play('ok')
    set({ mfpFixed: true })
    return 'done'
  },
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
  // The router's admin page. Stopping DHCP takes the floor down until it is
  // started again; changing the default password is the one thing worth doing.
  breakRouter: () => {
    const s = get()
    if (s.routerDown) return
    set({ routerDown: true })
    s.grant('router_broke')
    const o = outageOf(s.scenario)
    setTimeout(() => {
      o.down.forEach((text) => get().pushMessage(o.thread, { from: o.from, text }))
      get().showToast({ from: o.from, text: o.down[0], app: appOf(o.source), source: o.source, thread: o.thread })
    }, 2500)
  },
  fixRouter: () => {
    if (!get().routerDown) return
    set({ routerDown: false })
    const o = outageOf(get().scenario)
    setTimeout(() => o.up.forEach((text) => get().pushMessage(o.thread, { from: o.from, text })), 1500)
  },
  secureRouter: () => get().grant('router_secured'),
  // Credentials typed into the look-alike login page: security notices at once.
  phished: (after) => {
    if (get().grants.phished) return
    get().grant('phished')
    setTimeout(() => {
      after.lines.forEach((text) => get().pushMessage(after.thread, { from: after.from, text }))
      get().showToast({ from: after.from, text: after.lines[0], app: appOf(after.source), source: after.source, thread: after.thread })
    }, after.delay ?? 2500)
  },
  grant: (key) => {
    const was = heldThreads(get().scenario, get().day, get())
    play('ok')
    set((s) => ({
      grants: { ...s.grants, [key]: true },
      // the day a watched deed happened, for the consequences that wait
      ripples: watched(s.scenario, key) && s.ripples['_' + key] === undefined
        ? { ...s.ripples, ['_' + key]: s.day }
        : s.ripples
    }))
    get().chat(key)
    // finishing one request is what opens the next conversation
    const now = heldThreads(get().scenario, get().day, get())
    if (was && now) for (const id of was) if (!now.has(id)) get().nudge(id)
    // some mail only shows up once the player has got somewhere
    const mw = get().scenario.malware
    if (mw.after !== key || get().extraMails.some((m) => m.id === mw.mail.id)) return
    setTimeout(() => {
      set((s) => ({ extraMails: [...s.extraMails, mw.mail] }))
      get().showToast({ from: mw.mail.from, text: mw.notice, app: 'mail' })
    }, mw.delay)
  },
  book: (place, details) =>
    set((s) => ({ bookings: { ...s.bookings, [place]: details }, bookedFor: s.day })),
  // Small talk lands between the work. A deed that someone was waiting on
  // brings their reaction; otherwise every other solved request brings one
  // line of the day's idle chatter, a few a day at most.
  chat: (key, pick = Math.random) => {
    const s = get()
    const chosen = chatterFor(s.scenario, key, s, pick)
    if (!chosen) return
    set((st) => ({ chatted: { ...st.chatted, [chosen.id]: st.day } }))
    setTimeout(() => {
      const { beat } = chosen
      beat.lines.forEach((text) => get().pushMessage(beat.thread, { from: beat.from, text }))
      get().showToast({ from: beat.from, text: beat.lines[0], app: appOf(beat.source), source: beat.source, thread: beat.thread })
    }, 2600)
  },
  // A day speaks one conversation at a time. Its beats go in a queue, and the
  // next one waits for the question the last one asked to be answered —
  // otherwise three people talk over a player who is still typing a reply.
  queueBeats: (beats, first) => {
    if (!beats.length) return
    set((s) => ({ beatQueue: [...s.beatQueue, ...beats] }))
    setTimeout(() => get().nextBeat(), first)
  },
  // Nothing schedules the held beat: whoever answers the open question calls
  // this again, so a waiting beat can never arrive twice.
  nextBeat: () => {
    const s = get()
    const [beat, ...rest] = s.beatQueue
    if (!beat || asking(s)) return
    set({ beatQueue: rest, beatAsk: beat.ask || beat.choices ? beat.thread : null })
    beat.lines.forEach((text) => s.pushMessage(beat.thread, { from: beat.from, text }))
    if (beat.ask) get().queueAsk(beat.thread, beat.ask)
    // a question with buttons: the thread's own reactions answer it
    if (beat.choices) get().queueAsk(beat.thread, { choices: beat.choices })
    get().showToast({
      from: beat.from, text: beat.lines[0],
      app: appOf(beat.source), source: beat.source, thread: beat.thread
    })
    if (rest.length) setTimeout(() => get().nextBeat(), BEAT_GAP)
  },
  setAsk: (threadId, ask) => {
    set((s) => ({ pendingAsks: { ...s.pendingAsks, [threadId]: ask } }))
    // answering the question the day is waiting on is what lets it carry on
    if (threadId === get().beatAsk && !asking(get())) setTimeout(() => get().nextBeat(), BEAT_GAP)
  },
  // A day can raise two questions in the same conversation. The second waits
  // behind the first instead of replacing it, so neither goes unanswered.
  queueAsk: (threadId, ask) =>
    set((s) => {
      const waiting = s.pendingAsks[threadId]
      return { pendingAsks: { ...s.pendingAsks, [threadId]: waiting ? appendAsk(waiting, ask) : ask } }
    }),
  // A conversation belongs to the game, not to the window drawing it. Both
  // halves of it go where every other pushed line goes, so closing the
  // messenger cannot take the exchange with it.
  say: (threadId, entry) => get().pushMessage(threadId, { me: true, ...entry }),
  // The other side writes for a beat, then answers a line at a time. The
  // timers live here rather than in the window, so a reply already started
  // finishes even if the player closes the messenger halfway through it.
  sayBack: (threadId, from, lines) => {
    get().setTyping(threadId, true)
    lines.forEach((text, i) => setTimeout(() => {
      get().pushMessage(threadId, { from, text })
      if (i === lines.length - 1) get().setTyping(threadId, false)
    }, 1200 + i * 1500))
  },
  // Which set of choices a conversation has reached.
  setBranch: (threadId, next) =>
    set((s) => ({ branches: { ...s.branches, [threadId]: next } })),
  // Every message remembers the day it arrived; the scenario's own are day one.
  pushMessage: (threadId, msg) =>
    set((s) => ({
      extraMessages: { ...s.extraMessages, [threadId]: [...(s.extraMessages[threadId] ?? []), { day: s.day, ...msg }] }
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
          get().showToast({ from: c.from, text, app: appOf(c.source), source: c.source, thread: c.thread })
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

// Once the blog has been read, the photos it was lending are gone. The rows
// stay so the player can see the shape of what was there — a name, greyed, and
// nothing behind it. Anything the dream never borrowed is untouched.
export function dreamGallery(scenario, fs, dreamt) {
  const gone = new Set(dreamt ? scenario.dream?.photos ?? [] : [])
  if (!gone.size) return fs
  const mark = (entries) => entries.map((e) => (
    e.children ? { ...e, children: mark(e.children) }
      : gone.has(e.id) ? { ...e, missing: scenario.dream.broken, image: undefined, alt: undefined }
        : e
  ))
  return Object.fromEntries(Object.entries(fs).map(([root, entries]) => [root, mark(entries)]))
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

// What a conversation actually shows: the lines it already had, then — if this
// is the live thread — today's timed script, then whatever the week has pushed
// into it since. A live thread keeps its history rather than replacing it.
// Stored lines from before the week carry the `date` they were said on; anything
// belonging to the week carries a `day` instead, which is also what marks it as
// still unread.
// `hold` is the day whose messages this conversation has not reached yet: on the
// first days a thread waiting its turn shows the history it came with and none
// of today.
export const threadMessages = (thread, scenario, msgCount = 0, extras = {}, hold = 0) => [
  ...(thread.messages ?? []),
  ...(thread.live ? scenario.messenger.slice(0, msgCount).map((m) => ({ ...m, day: 1 })) : []),
  ...(extras[thread.id] ?? [])
].filter((m) => !hold || m.day !== hold)

// A conversation someone came back to was read long ago, so only what the week
// itself brought can still be unread — and never what the player typed.
export const unreadCount = (all, seen = 0) => {
  const read = Math.max(seen, all.filter((msg) => msg.date !== undefined).length)
  return all.filter((msg, i) => i >= read && !msg.me).length
}

// Which app a toast should open. A beat already names the messenger it came
// from, so the toast follows it there rather than always opening AR톡.
export const appOf = (source) => (source === 'privateMessenger' ? 'chat' : 'messenger')

export const quickSets = (thread) => lineSets(thread.quick ?? FALLBACK_QUICK)

// Loose match: spacing and case are forgiven. An entry may be an array, in
// which case every part of it has to appear — a pasted receipt has to carry both
// the place and the time, not just one of them.
const loose = (v) => v.replace(/\s/g, '').toLowerCase()

export function answerFits(ask, text) {
  // A question asked with no answer in the world takes whatever is typed: the
  // player has already worked it out, and there is nothing to check it against.
  if (ask.free) return text.trim() !== ''
  return ask.accept.some((entry) =>
    (Array.isArray(entry) ? entry : [entry]).every((part) => contains(text, part)))
}

// A loose "does the answer mention this" test, except that a number has to
// stand on its own. Without the digit boundary, typing the extension 1180
// would also answer a question whose answer is the stock count 180.
function contains(text, part) {
  const hay = loose(text)
  const needle = loose(part)
  if (!needle || !hay.includes(needle)) return false
  // only numbers get the boundary; a word answer may sit inside a sentence
  if (!/^[\d,.-]+$/.test(needle)) return true
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    if (!isDigit(hay[at - 1]) && !isDigit(hay[at + needle.length])) return true
  }
  return false
}

const isDigit = (ch) => ch !== undefined && ch >= '0' && ch <= '9'

// Which ending the week earned: the truth if the obituary was opened, the
// overwork variant if the screen never once locked, an ordinary weekend otherwise.
// Once the obituary has been opened the ticket is worthless: the dead cannot
// collect. Until then, a confirmed win is the one way the week ends well.
// Working late every single night earns the overwork ending on its own.
// Someone who was called and never opened the notice wakes up: the summons was
// answered by refusing it, and the refusal outranks even the ticket — but not
// the notice itself, because the dead do not wake. Walking into the eighth
// floor outranks all of it: whatever else the week was, it ends there.
export const endingFor = (ending, { grants, locks, overtime = {}, days = 5, digging = {}, rumor = {} }) =>
  wentUp(digging) ? 'missing'
    : toldRumor(rumor) ? ('rumor_' + rumor.acted)
    : awareOf(ending, grants) ? 'true'
      : refusedSummons(grants) ? 'wake'
        : grants.lotto ? 'lotto'
          : workedEveryNight(overtime, days) || locks === 0 ? 'overwork' : 'plain'

// The trail has to be walked in order: you cannot open a door you never heard
// about, and the page will not resolve until the player writes it into hosts.
export const wentUp = (digging = {}) => Boolean(digging.asked && digging.found && digging.entered)

// The rumour ends the week only once the player has actually chosen what to do
// with the name — heard it, traced it, acted on it.
export const toldRumor = (rumor = {}) => Boolean(rumor.heard && rumor.traced && rumor.acted)

// Whether the player has traced the observer but not yet chosen: the moment the
// choice is offered.
export const rumorPending = (rumor = {}) => Boolean(rumor.heard && rumor.traced && !rumor.acted)

// How far along the trail the player is, for anything that wants to show it.
export const digDepth = (scenario, digging = {}) =>
  scenario.floor8.steps.filter((k) => digging[k]).length

// Five nights out of five, no exceptions.
export const workedEveryNight = (overtime, days) =>
  Array.from({ length: days }, (_, i) => overtime[i + 1]).every(Boolean)

// Called, and the notice left unopened. Reaching the end of the questions is
// what makes the week refusable at all: without the call there is nothing to
// turn down, and opening the notice takes the refusal back.
export const refusedSummons = (grants = {}) => Boolean(grants.summoned) && !grants[CLUE.obituary]

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

// A feed item tagged with a day exists only from that morning on; untagged
// items were always there.
export const visibleByDay = (items = [], day = 1) => items.filter((x) => (x.day ?? 0) <= day)

// A board shows what has arrived so far, newest day floating to the top.
// The sort is stable, so the authored order inside a day survives.
export const boardPosts = (posts = [], day = 1) =>
  [...visibleByDay(posts, day)].sort((a, b) => (b.day ?? 0) - (a.day ?? 0))

// The portal keeps every day's announcements: today's on top, then each
// earlier day, then what was already pinned before the week began.
export function portalFeed(scenario, base, day) {
  const perDay = []
  for (let n = day; n >= 1; n--) perDay.push(...(scenario.days[n - 1]?.portal?.news ?? []))
  return [...perDay, ...(base.news ?? [])]
}

// The front page carries the freshest headlines, newest first.
export const latestNews = (news, n = 6) =>
  [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)

// The player knows once they have opened their own obituary.
export const CLUE = { obituary: 'clue_obituary' }
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
export const hintAfter = (ask, wrongs, mercy = false) => {
  const sets = lineSets(ask.no)
  // the morning after a late night, nobody makes you work for the hint
  return sets[Math.min(mercy ? wrongs + 1 : wrongs, sets.length - 1)]
}

// Edited cells are kept flat, one key per cell, on top of the read-only workbook.
export const cellKey = (fileId, sheet, r, c) => `${fileId}:${sheet}:${r}:${c}`

export const cellMatches = (objective, sheetEdits) => {
  const { file, sheet, row, col, value } = objective.cell
  return (sheetEdits[cellKey(file, sheet, row, col)] ?? '').trim() === value.trim()
}

// The jammed printer wants the wiki's steps in order; a wrong press jams it again.
// An address typed into a form: spaces forgiven, nothing else. Leading zeros
// are not the same address, so this is a plain comparison and not a number one.
export const ipFits = (want, text = '') => text.replace(/\s/g, '') === want

// The mail brief in force on a given day: shared rules (attempts, the boss's
// reaction, the failure screen) plus that day's client and figures.
export const goalFor = (scenario, day) =>
  ({ ...scenario.goal, ...(scenario.days[day - 1]?.goal ?? {}) })

// Today's work: the day names which objectives it wants, the objective says
// which state counts as done.
export function requestsOf(scenario, day, overtime = {}, drawn = {}, ripples = {}) {
  const today = scenario.days[day - 1]
  if (!today) return []
  const extra = overtime[day] ? scenario.overtime?.days?.[day]?.requests ?? [] : []
  // a consequence can put work on the day that nobody asked for
  const forced = (scenario.ripples ?? [])
    .filter((r) => ripples[r.id] === day && r.effect?.extraRequest)
    .map((r) => r.effect.extraRequest)
  // A request can need a step of its own somewhere else — a tracking number in
  // 톡톡, a cell in a sheet. That is work the player has to do, so it goes on
  // the list under the request that asked for it.
  return [...new Set([...today.requests, ...(drawn[day] ?? []), ...extra, ...forced])]
    .flatMap((id) => [
      scenario.objectives.find((o) => o.id === id),
      ...scenario.objectives.filter((o) => o.partOf === id)
    ]).filter(Boolean)
}

// Grants a consequence is waiting on, so `grant` only stamps the ones that matter.
export const watched = (scenario, key) =>
  (scenario.ripples ?? []).some((r) => r.when.grant === key)

// Which consequences land on the morning of day `n`. A ripple lands once, and
// only when the state it names is actually true.
// Which small talk a deed brings: the one waiting on exactly this deed, or
// else — on every other deed, while the day's quota lasts — one drawn from
// what the day has to say. Nothing is ever said twice.
export const CHATTER_A_DAY = 3
export function chatterFor(scenario, key, state, pick = Math.random) {
  const { chatted = {}, day, grants = {} } = state
  const fresh = (scenario.chatter ?? []).filter((c) => !(c.id in chatted))
  const waiting = fresh.find((c) => c.after === key)
  if (waiting) return waiting
  const today = Object.values(chatted).filter((d) => d === day).length
  if (today >= CHATTER_A_DAY || Object.keys(grants).length % 2) return null
  const idle = fresh.filter((c) => !c.after && (!c.days || c.days.includes(day)))
  return idle.length ? idle[Math.floor(pick() * idle.length)] : null
}

export function ripplesFor(scenario, n, state) {
  const seen = state.ripples ?? {}
  return (scenario.ripples ?? []).filter((r) => !(r.id in seen) && rippleHolds(r.when, n, state))
}

export function rippleHolds(when = {}, n, state) {
  const {
    overtime = {}, locks = 0, slips = 0, mining = false, cleaned = false, roomQuestions = 0,
    grants = {}, minedSince = null, bookedFor = null, ripples = {}, edits = {}
  } = state
  if (when.fromDay && n < when.fromDay) return false
  if (n < 2 && !when.fromDay) return false          // nothing ripples onto day one
  if (when.overtimeYesterday && !overtime[n - 1]) return false
  if (when.overtimeStreak) {
    const run = Array.from({ length: when.overtimeStreak }, (_, i) => overtime[n - 1 - i])
    if (!run.every(Boolean)) return false
  }
  if (when.mining !== undefined && (mining !== when.mining || cleaned)) return false
  if (when.locks !== undefined && locks !== when.locks) return false
  if (when.slipsAtLeast !== undefined && slips < when.slipsAtLeast) return false
  if (when.slipsAtMost !== undefined && slips > when.slipsAtMost) return false
  if (when.roomQuestions !== undefined && roomQuestions < when.roomQuestions) return false
  // a machine left mining for this many days running
  if (when.miningDays && (minedSince === null || n - minedSince < when.miningDays)) return false
  // something the player did, and something they then did not do
  if (when.grant && !grants[when.grant]) return false
  if (when.notGrant && grants[when.notGrant]) return false
  // the bill comes due a couple of days after the thing itself
  if (when.afterDays && !doneLongEnough(ripples, when, n)) return false
  // a table booked, and a night spent at the office instead
  if (when.bookingKept && bookedFor === null) return false
  // a synced file the player rewrote, and did not put back
  if (when.edited && !rewritten(state.scenario ?? scenario, edits, when.edited)) return false
  return true
}

const rewritten = (sc, edits, id) => {
  const f = findFile(sc.fs, id)
  return Boolean(f) && edits[id] !== undefined && edits[id] !== f.content
}

// A consequence with `afterDays` waits that many days after the deed before it
// lands, so the player has a window in which to put it right.
const doneLongEnough = (ripples, when, n) => {
  const at = ripples['_' + when.grant]
  return at !== undefined && n - at >= when.afterDays
}

// Days after the first keep a fixed core and draw the rest, so no two weeks
// bring the same work. A request that reads a document from a later day waits
// for that day (`after`); one that explains itself too kindly for the end of
// the week stops being drawn (`before`); nothing is ever drawn twice.
export function drawFor(scenario, day, drawn = {}, pick = Math.random) {
  const pool = scenario.pool
  if (!pool || day === 1) return []
  const taken = new Set(Object.values(drawn).flat())
  const want = pool.sizes[day] - (pool.fixed[day] ?? []).length
  const ready = pool.requests
    .filter((r) => !taken.has(r.id) && (pool.after[r.id] ?? 0) <= day && day <= (pool.before?.[r.id] ?? 9))
    .map((r) => r.id)
  // The work written for this end of the week goes first: the kindly explained
  // requests early on, the ones that explain nothing late. The rest fills in.
  const meant = (id) => (day >= 4 ? (pool.after[id] ?? 0) >= 4 : Boolean(pool.before?.[id]))
  const first = shuffle(ready.filter(meant), pick)
  const rest = shuffle(ready.filter((id) => !meant(id)), pick)
  return [...first, ...rest].slice(0, Math.max(0, want))
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

// The first days ease the player in: the work is offered one request at a time,
// and nobody else starts talking until the one on the table is done. How far the
// day has opened is not stored anywhere — it is simply how much is finished.
const lastStep = (ask) => (ask?.then ? lastStep(ask.then) : ask)

// Which conversation carries each request, by the grant it ends on. The answer
// only depends on the scenario, and the messenger asks on every render.
const hosts = new WeakMap()
export function hostThreads(scenario) {
  if (hosts.has(scenario)) return hosts.get(scenario)
  const threads = allThreads(scenario)
  const host = {}
  for (const t of threads) {
    for (const a of [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]) {
      if (a) host[lastStep(a).grants] = t.id
    }
  }
  for (const d of scenario.days) {
    for (const b of d.asks ?? []) if (b.ask) host[lastStep(b.ask).grants] = b.thread
  }
  for (const r of scenario.pool?.requests ?? []) {
    if (r.beat?.ask) host[lastStep(r.beat.ask).grants] = r.beat.thread
  }
  hosts.set(scenario, host)
  return host
}

export const allThreads = (scenario) =>
  [scenario.workMessenger, scenario.privateMessenger].flatMap((m) => m.sections.flatMap((s) => s.threads))

// The conversations still waiting their turn, or null on a day that holds
// nothing back. Only what the day itself lines up can be held: a request's own
// thread waits for its place in the order, and the ones with nothing to ask
// today follow a step behind. Anything else — the live thread, a bank alert, a
// verification code — is never in the queue and always gets through.
export function heldThreads(scenario, day, state) {
  if (day > (scenario.tutorialDays ?? 0)) return null
  const list = requestsOf(scenario, day, state.overtime, state.drawn, state.ripples)
  const step = list.filter((o) => objectiveDone(o, state)).length
  const host = hostThreads(scenario)
  const hosts = list.map((o) => host[o.id])
  const taken = new Set(hosts.filter(Boolean))
  const idle = allThreads(scenario)
    .filter((t) => !t.live && !taken.has(t.id) && (t.messages ?? []).some((m) => m.day === day))
    .map((t) => t.id)
  const held = new Set()
  hosts.forEach((id, i) => { if (id && step < i) held.add(id) })
  idle.forEach((id, k) => { if (step <= k) held.add(id) })
  return held
}

export const dayDone = (scenario, day, state) =>
  requestsOf(scenario, day, state.overtime ?? {}, state.drawn ?? {}, state.ripples ?? {})
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
// Every address a name is listed against, in the order the file lists them.
// hostNames keeps only the last one, which is right for asking "what does this
// name point at" and wrong for asking "is anything here at all".
export function hostAddresses(scenario, edits, host) {
  const file = findFile(scenario.fs, scenario.hosts.file)
  const want = host.toLowerCase()
  const out = []
  for (const raw of contentOf(file, edits).split('\n')) {
    const [ip, ...names] = raw.split('#')[0].trim().split(/\s+/).filter(Boolean)
    if (ip && names.some((n) => n.toLowerCase() === want)) out.push(ip)
  }
  const named = scenario.hosts.required[want]
  if (named && !out.includes(named)) out.push(named)
  return out
}

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

// The address bar: protocol and case are forgiven, the first slash splits
// host from path, and a trailing slash means nothing.
export function parseAddress(raw = '') {
  const cleaned = raw.trim().replace(/^https?:\/\//i, '').toLowerCase()
  const cut = cleaned.indexOf('/')
  const host = cut < 0 ? cleaned : cleaned.slice(0, cut)
  const path = cut < 0 ? '' : cleaned.slice(cut).replace(/\/+$/, '')
  return { host, path }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

// A site by its name — or, typed as an address, by whichever name the hosts
// file (or the names the game hands out) maps to that address.
export function resolveSite(scenario, edits, host) {
  const exact = scenario.sites.find((s) => s.url === host)
  if (exact) return exact
  const file = findFile(scenario.fs, scenario.hosts.file)
  const names = { ...scenario.hosts.required, ...hostNames(contentOf(file, edits)) }
  // A name the hosts file knows stands in for the address it points at. A name
  // can be listed against more than one address — localhost is 127.0.0.1 and
  // then ::1 — so try every address it carries, not just the last one to win.
  if (!IPV4.test(host)) {
    for (const ip of hostAddresses(scenario, edits, host)) {
      const at = scenario.sites.find((s) => s.url === ip)
      if (at) return at
    }
    return null
  }
  const name = Object.keys(names).find((n) => names[n] === host)
  return (name && scenario.sites.find((s) => s.url === name)) ?? null
}

// Addresses that are pages in their own right, not sites to look up.
// This machine's own address is no longer among them: something the last
// occupant started is still listening on it, and the site list answers.
export const specialPage = (host) =>
  (host === 'about:blank' ? 'blank' : null)

// A path is a wiki page id or a portal sub-page; anything else on any site is a 404.
export function pathKnown(site, path = '') {
  if (!path) return true
  if (site?.layout === 'wiki') return Boolean(site.wiki.pages[path.slice(1)])
  return Boolean(site?.pages?.[path])
}

// Which topic a question lands on, so a caller can tell what was asked about.
export function roomTopic(ask, question) {
  const q = loose(question)
  if (!q) return null
  let hit = null, best = 0
  for (const topic of ask.topics) {
    for (const k of topic.keys) {
      const key = loose(k)
      if (q.includes(key) && key.length > best) { hit = topic; best = key.length }
    }
  }
  if (!hit) return null
  if (hit.keys.includes('8층')) return 'floor8'
  if (hit.keys.includes('불륜')) return 'rumor'
  return null
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

// Which window draws which messenger. A message arriving in the conversation
// that is already open on screen is not news, so it does not ring: the player
// is watching it land.
const MESSENGER_APP = { workMessenger: 'messenger', privateMessenger: 'chat' }
export function watchingThread(s, toast) {
  if (!toast.source || !toast.thread) return false
  if (s.openThread[toast.source] !== toast.thread) return false
  return s.windows.some((w) => w.app === MESSENGER_APP[toast.source] && !w.minimized)
}

// Installing something can leave an icon on the desktop. Which ones are there
// is a question about grants, so the shell never has to keep its own list.
export const installedShortcuts = (programs = {}, grants = {}) =>
  Object.values(programs).filter((p) => p.shortcut && grants[p.grant]).map((p) => p.shortcut)

// While the miner runs the machine cannot hold a new window open: opening one
// is what the player sees fail. The task manager and the antivirus are the way
// out, so they always open.
export const SAFE_APPS = ['taskmgr', 'antivirus']
export const opensWhileMining = (app) => SAFE_APPS.includes(app)

// What the task manager lists: the miner first, on top of the ordinary rows.
export function processList(miner, mining) {
  const rows = [...miner.processes]
  return mining ? [{ ...miner.process, miner: true }, ...rows] : rows
}

// Exactly one state per visited site: no tunnel means no name, no approval
// means no login form, no login means no content. Returning a single value
// keeps them mutually exclusive.
const outageOf = (sc) => sc.sites.find((x) => x.layout === 'router').router.outage

export function siteView(site, { grants, unlocked, resolves = true, vpn = false, offline = false }) {
  if (!site) return 'error'
  // ponytail: only the browser goes dark when the router is down; mail and the VPN app still work
  if (offline) return 'offline'
  if (site.requiresIp && !grants.ip) return 'blocked'
  if (site.requiresVpn && !vpn) return 'vpn'
  if (site.requiresHost && !resolves) return 'error'
  if (site.login && !unlocked[site.url]) return 'login'
  // a server fault that stays until the grant it names is earned
  if (site.down && !grants[site.down]) return 'down'
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

// Sponsored results are not sites the portal indexed — they are bought, so they
// match on the words the buyer paid for and never show up in a plain site search.
export const searchAds = (ads, q) => searchIn(ads, q, ['title', 'desc', 'tags'])

// Titles and addresses only. Matching page contents would surface the wiki's
// price table in results and let a player skip its password gate entirely.
export const searchSites = (sites, q) => searchIn(sites.filter((s) => !s.unlisted), q, ['title', 'url'])

// path is ['문서', '업무자료', '2026'] — the first name picks the root drive.
// Windows keeps hidden items out of every listing until you ask for them, and
// then draws them faded — one switch, every folder.
export const visible = (entries, showHidden) =>
  entries.filter((e) => showHidden || !e.hidden)

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
