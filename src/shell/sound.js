// Synthesised rather than shipped: a handful of oscillators cost nothing to
// download and stay easy to retune.
const MUTE_KEY = 'windowsEx.muted'

let ctx = null
let muted = read()

function read() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const isMuted = () => muted

export function setMuted(on) {
  muted = on
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, on ? '1' : '0')
  } catch {
    // a preference that cannot be stored is still honoured this session
  }
}

// Browsers keep audio suspended until the page has been interacted with, so the
// context is created on demand and woken on the first click or key.
function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx.state === 'running' ? ctx : null
}

if (typeof window !== 'undefined') {
  const wake = () => audio()
  window.addEventListener('pointerdown', wake, { once: true })
  window.addEventListener('keydown', wake, { once: true })
}

function tone(ac, { at = 0, freq, to, dur, gain = 0.12, type = 'sine' }) {
  const osc = ac.createOscillator()
  const vol = ac.createGain()
  const t = ac.currentTime + at
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  // a short fade either side keeps it from clicking
  vol.gain.setValueAtTime(0.0001, t)
  vol.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  vol.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(vol).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

const SOUNDS = {
  notify: [{ freq: 880, dur: 0.11 }, { at: 0.1, freq: 1174, dur: 0.22 }],
  boot: [
    { freq: 523, dur: 0.3, gain: 0.09 },
    { at: 0.11, freq: 659, dur: 0.3, gain: 0.09 },
    { at: 0.22, freq: 784, dur: 0.5, gain: 0.1 }
  ],
  ok: [{ freq: 784, dur: 0.1 }, { at: 0.09, freq: 1046, dur: 0.28 }],
  error: [{ freq: 200, to: 90, dur: 0.5, gain: 0.16, type: 'sawtooth' }],
  click: [{ freq: 1200, dur: 0.04, gain: 0.05 }]
}

export function play(name) {
  if (muted) return
  const parts = SOUNDS[name]
  const ac = parts && audio()
  if (!ac) return
  parts.forEach((p) => tone(ac, p))
}
