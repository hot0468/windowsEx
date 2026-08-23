import { create } from 'zustand'
import scenario from '../scenarios/ep1.json'
import { checkGoal } from './goal.js'

const SAVE_KEY = 'windowsEx.save'
const PENDING_KEY = 'windowsEx.pendingLoad'

// The fields worth carrying across sessions: progress, not view state.
const PROGRESS = ['windows', 'nextZ', 'msgCount', 'readMails', 'extraMails',
  'wikiUnlocked', 'cleared', 'scratch']

function readSave() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY))
    return save && Array.isArray(save.windows) ? save : null
  } catch {
    return null
  }
}

export function savedAt() {
  return readSave()?.at ?? null
}

// Loading reloads the page (see loadGame) so every app remounts clean; the flag
// set just before that reload tells this fresh session to start from the save.
function takePendingSave() {
  try {
    if (sessionStorage.getItem(PENDING_KEY) !== '1') return null
    sessionStorage.removeItem(PENDING_KEY)
    return readSave()
  } catch {
    return null
  }
}

const restored = takePendingSave()

let winId = Math.max(0, ...(restored?.windows ?? []).map((w) => w.id))
let toastId = 0

export const useGame = create((set, get) => ({
  scenario,
  booted: false,
  toast: null,
  windows: restored?.windows ?? [],
  nextZ: restored?.nextZ ?? 10,
  msgCount: restored?.msgCount ?? 0,
  readMails: restored?.readMails ?? {},
  extraMails: restored?.extraMails ?? [],
  wikiUnlocked: restored?.wikiUnlocked ?? false,
  cleared: restored?.cleared ?? false,
  scratch: restored?.scratch ?? '',

  setBooted: () => set({ booted: true }),
  // The id lets the view remount each toast so its entrance animation replays,
  // even when two toasts carry identical text.
  showToast: (toast) => set({ toast: { ...toast, id: ++toastId } }),
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
    const save = { at: Date.now() }
    for (const k of PROGRESS) save[k] = s[k]
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save))
      s.showToast({ from: '게임 저장', text: '현재 진행 상황을 저장했습니다.' })
    } catch {
      s.showToast({ from: '게임 저장', text: '저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요.' })
    }
  },
  loadGame: () => {
    if (!readSave()) return get().showToast({ from: '불러오기', text: '저장된 게임이 없습니다.' })
    try {
      sessionStorage.setItem(PENDING_KEY, '1')
    } catch {
      return get().showToast({ from: '불러오기', text: '불러오지 못했습니다. 브라우저 저장공간을 확인해 주세요.' })
    }
    location.reload()
  },
  newGame: () => location.reload(),

  markMailRead: (id) => set((s) => ({ readMails: { ...s.readMails, [id]: true } })),
  unlockWiki: () => set({ wikiUnlocked: true }),
  setScratch: (scratch) => set({ scratch }),

  sendReply: ({ attachmentId, body }) => {
    const s = get()
    const goal = s.scenario.goal
    const original = s.scenario.mails.find((m) => m.id === goal.replyToMail)
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
      if (verdict.ok) setTimeout(() => set({ cleared: true }), 2500)
    }, 1800)
    return verdict.ok
  }
}))

export function findFile(fs, fileId) {
  for (const folder of Object.values(fs)) {
    const f = folder.find((x) => x.id === fileId)
    if (f) return f
  }
  return null
}

export function allFiles(fs) {
  return Object.values(fs).flat()
}

// Pull a window up when its cascade offset would push its bottom past the taskbar,
// so a tall window opens anchored to the top instead of hanging off a short screen.
export function fitY(y, height, viewportH, taskbar = 48) {
  const avail = viewportH - taskbar
  const shown = Math.min(height, avail)
  return y + shown > avail ? Math.max(0, avail - shown) : y
}
