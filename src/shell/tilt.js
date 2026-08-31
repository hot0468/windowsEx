import { useEffect, useRef, useState } from 'react'

// 기기를 기울여 사진 안을 둘러보는 자리. 계산은 여기서만 하고 화면은 결과만
// 받는다 — 센서 없는 환경(데스크톱·테스트)에서도 규칙을 그대로 검사할 수 있다.

// 기울기를 -1..1 로 접는다. RANGE 도를 넘게 기울여도 사진 밖으로는 나가지 않는다.
export const RANGE = 22

const clamp = (v) => Math.max(-1, Math.min(1, v))

// beta 는 앞뒤(폰을 세우고 눕히는 것), gamma 는 좌우다. 세로로 든 폰을 기준
// 자세로 삼는다 — 사람은 화면을 눕혀 놓고 보지 않는다(REST 만큼 기울어 있다).
export const REST = 45

export function panFrom({ beta = REST, gamma = 0 } = {}, range = RANGE) {
  return {
    x: clamp(gamma / range),
    y: clamp((beta - REST) / range)
  }
}

// 센서는 초당 예순 번씩 값을 준다. 그대로 화면에 넣으면 손의 미세한 떨림이
// 그대로 보여 화면이 부들거린다 — 사람은 폰을 완벽히 고정하지 못한다.
//
// 두 가지로 눕힌다. 데드존(DEAD)보다 작은 움직임은 제자리에 두고, 나머지는
// 새 값을 한 번에 반영하지 않고 조금씩 따라간다(EASE).
//
// 데드존이 실제로 떨림을 잡는 쪽이다. RANGE 가 22° 이므로 0.045 는 ±1° —
// 사람이 폰을 들고 있을 때의 흔들림이 그 언저리다. EASE 는 그보다 큰
// 움직임을 눕히는 몫이고, 떨림은 방향이 계속 바뀌므로 조금씩 따라가면
// 서로 상쇄된다.
//
// 재 보고 고른 값이다: ±0.3° 미세 떨림은 화면이 아예 움직이지 않고(0),
// ±1.2° 도 눈에 띄지 않을 만큼 눕으며(0.077), 기울이면 0.5초 안에 따라온다.
export const EASE = 0.08
export const DEAD = 0.045

// 지금 있는 자리에서 목표로 얼마나 갈 것인가. 손짓이 크면 성큼, 떨림이면
// 제자리 — 끝에 다다르면 목표에 붙여 둔다(영영 0.001 씩 남는 것을 막는다).
export function smoothPan(from = { x: 0, y: 0 }, to = { x: 0, y: 0 }, ease = EASE, dead = DEAD) {
  const step = (a, b) => {
    // 차이가 데드존보다 작으면 **움직이지 않는다**. 여기서 목표로 붙여 버리면
    // 미세한 떨림이 필터를 통째로 우회한다 — 매 프레임 차이가 데드존 안이라
    // 센서 값을 그대로 따라가게 되고, 작은 떨림일수록 오히려 필터가 없어진다.
    // 실기기에서 계속 부들거린 까닭이 이것이었다.
    if (Math.abs(b - a) < dead) return a
    return a + (b - a) * ease
  }
  return { x: step(from.x, to.x), y: step(from.y, to.y) }
}
// 기울기를 사진의 이동량(%)으로. transform: translate 의 퍼센트는 사진 제 크기를
// 기준으로 하므로, 뷰파인더 밖으로 남는 여백((over-1)/2)을 사진 크기로 다시
// 나눈다 — 이 한 번의 나눗셈을 빠뜨리면 끝까지 기울였을 때 가장자리가 빈다.
export const shiftPct = ({ x = 0, y = 0 }, over = 1.6) => {
  const room = ((over - 1) / 2 / over) * 100
  return { x: -x * room, y: -y * room }
}

// 사진 안에서 지금 보고 있는 자리. 찍은 사진에 남겨 두면 그때의 구도가 그대로
// 남는다 — object-position 이 바로 받는 값이다.
export const framePct = ({ x = 0, y = 0 }) => ({
  x: Math.round(50 + x * 30),
  y: Math.round(50 + y * 30)
})

// http 로 열었는가. localhost 는 http 라도 보안 컨텍스트라 예외다.
// isSecureContext 를 안 주는 브라우저가 있어 주소로도 본다 — 모른다고 안전한
// 것으로 치면 http 인데도 그냥 지나쳐 엉뚱한 진단이 나온다.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/

export const isInsecure = ({ secure, protocol = '', host = '' }) => {
  if (secure === true) return false
  if (protocol === 'https:' || LOCAL.test(host.replace(/:\d+$/, ''))) return false
  return true
}

// 기울기가 안 되는 이유를 가린다. 순서가 곧 진단의 질이다 — 주소가 문제면
// 다른 것을 짚어 봐야 소용이 없다(http 에서는 생성자가 있어도 이벤트가 안 온다).
//   listen      들을 수 있다. 바로 붙인다
//   off         권한을 물어야 하는 기기다(iOS) — 버튼을 보여 준다
//   insecure    http 로 열려 브라우저가 센서를 막았다
//   unsupported 이 브라우저에 센서 이벤트 자체가 없다
export function sensorState({ hasEvent, secure, protocol, host, needsPermission = false }) {
  // 주소를 먼저 짚는다. 고치면 나머지 사실 자체가 달라질 수 있다.
  if (isInsecure({ secure, protocol, host })) return 'insecure'
  if (!hasEvent) return 'unsupported'
  return needsPermission ? 'off' : 'listen'
}

