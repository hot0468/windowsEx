import { create } from 'zustand'
import scenario from '../scenarios/workday.json'
import { checkGoal } from './goal.js'
import { play } from '../shell/sound.js'

const SAVE_KEY = 'windowsEx.save'        // the player's explicit checkpoint
const SESSION_KEY = 'windowsEx.session'  // autosaved, so a refresh continues where you were
const PENDING_KEY = 'windowsEx.pendingLoad'

// The fields worth carrying across sessions: progress, not view state.
const PROGRESS = ['windows', 'nextZ', 'msgCount', 'readMails', 'seenThreads', 'extraMails',
  'starred', 'pinned', 'unlocked', 'grants', 'extraMessages', 'pendingAsks', 'bookings',
  'day', 'misses', 'failed', 'scratch']

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
  windows: restored?.windows ?? [],
  nextZ: restored?.nextZ ?? 10,
  msgCount: restored?.msgCount ?? 0,
  readMails: restored?.readMails ?? {},
  starred: restored?.starred ?? {},
  pinned: restored?.pinned ?? [],
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
  scratch: restored?.scratch ?? '',

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

  // Running the phishing attachment takes the machine down. Progress is kept —
  // what is lost is every open window and whatever was on screen in them.
  crash: () => {
    play('error')
    set({ crashed: true, toast: null })
  },
  restart: () => set({ crashed: false, booted: false, windows: [], toast: null }),
  reboot: () => {
    const s = get()
    const after = s.scenario.malware.aftermath
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

  // Clocking off restarts the machine and brings tomorrow's work with it.
  startDay: (n) => {
    const s = get()
    const day = s.scenario.days[n - 1]
    if (!day) return
    set({ day: n, misses: 0 })
    if (day.mails) set((st) => ({ extraMails: [...st.extraMails, ...day.mails] }))
    const beats = [day.opening, ...(day.asks ?? [])].filter(Boolean)
    beats.forEach((beat, i) => setTimeout(() => {
      beat.lines.forEach((text) => get().pushMessage(beat.thread, { from: beat.from, text }))
      if (beat.ask) get().setAsk(beat.thread, beat.ask)
      get().showToast({
        from: beat.from, text: beat.lines[0],
        app: 'messenger', source: beat.source, thread: beat.thread
      })
    }, 3600 + i * 4200))
  },
  finishDay: () => {
    const s = get()
    const next = s.day + 1
    s.restart()
    if (s.scenario.days[next - 1]) setTimeout(() => get().startDay(next), 100)
  },

  markMailRead: (id, read = true) =>
    set((s) => ({ readMails: { ...s.readMails, [id]: read } })),
  toggleStar: (id) => set((s) => ({ starred: { ...s.starred, [id]: !s.starred[id] } })),
  pinFile: (id) => set((s) => (s.pinned.includes(id) ? s : { pinned: [...s.pinned, id] })),
  unpinFile: (id) => set((s) => ({ pinned: s.pinned.filter((x) => x !== id) })),
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
  pushMessage: (threadId, msg) =>
    set((s) => ({
      extraMessages: { ...s.extraMessages, [threadId]: [...(s.extraMessages[threadId] ?? []), msg] }
    })),
  setScratch: (scratch) => set({ scratch }),
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
    const { spent, lines } = complaintFor(goal, verdict.reason, misses)
    set({ misses })

    setTimeout(() => {
      get().setTyping(c.thread, true)
      lines.forEach((text, i) => setTimeout(() => {
        get().pushMessage(c.thread, { from: c.from, text })
        if (i === lines.length - 1) {
          get().setTyping(c.thread, false)
          get().showToast({ from: c.from, text, app: 'messenger', source: c.source, thread: c.thread })
          if (spent) setTimeout(() => set({ failed: true }), 2600)
        }
      }, i * 1600))
    }, 3600)
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

// Wrong answers get a firmer nudge each time, stopping at the clearest one.
export const hintAfter = (ask, wrongs) => {
  const sets = lineSets(ask.no)
  return sets[Math.min(wrongs, sets.length - 1)]
}

// The mail brief in force on a given day: shared rules (attempts, the boss's
// reaction, the failure screen) plus that day's client and figures.
export const goalFor = (scenario, day) =>
  ({ ...scenario.goal, ...(scenario.days[day - 1]?.goal ?? {}) })

// Today's work: the day names which objectives it wants, the objective says
// which state counts as done.
export function requestsOf(scenario, day) {
  const today = scenario.days[day - 1]
  if (!today) return []
  return today.requests.map((id) => scenario.objectives.find((o) => o.id === id)).filter(Boolean)
}

export const dayDone = (scenario, day, state) =>
  requestsOf(scenario, day).every((o) => objectiveDone(o, state))

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
    : file.name.endsWith('.xlsx') ? { app: 'sheet', icon: 'xls' }
      : file.name.endsWith('.pptx') ? { app: 'slides', icon: 'ppt' }
        : file.name.endsWith('.hwp') ? { app: 'hwp', icon: 'hwp' }
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

// Exactly one state per visited site: no approval means no login form, no login
// means no content. Returning a single value keeps them mutually exclusive.
export function siteView(site, { grants, unlocked }) {
  if (!site) return 'error'
  if (site.requiresIp && !grants.ip) return 'blocked'
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
