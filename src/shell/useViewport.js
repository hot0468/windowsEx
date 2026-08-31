import { useEffect, useState } from 'react'

// 폰 셸로 넘어가는 폭. 이보다 좁으면 창을 띄울 자리가 없다.
export const PHONE_MAX = 820

// 판별만 떼어낸 순수 함수 — 이 프로젝트에는 DOM 테스트 환경이 없으므로
// 로직은 여기서 검사하고 훅은 얇게 둔다.
export function pickShell({ width, coarse = false, force = null }) {
  if (force === 'phone' || force === 'desktop') return force
  return width <= PHONE_MAX ? 'phone' : 'desktop'
}

// ?shell=phone 으로 데스크톱에서도 폰 셸을 열어 볼 수 있다. 개발용이자,
// 좁은 창을 만들 수 없는 환경에서 확인하는 길.
const forced = () => {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('shell')
  } catch {
    return null
  }
}

const read = () => pickShell({
  width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  coarse: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  force: forced()
})

// 여는 손짓은 셸을 따른다. 데스크톱은 더블클릭이라는 관례가 있지만 폰에는
// 더블탭이 없다 — 한 번 탭이 여는 동작이고, 두 번 탭은 확대로 읽힌다.
export const openTap = (shell, open) =>
  shell === 'phone' ? { onClick: open } : { onDoubleClick: open }

// 세로로 민 손짓인가. 위로 밀면 -1, 아래로 밀면 1, 아니면 0.
// 가로가 더 길면 0 — 그건 옆으로 넘기는 손짓이지 여닫는 손짓이 아니다.
export function pullDir({ dy = 0, dx = 0 }, threshold = 48) {
  if (Math.abs(dy) < threshold || Math.abs(dy) <= Math.abs(dx)) return 0
  return dy < 0 ? -1 : 1
}

export function useViewport() {
  const [shell, setShell] = useState(read)
  useEffect(() => {
    const on = () => setShell(read())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return shell
}
