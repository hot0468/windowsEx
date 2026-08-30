// 솔리테어(클론다이크) 규칙. windowsGame에서 옮겨왔다.
//
// 판은 창 안에서만 살고 store에도 세이브에도 들어가지 않는다 — 지뢰찾기와 같다.
// 섞기는 시드를 받아 돌리고 시드는 화면이 정한다. 그래야 테스트가
// "이 시드의 판은 이렇게 깔린다"를 단언할 수 있다.

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs']

// 무늬 기호. 화면은 이 표만 읽는다(컴포넌트에 기호를 다시 적지 않는다).
export const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

// 스크린 리더용 이름. 기호(♠)는 읽히지 않거나 "검은 스페이드 슈트"로 길게 읽힌다.
export const SUIT_NAMES = { spades: '스페이드', hearts: '하트', diamonds: '다이아몬드', clubs: '클럽' }

// A·J·Q·K만 글자다. 숫자를 그대로 쓰면 1·11·12·13이 카드에 뜬다.
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
export const rankLabel = (rank) => RANK_LABELS[rank] ?? String(rank)

// 빨강 무늬. "같은 색 위에는 못 놓는다"는 규칙의 유일한 판단 지점이다.
export const isRed = (card) => card.suit === 'hearts' || card.suit === 'diamonds'

// 한 번에 뽑는 장수. 1장 뽑기(윈도우 기본)다 — 3장 뽑기로 바꾸려면 이 값만 고친다.
export const DRAW_COUNT = 1

// mulberry32. 검증된 상수를 그대로 쓴다.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 52장 한 벌. 순서는 항상 같고 섞는 것은 deal이 한다.
const freshDeck = () => SUITS.flatMap((suit) =>
  Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 1}`, suit, rank: i + 1, faceUp: false })))

// 시드 하나로 한 판을 깐다. 작업 더미는 1·2·3…7장이고 각 더미의 맨 위 한 장만
// 앞면이다(클론다이크 규칙). 남은 24장이 산이 된다.
export function deal(seed) {
  const rand = mulberry32(seed)
  const deck = freshDeck()
  // Fisher-Yates. 앞에서부터 섞으면 분포가 치우친다 — 뒤에서부터가 정석이다.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const tableau = []
  let at = 0
  for (let col = 0; col < 7; col++) {
    const pile = deck.slice(at, at + col + 1).map((c) => ({ ...c }))
    at += col + 1
    pile[pile.length - 1].faceUp = true
    tableau.push(pile)
  }
  return { stock: deck.slice(at).map((c) => ({ ...c })), waste: [], foundations: SUITS.map(() => []), tableau }
}

// 더미 하나의 카드 목록. 없는 이름이면 빈 배열이다(화면이 실수해도 터지지 않는다).
export function pileOf(state, pile) {
  if (pile === 'stock') return state.stock
  if (pile === 'waste') return state.waste
  const index = Number(pile.slice(1))
  const piles = pile[0] === 'f' ? state.foundations : state.tableau
  return piles[index] ?? []
}

const topOf = (cards) => cards[cards.length - 1]

// 기초 더미에 놓을 수 있는가 — 같은 무늬로 A부터 한 장씩.
function acceptsOnFoundation(foundation, card) {
  const top = topOf(foundation)
  if (!top) return card.rank === 1
  return top.suit === card.suit && card.rank === top.rank + 1
}

// 작업 더미에 놓을 수 있는가 — 색을 번갈아 한 장씩 내려가고, 빈 자리는 K만.
function acceptsOnTableau(tableau, card) {
  const top = topOf(tableau)
  if (!top) return card.rank === 13
  return isRed(top) !== isRed(card) && card.rank === top.rank - 1
}

// from의 cardIndex번째 카드부터를 to로 옮길 수 있는가. 여러 장을 한 번에 옮기는
// 것은 작업 더미끼리뿐이다 — 기초 더미는 한 장씩만 받는다.
export function canMove(state, from, cardIndex, to) {
  if (from === to || from === 'stock' || to === 'stock' || to === 'waste') return false
  const source = pileOf(state, from)
  const moving = source.slice(cardIndex)
  if (moving.length === 0) return false
  // 뒤집힌 카드는 잡을 수 없다 — 무엇인지 모르는 카드를 옮기는 규칙은 없다.
  if (moving.some((c) => !c.faceUp)) return false
  if (to[0] === 'f') {
    if (moving.length !== 1) return false
    return acceptsOnFoundation(pileOf(state, to), moving[0])
  }
  // 작업 더미로 옮기는 여러 장은 그 자체로 이미 규칙에 맞게 이어져 있어야 한다.
  for (let i = 1; i < moving.length; i++) if (!acceptsOnTableau([moving[i - 1]], moving[i])) return false
  return acceptsOnTableau(pileOf(state, to), moving[0])
}

function withPile(state, pile, cards) {
  if (pile === 'stock') return { ...state, stock: cards }
  if (pile === 'waste') return { ...state, waste: cards }
  const index = Number(pile.slice(1))
  if (pile[0] === 'f') return { ...state, foundations: state.foundations.map((p, i) => (i === index ? cards : p)) }
  return { ...state, tableau: state.tableau.map((p, i) => (i === index ? cards : p)) }
}

// 옮긴다. 규칙에 안 맞으면 null — 화면은 그때 아무 일도 일으키지 않는다.
// 드러난 뒤집힌 카드는 여기서 뒤집는다. 화면에 맡기면 통로마다(클릭·더블클릭)
// 같은 코드를 적게 되고 한쪽을 반드시 빠뜨린다.
export function move(state, from, cardIndex, to) {
  if (!canMove(state, from, cardIndex, to)) return null
  const source = pileOf(state, from)
  const moving = source.slice(cardIndex)
  const rest = source.slice(0, cardIndex)
  const exposed = rest[rest.length - 1]
  const restFlipped = exposed && !exposed.faceUp
    ? [...rest.slice(0, -1), { ...exposed, faceUp: true }]
    : rest
  let next = withPile(state, from, restFlipped)
  next = withPile(next, to, [...pileOf(next, to), ...moving])
  return next
}

// 산에서 한 장 뽑는다. 산이 비어 있으면 뽑아 놓은 자리를 되돌려 다시 산으로
// 만든다(뒤집어 쌓으므로 순서가 뒤집힌다 — 실제 카드와 같다).
export function draw(state) {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return state
    return { ...state, stock: [...state.waste].reverse().map((c) => ({ ...c, faceUp: false })), waste: [] }
  }
  const count = Math.min(DRAW_COUNT, state.stock.length)
  const drawn = state.stock.slice(state.stock.length - count).map((c) => ({ ...c, faceUp: true }))
  return {
    ...state,
    stock: state.stock.slice(0, state.stock.length - count),
    // 뽑은 순서대로 쌓인다 — 맨 뒤가 지금 쓸 수 있는 한 장이다.
    waste: [...state.waste, ...drawn.reverse()]
  }
}

// 더블클릭 자동 이동: 이 카드를 받아 줄 기초 더미를 찾아 옮긴다. 없으면 null
// (작업 더미로는 자동으로 보내지 않는다 — 어디로 갈지가 하나로 정해지지 않는다).
export function sendToFoundation(state, from) {
  const cards = pileOf(state, from)
  if (cards.length === 0) return null
  const index = cards.length - 1
  for (let i = 0; i < state.foundations.length; i++) {
    const next = move(state, from, index, `f${i}`)
    if (next) return next
  }
  return null
}

// 52장이 전부 기초 더미에 올라갔는가.
export const isWon = (state) => state.foundations.reduce((n, pile) => n + pile.length, 0) === 52