// 센서를 쓰는 훅. 기울기가 안 오는 이유가 여러 가지라(권한·http·센서 없음)
// 무엇 때문인지를 state 로 돌려준다 — 화면은 그것을 그대로 말해 준다.
//   on         기울기가 오고 있다
//   idle       듣고 있는데 아직 아무것도 안 왔다(대개 센서가 없는 기기)
//   insecure   https 가 아니라 브라우저가 센서를 막았다
//   denied     권한을 주지 않았다
//   unsupported 이 브라우저에 센서 이벤트 자체가 없다
//   off        아직 켜지 않았다(권한을 물어야 하는 기기)
export function useTilt() {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [state, setState] = useState('off')
  const on = useRef(null)
  const idle = useRef(null)
  // 센서가 말하는 자리와, 화면이 지금 있는 자리. 둘을 나눠 두어야 사이를
  // 부드럽게 이을 수 있다.
  const want = useRef({ x: 0, y: 0 })
  const now = useRef({ x: 0, y: 0 })
  const raf = useRef(0)

  // 화면 새로 그릴 때마다 조금씩 따라간다. 다 따라잡으면 멈춘다 — 가만히
  // 있는 동안 프레임마다 도는 루프는 배터리를 축낸다.
  const follow = () => {
    const next = smoothPan(now.current, want.current)
    // 움직임이 멎으면 멈춘다. step 이 데드존 안에서 제자리를 돌려주므로,
    // 값이 그대로면 더 갈 곳이 없다는 뜻이다 — 가만히 있는 동안 프레임마다
    // 도는 루프는 배터리를 축낸다.
    const still = next.x === now.current.x && next.y === now.current.y
    now.current = next
    setPan(next)
    raf.current = still ? 0 : requestAnimationFrame(follow)
  }

  const start = () => {
    if (on.current) return
    const handler = (e) => {
      if (e.beta == null && e.gamma == null) return
      clearTimeout(idle.current)
      setState('on')
      // 센서 값은 '가려는 자리'일 뿐이다. 화면은 아래 루프가 그쪽으로 조금씩
      // 옮겨 준다 — 그대로 넣으면 손 떨림이 그대로 보인다.
      want.current = panFrom(e)
      if (!raf.current) raf.current = requestAnimationFrame(follow)
    }
    // 기기에 따라 둘 중 하나만 온다. 둘 다 듣고 먼저 오는 것을 쓴다.
    window.addEventListener('deviceorientation', handler)
    window.addEventListener('deviceorientationabsolute', handler)
    on.current = handler
    // 켰는데 조용하면 센서가 없는 것이다 — 손으로 끌라고 말해 줘야 한다.
    idle.current = setTimeout(() => setState((v) => (v === 'on' ? v : 'idle')), 1500)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      setState('unsupported')
      return undefined
    }
    const verdict = sensorState({
      hasEvent: Boolean(window.DeviceOrientationEvent),
      secure: window.isSecureContext,
      protocol: window.location?.protocol,
      host: window.location?.host,
      needsPermission: typeof window.DeviceOrientationEvent?.requestPermission === 'function'
    })
    if (verdict === 'listen') start()
    else setState(verdict)
    return () => {
      clearTimeout(idle.current)
      cancelAnimationFrame(raf.current)
      raf.current = 0
      if (on.current) {
        window.removeEventListener('deviceorientation', on.current)
        window.removeEventListener('deviceorientationabsolute', on.current)
      }
      on.current = null
    }
  }, [])

  // iOS 는 사용자의 손짓 안에서만 권한을 묻는다 — 버튼이 이것을 부른다.
  const ask = async () => {
    const req = window.DeviceOrientationEvent?.requestPermission
    if (typeof req !== 'function') return start()
    try {
      const ok = await req()
      if (ok === 'granted') start()
      else setState('denied')
    } catch {
      setState('denied')
    }
  }

  // 물어볼 수 있을 때만 버튼을 보인다. 주소가 문제면 물어도 소용없고, 이미
  // 거절당했으면 다시 물어도 같은 답이 온다.
  const needsAsk = typeof window !== 'undefined'
    && typeof window.DeviceOrientationEvent?.requestPermission === 'function'
    && !['on', 'insecure', 'denied'].includes(state)

  // 손으로 끌 때는 부드럽게 이을 것이 없다 — 손가락이 이미 그 자리에 있다.
  // 화면이 있는 자리도 같이 옮겨 두어야, 그 뒤에 센서가 켜져도 튀지 않는다.
  const setPanNow = (next) => {
    const v = typeof next === 'function' ? next(now.current) : next
    now.current = v
    want.current = v
    setPan(v)
  }

  return { pan, setPan: setPanNow, state, ask, needsAsk }
}

// 기울기가 안 될 때 화면이 할 말. 손으로 끄는 길은 어느 경우에도 열려 있다.
export const tiltNote = (state) => ({
  insecure: 'https 로 열어야 기울기 센서가 켜집니다. 지금은 끌어서 둘러보세요.',
  denied: '기울기 권한이 없습니다. 끌어서 둘러보세요.',
  unsupported: '이 브라우저는 기울기 센서를 지원하지 않습니다. 끌어서 둘러보세요.',
  idle: '기울기가 잡히지 않습니다. 끌어서 둘러보세요.'
}[state] ?? null)
