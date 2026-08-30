import { useRef, useState } from 'react'
import {
  canMove, deal, draw, isRed, isWon, move, pileOf, rankLabel, sendToFoundation,
  SUIT_NAMES, SUIT_SYMBOLS, SUITS
} from './solitaire.js'

// 솔리테어(클론다이크). 판은 이 컴포넌트 안에서만 산다 — store에도 세이브에도
// 넣지 않는다. 창을 닫으면 판이 끝난다(실제 윈도우 솔리테어와 같다).
//
// 옮기는 길이 둘이고 둘 다 남긴다:
//   ① 끌어다 놓기 — 포인터 이벤트 하나로 마우스와 손가락을 같이 받는다. HTML5
//      drag 는 터치에서 아예 오지 않고, 오더라도 유령이 브라우저 것이라 손가락
//      아래 카드가 따라오지 않는다. 유령은 여기서 직접 그린다.
//   ② 카드를 누르고 → 놓을 자리를 누르기
// ②도 남긴다 — 좁은 화면에서는 겨누는 것보다 두 번 누르는 편이 확실하다.
// 세 길 모두 applyMove 하나를 지나므로 규칙이 갈릴 수 없다.

// 새 판의 시드. 화면이 정한다 — 규칙 쪽은 시드를 받기만 한다.
const newSeed = () => Date.now()

function CardFace({ card }) {
  const symbol = SUIT_SYMBOLS[card.suit]
  return (
    <span className={`sol-face${isRed(card) ? ' sol-red' : ''}`}>
      <span className="sol-corner">{rankLabel(card.rank)}<span className="sol-corner-suit">{symbol}</span></span>
      <span className="sol-pip" aria-hidden="true">{symbol}</span>
    </span>
  )
}

// 카드 한 장의 접근성 이름. 기호(♠)는 스크린 리더가 제대로 읽지 못한다.
const cardName = (card) => (card.faceUp ? `${SUIT_NAMES[card.suit]} ${rankLabel(card.rank)}` : '뒤집힌 카드')

// 산·뽑은 자리·기초 더미의 한 칸. 작업 더미는 쌓임이 달라 따로 그린다.
//
// Solitaire 안에 정의하지 말 것: 렌더마다 새 컴포넌트 타입이 되어 React가 이
// 버튼의 DOM 노드를 통째로 갈아 끼운다. 창은 pointerdown에 focus로 z를 올리므로
// 누르는 순간 리렌더가 나고, mousedown과 mouseup이 서로 다른 노드에 떨어져
// 브라우저가 click을 아예 만들지 않는다.
function Slot({ cards, label, held = false, lifted = false, highlight = false, onClick, onDoubleClick, handlers }) {
  const top = cards[cards.length - 1]
  return (
    <button type="button"
      className={`sol-slot${top ? '' : ' sol-slot-empty'}${highlight ? ' sol-drop' : ''}`}
      onClick={onClick} onDoubleClick={onDoubleClick} {...handlers}
      aria-pressed={top ? held : undefined}
      aria-label={top ? `${label}, ${cardName(top)}` : `${label}, 비어 있음`}>
      {top ? (top.faceUp
        ? <span className={`sol-card${held ? ' sol-card-held' : ''}${lifted ? ' sol-lifted' : ''}`}><CardFace card={top} /></span>
        : <span className="sol-card sol-card-back" />) : null}
    </button>
  )
}

// 지금 이 카드 묶음을 받아 줄 수 있는 더미 전부. 끌기 시작할 때 한 번만 센다.
function dropTargetsFor(state, from) {
  const all = [...state.foundations.map((_, i) => `f${i}`), ...state.tableau.map((_, i) => `t${i}`)]
  return new Set(all.filter((to) => canMove(state, from.pile, from.index, to)))
}

// 쌓인 카드의 세로 위치. 뒤집힌 카드는 8px, 앞면은 22px씩 내려 겹친다.
function stackOffset(pile, index) {
  let y = 0
  for (let i = 0; i < index; i++) y += pile[i].faceUp ? 22 : 8
  return y
}

