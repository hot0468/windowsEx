import { useReducer } from 'react'

export const historyInit = (at) => ({ at, back: [], fwd: [] })

// Back/forward over any kind of location — a folder path or a browser page.
// Going somewhere new drops the forward trail, the way a browser does.
export function historyReduce(s, action) {
  switch (action.type) {
    case 'go':
      return { at: action.to, back: [...s.back, s.at], fwd: [] }
    case 'back':
      return s.back.length
        ? { at: s.back[s.back.length - 1], back: s.back.slice(0, -1), fwd: [s.at, ...s.fwd] }
        : s
    case 'forward':
      return s.fwd.length
        ? { at: s.fwd[0], back: [...s.back, s.at], fwd: s.fwd.slice(1) }
        : s
    default:
      return s
  }
}

export function useHistory(start) {
  const [h, dispatch] = useReducer(historyReduce, start, historyInit)
  return {
    at: h.at,
    canBack: h.back.length > 0,
    canForward: h.fwd.length > 0,
    go: (to) => dispatch({ type: 'go', to }),
    back: () => dispatch({ type: 'back' }),
    forward: () => dispatch({ type: 'forward' })
  }
}

export function useFolderNav(start) {
  const h = useHistory(Array.isArray(start) ? start : [start])
  return {
    path: h.at,
    canBack: h.canBack,
    canForward: h.canForward,
    canUp: h.at.length > 1,
    goTo: h.go,
    goBack: h.back,
    goForward: h.forward,
    goUp: () => h.at.length > 1 && h.go(h.at.slice(0, -1))
  }
}
