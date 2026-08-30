import { useEffect, useState } from 'react'

// 지뢰찾기 — 클래식 9×9·지뢰 10개. windowsGame에서 옮겨왔다.
//
// 판은 이 컴포넌트 안에서만 산다. store에도 세이브에도 들어가지 않는다 —
// 딴짓거리는 게임의 상태를 한 톨도 건드리지 않는다. 이기든 지든 아무것도
// 기록되지 않고, 창을 닫으면 판이 사라진다(진짜 지뢰찾기와 같다).
//
// 바깥이 이것을 아는 유일한 통로는 '창이 열려 있다'는 사실 하나다 —
// 요청을 해결하는 순간 팀장이 그걸 본다(store.js의 slacking).

export const ROWS = 9
export const COLS = 9
export const MINES = 10

export function freshBoard() {
  return Array.from({ length: ROWS * COLS }, () => ({ mine: false, open: false, flag: false, adj: 0 }))
}

function neighbors(i) {
  const r = Math.floor(i / COLS)
  const c = i % COLS
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push(nr * COLS + nc)
    }
  }
  return out
}

// 지정한 칸들에 지뢰를 놓고 모든 칸의 adj를 계산한다. 테스트가 판을 짜는 입구이기도 하다.
export function minedBoard(mines) {
  const next = freshBoard()
  for (const i of mines) next[i].mine = true
  for (let i = 0; i < next.length; i++) next[i].adj = neighbors(i).filter((n) => next[n].mine).length
  return next
}

// 첫 클릭 뒤에 지뢰를 배치한다 — safe 칸은 절대 지뢰가 아니다.
// 첫 클릭 전에 꽂아 둔 깃발은 살려서 옮긴다.
export function placeMines(board, safe, rand = Math.random) {
  const picks = new Set()
  while (picks.size < MINES) {
    const i = Math.floor(rand() * ROWS * COLS)
    if (i !== safe) picks.add(i)
  }
  const next = minedBoard(picks)
  for (let i = 0; i < next.length; i++) next[i].flag = board[i].flag
  return next
}

// 칸을 연다. 0칸이면 flood fill — 깃발 꽂힌 칸은 열지 않는다(클래식 규칙).
export function openCell(board, i) {
  if (board[i].open || board[i].flag) return board
  const next = board.map((c) => ({ ...c }))
  const queue = [i]
  while (queue.length > 0) {
    const cur = queue.pop()
    const cell = next[cur]
    if (cell.open) continue
    cell.open = true
    if (!cell.mine && cell.adj === 0) {
      for (const n of neighbors(cur)) if (!next[n].open && !next[n].flag) queue.push(n)
    }
  }
  return next
}

export function toggleFlag(board, i) {
  if (board[i].open) return board
  const next = board.map((c) => ({ ...c }))
  next[i].flag = !next[i].flag
  return next
}

// 승리 = 지뢰가 아닌 칸을 전부 열었다. 깃발은 승패와 무관하다(클래식 규칙).
export const isWon = (board) => board.every((c) => c.mine || c.open)
export const isLost = (board) => board.some((c) => c.mine && c.open)
export const flagCount = (board) => board.filter((c) => c.flag).length

// LED 카운터 표기. 클래식처럼 3자리, 음수는 '-'가 한 자리를 먹는다.
const led = (n) =>
  n < 0 ? `-${String(Math.min(99, -n)).padStart(2, '0')}` : String(Math.min(999, n)).padStart(3, '0')

const numberName = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟']

export default function Minesweeper() {
  const [board, setBoard] = useState(freshBoard)
  // 첫 클릭 전에는 지뢰가 없다 — 배치는 첫 클릭이 한다.
  const [armed, setArmed] = useState(false)
  const [seconds, setSeconds] = useState(0)
  // 깃발 모드. 우클릭은 폰에 없다 — 토글 하나로 마우스와 손가락이 같은 길을 쓴다.
  const [flagging, setFlagging] = useState(false)

  const lost = isLost(board)
  const won = armed && isWon(board)
  const done = lost || won

  useEffect(() => {
    if (!armed || done) return
    const t = setInterval(() => setSeconds((s) => Math.min(999, s + 1)), 1000)
    return () => clearInterval(t)
  }, [armed, done])

  const reset = () => {
    setBoard(freshBoard())
    setArmed(false)
    setSeconds(0)
  }

  const leftClick = (i) => {
    if (done || board[i].open) return
    if (flagging) return setBoard(toggleFlag(board, i))
    if (board[i].flag) return
    const base = armed ? board : placeMines(board, i)
    if (!armed) setArmed(true)
    setBoard(openCell(base, i))
  }

  // 우클릭 = 깃발. 브라우저 메뉴를 막는다.
  const rightClick = (e, i) => {
    e.preventDefault()
    if (done || board[i].open) return
    setBoard(toggleFlag(board, i))
  }

  const face = won ? '😎' : lost ? '💀' : '🙂'

  return (
    <div className="ms">
      <div className="ms-panel">
        <div className="ms-head">
          <span className="ms-led" aria-label={`남은 지뢰 ${MINES - flagCount(board)}개`}>
            {led(MINES - flagCount(board))}
          </span>
          <button type="button" className="ms-face" onClick={reset}
                  aria-label={won ? '이겼다 — 새 판' : lost ? '졌다 — 새 판' : '새 판'}>
            {face}
          </button>
          <span className="ms-led" aria-label={`경과 ${seconds}초`}>{led(seconds)}</span>
        </div>
        <div className="ms-grid" role="grid" aria-label="지뢰밭 9×9"
             onContextMenu={(e) => e.preventDefault()}>
          {board.map((cell, i) => {
            // 지면 지뢰가 전부 드러나고, 이기면 남은 지뢰에 깃발이 저절로 꽂힌다(클래식).
            const shown = cell.open || (lost && cell.mine)
            const flagged = !shown && (cell.flag || (won && cell.mine))
            const r = Math.floor(i / COLS) + 1
            const c = (i % COLS) + 1
            return (
              <button key={i} type="button"
                className={['ms-cell', shown ? 'ms-open' : '',
                  shown && cell.mine ? (cell.open ? 'ms-boom' : 'ms-mine') : '',
                  shown && !cell.mine && cell.adj > 0 ? `ms-n${cell.adj}` : ''].filter(Boolean).join(' ')}
                onClick={() => leftClick(i)}
                onContextMenu={(e) => rightClick(e, i)}
                aria-label={`${r}행 ${c}열` + (flagged ? ' 깃발' : shown
                  ? cell.mine ? ' 지뢰' : cell.adj > 0 ? ` 주변 지뢰 ${numberName[cell.adj]}` : ' 빈 칸'
                  : ' 안 연 칸')}>
                {flagged ? '🚩' : shown && cell.mine ? '💣' : shown && cell.adj > 0 ? cell.adj : null}
              </button>
            )
          })}
        </div>
        {/* 깃발을 우클릭으로만 꽂게 두면 폰에서 판을 끝낼 수 없다. */}
        <button type="button" className={'ms-mode' + (flagging ? ' on' : '')}
                onClick={() => setFlagging((f) => !f)} aria-pressed={flagging}>
          🚩 깃발 모드{flagging ? ' 켜짐' : ''}
        </button>
      </div>
    </div>
  )
}
