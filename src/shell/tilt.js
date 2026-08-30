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

// 센서를 쓰는 훅. 권한이 필요한 기기(iOS)에서는 ask() 를 눌러야 켜진다.
export function useTilt() {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [state, setState] = useState('off')
  const on = useRef(null)

  const start = () => {
    if (on.current) return
    const handler = (e) => {
      if (e.beta == null && e.gamma == null) return
      setState('on')
      setPan(panFrom(e))
    }
    window.addEventListener('deviceorientation', handler)
    on.current = handler
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      setState('unsupported')
      return undefined
    }
    // 권한을 묻는 기기가 아니면 그냥 듣는다.
    if (typeof window.DeviceOrientationEvent.requestPermission !== 'function') start()
    return () => {
      if (on.current) window.removeEventListener('deviceorientation', on.current)
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

  const needsAsk = typeof window !== 'undefined'
    && typeof window.DeviceOrientationEvent?.requestPermission === 'function'
    && state === 'off'

  return { pan, setPan, state, ask, needsAsk }
}