export default function Solitaire() {
  const [state, setState] = useState(() => deal(newSeed()))
  const [held, setHeld] = useState(null)
  // 지금 끌고 있는 카드와 유령의 자리. 눌러서 집는 것(held)과 달리 놓는 순간 사라진다.
  // { pile, index, x, y, w, ox, oy } — x·y 는 포인터, ox·oy 는 카드 안에서 잡은 자리.
  const [drag, setDrag] = useState(null)
  // 누르고 아직 안 움직인 것. 몇 픽셀 넘게 움직여야 끌기가 된다 — 안 그러면 탭이 끌기로 샌다.
  const press = useRef(null)
  // 끌어 놓은 직후 따라오는 click 한 번을 흘려보내는 표시.
  const dropped = useRef(false)
  const won = isWon(state)
  const targets = drag ? dropTargetsFor(state, drag) : null

  const restart = () => {
    setState(deal(newSeed()))
    setHeld(null)
  }

  // 옮기기의 단일 통로. 누르기·끌기 둘 다 여기로 들어온다.
  const applyMove = (from, to) => {
    const next = move(state, from.pile, from.index, to)
    if (next) setState(next)
    return !!next
  }

  // 놓을 자리를 눌렀다. 규칙에 맞으면 옮기고, 아니면 집은 것을 놓아 준다.
  const dropOn = (pile) => {
    if (!held) return
    applyMove(held, pile)
    setHeld(null)
  }

  // 끌기. 누르면 기억만 하고, 몇 픽셀 움직이면 그때 집는다 — 탭과 끌기가 같은
  // 손가락에서 갈리는 자리다. 집은 뒤로는 포인터를 이 카드가 붙잡아(setPointerCapture)
  // 손가락이 카드 밖으로 나가도 계속 받는다. 놓는 자리는 뗀 좌표 밑의 더미(data-pile)로
  // 안다 — 유령은 pointer-events 가 없어서 그 밑이 보인다.
  const DRAG_START = 6
  const dragProps = (pile, index) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return
      const r = e.currentTarget.getBoundingClientRect()
      press.current = { pile, index, x: e.clientX, y: e.clientY, w: r.width, ox: e.clientX - r.left, oy: e.clientY - r.top }
      dropped.current = false
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    onPointerMove: (e) => {
      const p = press.current
      if (!p) return
      if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START) return
      setDrag({ ...p, x: e.clientX, y: e.clientY })
      if (held) setHeld(null)
    },
    onPointerUp: (e) => {
      press.current = null
      if (!drag) return
      const to = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pile]')?.dataset.pile
      if (to && to !== drag.pile) applyMove(drag, to)
      // 끈 뒤에 오는 click 은 이 카드를 다시 집으려 든다. 옮겼든 못 옮겼든 흘려보낸다.
      dropped.current = true
      setDrag(null)
    },
    onPointerCancel: () => { press.current = null; setDrag(null) }
  })

  // 놓을 수 있는 자리. 유령 밑의 요소에서 이 표식을 찾아 어느 더미인지 안다.
  const dropProps = (pile) => ({ 'data-pile': pile })

  // 끌고 있는 카드들 — 유령이 그리고, 제자리 것은 숨긴다.
  const lifted = drag ? pileOf(state, drag.pile).slice(drag.index) : []
  const isLifted = (pile, index) => Boolean(drag && drag.pile === pile && index >= drag.index)

  // 카드를 눌렀다. 집은 게 없으면 집고, 있으면 그 자리로 옮겨 본다.
  const clickCard = (pile, index, card) => {
    // 손가락으로 끌어 놓은 직후에도 브라우저는 click 을 한 번 더 보낸다.
    // 그대로 두면 방금 옮긴 카드가 다시 집힌 채로 남는다.
    if (dropped.current) { dropped.current = false; return }
    if (!card.faceUp) return
    if (held && (held.pile !== pile || held.index !== index)) {
      // 옮길 수 없는 자리를 눌렀으면 그 카드를 새로 집는다 — 아무 일도 안 일어나는
      // 클릭은 "왜 안 되지"만 남긴다.
      const next = move(state, held.pile, held.index, pile)
      if (next) {
        setState(next)
        setHeld(null)
        return
      }
    }
    setHeld((h) => (h && h.pile === pile && h.index === index ? null : { pile, index }))
  }

  // 더블클릭 = 기초 더미로 보내기. 갈 곳이 없으면 아무 일도 없다.
  const autoSend = (pile) => {
    const next = sendToFoundation(state, pile)
    if (next) {
      setState(next)
      setHeld(null)
    }
  }

  // 집힌 표시. 눌러서 집은 것과 끌고 있는 것을 같은 모양으로 알린다(같은 뜻이다).
  const isHeld = (pile, index) => [held, drag].some((h) => !!h && h.pile === pile && h.index === index)

  return (
    <div className="sol">
      <div className="sol-bar">
        <button type="button" className="sol-btn" onClick={restart}>새 게임</button>
        {/* 이겼다는 사실을 색이 아니라 문장으로 말한다. */}
        <p className="sol-status" role="status">
          {won ? '완성했습니다. 축하합니다!' : `남은 카드 ${state.stock.length}장`}
        </p>
      </div>

      <div className="sol-top">
        <Slot cards={state.stock} label="산" onClick={() => setState(draw(state))} />
        <Slot cards={state.waste} label="뽑은 카드"
          held={isHeld('waste', state.waste.length - 1)}
          lifted={isLifted('waste', state.waste.length - 1)}
          onClick={() => {
            const top = state.waste.length - 1
            if (top >= 0) clickCard('waste', top, state.waste[top])
          }}
          onDoubleClick={() => autoSend('waste')}
          handlers={state.waste[state.waste.length - 1]?.faceUp
            ? dragProps('waste', state.waste.length - 1) : undefined} />
        {/* 기초 더미는 3열이 아니라 4열부터 시작한다(CSS가 격자 칸을 건너뛴다) —
            산 묶음과 갈라 놓는 빈 칸이 실제 솔리테어의 배치다. */}
        {SUITS.map((suit, i) => (
          <Slot key={suit} cards={state.foundations[i]} label={`${SUIT_NAMES[suit]} 기초 더미`}
            highlight={!!targets?.has(`f${i}`)} onClick={() => dropOn(`f${i}`)}
            handlers={dropProps(`f${i}`)} />
        ))}
      </div>

      <div className="sol-table">
        {state.tableau.map((pile, col) => (
          /* 놓는 자리는 열 전체다 — 쌓인 카드 위 어디에 떨어뜨려도 같은 더미로 간다. */
          <div className={`sol-col${targets?.has(`t${col}`) ? ' sol-drop' : ''}`} key={col} {...dropProps(`t${col}`)}>
            {/* 빈 더미에도 놓을 자리가 있어야 K를 옮길 수 있다. */}
            <button type="button" className="sol-slot sol-slot-empty sol-col-base"
              onClick={() => dropOn(`t${col}`)}
              aria-label={`작업 더미 ${col + 1}${pile.length ? '' : ', 비어 있음'}`} />
            {pile.map((card, i) => (
              <button type="button" key={card.id}
                className={`sol-stacked${isHeld(`t${col}`, i) ? ' sol-stacked-held' : ''}`}
                {...(card.faceUp ? dragProps(`t${col}`, i) : {})}
                /* 쌓임은 흐름이 아니라 좌표다 — 뒤집힌 카드는 좁게, 앞면은 넓게 겹친다. */
                style={{ top: stackOffset(pile, i) }}
                onClick={() => (card.faceUp ? clickCard(`t${col}`, i, card) : undefined)}
                onDoubleClick={() => card.faceUp && autoSend(`t${col}`)}
                aria-pressed={card.faceUp ? isHeld(`t${col}`, i) : undefined}
                aria-label={`작업 더미 ${col + 1}, ${cardName(card)}`}>
                <span className={`sol-card${card.faceUp ? '' : ' sol-card-back'}${isHeld(`t${col}`, i) ? ' sol-card-held' : ''}${isLifted(`t${col}`, i) ? ' sol-lifted' : ''}`}>
                  {card.faceUp ? <CardFace card={card} /> : null}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 손가락을 따라다니는 유령. 창 밖 좌표라 fixed 다. 마우스도 같은 유령을 쓴다. */}
      {drag && lifted.length > 0 && (
        <div className="sol-ghost" style={{ left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w }} aria-hidden="true">
          {lifted.map((card, i) => (
            <span key={card.id} className="sol-card sol-card-held sol-ghost-card" style={{ top: i * 22 }}>
              <CardFace card={card} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
