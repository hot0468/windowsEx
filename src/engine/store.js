import { create } from 'zustand'
import scenario from '../scenarios/ep1.json'
import { checkGoal } from './goal.js'

let winId = 0

export const useGame = create((set, get) => ({
  scenario,
  booted: false,
  windows: [],
  nextZ: 10,
  toast: null,
  msgCount: 0,
  readMails: {},
  extraMails: [],
  wikiUnlocked: false,
  cleared: false,
  scratch: '',

  setBooted: () => set({ booted: true }),
  showToast: (toast) => set({ toast }),
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
      set({ toast: { from: original.from, text: '새 메일이 도착했습니다: ' + 'RE: ' + original.subject, app: 'mail' } })
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
