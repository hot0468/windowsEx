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

  const start = () => {
    if (on.current) return
    const handler = (e) => {
      if (e.beta == null && e.gamma == null) return
      clearTimeout(idle.current)
      setState('on')
      setPan(panFrom(e))
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

  return { pan, setPan, state, ask, needsAsk }
}

// 기울기가 안 될 때 화면이 할 말. 손으로 끄는 길은 어느 경우에도 열려 있다.
export const tiltNote = (state) => ({
  insecure: 'https 로 열어야 기울기 센서가 켜집니다. 지금은 끌어서 둘러보세요.',
  denied: '기울기 권한이 없습니다. 끌어서 둘러보세요.',
  unsupported: '이 브라우저는 기울기 센서를 지원하지 않습니다. 끌어서 둘러보세요.',
  idle: '기울기가 잡히지 않습니다. 끌어서 둘러보세요.'
}[state] ?? null)
