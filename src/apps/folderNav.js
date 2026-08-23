import { useReducer } from 'react'

export const navInit = (start) =>
  ({ path: Array.isArray(start) ? start : [start], back: [], fwd: [] })

// Explorer's back/forward semantics: going somewhere new drops the forward trail.
export function navReduce(s, action) {
  switch (action.type) {
    case 'go':
      return { path: action.path, back: [...s.back, s.path], fwd: [] }
    case 'back':
      return s.back.length
        ? { path: s.back[s.back.length - 1], back: s.back.slice(0, -1), fwd: [s.path, ...s.fwd] }
        : s
    case 'forward':
      return s.fwd.length
        ? { path: s.fwd[0], back: [...s.back, s.path], fwd: s.fwd.slice(1) }
        : s
    default:
      return s
  }
}

export function useFolderNav(start) {
  const [nav, dispatch] = useReducer(navReduce, start, navInit)
  return {
    path: nav.path,
    canBack: nav.back.length > 0,
    canForward: nav.fwd.length > 0,
    canUp: nav.path.length > 1,
    goTo: (path) => dispatch({ type: 'go', path }),
    goBack: () => dispatch({ type: 'back' }),
    goForward: () => dispatch({ type: 'forward' }),
    goUp: () => nav.path.length > 1 && dispatch({ type: 'go', path: nav.path.slice(0, -1) })
  }
}
