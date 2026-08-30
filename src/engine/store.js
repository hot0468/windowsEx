import { create } from 'zustand'
import scenario from '../scenarios/workday.json'
import { checkEtiquette, checkGoal, checkOutbound } from './goal.js'
import { play } from '../shell/sound.js'

const SAVE_KEY = 'windowsEx.save'        // the player's explicit checkpoint
const SESSION_KEY = 'windowsEx.session'  // autosaved, so a refresh continues where you were
const PENDING_KEY = 'windowsEx.pendingLoad'

// The fields worth carrying across sessions: progress, not view state.
export const PROGRESS = ['windows', 'nextZ', 'msgCount', 'readMails', 'seenThreads', 'extraMails',
  'starred', 'pinned', 'restored', 'showHidden', 'sheetEdits', 'unlocked', 'grants', 'extraMessages', 'pendingAsks', 'bookings',
  'day', 'misses', 'failed', 'scratch', 'ended', 'locks', 'overtime', 'slips', 'edits', 'drawn', 'vpn', 'mining', 'cleaned',
  'roomQuestions', 'ripples', 'mercy', 'minedSince', 'bookedFor', 'digging', 'rumor', 'chatted', 'routerDown',
  'mfpFixed', 'beatQueue', 'beatAsk', 'branches', 'dreamt', 'openedHistory', 'readBack', 'myNotes', 'posted', 'wikiEdits', 'tiles', 'myBookmarks', 'hinted', 'dayAt', 'sealed', 'frozen', 'placed', 'uploaded', 'slacked', 'sentMails', 'visited', 'traces']

// 세이브에 담기는 것은 그때 열려 있던 질문의 사본이다(pendingAsks). 그래서
// 시나리오의 대사나 정답을 고쳐도 이미 열려 있던 질문은 옛 사본 그대로 남아,
// 파일에는 새 말이 보이는데 대화는 옛 말을 하고 옛 답을 받는다 — 만드는 동안
// 플레이하면 이것이 버그처럼 보인다.
//
// 그래서 시나리오의 질문마다 자리표를 하나 찍어 둔다. 자리표는 훑는 순서로
// 매기므로 대사나 정답이 바뀌어도 그대로다 — 묻는 말과 정답으로 짝을 찾으면
// 정작 정답이 바뀐 판에서 짝을 잃는다. 질문을 새로 넣거나 빼면 그 뒤 자리표가
// 밀리는데, 그때는 옛 방식으로 한 번 더 찾아본다.
const PATH = '__at'

export function stampAsks(scenario) {
  let n = 0
  const chain = (a, owner) => {
    let d = 0
    for (let x = a; x; x = x.then) {
      // 자리표는 세이브에 같이 실려야 한다. 숨기면 저장될 때 떨어져 나가,
      // 다음에 켤 때 짚을 것이 없다.
      if (!x[PATH]) x[PATH] = owner + ':' + d
      d++
    }
  }
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      if (node.ask) chain(node.ask, 'a' + n++)
      Object.values(node).forEach(walk)
    }
  }
  walk(scenario)
  return scenario
}

// 자리표가 없던 옛 세이브를 위한 되짚기 — 묻는 말과 정답이 같으면 같은 질문.
const askOf = (a) => (a?.placeholder ?? '') + '|' + JSON.stringify(a?.accept ?? a?.files ?? null)

export function freshenAsks(scenario, pending = {}) {
  const byPath = new Map()
  // 되짚기는 대화별로 나눠 둔다. 묻는 말과 정답만 보면 남의 대화 질문을
  // 끌어다 꽂는다 — 대화가 끝난 자리(null)가 부름의 마지막 빈칸 질문과
  // 열쇠가 같아, 지현이가 부름의 대사를 말한 적이 있다.
  const byText = new Map()
  const owner = new Map()
  const put = (thread, a) => {
    if (!byText.has(thread)) byText.set(thread, new Map())
    byText.get(thread).set(askOf(a), a)
  }
  const walk = (node, thread) => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, thread))
    if (node && typeof node === 'object') {
      const t = node.thread ?? node.id ?? thread
      if (node.ask) {
        for (let x = node.ask; x; x = x.then) {
          if (x[PATH]) { byPath.set(x[PATH], x); owner.set(x[PATH], t) }
          if (t) put(t, x)
        }
      }
      Object.values(node).forEach((x) => walk(x, t))
    }
  }
  walk(stampAsks(scenario), null)

  const out = {}
  for (const [id, a] of Object.entries(pending)) {
    // 열린 질문이 없는 자리는 없는 채로 둔다. 여기서 무엇이든 끌어오면
    // 끝난 대화가 되살아난다.
    if (!a || typeof a !== 'object') { out[id] = a; continue }
    // 자리표로 찾을 때도 임자를 확인한다. 자리표만 보면 잘못 꽂힌 질문도
    // '찾았다' 가 되어 그대로 남는다.
    const viaPath = a[PATH] && owner.get(a[PATH]) === id ? byPath.get(a[PATH]) : null
    const mine = viaPath ?? byText.get(id)?.get(askOf(a))
    if (mine) { out[id] = mine; continue }
    // 남의 대화 질문이 이 자리에 꽂혀 있으면 세이브가 상한 것이다. 예전
    // 되짚기가 그렇게 만들었고, 그대로 두면 최민서가 부름의 대사를 한다.
    // 고칠 방법은 없고 비우는 것이 맞다 — 그 대화는 할 말이 없어질 뿐이다.
    const elsewhere = a[PATH] && owner.has(a[PATH]) && owner.get(a[PATH]) !== id
    out[id] = elsewhere ? null : a
  }
  return out
}

const snapshot = (s) => {
  const out = { at: Date.now() }
  for (const k of PROGRESS) out[k] = s[k]
  return out
}

function read(key) {
  try {
    const save = JSON.parse(localStorage.getItem(key))
    return save && Array.isArray(save.windows) ? save : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// 게임 안의 시각. 실제 시계를 그대로 걸면 토요일 밤에 플레이하는 사람이
// 게임 속에서도 주말 야근을 하고 있는 것처럼 보인다 — 화면의 날짜와 게임의
// 날짜가 다른 이야기를 한다.
//
// 날짜는 그날 것을 쓰고, 시각은 출근 시각에서 시작해 논 만큼 흐른다. 실제
// 1분이 게임 30분이다: 하루를 십몇 분에 끝내도 퇴근 무렵이 되고, 오래 붙들고
// 있어도 퇴근 시각을 넘지 않는다. 야근을 고른 날은 저녁부터 센다.
const CLOCK_SPEED = 30
const MORNING = 9 * 60
const EVENING = 18 * 60
const NIGHT_IN = 19 * 60
const NIGHT_OUT = 23 * 60 + 30

export function gameClock(scenario, { day = 1, overtime = {}, dayAt = 0 } = {}, nowMs = Date.now()) {
  const night = Boolean(overtime[day])
  const from = night ? NIGHT_IN : MORNING
  const until = night ? NIGHT_OUT : EVENING
  const run = dayAt ? Math.floor((nowMs - dayAt) / 60000) * CLOCK_SPEED : 0
  const at = Math.min(from + Math.max(0, run), until)
  const p = (v) => String(v).padStart(2, '0')
  return {
    date: scenario?.days?.[day - 1]?.date ?? '',
    time: `${p(Math.floor(at / 60))}:${p(at % 60)}`
  }
}

// 오늘 밤 부름이 보낼 것. 거절했으면 아무 밤도 오지 않고, 이미 보낸 밤은
// 다시 오지 않는다.
export function callerNight(s) {
  const su = s.scenario?.summons
  if (!su?.nights || s.grants[su.off]) return null
  const beat = su.nights[s.day]
  if (!beat || s.grants['called:' + s.day]) return null
  // 계정은 플레이어가 본 것을 안다. 그 화면을 연 적이 있으면 그 말부터
  // 시작한다 — 안 본 사람에게 말하면 협박이지만, 본 사람에게는 확인이다.
  return beat.seen && s.grants[beat.seen.grant]
    ? { ...beat, lines: [...beat.seen.lines, ...beat.lines] }
    : beat
}

export function savedAt() {
  return read(SAVE_KEY)?.at ?? null
}

// Normally a fresh page picks up the autosave. Loading the checkpoint reloads the
// page (see loadGame) so every app remounts clean, and this flag — set just before
// that reload — tells the new session to start from the checkpoint instead.
function startingPoint() {
  try {
    if (sessionStorage.getItem(PENDING_KEY) === '1') {
      sessionStorage.removeItem(PENDING_KEY)
      return read(SAVE_KEY)
    }
  } catch {
    // fall through to the autosave
  }
  return read(SESSION_KEY)
}

const restored = startingPoint()

let winId = Math.max(0, ...(restored?.windows ?? []).map((w) => w.id))
let toastId = 0

// How long the day waits between two things being said.
const BEAT_GAP = 3600
// 한 줄씩 말할 때의 간격. 이 줄들이 다 나올 때까지 다음 대화는 기다린다.
// 마치기를 누르고 이름 없는 계정이 말을 걸기까지.
export const CALLER_DELAY = 2200
const SAY_FIRST = 1200
const SAY_GAP = 1500
const sayTime = (count, gap = SAY_GAP) => SAY_FIRST + Math.max(0, count - 1) * gap
// And how long between consecutive lines of one conversation opening up:
// short enough to read as one person typing, long enough to read each toast.
const NUDGE_GAP = 2200
// 부고를 본 뒤 마지막 말들이 도착하는 속도. 사람이 바뀔 때 한 박자 쉬고,
// 마지막 줄 뒤에는 읽을 만큼 두었다가 엔딩으로 넘어간다.
// 마지막 장면은 일부러 느리다. 여기서 오는 말은 처리할 일이 아니라 읽을
// 것이다 — 평소 속도로 흘리면 다 지나간 뒤에야 무슨 말이었는지 안다.
const SEAL_SAY = 3400
const SEAL_TURN = 3800
// 사고 기사가 뜨고 나서 계정이 입을 열 때까지 — 다 읽을 만큼은 아니어도,
// 무엇이 뜬 것인지 알아볼 만큼은 된다.
const SEAL_READ = 5200
const SEAL_TAIL = 3600
// Who asks for the IP, and the thread's own `wait` — the scenario names the
// same grant, so the conversation and its trigger cannot drift apart.
export const IP_THREAD = 'security'
export const IP_ASKED = 'ip_asked'
// What a conversation's `gate` names once the player has met the wall a
// program's absence puts up.
export const missingKey = (program) => `missing:${program}`
// The last thing the day said asked a question, and it has not been answered.
// Only the day's own questions hold it up: a thread's standing question is
// always there and would stop the day before it started.
const asking = (s) => Boolean(s.beatAsk && s.pendingAsks[s.beatAsk])

export const useGame = create((set, get) => ({
  scenario,
  booted: false,
  toast: null,
  crashed: false,
  // Which program took the machine down, so the reboot knows who to blame.
  crashSource: null,
  locked: false,
  windows: restored?.windows ?? [],
  // what the browser's console and network log show right now; the devtools window draws them
  browserDev: { console: [], network: [] },
  setBrowserDev: (dev) => set({ browserDev: dev }),
  nextZ: restored?.nextZ ?? 10,
  msgCount: restored?.msgCount ?? 0,
  readMails: restored?.readMails ?? {},
  starred: restored?.starred ?? {},
  pinned: restored?.pinned ?? [],
  restored: restored?.restored ?? {},
  showHidden: restored?.showHidden ?? false,
  sheetEdits: restored?.sheetEdits ?? {},
  // Which conversation each messenger is showing, and how much of it has been read.
  // Both live here so a toast can open a thread in an already-running window.
  openThread: {},
  // Which choices each conversation has moved on to — part of the exchange, so
  // it outlives the window the same way the messages do.
  branches: restored?.branches ?? {},
  seenThreads: restored?.seenThreads ?? {},
  // 대화마다 지난 기록을 몇 묶음까지 펼쳐 두었나. 한 번 연 기록은 다시 감추지
  // 않으므로 저장에 실린다.
  openedHistory: restored?.openedHistory ?? {},
  typing: {},
  extraMails: restored?.extraMails ?? [],
  extraMessages: restored?.extraMessages ?? {},
  // which small talk has already come, and on what day
  chatted: restored?.chatted ?? {},
  pendingAsks: freshenAsks(scenario, restored?.pendingAsks),
  // What the day still has to say, and the conversation it is waiting on
  // before it says the next thing.
  beatQueue: restored?.beatQueue ?? [],
  beatAsk: restored?.beatAsk ?? null,
  unlocked: restored?.unlocked ?? {},
  grants: restored?.grants ?? {},
  // Whether the travel blog has been read to the end. The photos go with it.
  // 부고를 본 뒤. 그 페이지가 떠 있던 창 하나만 남아 그 자리에 굳고, 마지막
  // 말들이 차례로 도착한 다음 게임이 끝난다. 그동안 아무것도 열리지 않는다.
  sealed: restored?.sealed ?? false,
  // 그 자리에 굳은 창. 이것만 스크롤이 서고, 뒤이어 뜨는 창들은 읽을 수 있다.
  frozen: restored?.frozen ?? null,
  // 옮기거나 이름을 바꾼 파일. 뷰(fsView)가 적용한다 — 원본 트리는 그대로다.
  placed: restored?.placed ?? {},
  // 드라이브 페이지에 올린 파일 id들. Task 4 가 쓴다.
  uploaded: restored?.uploaded ?? {},
  // 게임 창을 켜 둔 채로 일을 끝내다 팀장에게 걸렸는가. 한 번뿐이다.
  slacked: restored?.slacked ?? false,
  // 잘라낸 파일. 세이브에는 안 실린다.
  clipboard: null,
  dreamt: restored?.dreamt ?? false,
  // Whether 엄마's conversation has been unfolded all the way back. She answers
  // that once, and only for the player who went looking.
  readBack: restored?.readBack ?? false,

  bookings: restored?.bookings ?? {},
  day: restored?.day ?? 1,
  misses: restored?.misses ?? 0,
  failed: restored?.failed ?? false,
  ended: restored?.ended ?? false,
  locks: restored?.locks ?? 0,
  // Which days the player chose to stay late on, and whether tonight's offer
  // has been answered yet.
  overtime: restored?.overtime ?? {},
  // Whether the player has pressed "finish today" — view state, so a reload
  // simply asks for the click again.
  closing: false,
  // 하루가 기다리는 대화. 그 창을 닫을 때까지 저녁이 오지 않는다.
  awaitingCaller: null,
  // 내가 보낸 메일. 되돌려받은 것도 남긴다 — 잘못 보냈다는 것을
  // 보려면 무엇을 보냈는지가 남아 있어야 한다.
  sentMails: restored?.sentMails ?? [],
  // 이번 주에 실제로 열린 곳들. 최근이 앞이다.
  visited: restored?.visited ?? [],
  // 이 자리의 전 사용자가 남긴 흔적 중 본 것. 메모 서버의 끓긴 문장이 이걸로 이어진다.
  traces: restored?.traces ?? {},
  // Every wrong answer of the week, typed or mailed. Unlike misses this is
  // never reset: accuracy is judged over the whole week.
  slips: restored?.slips ?? 0,
  // Text files the player has typed into, kept by id on top of the scenario.
  edits: restored?.edits ?? {},
  // Which requests each day drew from the pool. Day one never draws.
  drawn: restored?.drawn ?? {},
  // A miner that came bundled with a security plugin: running until the task
  // is ended, and still installed until the antivirus removes it.
  mining: restored?.mining ?? false,
  cleaned: restored?.cleaned ?? false,
  // How many questions the anonymous room has been asked, which ripples have
  // already landed, and whether today's wrong answers are being forgiven.
  roomQuestions: restored?.roomQuestions ?? 0,
  ripples: restored?.ripples ?? {},
  mercy: restored?.mercy ?? false,
  // The day the miner started and which day a table was booked for — two small
  // facts that come back later.
  minedSince: restored?.minedSince ?? null,
  bookedFor: restored?.bookedFor ?? null,
  // How far the player has followed the eighth floor: asked the room about it,
  // found who went missing, walked in.
  digging: restored?.digging ?? {},
  // Following the affair rumour: heard where it leads, traced who wrote it,
  // and then either told or buried it.
  rumor: restored?.rumor ?? {},
  scratch: restored?.scratch ?? '',
  // What the player adds to the note server the last occupant left running.
  // His log stops mid-sentence in 2023; these go underneath it.
  myNotes: restored?.myNotes ?? [],
  // Which posts she has put up, and on what day: `board.kr/w_boss` → 2.
  posted: restored?.posted ?? {},
  // Wiki pages she has edited: `account` → { day, line }. Separate from
  // `edits`, which holds file contents and is read by a ripple.
  wikiEdits: restored?.wikiEdits ?? {},
  // Which tile photographs have been copied into the folder on the desktop.
  tiles: restored?.tiles ?? [],
  // 주소를 직접 알아내야 닿는 곳은 북마크 바에 실려 나오지 않는다 — 소통방은
  // hosts를 고쳐야 열린다. 플레이어가 직접 별을 눌러 얹은 주소가 여기 쌓인다.
  myBookmarks: restored?.myBookmarks ?? [],
  // 이 날이 시작한 실제 시각. 게임 시계가 여기서부터 흐른다.
  dayAt: restored?.dayAt ?? Date.now(),
  // 시트에서 아직 저장하지 않은 편집. PROGRESS에 넣지 않는다 — 저장 안 한 것이
  // 다음 세션까지 살아남으면 '저장'이라는 말이 뜻을 잃는다.
  sheetDrafts: {},
  // 어느 요청에 되물어 힌트를 받았는지. 버튼은 요청마다 한 번만 뜬다.
  hinted: restored?.hinted ?? {},
  // The VPN tunnel. Kept across a save, dropped by a restart the way a real one is.
  vpn: restored?.vpn ?? false,
  // 연결 중. 저장하지 않는다 — 다시 켜면 타이머는 없다.
  vpnDialing: false,
  // The floor's router with its DHCP server stopped: nothing past it loads until it is started again.
  routerDown: restored?.routerDown ?? false,
  // Whether this PC is registered with the copier. Set on the copier's own web
  // page and read by the print dialog, so it lives here rather than in either.
  mfpFixed: restored?.mfpFixed ?? false,

  setBooted: () => {
    play('boot')
    set({ booted: true })
    // A save reloaded, or a crash rebooted, mid-day: the rest of the day is
    // still in the queue and nothing is left holding a timer for it.
    if (get().beatQueue.length) setTimeout(() => get().nextBeat(), BEAT_GAP)
    // 굳은 채로 저장된 판을 다시 켰다. 마지막 말들을 물고 있던 타이머는
    // 새로고침과 함께 사라졌으니, 여기서 되살리지 않으면 그 화면에 영영
    // 갇힌다 — 이미 정해진 결말로 곧장 보낸다.
    const g = get()
    if (g.sealed && !g.ended) {
      setTimeout(() => get().endGame(endingFor(g.scenario.ending, { ...g, days: g.scenario.days.length })), SEAL_TAIL)
    }
  },
  // The id lets the view remount each toast so its entrance animation replays,
  // even when two toasts carry identical text.
  showToast: (toast) => {
    const s = get()
    // On the days that take it one request at a time, a conversation whose turn
    // has not come does not interrupt.
    const held = toast.thread ? heldThreads(s.scenario, s.day, s) : null
    if (held && held.has(toast.thread)) return
    // A message that lands in the conversation already on screen needs no
    // notification: the player is watching it arrive.
    if (watchingThread(s, toast)) return
    // 머무는 알림은 하루를 봐줘 달라는 말이다. 그 위로 잡담을 덮지 않는다 —
    // 덮으면 이름 없는 계정이 부른 줄을 모른 채 하루가 멈춰 있게 된다.
    // 말 자체는 대화창에 그대로 쌓인다. 알림만 건너뛴다.
    if (s.toast?.sticky && !toast.sticky) return
    play('notify')
    set({ toast: { ...toast, id: ++toastId } })
  },
  // A conversation that has just opened says everything it has to say, one line
  // at a time, so the player sees it arrive the way the other side sent it —
  // 지현 opens with eight lines, and only the last of them used to ring.
  nudge: (threadId) => {
    const s = get()
    const t = allThreads(s.scenario).find((x) => x.id === threadId)
    const said = threadMessages(t, s.scenario, s.msgCount, s.extraMessages)
      .filter((m) => m.day === s.day && !m.me)
    if (!said.length) return
    const source = sourceOf(s.scenario, threadId)
    said.forEach((msg, i) => setTimeout(() => {
      if (i < said.length - 1) get().setTyping(threadId, true)
      else get().setTyping(threadId, false)
      get().showToast({
        from: msg.from, text: msg.text, app: appOf(source), source, thread: threadId
      })
    }, 1800 + i * NUDGE_GAP))
  },
  // The intranet turning the machine away is what starts the IP conversation:
  // the block card says to ask 정보보안팀, and 차민혁 gets there first. Until
  // then his thread is a noticeboard with nothing on it for today.
  askedIp: () => {
    const s = get()
    if (s.grants[IP_ASKED]) return
    set({ grants: { ...s.grants, [IP_ASKED]: true } })
    get().nudge(IP_THREAD)
  },
  // Windows refusing to open something is what gives the player the thing to
  // say about it. Until they have seen the refusal there is nothing to report.
  sawMissing: (program) => set((s) => (s.grants[missingKey(program)]
    ? s
    : { grants: { ...s.grants, [missingKey(program)]: true } })),
  // 어떤 화면을 봤다는 표식. 퍼즐이 아니라 반응을 위한 것이다 — 근태의
  // 빈칸을 본 사람에게만 부름이 그것을 짚는다.
  notice: (key) => set((s) => (s.grants[key] ? s : { grants: { ...s.grants, [key]: true } })),
  clearToast: () => set({ toast: null }),
  deliverMessage: () =>
    set((s) => ({ msgCount: Math.min(s.msgCount + 1, s.scenario.messenger.length) })),

  // 폰 셸의 화면 스택. []면 홈이고, 'app:<id>'가 바닥에 깔린 뒤 앱이 제
  // 안에서 더 들어갈 때마다 쌓인다. 데스크톱 셸은 이 값을 보지 않는다.
  //
  // PROGRESS에 넣지 않는다 — 어느 화면을 보고 있었는지는 세이브에 남을
  // 성질이 아니고, 불러오면 홈에서 시작하는 편이 낫다.
  screens: [],

  pushScreen: (key) => set((s) => (
    // 같은 화면이 두 번 쌓이면 뒤로가 한 번 헛돈다. 눌렀는데 안 나가는
    // 것처럼 보이므로 연속 중복은 버린다.
    s.screens[s.screens.length - 1] === key ? s : { screens: [...s.screens, key] }
  )),

  popScreen: () => set((s) => ({ screens: s.screens.slice(0, -1) })),

  // 폰 홈으로. 게임의 goHome(퇴근하기)과 이름이 겹치지 않게 따로 둔다 —
  // 그쪽은 하루를 끝내는 동작이라 홈 버튼이 건드려서는 안 된다.
  goPhoneHome: () => set({ screens: [] }),
  // 최근 목록에서 하나를 고르면 그 위에 쌓인 화면을 걷어낸다. 창 화면을
  // 걷을 땐 창도 같이 닫는다 — 스택에서만 빼면 다음 렌더에서 '새로 생긴
  // 창'으로 보여 도로 밀려 들어온다.
  goScreen: (key) => set((s) => {
    const at = s.screens.lastIndexOf(key)
    if (at < 0) return s
    const gone = s.screens.slice(at + 1)
      .filter((k) => k.startsWith('win:'))
      .map((k) => Number(k.slice(4)))
    return {
      screens: s.screens.slice(0, at + 1),
      windows: s.windows.filter((w) => !gone.includes(w.id))
    }
  }),
  // 최근 목록에서 하나를 치운다.
  dropScreen: (key) => set((s) => ({
    screens: s.screens.filter((k) => k !== key),
    windows: key.startsWith('win:')
      ? s.windows.filter((w) => w.id !== Number(key.slice(4)))
      : s.windows
  })),

  // 스택이 아무리 깊어도 지금 어느 앱 안에 있는지는 바닥이 정한다.
  currentApp: () => {
    const [first] = get().screens
    return first?.startsWith('app:') ? first.slice(4) : null
  },

  openWindow: (app, props = {}, anew = false, forced = false) => {
    // A machine pinned at 96% cannot hold a new window: it appears and shuts.
    // The two ways out of this state are exempt, or the player would be stuck.
    const s0 = get()
    // 굳은 뒤로 플레이어는 아무것도 열지 못한다. 바탕화면도 작업표시줄도
    // 치웠지만 알림이나 남은 단축키가 여기로 들어올 수 있다. 마지막 장면이
    // 스스로 띄우는 창만 forced로 지나간다.
    if (s0.sealed && !forced) return s0
    if (s0.mining && !opensWhileMining(app)) {
      play('error')
      return s0.showToast({ from: s0.scenario.miner.symptoms.title, text: s0.scenario.miner.symptoms.lines[0], app: 'taskmgr' })
    }
    return set((s) => {
      const key = app + JSON.stringify(props)
      const existing = anew ? null : s.windows.find((w) => w.key === key)
      if (existing) {
        return {
          windows: s.windows.map((w) =>
            w.id === existing.id ? { ...w, minimized: false, z: s.nextZ } : w),
          nextZ: s.nextZ + 1
        }
      }
      const n = s.windows.length
      // 여러 개를 띄우는 앱은 키도 창마다 달라야 한다 — 키가 같으면 다음에
      // 열 때 그중 하나를 앞으로 끌어오게 된다.
      const id = ++winId
      return {
        windows: [...s.windows, {
          id, key: anew ? key + '#' + id : key, app, props,
          x: 120 + (n % 5) * 36, y: 60 + (n % 5) * 32,
          z: s.nextZ, minimized: false, maximized: false
        }],
        nextZ: s.nextZ + 1
      }
    })
  },
  closeWindow: (id) => set((s) => {
    if (s.sealed) return s
    // 하루가 이 대화를 기다리고 있었다면, 그 창을 닫는 순간이 퇴근이다.
    // 폰도 화면을 내릴 때 여기를 지나므로 꼬리는 자리는 하나다.
    const gone = s.windows.find((w) => w.id === id)
    const wanted = s.awaitingCaller && appOf(sourceOf(s.scenario, s.awaitingCaller))
    const evening = wanted && gone?.app === wanted
    return {
      windows: s.windows.filter((w) => w.id !== id),
      ...(evening ? { closing: true, awaitingCaller: null, toast: null } : {})
    }
  }),
  focusWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.nextZ, minimized: false } : w)),
      nextZ: s.nextZ + 1
    })),
  minimizeWindow: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) })),
  toggleMaximize: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)) })),
  moveWindow: (id, x, y) => {
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 1920) - 60
    const maxY = (typeof window !== 'undefined' ? window.innerHeight : 1080) - 90
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, x: Math.max(-500, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) }
          : w)
    }))
  },

  saveGame: () => {
    const s = get()
    s.showToast(write(SAVE_KEY, snapshot(s))
      ? { from: '게임 저장', text: '현재 진행 상황을 저장했습니다.' }
      : { from: '게임 저장', text: '저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요.' })
  },
  loadGame: () => {
    if (!read(SAVE_KEY)) return get().showToast({ from: '불러오기', text: '저장된 게임이 없습니다.' })
    try {
      sessionStorage.setItem(PENDING_KEY, '1')
    } catch {
      return get().showToast({ from: '불러오기', text: '불러오지 못했습니다. 브라우저 저장공간을 확인해 주세요.' })
    }
    location.reload()
  },
  newGame: () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // nothing to clear
    }
    location.reload()
  },

  resizeWindow: (id, rect) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...rect } : w)) })),

  // Running a malicious installer takes the machine down. Progress is kept —
  // what is lost is every open window and whatever was on screen in them.
  crash: (source = null) => {
    play('error')
    set({ crashed: true, crashSource: source, toast: null })
  },
  restart: () => set({ crashed: false, crashSource: null, booted: false, windows: [], toast: null, locked: false, vpn: false, closing: false, screens: [] }),
  // Finishing the last request does nothing on its own; the player clocks off
  // from the request list, and only then the evening (offer, then the door) begins.
  // 하루를 마치면 결과가 뜨기 전에 그날 밤 몫이 먼저 도착한다. 답은 다음
  // 날 하게 되어 있다 — 마감 화면이 대화를 덮으므로 그 자리에서는 못 쓴다.
  closeDay: () => {
    const s = get()
    // 부름을 기다리는 중이면 버튼은 이미 죽어 있다. 다시 눌러도 하루는 그
    // 대화를 읽고 닫아야만 끝난다 — 지나칠 수 있는 말이면 밤에 올 이유가 없다.
    if (s.awaitingCaller) return
    const night = callerNight(s)
    if (!night) return set({ closing: true })
    s.grant('called:' + s.day)
    // 알림은 사라지지 않고, 마감 화면도 아직 오지 않는다. 받은 사람이
    // 읽고 대화를 닫는 것이 오늘을 끝낸다 — 이름 없는 계정이 말을 건는데
    // 2.6초 뒤 퇴근 화면이 덮어버리면 무슨 말을 했는지 보지도 못한다.
    // 말은 버튼이 죽고 살짝 뒤에 온다. 곧바로 오면 버튼이 부른 것처럼 읽힌다.
    set({ awaitingCaller: night.thread })
    s.queueBeats([{ ...night, sticky: true }], CALLER_DELAY)
  },
  // Windows keep running behind the lock screen; only the screen is covered.
  // Every lock is counted: a week with none means the player never once left.
  lock: () => set((s) => ({ locked: true, toast: null, locks: s.locks + 1 })),
  unlock: () => {
    play('ok')
    set({ locked: false })
  },
  reboot: () => {
    const s = get()
    const program = s.scenario.programs[s.crashSource]
    const after = program?.aftermath ?? s.scenario.malware.aftermath
    // Each infection source is tracked on its own key so a second infection
    // from a DIFFERENT source still delivers its own warning once, while a
    // repeat from the SAME source stays a no-op. `grants.infected` keeps
    // meaning "infected at least once" for every other reader of it.
    const seenKey = `infected:${s.crashSource ?? 'mail'}`
    const fresh = !s.grants[seenKey]
    if (fresh) {
      s.saying(after.thread, after.from, after.lines)
      s.grant(seenKey)
      if (!s.grants.infected) s.grant('infected')
    }
    s.restart()
    if (!fresh) return
    setTimeout(() => get().showToast({
      from: after.from, text: after.lines[0],
      app: appOf(after.source), source: after.source, thread: after.thread
    }), 3200)
  },

  // Staying late brings three more requests tonight; going home closes the
  // offer for good. Either way the day can only be finished once.
  workLate: () => {
    const s = get()
    const extra = s.scenario.overtime.days[s.day]
    if (!extra || s.overtime[s.day]) return
    set((st) => ({ overtime: { ...st.overtime, [st.day]: true }, closing: false }))
    get().queueBeats([extra.opening, ...(extra.asks ?? [])].filter(Boolean), 1200)
  },
  goHome: () => set((s) => (s.overtime[s.day] !== undefined ? s : { overtime: { ...s.overtime, [s.day]: false } })),
  slip: () => set((s) => ({ slips: s.slips + 1 })),
  askedRoom: (about) => set((s) => {
    const next = { roomQuestions: s.roomQuestions + 1 }
    // pressing the room about the eighth floor is the first step of the trail
    if (about === 'rumor') {
      const asked = (s.rumor.asks ?? 0) + 1
      return { ...next, rumor: { ...s.rumor, asks: asked, heard: s.rumor.heard || asked >= s.scenario.rumor.askThreshold } }
    }
    if (about !== 'floor8') return next
    const asked = (s.digging.asks ?? 0) + 1
    return {
      ...next,
      digging: {
        ...s.digging,
        asks: asked,
        asked: s.digging.asked || asked >= s.scenario.floor8.askThreshold
      }
    }
  }),
  // Reading the attendance page is what turns a rumour into a name.
  foundMissing: () => set((s) => (s.digging.found ? s : { digging: { ...s.digging, found: true } })),
  // The print log names the observer — traced, but not yet acted on.
  traceObserver: () => set((s) => (s.rumor.traced ? s : { rumor: { ...s.rumor, traced: true } })),
  // The one choice that decides which way this ends.
  actOnRumor: (how) => set({ rumor: { ...get().rumor, acted: how }, ended: 'rumor_' + how }),
  // Walking in is the last thing the player does.
  enterFloor8: () => set((s) => (s.digging.entered ? s : { digging: { ...s.digging, entered: true } })),
  // Something the player installed starts mining. The machine goes slow and
  // windows fall over until the task is ended.
  startMining: () => {
    const s = get()
    if (s.mining || s.cleaned) return
    set({ mining: true, minedSince: s.day })
    setTimeout(() => get().showToast({
      from: s.scenario.miner.symptoms.title,
      text: s.scenario.miner.symptoms.lines[0], app: 'taskmgr'
    }), 4200)
  },
  // Ending the task quiets the machine; the program is still on disk, and the
  // security team says so a moment later.
  killMiner: () => {
    const s = get()
    if (!s.mining) return
    set({ mining: false })
    play('ok')
    s.showToast({ from: '작업 관리자', text: s.scenario.miner.killed.toast, app: 'taskmgr' })
    const after = s.scenario.miner.after
    setTimeout(() => {
      get().saying(after.thread, after.from, after.lines)
      get().showToast({
        from: after.from, text: after.lines[1],
        app: appOf(after.source), source: after.source, thread: after.thread
      })
    }, 5200)
  },
  // The scan removes it for good.
  cleanPc: () => {
    const s = get()
    if (s.cleaned) return
    set({ mining: false, cleaned: true, minedSince: null })
    play('ok')
    s.showToast({ from: s.scenario.antivirus.name, text: s.scenario.antivirus.clean.toast, app: 'antivirus' })
    s.grant('cleanpc')
  },
  // Saving hosts can put a name on the network; the objective is the site
  // opening, so nothing else has to happen here.
  editFile: (fileId, text) => set((s) => ({ edits: { ...s.edits, [fileId]: text } })),
  // The layoff comes as a message, and the answer to it is the ending.
  layOff: (choice) => set({ ended: 'layoff:' + choice, toast: null, locked: false }),

  // Clocking off restarts the machine and brings tomorrow's work with it.
  startDay: (n) => {
    const s = get()
    const day = s.scenario.days[n - 1]
    if (!day) return
    set({ dayAt: Date.now() })
    const drawn = s.drawn[n] ?? drawFor(s.scenario, n, s.drawn)
    // What the player did yesterday decides what today says to them.
    const landing = ripplesFor(s.scenario, n, s)
    const cost = landing.reduce((n2, r) => n2 + (r.effect?.slipPenalty ?? 0), 0)
    set({
      day: n,
      misses: 0,
      // yesterday said everything it was going to say
      beatQueue: [],
      beatAsk: null,
      drawn: { ...s.drawn, [n]: drawn },
      mercy: landing.some((r) => r.effect?.hintMercy),
      // what it costs you, counted where the player cannot see it
      slips: s.slips + cost,
      ripples: { ...s.ripples, ...Object.fromEntries(landing.map((r) => [r.id, n])) }
    })
    if (day.mails) set((st) => ({ extraMails: [...st.extraMails, ...day.mails] }))
    // The caller waits until the day's work has been asked for: it speaks last,
    // and only on its own night.
    get().queueBeats([day.opening, ...landing.map((r) => r.beat), ...(day.asks ?? []),
      ...beatsFor(s.scenario, drawn)].filter(Boolean), 3600)
  },
  finishDay: () => {
    const s = get()
    const next = s.day + 1
    if (!s.scenario.days[next - 1]) return s.endGame(endingFor(s.scenario.ending, { ...s, days: s.scenario.days.length }))
    set((st) => ({ overtime: { ...st.overtime } }))
    s.restart()
    setTimeout(() => get().startDay(next), 100)
  },
  // The last clock-off brings either a weekend or the truth, depending on
  // what the player has read along the way.
  endGame: (kind) => set({ ended: kind, toast: null, locked: false }),
  // 부고를 여는 순간 그 주는 멈춘다. 남은 요청도, 열려 있던 창도 갈 곳이
  // 없다 — 그 페이지가 떠 있던 창 하나만 그 자리에 굳는다.
  //
  // 그다음은 게임이 혼자 진행한다. 사람들이 차례로 말을 걸어오고(창이 스스로
  // 뜬다), 닷새 내내 아무도 열어 보지 않았을 사고 기사가 뜨고, 나흘 밤 묻기만
  // 하던 계정이 마지막으로 대답한다. 그러고 나서 끝난다.
  witness: () => {
    const s = get()
    // 굳었는지로 따진다. 표식만 보고 돌아서면, 이 화면이 생기기 전에 부고를
    // 이미 열어 둔 세이브는 다시 열어도 아무 일이 일어나지 않는다.
    if (s.sealed) return
    // 어느 창이 그것을 띄우고 있는지는 창틀이 앱에 알려 주지 않는다. 방금
    // 읽던 것은 맨 앞의 브라우저다.
    const keep = s.windows.filter((w) => w.app === 'browser')
      .reduce((top, w) => (!top || w.z > top.z ? w : top), null)
    set({
      grants: { ...s.grants, [CLUE.obituary]: true },
      sealed: true,
      frozen: keep?.id ?? null,
      // 띄운 창을 못 찾으면 그냥 다 굳힌다 — 화면을 통째로 비우는 것보다 낫다.
      windows: keep ? [{ ...keep, minimized: false }] : s.windows,
      screens: keep ? ['win:' + keep.id] : s.screens,
      beatQueue: [], beatAsk: null, pendingAsks: {}, typing: {}, toast: null, closing: false
    })
    const e = s.scenario.ending
    let at = 0
    // 말하는 사람이 바뀔 때마다 그 메신저가 열리고 그 대화가 앞으로 온다 —
    // 보고 있는 대화이므로 줄이 한 줄씩 도착한다.
    const speaks = (say) => {
      if (!say) return
      at += say.delay ?? SEAL_TURN
      const when = at
      setTimeout(() => {
        get().openWindow(appOf(say.source), {}, false, true)
        get().setOpenThread(say.source, say.thread)
        get().saying(say.thread, say.from, say.lines, SEAL_SAY)
      }, when)
      at += sayTime(say.lines.length, SEAL_SAY)
    }
    speaks(e.event)
    for (const say of e.last ?? []) speaks(say)
    if (e.article) {
      at += SEAL_TURN
      const when = at
      setTimeout(() => get().openWindow('browser', { start: { kind: 'news', id: e.article } }, true, true), when)
      at += SEAL_READ
    }
    speaks(e.explain)
    // 다 읽고 나면 넘어간다. 어느 엔딩인지는 그 주가 이미 정해 두었다.
    setTimeout(() => {
      const g = get()
      g.endGame(endingFor(g.scenario.ending, { ...g, days: g.scenario.days.length }))
    }, at + SEAL_TAIL)
  },

  // Reading the travel blog to the end is the moment the holiday stops being
  // his. The photos he remembers taking were always somebody else's, and the
  // cloud notices they are gone a beat later.
  readDream: () => {
    const s = get()
    if (s.dreamt) return
    set({ dreamt: true })
    const note = s.scenario.dream?.notice
    if (!note) return
    setTimeout(() => {
      get().saying(note.thread, note.from, note.lines)
      get().showToast({
        from: note.from, text: note.lines[note.lines.length - 1],
        app: appOf(note.source), source: note.source, thread: note.thread
      })
    }, note.delay)
  },

  // Unfolding 엄마's conversation all the way back is its own kind of looking.
  // What is down there is a month of her talking into nothing — after the 24th
  // of July not one line is his. She does not say that, and never could; she
  // only notices the read mark move and says his name. Nothing answers.
  readAllBack: () => {
    const s = get()
    if (s.readBack) return
    set({ readBack: true })
    const note = s.scenario.readBack
    if (!note) return
    setTimeout(() => {
      get().saying(note.thread, note.from, note.lines)
      get().showToast({
        from: note.from, text: note.lines[note.lines.length - 1],
        app: appOf(note.source), source: note.source, thread: note.thread
      })
    }, note.delay)
  },

  markMailRead: (id, read = true) =>
    set((s) => ({ readMails: { ...s.readMails, [id]: read } })),
  toggleStar: (id) => set((s) => ({ starred: { ...s.starred, [id]: !s.starred[id] } })),
  markHinted: (key) => set((s) => ({ hinted: { ...s.hinted, [key]: true } })),
  toggleBookmark: (url) => set((s) => ({
    myBookmarks: s.myBookmarks.includes(url)
      ? s.myBookmarks.filter((x) => x !== url)
      : [...s.myBookmarks, url]
  })),
  pinFile: (id) => set((s) => (s.pinned.includes(id) ? s : { pinned: [...s.pinned, id] })),
  unpinFile: (id) => set((s) => ({ pinned: s.pinned.filter((x) => x !== id) })),
  // 열린 곳만 기록에 남는다. 주소만 치고 못 들어간 곳까지 쌓으면, 기록이
  // 가 본 적 없는 데를 가리키게 된다(북마크와 같은 규칙).
  noteVisit: (url, title) => set((s) => ({
    visited: [{ url, title, day: s.day }, ...s.visited.filter((v) => v.url !== url)].slice(0, VISITS)
  })),
  sawTrace: (key) => set((s) => (s.traces[key] ? s : { traces: { ...s.traces, [key]: true } })),
  restoreFile: (id) => set((s) => ({ restored: { ...s.restored, [id]: true } })),
  toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  // A maintenance command sent to the copier. Out of order, the paper jams
  // again and the sequence starts over.
  // Registering this PC with the copier. Only its own address will do: the
  // machine has to be on the network for the copier to find it.
  registerMfp: (text) => {
    const s = get()
    if (s.mfpFixed) return 'taken'
    if (!ipFits(s.scenario.network.ip, text)) {
      play('error')
      return 'bad'
    }
    play('ok')
    set({ mfpFixed: true })
    return 'done'
  },
  cutFile: (fileId) => set({ clipboard: fileId }),
  placeFile: (fileId, into) => {
    set((s) => ({ placed: { ...s.placed, [fileId]: { ...s.placed[fileId], into } }, clipboard: null }))
    get().checkPlaced()
  },
  renameFile: (fileId, name) => {
    set((s) => ({ placed: { ...s.placed, [fileId]: { ...s.placed[fileId], name } } }))
    get().checkPlaced()
  },
  // 옮기기·이름 목표. 셀 목표와 같은 식이다 — 자리가 맞는 순간 켜진다.
  checkPlaced: () => {
    const { scenario, placed, grants, grant } = get()
    scenario.objectives
      .filter((o) => !grants[o.grant] && (
        (o.move && placed[o.move.file]?.into === o.move.into) ||
        (o.rename && placed[o.rename.file]?.name === o.rename.name)))
      .forEach((o) => grant(o.grant))
  },
  uploadTo: (page, fileId) => {
    set((s) => ({ uploaded: { ...s.uploaded, [page]: [...new Set([...(s.uploaded[page] ?? []), fileId])] } }))
    get().checkUploaded()
  },
  checkUploaded: () => {
    const { scenario, uploaded, grants, grant } = get()
    scenario.objectives
      .filter((o) => o.upload && !grants[o.grant] && (uploaded[o.upload.page] ?? []).includes(o.upload.file))
      .forEach((o) => grant(o.grant))
  },
  // Typing into a cell is the whole interaction; an objective that names that
  // cell is met the moment the value fits.
  editCell: (fileId, sheet, r, c, value) => {
    set((s) => ({ sheetEdits: { ...s.sheetEdits, [cellKey(fileId, sheet, r, c)]: value } }))
    get().checkCells()
  },
  // 시트 목표는 저장된 문서만 본다. 고쳐 놓고 저장을 안 했으면 아직 안 고친
  // 것이다 — 실제 업무가 그렇고, 저장이 뜻을 가지려면 그래야 한다.
  checkCells: () => {
    const { scenario, sheetEdits, grants, grant } = get()
    scenario.objectives
      .filter((o) => o.cell && !grants[o.grant] && cellMatches(o, sheetEdits))
      .forEach((o) => grant(o.grant))
  },
  // 셀에 쳐 넣은 것은 일단 여기 쌓인다. 저장을 눌러야 문서로 넘어간다.
  draftCell: (fileId, sheet, r, c, value) =>
    set((s) => ({ sheetDrafts: { ...s.sheetDrafts, [cellKey(fileId, sheet, r, c)]: value } })),
  // 저장. 들고 있던 것을 문서에 옮기고 목표를 다시 본다.
  saveSheet: (fileId) => {
    const s = get()
    const mine = Object.keys(s.sheetDrafts).filter((k) => k.startsWith(fileId + ':'))
    if (!mine.length) return
    const sheetEdits = { ...s.sheetEdits }
    const sheetDrafts = { ...s.sheetDrafts }
    for (const k of mine) {
      sheetEdits[k] = sheetDrafts[k]
      delete sheetDrafts[k]
    }
    set({ sheetEdits, sheetDrafts })
    get().checkCells()
  },
  // 저장하지 않고 닫을 때. 들고 있던 것을 버린다.
  dropDrafts: (fileId) =>
    set((s) => ({
      sheetDrafts: Object.fromEntries(
        Object.entries(s.sheetDrafts).filter(([k]) => !k.startsWith(fileId + ':')))
    })),
  setVpn: (on) => set({ vpn: on }),
  // VPN 연결. 클라이언트 창과 트레이 팝오버가 같은 길을 쓴다 — 이름이 hosts 에 없으면
  // 어느 쪽에서도 못 붙는다. 끊기가 창에 있으면 팝오버는 그 사이를 몰랐다.
  dialVpn: () => {
    const s = get()
    if (s.vpn || s.vpnDialing) return true
    if (!hostResolves(s.scenario, s.edits, s.scenario.vpn.server)) return false
    set({ vpnDialing: true })
    setTimeout(() => { set({ vpnDialing: false, vpn: true }); play('ok') }, 1800)
    return true
  },
  dropVpn: () => { set({ vpn: false, vpnDialing: false }); play('click') },
  unlockSite: (url) => set((s) => ({ unlocked: { ...s.unlocked, [url]: true } })),
  // The router's admin page. Stopping DHCP takes the floor down until it is
  // started again; changing the default password is the one thing worth doing.
  breakRouter: () => {
    const s = get()
    if (s.routerDown) return
    set({ routerDown: true })
    s.grant('router_broke')
    const o = outageOf(s.scenario)
    setTimeout(() => {
      get().saying(o.thread, o.from, o.down)
      get().showToast({ from: o.from, text: o.down[0], app: appOf(o.source), source: o.source, thread: o.thread })
    }, 2500)
  },
  fixRouter: () => {
    if (!get().routerDown) return
    set({ routerDown: false })
    const o = outageOf(get().scenario)
    setTimeout(() => get().saying(o.thread, o.from, o.up), 1500)
  },
  secureRouter: () => get().grant('router_secured'),
  // Credentials typed into the look-alike login page: security notices at once.
  phished: (after) => {
    if (get().grants.phished) return
    get().grant('phished')
    setTimeout(() => {
      get().saying(after.thread, after.from, after.lines)
      get().showToast({ from: after.from, text: after.lines[0], app: appOf(after.source), source: after.source, thread: after.thread })
    }, after.delay ?? 2500)
  },
  grant: (key) => {
    const was = heldThreads(get().scenario, get().day, get())
    play('ok')
    set((s) => ({
      grants: { ...s.grants, [key]: true },
      // the day a watched deed happened, for the consequences that wait
      ripples: watched(s.scenario, key) && s.ripples['_' + key] === undefined
        ? { ...s.ripples, ['_' + key]: s.day }
        : s.ripples
    }))
    get().chat(key)
    get().finishDeeds(key)
    get().caughtSlacking()
    // finishing one request is what opens the next conversation
    const now = heldThreads(get().scenario, get().day, get())
    if (was && now) for (const id of was) if (!now.has(id)) get().nudge(id)
    // some mail only shows up once the player has got somewhere
    const mw = get().scenario.malware
    if (mw.after !== key || get().extraMails.some((m) => m.id === mw.mail.id)) return
    setTimeout(() => {
      set((s) => ({ extraMails: [...s.extraMails, mw.mail] }))
      get().showToast({ from: mw.mail.from, text: mw.notice, app: 'mail' })
    }, mw.delay)
  },
  // 행동을 기다리던 질문. 그 행동의 grant가 켜지면 여기서 답이 온다 —
  // 대화는 게임의 것이라 메신저 창이 닫혀 있어도 진행된다. 마지막 단계가
  // 든 grants는 보통 deed와 같은 키라 이미 켜져 있고, 다르면 여기서 켠다.
  finishDeeds: (key) => {
    const s = get()
    for (const [threadId, ask] of Object.entries(s.pendingAsks)) {
      if (!ask || ask.deed !== key) continue
      const t = allThreads(s.scenario).find((x) => x.id === threadId)
      get().setAsk(threadId, ask.then ?? null)
      if (ask.next) get().setBranch(threadId, ask.next)
      if (ask.grants && !get().grants[ask.grants]) get().grant(ask.grants)
      get().saying(threadId, t?.name ?? '', ask.ok ?? [])
    }
  },
  // 지뢰찾기나 솔리테어를 켜 둔 채로 일을 하나 끝내면 팀장이 그걸 본다.
  // 게임 자체는 아무것도 기록하지 않는다 — 창이 열려 있다는 사실이 전부고,
  // 그래서 잔소리도 딱 한 번이다(두 번째부터는 잔소리가 아니라 소음이다).
  caughtSlacking: () => {
    const s = get()
    const nag = s.scenario.slacking
    if (!nag || s.slacked || !s.windows.some((w) => nag.apps.includes(w.app))) return
    set({ slacked: true })
    setTimeout(() => {
      get().saying(nag.thread, nag.from, nag.lines)
      get().showToast({
        from: nag.from, text: nag.lines[0],
        app: appOf(nag.source), source: nag.source, thread: nag.thread
      })
    }, nag.delay)
  },
  book: (place, details) =>
    set((s) => ({ bookings: { ...s.bookings, [place]: details }, bookedFor: s.day })),
  // Small talk lands between the work. A deed that someone was waiting on
  // brings their reaction; otherwise every other solved request brings one
  // line of the day's idle chatter, a few a day at most.
  chat: (key, pick = Math.random) => {
    const s = get()
    const chosen = chatterFor(s.scenario, key, s, pick)
    if (!chosen) return
    set((st) => ({ chatted: { ...st.chatted, [chosen.id]: st.day } }))
    setTimeout(() => {
      const { beat } = chosen
      get().saying(beat.thread, beat.from, beat.lines)
      get().showToast({ from: beat.from, text: beat.lines[0], app: appOf(beat.source), source: beat.source, thread: beat.thread })
    }, 2600)
  },
  // A day speaks one conversation at a time. Its beats go in a queue, and the
  // next one waits for the question the last one asked to be answered —
  // otherwise three people talk over a player who is still typing a reply.
  queueBeats: (beats, first) => {
    if (!beats.length) return
    set((s) => ({ beatQueue: [...s.beatQueue, ...beats] }))
    setTimeout(() => get().nextBeat(), first)
  },
  // Nothing schedules the held beat: whoever answers the open question calls
  // this again, so a waiting beat can never arrive twice.
  nextBeat: () => {
    const s = get()
    const [beat, ...rest] = s.beatQueue
    if (!beat || asking(s)) return
    set({ beatQueue: rest, beatAsk: beat.ask || beat.choices ? beat.thread : null })
    // 보고 있는 대화면 한 줄씩 온다. 그러면 이 대화가 말을 마치는 데 시간이
    // 걸리므로, 다음 대화는 그때까지 기다린다 — 안 그러면 한 줄씩 오는 도중에
    // 다른 사람이 끼어들어 두 대화가 뒤엉킨다.
    const watching = watchingThread(s, { source: beat.source, thread: beat.thread })
    s.saying(beat.thread, beat.from, beat.lines)
    if (beat.ask) get().queueAsk(beat.thread, beat.ask)
    // a question with buttons: the thread's own reactions answer it
    if (beat.choices) get().queueAsk(beat.thread, { choices: beat.choices })
    get().showToast({
      from: beat.from, text: beat.lines[0], sticky: beat.sticky,
      app: appOf(beat.source), source: beat.source, thread: beat.thread
    })
    if (rest.length) {
      setTimeout(() => get().nextBeat(), Math.max(BEAT_GAP, watching ? sayTime(beat.lines.length) + SAY_GAP : 0))
    }
  },
  setAsk: (threadId, ask) => {
    set((s) => ({ pendingAsks: { ...s.pendingAsks, [threadId]: ask } }))
    // 행동이 앞 단계보다 먼저 일어났을 수 있다. 새로 머리에 온 질문이 이미
    // 켜진 grant 를 기다리는 것이면 지금 바로 답한다 — 안 그러면 영영 기다린다.
    if (ask?.deed && get().grants[ask.deed]) return get().finishDeeds(ask.deed)
    // answering the question the day is waiting on is what lets it carry on
    if (threadId === get().beatAsk && !asking(get())) setTimeout(() => get().nextBeat(), BEAT_GAP)
  },
  // A day can raise two questions in the same conversation. The second waits
  // behind the first instead of replacing it, so neither goes unanswered.
  queueAsk: (threadId, ask) => {
    const waiting = get().pendingAsks[threadId]
    set((s) => ({ pendingAsks: { ...s.pendingAsks, [threadId]: waiting ? appendAsk(waiting, ask) : ask } }))
    // 부탁받기 전에 이미 해 둔 일. 머리에 온 질문이 켜진 grant 를 기다리는
    // 것이면 지금 답한다 — 안 그러면 그날의 나머지가 영영 오지 않는다.
    if (!waiting && ask?.deed && get().grants[ask.deed]) get().finishDeeds(ask.deed)
  },
  // A conversation belongs to the game, not to the window drawing it. Both
  // halves of it go where every other pushed line goes, so closing the
  // messenger cannot take the exchange with it.
  say: (threadId, entry) => get().pushMessage(threadId, { me: true, ...entry }),
  // The other side writes for a beat, then answers a line at a time. The
  // timers live here rather than in the window, so a reply already started
  // finishes even if the player closes the messenger halfway through it.
  // 말 끝에 파일을 붙여 보낼 수 있다. 메일 첨부와 같은 모양({ name, size, fileId })이고,
  // 받는 쪽이 저장을 누르기 전에는 디스크에 없다(fsView 의 attached 규칙).
  sayBack: (threadId, from, lines, gap = SAY_GAP, attach = null) => {
    get().setTyping(threadId, true)
    lines.forEach((text, i) => setTimeout(() => {
      get().pushMessage(threadId, { from, text })
      if (i === lines.length - 1) get().setTyping(threadId, false)
    }, SAY_FIRST + i * gap))
    if (attach) setTimeout(() => get().pushMessage(threadId, { from, file: attach.name, size: attach.size, fileId: attach.fileId }),
      SAY_FIRST + lines.length * gap)
  },
  // 한 사람이 잇달아 여러 줄을 말한다. 그 대화를 보고 있으면 한 줄씩 도착하고,
  // 안 보고 있으면 한꺼번에 넣는다 — 어차피 열었을 때 함께 읽는다. 눈앞에서
  // 네 줄이 한 번에 튀어나오면 사람이 친 말로 읽히지 않는다.
  saying: (threadId, from, lines, gap) => {
    const s = get()
    const source = sourceOf(s.scenario, threadId)
    if (watchingThread(s, { source, thread: threadId })) get().sayBack(threadId, from, lines, gap)
    else lines.forEach((text) => get().pushMessage(threadId, { from, text }))
  },
  // Which set of choices a conversation has reached.
  setBranch: (threadId, next) =>
    set((s) => ({ branches: { ...s.branches, [threadId]: next } })),
  // Every message remembers the day it arrived; the scenario's own are day one.
  pushMessage: (threadId, msg) =>
    set((s) => ({
      extraMessages: { ...s.extraMessages, [threadId]: [...(s.extraMessages[threadId] ?? []), { day: s.day, ...msg }] }
    })),
  setScratch: (scratch) => set({ scratch }),
  // Posting to an anonymous board. It grants nothing and opens nothing — what
  // it buys is a handful of strangers answering, or not.
  postTo: (url, id) =>
    set((s) => (s.posted[url + '/' + id] !== undefined
      ? s
      : { posted: { ...s.posted, [url + '/' + id]: s.day } })),

  // Editing a wiki page. Only the three that hold no answer can be edited, and
  // none of it survives the night. Insist three times and 차민혁 says so.
  editWiki: (key, line) => {
    const s = get()
    const edit = s.scenario.wikiEdit
    const said = line.trim()
    if (!edit?.pages.includes(key) || !said) return
    const wikiEdits = { ...s.wikiEdits, [key]: { day: s.day, line: said } }
    const times = Object.keys(wikiEdits).filter((k) => k !== 'nagged').length
    if (times >= edit.nagAfter && !s.wikiEdits.nagged) {
      wikiEdits.nagged = true
      const nag = edit.nag
      setTimeout(() => {
        get().saying(nag.thread, nag.from, nag.lines)
        get().showToast({
          from: nag.from, text: nag.lines[nag.lines.length - 1],
          app: appOf(nag.source), source: nag.source, thread: nag.thread
        })
      }, nag.delay)
    }
    set({ wikiEdits })
  },

  // Copying a tile photograph into the folder. Fourteen of them make a hand
  // that wins on any tile at all — nine gates, every one of them open — and the
  // week does not get to finish.
  takeTile: (id) => {
    const s = get()
    const gates = s.scenario.nineGates
    if (!gates || s.tiles.includes(id)) return
    if (!gates.shots.some((x) => x.id === id)) return
    const tiles = [...s.tiles, id]
    set({ tiles })
    if (tiles.length >= gates.shots.length) get().endGame(gates.ending)
  },

  // Nothing reads these back but the player, on a later day. That is the point.
  writeNote: (text) => {
    const said = text.trim()
    if (!said) return
    set((s) => ({ myNotes: [...s.myNotes, { day: s.day, text: said }] }))
  },
  // A government site verifies you by phone: the code lands in 톡톡, the way
  // a real SMS would, and the toast points at that conversation.
  sendCode: (gov) => {
    const v = gov.verify
    const text = smsFor(v)
    get().pushMessage(v.thread, { from: v.from, text })
    get().showToast({ from: v.from, text: text.split('\n')[0], app: 'chat', source: v.source, thread: v.thread })
  },
  setOpenThread: (source, id) =>
    set((s) => ({ openThread: { ...s.openThread, [source]: id } })),
  setTyping: (id, on) =>
    set((s) => (!!s.typing[id] === on ? s : { typing: { ...s.typing, [id]: on } })),
  markThreadSeen: (id, count) =>
    set((s) => (s.seenThreads[id] === count ? s : { seenThreads: { ...s.seenThreads, [id]: count } })),
  openHistory: (id, n) =>
    set((s) => (s.openedHistory[id] === n ? s : { openedHistory: { ...s.openedHistory, [id]: n } })),

  // 보낸 것을 보낸메일함에 남긴다. 두 길(회신·새 메일)이 여기를 지나므로
  // 한쪽만 남고 한쪽은 사라지는 일이 없다.
  keepSent: ({ to, subject, body, attachmentId = null }) => {
    const s = get()
    const file = attachmentId ? findFile(s.scenario.fs, attachmentId) : null
    set((st) => ({
      sentMails: [...st.sentMails, {
        id: 'sent_' + Date.now() + '_' + st.sentMails.length,
        to, subject, body, sent: true,
        attach: file ? { name: file.name, fileId: file.id } : null,
        date: '방금', at: justNow(s.scenario, s.day), day: s.day
      }]
    }))
  },
  sendReply: ({ attachmentId, subject, body }) => {
    const s = get()
    const goal = goalFor(s.scenario, s.day)
    const original = [...s.scenario.mails, ...s.extraMails].find((m) => m.id === goal.replyToMail)
    get().keepSent({ to: original.from, subject, body, attachmentId })
    const verdict = checkGoal(goal, { attachmentId, body })
    // 예절은 일과 별개다. 메일은 그대로 나가고 목표도 정상 처리되며, 실수
    // 횟수에도 들어가지 않는다. 잠시 뒤 박 팀장이 거래처 말을 옮길 뿐이다.
    // 다만 일 자체가 틀린 날은 그쪽이 먼저다. 한 스레드에서 두 잔소리가
    // 엇갈리면 팀장이 딴 얘기 두 개를 동시에 하는 것처럼 읽힌다.
    if (verdict.ok) get().scold({ subject, body, outbound: false })
    setTimeout(() => {
      set((st) => ({
        extraMails: [...st.extraMails, {
          id: 'reply_' + Date.now(),
          from: original.from,
          subject: 'RE: ' + original.subject,
          date: '방금',
          at: justNow(s.scenario, s.day),
          body: verdict.reply
        }]
      }))
      get().showToast({ from: original.from, text: `새 메일이 도착했습니다: RE: ${original.subject}`, app: 'mail' })
      if (verdict.ok) setTimeout(() => get().grant(goal.grants), 2200)
    }, 1800)

    if (verdict.ok) return verdict.ok

    // A bad reply reaches the client before it reaches you, so the complaint
    // comes back through the boss a moment after their reply lands.
    const c = goal.complain
    const misses = s.misses + 1
    s.slip()
    const { spent, lines } = complaintFor(goal, verdict.reason, misses)
    set({ misses })

    get().nag(lines, () => spent && setTimeout(() => set({ failed: true }), 2600))
    return verdict.ok
  },

  // 어긴 게 여럿이어도 사유 하나만 고른다. 한 번에 셋을 지적하면 잔소리가
  // 아니라 체크리스트가 된다.
  scold: ({ subject, body, outbound }) => {
    const s = get()
    const e = s.scenario.etiquette
    if (!e) return
    const [reason] = checkEtiquette(
      { ...e, company: s.scenario.player.company, name: s.scenario.player.name },
      { subject, body, outbound }
    )
    if (reason) get().nag(e.nags[reason])
  },

  // The boss types a moment after the client's reply lands, one line at a time.
  nag: (lines, after) => {
    const c = get().scenario.goal.complain
    setTimeout(() => {
      get().setTyping(c.thread, true)
      lines.forEach((text, i) => setTimeout(() => {
        get().pushMessage(c.thread, { from: c.from, text })
        if (i === lines.length - 1) {
          get().setTyping(c.thread, false)
          get().showToast({ from: c.from, text, app: appOf(c.source), source: c.source, thread: c.thread })
          after?.()
        }
      }, i * 1600))
    }, 3600)
  },

  // A mail the player starts. Only the day's brief knows which address is real;
  // everything else bounces. `{to}` and `{subject}` in the reply are filled in.
  sendMail: ({ to, subject, body, attachmentId = null }) => {
    const s = get()
    // 그날의 fetch 하나만 보던 것을 아직 안 켜진 메일 목표 전부로 넓힌다.
    // 수신자가 맞는 첫 후보가 이 메일의 상대다. 없으면 되돌아온다.
    const specs = [
      s.scenario.days[s.day - 1]?.fetch,
      ...s.scenario.objectives.filter((o) => o.mail && !s.grants[o.grant]).map((o) => ({ ...o.mail, grants: o.grant }))
    ].filter(Boolean)
    const same = (a, b) => String(a).replace(/[,\s]/g, '').toLowerCase() === String(b).replace(/[,\s]/g, '').toLowerCase()
    const spec = specs.find((f) => same(f.to, to)) ?? null
    get().keepSent({ to, subject, body, attachmentId })
    const verdict = checkOutbound(spec, { to, subject, body, attachmentId }, s.scenario.etiquette, s.scenario.player)
    // 요청 단위의 메일은 예절로 막지 않는다. 일은 되고, 잠시 뒤 팀장이 한마디 한다.
    if (verdict.ok && !spec.rudeReplies) get().scold({ subject, body, outbound: true })
    const fill = (t = '') => t.replace('{to}', to).replace('{subject}', subject)
    const reply = verdict.reply ?? s.scenario.goal.bounce
    setTimeout(() => {
      const mail = { ...reply, id: 'in_' + Date.now(), date: '방금', at: justNow(s.scenario, s.day), subject: fill(reply.subject), body: fill(reply.body) }
      set((st) => ({ extraMails: [...st.extraMails, mail] }))
      get().showToast({ from: mail.from, text: `새 메일이 도착했습니다: ${mail.subject}`, app: 'mail' })
      if (verdict.ok) setTimeout(() => get().grant(spec.grants), 2200)
      const nags = s.scenario.etiquette.nags[verdict.reason]
      if (nags) get().nag(nags)
    }, 1800)
    return verdict.ok
  }
}))

// Autosave on a trailing debounce: dragging a window fires a state change per
// pointer move, and localStorage writes are synchronous.
let autosaveTimer
useGame.subscribe(() => {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => write(SESSION_KEY, snapshot(useGame.getState())), 400)
})

// A staging folder on the desktop holding copies of files the player pinned, so
// attaching them later is one click instead of a dig through the tree.
export const WORK_FOLDER = '작업 폴더'

export function fsWithPinned(fs, pinned) {
  const copies = pinned.map((id) => findFile(fs, id)).filter(Boolean)
  return { ...fs, 바탕화면: [...fs['바탕화면'], { name: WORK_FOLDER, children: copies }] }
}

// The tiles the player has gathered. Like the work folder, this is a view: the
// folder is not on the desktop until the first photo goes into it, and what is
// inside are the same files, still where they were.
export function fsWithTiles(sc, fs, tiles = []) {
  if (!tiles.length) return fs
  const gates = (sc ?? scenario).nineGates
  if (!gates) return fs
  const shots = new Map(gates.shots.map((s) => [s.id, s]))
  const children = tiles.map((id) => findFile(fs, id) ?? blogTile(shots.get(id))).filter(Boolean)
  if (!children.length) return fs
  return { ...fs, 바탕화면: [...fs['바탕화면'], { name: gates.folder, children }] }
}

// A tile found in a blog post has no file behind it, so the folder makes one.
const blogTile = (shot) => shot && {
  id: shot.id, name: shot.id + '.jpg', image: shot.shot, alt: '사진', tile: shot.tile
}

// Which tile photos belong to a given spot — a blog post, or a folder path.
export const tileShots = (scenario, kind, key) =>
  (scenario.nineGates?.shots ?? []).filter((s) => (kind === 'blog'
    ? s.blog === key
    : s.at && s.at.join('/') === key))

// The bin is a view: a file flagged `deleted` in the scenario sits in 휴지통
// until restored, then reappears where the data always kept it.
export function fsView(fs, { pinned = [], restored = {}, tiles = [], placed = {}, scenario } = {}) {
  const binned = []
  const strip = (entries) => entries.flatMap((e) => {
    if (e.children) return [{ ...e, children: strip(e.children) }]
    if (e.deleted && !restored[e.id]) { binned.push(e); return [] }
    // a mail attachment is nowhere until it is saved from the mail
    if (e.attached && !restored[e.id]) return []
    return [e]
  })
  const out = Object.fromEntries(Object.entries(fs).map(([root, entries]) => [root, strip(entries)]))
  out['휴지통'] = [...(out['휴지통'] ?? []), ...binned]
  return fsWithTiles(scenario, fsWithPinned(place(out, placed), pinned), tiles)
}

// 옮기거나 이름을 바꾼 파일. 원래 자리에서 빼서 목적 폴더 끝에 넣는다 —
// 목적 폴더가 없으면 그 자리에 둔다. id는 그대로라 첨부·목표·힌트는 아무것도
// 눈치채지 못한다. 트리는 새로 만들어 돌려주므로 원본은 손대지 않는다.
export function place(fs, placed = {}) {
  if (!Object.keys(placed).length) return fs
  const folderAt = (tree, path) => path.slice(1).reduce(
    (es, name) => es?.find((e) => e.children && e.name === name)?.children ?? null,
    tree[path[0]] ?? null)
  const moving = []
  const pull = (entries) => entries.flatMap((e) => {
    if (e.children) return [{ ...e, children: pull(e.children) }]
    const p = placed[e.id]
    if (!p) return [e]
    const named = p.name ? { ...e, name: p.name } : e
    if (!p.into || !folderAt(fs, p.into.split('/'))) return [named]
    moving.push([p.into, named])
    return []
  })
  const out = Object.fromEntries(Object.entries(fs).map(([root, entries]) => [root, pull(entries)]))
  for (const [into, file] of moving) folderAt(out, into.split('/')).push(file)
  return out
}

// Once the blog has been read, the photos it was lending are gone. The rows
// stay so the player can see the shape of what was there — a name, greyed, and
// nothing behind it. Anything the dream never borrowed is untouched.
export function dreamGallery(scenario, fs, dreamt) {
  const gone = new Set(dreamt ? scenario.dream?.photos ?? [] : [])
  if (!gone.size) return fs
  const mark = (entries) => entries.map((e) => (
    e.children ? { ...e, children: mark(e.children) }
      : gone.has(e.id) ? { ...e, missing: scenario.dream.broken, image: undefined, alt: undefined }
        : e
  ))
  return Object.fromEntries(Object.entries(fs).map(([root, entries]) => [root, mark(entries)]))
}

// An entry with `children` is a folder; anything else is a file.
export function allFiles(fs) {
  const out = []
  const walk = (entries) =>
    entries.forEach((e) => (e.children ? walk(e.children) : out.push(e)))
  Object.values(fs).forEach(walk)
  return out
}

// Dialogue fields hold either one set of lines or several used in order, so the
// data can stay flat where nothing changes and escalate where it should.
const FALLBACK_QUICK = ['네, 알겠습니다', '감사합니다']

export const lineSets = (lines) => (Array.isArray(lines?.[0]) ? lines : [lines])

// What a conversation actually shows: the lines it already had, then — if this
// is the live thread — today's timed script, then whatever the week has pushed
// into it since. A live thread keeps its history rather than replacing it.
// Stored lines from before the week carry the `date` they were said on; anything
// belonging to the week carries a `day` instead, which is also what marks it as
// still unread.
// `hold` is the day whose messages this conversation has not reached yet: on the
// first days a thread waiting its turn shows the history it came with and none
// of today.
export const threadMessages = (thread, scenario, msgCount = 0, extras = {}, hold = 0) => [
  ...(thread.messages ?? []),
  ...(thread.live ? scenario.messenger.slice(0, msgCount).map((m) => ({ ...m, day: 1 })) : []),
  ...(extras[thread.id] ?? [])
].filter((m) => !hold || m.day !== hold)

// A conversation someone came back to was read long ago, so only what the week
// itself brought can still be unread — and never what the player typed.
// 어디까지 읽은 것으로 치는가. 세이브에 남은 열람 수와, 이번 주 전에 이미
// 오간 기록 중 뒤엣것이다 — 처음 여는 대화라도 지난 기록까지 안 읽은 것으로
// 세면 뱃지가 수십 개로 뜬다. 안 읽은 줄 수를 세는 쪽과 "여기까지 읽었습니다"
// 금을 긋는 쪽이 같은 자리를 가리켜야 하므로 규칙은 여기 한 곳에 둔다.
export const readUpTo = (all, seen = 0) =>
  Math.max(seen, all.filter((msg) => msg.date !== undefined).length)

export const unreadCount = (all, seen = 0) => {
  const read = readUpTo(all, seen)
  return all.filter((msg, i) => i >= read && !msg.me).length
}

// Which app a toast should open. A beat already names the messenger it came
// from, so the toast follows it there rather than always opening AR톡.
export const appOf = (source) => (source === 'privateMessenger' ? 'chat' : 'messenger')

// The timed script is the first morning's, and it is delivered once. Every
// reboot — clocking off into tomorrow, or a crash — starts the app again, so
// what is left to say is what has not been said yet, not the whole thing over.
export const scriptLeft = (messenger = [], msgCount = 0) => messenger.slice(msgCount)

// What a conversation still has to offer. A line the player has already used is
// not offered again — the live thread speaks all day, and every time it did the
// same canned reply came back and could be sent once more. A line the thread
// gates on something the player has not run into yet is not offered either.
export const offerable = (choices = [], { gate = {}, grants = {}, said = new Set() } = {}) =>
  choices.filter((c) => !said.has(c) && (!gate[c] || grants[gate[c]]))

export const quickSets = (thread) => lineSets(thread.quick ?? FALLBACK_QUICK)

// Loose match: spacing and case are forgiven. An entry may be an array, in
// which case every part of it has to appear — a pasted receipt has to carry both
// the place and the time, not just one of them.
// 시각은 적는 방법이 여럿이다. 13:40 과 "13시 40분" 은 같은 시각인데 글자로만
// 대조하면 뒤엣것이 퇴짜를 맞는다 — 물어본 대로 답한 사람이 틀렸다는 말을
// 듣는다. 양쪽을 같은 표기로 옮겨 놓고 견준다: N시 M분 → NN:MM, N시 → NN:00,
// 그리고 한 자리 시각은 앞에 0을 채운다(8:30 과 08:30 은 같다).
const pad = (v) => (v.length < 2 ? '0' + v : v)
const timeish = (v) => v
  .replace(/(\d{1,2})\s*시\s*(\d{1,2})\s*분/g, (_, h, m) => pad(h) + ':' + pad(m))
  .replace(/(\d{1,2})\s*시(?!\s*\d)/g, (_, h) => pad(h) + ':00')
  .replace(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/g, (_, h, m) => pad(h) + ':' + m)

const loose = (v) => timeish(v).replace(/\s/g, '').toLowerCase()

export function answerFits(ask, text) {
  // A question asked with no answer in the world takes whatever is typed: the
  // player has already worked it out, and there is nothing to check it against.
  if (ask.free) return text.trim() !== ''
  return ask.accept.some((entry) =>
    (Array.isArray(entry) ? entry : [entry]).every((part) => contains(text, part)))
}

// A loose "does the answer mention this" test, except that a number has to
// stand on its own. Without the digit boundary, typing the extension 1180
// would also answer a question whose answer is the stock count 180.
//
// 숫자 답은 구분 기호까지 맞춰 치라고 요구하지 않는다. 전화번호를 하이픈
// 없이, 금액을 쉼표 없이, 날짜를 점으로 적는 것은 틀린 답이 아니라 같은
// 답이다 — 010-0000-8102 와 01000008102 는 같은 번호다. 자릿수 경계는
// 기호를 뗀 뒤에도 그대로 지킨다.
const bare = (v) => v.replace(/[-.,]/g, '')

function contains(text, part) {
  const needle = loose(part)
  if (!needle) return false
  // only numbers get the boundary; a word answer may sit inside a sentence
  if (!/^[\d,.-]+$/.test(needle)) return loose(text).includes(needle)
  const hay = bare(loose(text))
  const digits = bare(needle)
  if (!digits || !hay.includes(digits)) return false
  for (let at = hay.indexOf(digits); at !== -1; at = hay.indexOf(digits, at + 1)) {
    if (!isDigit(hay[at - 1]) && !isDigit(hay[at + digits.length])) return true
  }
  return false
}

const isDigit = (ch) => ch !== undefined && ch >= '0' && ch <= '9'

// Which ending the week earned: the truth if the obituary was opened, the
// overwork variant if the screen never once locked, an ordinary weekend otherwise.
// Once the obituary has been opened the ticket is worthless: the dead cannot
// collect. Until then, a confirmed win is the one way the week ends well.
// Working late every single night earns the overwork ending on its own.
// Someone who was called and never opened the notice wakes up: the summons was
// answered by refusing it, and the refusal outranks even the ticket — but not
// the notice itself, because the dead do not wake. Walking into the eighth
// floor outranks all of it: whatever else the week was, it ends there.
export const endingFor = (ending, { grants, locks, overtime = {}, days = 5, digging = {}, rumor = {} }) =>
  wentUp(digging) ? 'missing'
    : toldRumor(rumor) ? ('rumor_' + rumor.acted)
    : awareOf(ending, grants) ? 'true'
      : refusedSummons(grants) ? 'wake'
        : grants.lotto ? 'lotto'
          : workedEveryNight(overtime, days) || locks === 0 ? 'overwork' : 'plain'

// The trail has to be walked in order: you cannot open a door you never heard
// about, and the page will not resolve until the player writes it into hosts.
export const wentUp = (digging = {}) => Boolean(digging.asked && digging.found && digging.entered)

// The rumour ends the week only once the player has actually chosen what to do
// with the name — heard it, traced it, acted on it.
export const toldRumor = (rumor = {}) => Boolean(rumor.heard && rumor.traced && rumor.acted)

// Whether the player has traced the observer but not yet chosen: the moment the
// choice is offered.
export const rumorPending = (rumor = {}) => Boolean(rumor.heard && rumor.traced && !rumor.acted)

// How far along the trail the player is, for anything that wants to show it.
export const digDepth = (scenario, digging = {}) =>
  scenario.floor8.steps.filter((k) => digging[k]).length

// Five nights out of five, no exceptions.
export const workedEveryNight = (overtime, days) =>
  Array.from({ length: days }, (_, i) => overtime[i + 1]).every(Boolean)

// Called, and the notice left unopened. Reaching the end of the questions is
// what makes the week refusable at all: without the call there is nothing to
// turn down, and opening the notice takes the refusal back.
export const refusedSummons = (grants = {}) => Boolean(grants.summoned) && !grants[CLUE.obituary]

// Too many wrong answers over the week and the company stops asking. Counted
// against every request the week actually raised, overtime included.
export function laidOff(layoff, { slips = 0, overtime = {}, drawn = {} }, scenario) {
  const asked = scenario.days.reduce((n, d, i) =>
    n + requestsOf(scenario, i + 1, overtime, drawn).length, 0)
  return asked > 0 && slips >= asked * layoff.ratio
}

// Tonight's extra work, if the day has any and the player has not answered yet.
export const overtimeOffer = (scenario, day, overtime) =>
  overtime[day] === undefined && scenario.overtime?.days?.[day] ? scenario.overtime : null

// The ticket's serial number, typed off the slip: hyphens and spaces forgiven.
export const serialFits = (lotto, text) => loose(text) === loose(lotto.serial).replace(/-/g, '') || loose(text) === loose(lotto.serial)

// A feed item tagged with a day exists only from that morning on; untagged
// items were always there.
export const visibleByDay = (items = [], day = 1) => items.filter((x) => (x.day ?? 0) <= day)

// A board shows what has arrived so far, newest day floating to the top.
// The sort is stable, so the authored order inside a day survives.
export const boardPosts = (posts = [], day = 1) =>
  [...visibleByDay(posts, day)].sort((a, b) => (b.day ?? 0) - (a.day ?? 0))

// A wiki page as it stands today. Editing one puts her name on it for the rest
// of the day; by the next morning the approved version is back, and the note
// saying so is the only trace left.
// 사내위키와 사내 드라이브는 겉만 다르고 같은 모양의 문서를 담는다. 어느
// 쪽인지로 갈라 두면 드라이브 페이지가 조용히 404가 되고, 거기 걸린 편집도
// 같이 죽는다 (편집 가능한 셋 중 q3·owner가 드라이브 쪽이다).
const holdsWikiPages = (s) => s?.layout === 'wiki' || s?.layout === 'drive'

export function wikiPage(scenario, { wikiEdits = {}, day = 1 }, key) {
  const page = scenario.sites
    .filter(holdsWikiPages)
    .map((s) => s.wiki.pages[key]).find(Boolean)
  const edit = scenario.wikiEdit
  const mine = wikiEdits[key]
  if (!page || !edit || !mine) return page
  if (day > mine.day) {
    return { ...page, author: edit.revertedBy, notes: [...(page.notes ?? []), edit.reverted] }
  }
  return { ...page, author: edit.author, notes: [...(page.notes ?? []), mine.line] }
}

// What the player has put on a board herself. A post carries the day it went
// up: the replies land the morning after, and one of them is never answered at
// all — it is quietly gone by the time she looks again.
export function myPosts(scenario, { posted = {}, day = 1 }, url) {
  const site = scenario.sites.find((s) => s.url === url)
  const compose = site?.board?.compose
  const options = compose?.options ?? []
  return Object.entries(posted)
    .filter(([key]) => key.startsWith(url + '/'))
    .map(([key, when]) => [options.find((o) => o.id === key.slice(url.length + 1)), when])
    .filter(([option, when]) => option && !(option.vanishes && day - when >= option.vanishes))
    .map(([option, when]) => ({
      ...option,
      author: compose.author,
      company: compose.company,
      likes: 0,
      time: '방금',
      day: when,
      // Nobody replies the same day, and nobody ever replies to the one about
      // the eighth floor.
      comments: day > when ? option.comments : []
    }))
    .sort((a, b) => b.day - a.day)
}

// The portal keeps every day's announcements: today's on top, then each
// earlier day, then what was already pinned before the week began.
export function portalFeed(scenario, base, day) {
  const perDay = []
  for (let n = day; n >= 1; n--) perDay.push(...(scenario.days[n - 1]?.portal?.news ?? []))
  return [...perDay, ...(base.news ?? [])]
}

// The front page carries the freshest headlines, newest first.
export const latestNews = (news, n = 6) =>
  [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)

// The player knows once they have opened their own obituary.
export const CLUE = { obituary: 'clue_obituary' }
export const awareOf = (ending, grants) => Object.keys(ending.clues).every((k) => grants[CLUE[k]])

// The verification text, with the code filled in where the template asks for it.
export const smsFor = (verify) => verify.sms.replace('{code}', verify.code)

// Six digits typed off a phone screen: spacing is forgiven, nothing else is.
export const codeFits = (verify, text) => loose(text) === loose(verify.code) && text.trim() !== ''

// A question may want a file instead of typed text; any of the ones it names will do.
export const fileFits = (ask, fileId) => Boolean(ask?.files?.includes(fileId))

// Hangs a question off the end of one still waiting, so a thread asked twice in
// a day keeps both — answering the first hands straight over to the second.
export const appendAsk = (ask, next) =>
  ask.then ? { ...ask, then: appendAsk(ask.then, next) } : { ...ask, then: next }

// Wrong answers get a firmer nudge each time, stopping at the clearest one.
export const hintAfter = (ask, wrongs, mercy = false) => {
  const sets = lineSets(ask.no)
  // the morning after a late night, nobody makes you work for the hint
  return sets[Math.min(mercy ? wrongs + 1 : wrongs, sets.length - 1)]
}

// 되물었을 때 돌려줄 말. no 의 각 단계는 대개 [틀렸다는 말, 실제 힌트] 인데,
// 답을 낸 적도 없는 사람에게 "그 날짜가 아닌 것 같은데요"로 답하면 말이 안
// 된다. 앞의 퇴짜를 떼고 힌트만 준다. 뗄 것이 없는 단계(퇴짜 한 줄뿐인 것이
// 243개 중 51개)는 건너뛰고 다음 단계로 넘어간다 — 되물었는데 아무것도 못
// 듣는 것보다는 한 단계 더 주는 편이 낫다. step 은 그다음 오답이 이어받을
// 자리다.
export function hintReply(ask, from = 0) {
  const sets = lineSets(ask.no)
  for (let i = Math.min(from, sets.length - 1); i < sets.length; i++) {
    const rest = sets[i].slice(1)
    if (rest.length) return { lines: rest, step: i + 1 }
  }
  return { lines: sets[sets.length - 1], step: sets.length }
}

// 되묻기는 요청 하나에 한 번뿐이다. 대화 하나가 하루에 요청을 둘 이상 맡으므로
// 대화 id 만으로는 못 세고, 요청 자체를 가리키는 열쇠가 필요하다.
export const hintKey = (threadId, ask) =>
  threadId + '|' + (ask?.placeholder ?? '') + '|' + JSON.stringify(ask?.accept ?? ask?.files ?? null)

// Edited cells are kept flat, one key per cell, on top of the read-only workbook.
export const cellKey = (fileId, sheet, r, c) => `${fileId}:${sheet}:${r}:${c}`

// 이 창이 아직 저장 안 한 것을 들고 있으면 그 파일 id, 아니면 null. 창틀이
// 닫기 전에 물어봐야 할지 여기에 묻는다 — 오늘 저장이라는 개념을 가진 앱은
// 시트뿐이라 시트만 안다. 다른 앱이 생기면 여기 한 줄이 는다.
export const unsavedFile = (state, win) => {
  const id = win?.app === 'sheet' ? win.props?.fileId : null
  if (!id) return null
  return Object.keys(state.sheetDrafts ?? {}).some((k) => k.startsWith(id + ':')) ? id : null
}

export const cellMatches = (objective, sheetEdits) => {
  const { file, sheet, row, col, value } = objective.cell
  return (sheetEdits[cellKey(file, sheet, row, col)] ?? '').trim() === value.trim()
}

// The jammed printer wants the wiki's steps in order; a wrong press jams it again.
// An address typed into a form: spaces forgiven, nothing else. Leading zeros
// are not the same address, so this is a plain comparison and not a number one.
export const ipFits = (want, text = '') => text.replace(/\s/g, '') === want

// The mail brief in force on a given day: shared rules (attempts, the boss's
// reaction, the failure screen) plus that day's client and figures.
export const goalFor = (scenario, day) =>
  ({ ...scenario.goal, ...(scenario.days[day - 1]?.goal ?? {}) })

// Today's work: the day names which objectives it wants, the objective says
// which state counts as done.
export function requestsOf(scenario, day, overtime = {}, drawn = {}, ripples = {}) {
  const today = scenario.days[day - 1]
  if (!today) return []
  const extra = overtime[day] ? scenario.overtime?.days?.[day]?.requests ?? [] : []
  // a consequence can put work on the day that nobody asked for
  const forced = (scenario.ripples ?? [])
    .filter((r) => ripples[r.id] === day && r.effect?.extraRequest)
    .map((r) => r.effect.extraRequest)
  // A request can need a step of its own somewhere else — a tracking number in
  // 톡톡, a cell in a sheet. That is work the player has to do, so it goes on
  // the list under the request that asked for it.
  return [...new Set([...today.requests, ...(drawn[day] ?? []), ...extra, ...forced])]
    .flatMap((id) => [
      scenario.objectives.find((o) => o.id === id),
      ...scenario.objectives.filter((o) => o.partOf === id)
    ]).filter(Boolean)
}

// Grants a consequence is waiting on, so `grant` only stamps the ones that matter.
export const watched = (scenario, key) =>
  (scenario.ripples ?? []).some((r) => r.when.grant === key)

// Which consequences land on the morning of day `n`. A ripple lands once, and
// only when the state it names is actually true.
// Which small talk a deed brings: the one waiting on exactly this deed, or
// else — on every other deed, while the day's quota lasts — one drawn from
// what the day has to say. Nothing is ever said twice.
export const CHATTER_A_DAY = 3
export function chatterFor(scenario, key, state, pick = Math.random) {
  const { chatted = {}, day, grants = {} } = state
  const fresh = (scenario.chatter ?? []).filter((c) => !(c.id in chatted))
  const waiting = fresh.find((c) => c.after === key)
  if (waiting) return waiting
  const today = Object.values(chatted).filter((d) => d === day).length
  if (today >= CHATTER_A_DAY || Object.keys(grants).length % 2) return null
  const idle = fresh.filter((c) => !c.after && (!c.days || c.days.includes(day)))
  return idle.length ? idle[Math.floor(pick() * idle.length)] : null
}

export function ripplesFor(scenario, n, state) {
  const seen = state.ripples ?? {}
  return (scenario.ripples ?? []).filter((r) => !(r.id in seen) && rippleHolds(r.when, n, state))
}

export function rippleHolds(when = {}, n, state) {
  const {
    overtime = {}, locks = 0, slips = 0, mining = false, cleaned = false, roomQuestions = 0,
    grants = {}, minedSince = null, bookedFor = null, ripples = {}, edits = {}
  } = state
  if (when.fromDay && n < when.fromDay) return false
  if (n < 2 && !when.fromDay) return false          // nothing ripples onto day one
  if (when.overtimeYesterday && !overtime[n - 1]) return false
  if (when.overtimeStreak) {
    const run = Array.from({ length: when.overtimeStreak }, (_, i) => overtime[n - 1 - i])
    if (!run.every(Boolean)) return false
  }
  if (when.mining !== undefined && (mining !== when.mining || cleaned)) return false
  if (when.locks !== undefined && locks !== when.locks) return false
  if (when.slipsAtLeast !== undefined && slips < when.slipsAtLeast) return false
  if (when.slipsAtMost !== undefined && slips > when.slipsAtMost) return false
  if (when.roomQuestions !== undefined && roomQuestions < when.roomQuestions) return false
  // a machine left mining for this many days running
  if (when.miningDays && (minedSince === null || n - minedSince < when.miningDays)) return false
  // something the player did, and something they then did not do
  if (when.grant && !grants[when.grant]) return false
  if (when.notGrant && grants[when.notGrant]) return false
  // the bill comes due a couple of days after the thing itself
  if (when.afterDays && !doneLongEnough(ripples, when, n)) return false
  // a table booked, and a night spent at the office instead
  if (when.bookingKept && bookedFor === null) return false
  // a synced file the player rewrote, and did not put back
  if (when.edited && !rewritten(state.scenario ?? scenario, edits, when.edited)) return false
  return true
}

const rewritten = (sc, edits, id) => {
  const f = findFile(sc.fs, id)
  return Boolean(f) && edits[id] !== undefined && edits[id] !== f.content
}

// A consequence with `afterDays` waits that many days after the deed before it
// lands, so the player has a window in which to put it right.
const doneLongEnough = (ripples, when, n) => {
  const at = ripples['_' + when.grant]
  return at !== undefined && n - at >= when.afterDays
}

// Days after the first keep a fixed core and draw the rest, so no two weeks
// bring the same work. A request that reads a document from a later day waits
// for that day (`after`); one that explains itself too kindly for the end of
// the week stops being drawn (`before`); nothing is ever drawn twice.
export function drawFor(scenario, day, drawn = {}, pick = Math.random) {
  const pool = scenario.pool
  if (!pool || day === 1) return []
  const taken = new Set(Object.values(drawn).flat())
  const want = pool.sizes[day] - (pool.fixed[day] ?? []).length
  const ready = pool.requests
    .filter((r) => !taken.has(r.id) && (pool.after[r.id] ?? 0) <= day && day <= (pool.before?.[r.id] ?? 9))
    .map((r) => r.id)
  // The work written for this end of the week goes first: the kindly explained
  // requests early on, the ones that explain nothing late. The rest fills in.
  const meant = (id) => (day >= 4 ? (pool.after[id] ?? 0) >= 4 : Boolean(pool.before?.[id]))
  const first = shuffle(ready.filter(meant), pick)
  const rest = shuffle(ready.filter((id) => !meant(id)), pick)
  return [...first, ...rest].slice(0, Math.max(0, want))
}

// Fisher–Yates, with the source of randomness passed in so a test can pin it.
export function shuffle(list, pick = Math.random) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The messenger beats behind a drawn set, in the order they were drawn.
export const beatsFor = (scenario, ids = []) =>
  ids.map((id) => scenario.pool?.requests.find((r) => r.id === id)?.beat).filter(Boolean)

// The first days ease the player in: the work is offered one request at a time,
// and nobody else starts talking until the one on the table is done. How far the
// day has opened is not stored anywhere — it is simply how much is finished.
const lastStep = (ask) => (ask?.then ? lastStep(ask.then) : ask)

// Which conversation carries each request, by the grant it ends on. The answer
// only depends on the scenario, and the messenger asks on every render.
const hosts = new WeakMap()
export function hostThreads(scenario) {
  if (hosts.has(scenario)) return hosts.get(scenario)
  const threads = allThreads(scenario)
  const host = {}
  for (const t of threads) {
    for (const a of [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]) {
      if (a) host[lastStep(a).grants] = t.id
    }
  }
  for (const d of scenario.days) {
    for (const b of d.asks ?? []) if (b.ask) host[lastStep(b.ask).grants] = b.thread
  }
  for (const r of scenario.pool?.requests ?? []) {
    if (r.beat?.ask) host[lastStep(r.beat.ask).grants] = r.beat.thread
  }
  hosts.set(scenario, host)
  return host
}

export const allThreads = (scenario) =>
  [scenario.workMessenger, scenario.privateMessenger].flatMap((m) => m.sections.flatMap((s) => s.threads))

// The conversations still waiting their turn, or null on a day that holds
// nothing back. Only what the day itself lines up can be held: a request's own
// thread waits for its place in the order, and the ones with nothing to ask
// today follow a step behind. Anything else — the live thread, a bank alert, a
// verification code — is never in the queue and always gets through.
export function heldThreads(scenario, day, state) {
  if (day > (scenario.tutorialDays ?? 0)) return null
  const list = requestsOf(scenario, day, state.overtime, state.drawn, state.ripples)
  const done = list.map((o) => objectiveDone(o, state))
  // How far the queue has actually got: the run of requests finished from the
  // front. Counting every finished request instead would let the count fall
  // behind the position — answer the third request before the second and the
  // conversations after it stay shut with nothing left to open them.
  const step = done.findIndex((d) => !d) === -1 ? done.length : done.findIndex((d) => !d)
  const host = hostThreads(scenario)
  // The live thread carries the day's own opening as well as whatever request
  // it happens to host, so holding it back holds back the morning itself —
  // nobody says anything and the day looks like it never started. It is never
  // in the queue, on either side of it.
  const live = allThreads(scenario).find((t) => t.live)?.id
  const hosts = list.map((o) => (host[o.id] === live ? null : host[o.id]))
  const taken = new Set(hosts.filter(Boolean))
  const idle = allThreads(scenario)
    .filter((t) => !t.live && !taken.has(t.id) && (t.messages ?? []).some((m) => m.day === day))
    .map((t) => t.id)
  // The queue hands out one conversation per answer, so what it has reached is
  // how many are done in all — not the unbroken run from the front, which
  // stalls the moment the player answers out of order and leaves the requests
  // behind the gap with nothing able to raise them.
  const reach = done.filter(Boolean).length
  // Position counted among the conversations only. Several requests are
  // answered somewhere other than a chat — a wiki page, a mail, a booking form
  // — and counting those into the order pushed the last conversations past
  // anything the day could reach, leaving their requests on the list with no
  // way to raise them.
  let place = -1
  const rank = hosts.map((id) => (id ? ++place : -1))
  const held = new Set()
  // 한 대화가 하루에 요청을 둘 이상 맡는다 — 정보보안팀은 VPN 세션 ID도,
  // 복합기 등록 IP도 묻는다. 뒤엣것의 차례로 대화를 닫아 버리면 이미 차례가
  // 온 앞엣것까지 같이 잠겨 하루가 멈춘다. 대화는 그 대화가 맡은 것 중 가장
  // 이른 것을 기준으로 열린다.
  const due = new Map()
  hosts.forEach((id, i) => {
    if (id && (!due.has(id) || rank[i] < due.get(id))) due.set(id, rank[i])
  })
  due.forEach((r, id) => { if (reach < r) held.add(id) })
  idle.forEach((id, k) => { if (reach <= k) held.add(id) })
  return held
}

export const dayDone = (scenario, day, state) =>
  requestsOf(scenario, day, state.overtime ?? {}, state.drawn ?? {}, state.ripples ?? {})
    .every((o) => objectiveDone(o, state))

// An objective is met when the state it names has been reached — the scenario
// says which, so adding a goal is a data change.
export function objectiveDone(objective, state) {
  if (objective.grant) return Boolean(state.grants[objective.grant])
  if (objective.site) return Boolean(state.unlocked[objective.site])
  return false
}

const ROOT_ICONS = { 휴지통: 'trash', 휴대폰: 'phone' }
export const rootIcon = (name) => ROOT_ICONS[name] ?? 'folder'

// Which app opens a file, decided by its name the way an OS does it.
export const fileOpener = (file) =>
  file.image ? { app: 'viewer', icon: 'image' }
    : file.name.endsWith('.exe') ? { app: 'installer', icon: 'exe' }
      : file.name.endsWith('.xlsx') ? { app: 'sheet', icon: 'xls' }
      : file.name.endsWith('.pptx') ? { app: 'slides', icon: 'ppt' }
        : file.name.endsWith('.hwp') ? { app: 'hwp', icon: 'hwp' }
          : file.name.endsWith('.pdf') ? { app: 'pdf', icon: 'pdf' }
            : file.name.endsWith('.dcx') ? { app: 'dcx', icon: 'doc' }
              : { app: 'notepad', icon: 'notepad' }

export function findFile(fs, fileId) {
  return allFiles(fs).find((f) => f.id === fileId) ?? null
}

// What the boss says after a bad reply, and whether that was the last straw.
// `misses` is the count including the one that just happened.
export function complaintFor(goal, reason, misses) {
  const c = goal.complain
  const limit = goal.attempts ?? 3
  if (misses >= limit) return { spent: true, lines: c.final }
  const warn = misses === limit - 1 ? [c.lastChance] : []
  return { spent: false, lines: [...c[reason], ...warn] }
}

// What a file says now: the player's saved text if they have edited it.
export const contentOf = (file, edits = {}) => (file ? edits[file.id] ?? file.content : '')

// A hosts line is an address, whitespace, a name — comments after # ignored.
// Every address a name is listed against, in the order the file lists them.
// hostNames keeps only the last one, which is right for asking "what does this
// name point at" and wrong for asking "is anything here at all".
export function hostAddresses(scenario, edits, host) {
  const file = findFile(scenario.fs, scenario.hosts.file)
  const want = host.toLowerCase()
  const out = []
  for (const raw of contentOf(file, edits).split('\n')) {
    const [ip, ...names] = raw.split('#')[0].trim().split(/\s+/).filter(Boolean)
    if (ip && names.some((n) => n.toLowerCase() === want)) out.push(ip)
  }
  const named = scenario.hosts.required[want]
  if (named && !out.includes(named)) out.push(named)
  return out
}

export function hostNames(text = '') {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim()
    const [ip, ...names] = line.split(/\s+/).filter(Boolean)
    if (!ip || !names.length) continue
    for (const name of names) out[name.toLowerCase()] = ip
  }
  return out
}

// A .local name resolves only once it is in the player's hosts file, at the
// address the request named.
export function hostResolves(scenario, edits, url) {
  const file = findFile(scenario.fs, scenario.hosts.file)
  const names = hostNames(contentOf(file, edits))
  const wanted = scenario.hosts.required[url]
  return wanted ? names[url] === wanted : Boolean(names[url])
}

// The address bar: protocol and case are forgiven, the first slash splits
// host from path, and a trailing slash means nothing.
export function parseAddress(raw = '') {
  const cleaned = raw.trim().replace(/^https?:\/\//i, '').toLowerCase()
  const cut = cleaned.indexOf('/')
  const host = cut < 0 ? cleaned : cleaned.slice(0, cut)
  const path = cut < 0 ? '' : cleaned.slice(cut).replace(/\/+$/, '')
  return { host, path }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

// 주소창은 주소만 받는 자리가 아니다. 실제 브라우저처럼, 주소로 읽히지 않는
// 것을 치면 검색으로 보낸다 — 사이트 이름만 아는 채로 '퇴근길' 이라고 쳤을 때
// "찾을 수 없습니다" 를 띄우는 것은 퍼즐이 아니라 벌이다. 점이 있으면 주소로
// 본다: 없는 도메인을 쳤을 때 오류가 나는 것은 실제 브라우저도 같고, hosts 를
// 고쳐야 열리는 주소(sotong.ar.local)가 그 오류로 퍼즐을 이룬다.
export const looksLikeAddress = (scenario, edits, raw = '') => {
  const t = raw.trim()
  if (!t || /\s/.test(t)) return false
  const { host } = parseAddress(t)
  return host.includes('.') || Boolean(resolveSite(scenario, edits, host))
}

// A site by its name — or, typed as an address, by whichever name the hosts
// file (or the names the game hands out) maps to that address.
export function resolveSite(scenario, edits, host) {
  const exact = scenario.sites.find((s) => s.url === host)
  if (exact) return exact
  const file = findFile(scenario.fs, scenario.hosts.file)
  const names = { ...scenario.hosts.required, ...hostNames(contentOf(file, edits)) }
  // A name the hosts file knows stands in for the address it points at. A name
  // can be listed against more than one address — localhost is 127.0.0.1 and
  // then ::1 — so try every address it carries, not just the last one to win.
  if (!IPV4.test(host)) {
    for (const ip of hostAddresses(scenario, edits, host)) {
      const at = scenario.sites.find((s) => s.url === ip)
      if (at) return at
    }
    return null
  }
  const name = Object.keys(names).find((n) => names[n] === host)
  return (name && scenario.sites.find((s) => s.url === name)) ?? null
}

// Addresses that are pages in their own right, not sites to look up.
// This machine's own address is no longer among them: something the last
// occupant started is still listening on it, and the site list answers.
export const specialPage = (host) =>
  (host === 'about:blank' ? 'blank' : null)

// A path is a wiki page id or a portal sub-page; anything else on any site is a 404.
export function pathKnown(site, path = '') {
  if (!path) return true
  if (holdsWikiPages(site)) return Boolean(site.wiki.pages[path.slice(1)])
  return Boolean(site?.pages?.[path])
}

// Which topic a question lands on, so a caller can tell what was asked about.
export function roomTopic(ask, question) {
  const q = loose(question)
  if (!q) return null
  let hit = null, best = 0
  for (const topic of ask.topics) {
    for (const k of topic.keys) {
      const key = loose(k)
      if (q.includes(key) && key.length > best) { hit = topic; best = key.length }
    }
  }
  if (!hit) return null
  if (hit.keys.includes('8층')) return 'floor8'
  if (hit.keys.includes('불륜')) return 'rumor'
  return null
}

// The anonymous room answers by keyword. Whoever replies is picked by how
// many times the player has already asked, so a second ask reads as a second
// voice rather than the same line twice.
export function roomReply(ask, question, asked = 0) {
  const q = loose(question)
  if (!q) return null
  // The longest keyword wins, so '빈자리' reaches the rumour topic rather than
  // the screen-lock one that merely says '자리'.
  let hit = null, best = 0
  for (const topic of ask.topics) {
    for (const k of topic.keys) {
      const key = loose(k)
      if (q.includes(key) && key.length > best) { hit = topic; best = key.length }
    }
  }
  const pool = hit ? hit.replies : ask.fallback
  return pool[asked % pool.length]
}

// Which window draws which messenger. A message arriving in the conversation
// that is already open on screen is not news, so it does not ring: the player
// is watching it land.
const MESSENGER_APP = { workMessenger: 'messenger', privateMessenger: 'chat' }
// 이 대화가 업무용 메신저의 것인지 개인 메신저의 것인지.
export const sourceOf = (scenario, threadId) =>
  (scenario.workMessenger.sections.some((sec) => sec.threads.some((x) => x.id === threadId))
    ? 'workMessenger' : 'privateMessenger')

export function watchingThread(s, toast) {
  if (!toast.source || !toast.thread) return false
  if (s.openThread[toast.source] !== toast.thread) return false
  return s.windows.some((w) => w.app === MESSENGER_APP[toast.source] && !w.minimized)
}

// Installing something can leave an icon on the desktop. Which ones are there
// is a question about grants, so the shell never has to keep its own list.
export const installedShortcuts = (programs = {}, grants = {}) =>
  Object.values(programs).filter((p) => p.shortcut && grants[p.grant]).map((p) => p.shortcut)

// While the miner runs the machine cannot hold a new window open: opening one
// is what the player sees fail. The task manager and the antivirus are the way
// out, so they always open.
export const SAFE_APPS = ['taskmgr', 'antivirus']
export const opensWhileMining = (app) => SAFE_APPS.includes(app)

// 창을 여러 개 띄울 수 있는 앱. 브라우저는 위키를 열어 둔 채 거래처 사이트를
// 봐야 하고, 파일 탐색기는 한쪽에서 찾은 파일을 다른 쪽으로 끌어다 놓아야
// 한다 — 둘 다 자기 주소와 기록을 창마다 따로 들고 있으므로 서로 간섭하지
// 않는다. 나머지 앱은 하나로 충분하다: 메일함이 둘이면 헷갈리기만 한다.
//
// 다만 새로 열지 말지는 앱이 아니라 **여는 쪽**이 정한다. 바탕화면 아이콘을
// 다시 누르는 것은 "하나 더"라는 뜻이지만, 폰 홈에서 같은 아이콘을 누르는
// 것은 "그 앱으로 가자"는 뜻이라 새 창이 쌓이면 안 된다.
export const MULTI_APPS = ['browser', 'explorer']
export const opensAnew = (app) => MULTI_APPS.includes(app)

// What the task manager lists: the miner first, on top of the ordinary rows.
export function processList(miner, mining) {
  // The ghost sits at 0% CPU, so sorting by CPU always leaves it last: you only
  // meet it if you scroll to the bottom of a list nobody needs to scroll.
  const rows = [...miner.processes, ...(miner.ghost ? [miner.ghost] : [])]
  return mining ? [{ ...miner.process, miner: true }, ...rows] : rows
}

// Commands the prompt knows but never advertises. HELP does not list them and
// nothing in the week needs them — they are there for whoever types anyway.
export const hiddenCommand = (scenario, cmd) =>
  (cmd && scenario.hiddenCommands?.[cmd]) || null

// Exactly one state per visited site: no tunnel means no name, no approval
// means no login form, no login means no content. Returning a single value
// keeps them mutually exclusive.
const outageOf = (sc) => sc.sites.find((x) => x.layout === 'router').router.outage

export function siteView(site, { grants, unlocked, resolves = true, vpn = false, offline = false }) {
  if (!site) return 'error'
  // ponytail: only the browser goes dark when the router is down; mail and the VPN app still work
  if (offline) return 'offline'
  if (site.requiresIp && !grants.ip) return 'blocked'
  if (site.requiresVpn && !vpn) return 'vpn'
  if (site.requiresHost && !resolves) return 'error'
  if (site.login && !unlocked[site.url]) return 'login'
  // a server fault that stays until the grant it names is earned
  if (site.down && !grants[site.down]) return 'down'
  return 'ready'
}

// Local listings for the portal's search: matched on name and tags so a broad
// term like 맥주 brings back every candidate, not just the one that matters.
export const searchPlaces = (places, q) => searchIn(places, q, ['name', 'category', 'tags'])

// One matcher for every kind of portal result. Each caller names the fields it
// wants searched, which is also how a locked page keeps its contents private.
export function searchIn(items = [], q, fields) {
  const term = q.trim().toLowerCase()
  if (!term) return []
  return items.filter((item) =>
    fields
      .map((f) => (Array.isArray(item[f]) ? item[f].join(' ') : item[f] ?? ''))
      .join(' ')
      .toLowerCase()
      .includes(term))
}

export const searchBlogs = (blogs, q) => searchIn(blogs, q, ['title', 'excerpt', 'tags'])
export const searchNews = (news, q) => searchIn(news, q, ['title', 'summary', 'tags', 'press'])
export const searchQna = (qna, q) => searchIn(qna, q, ['q', 'a', 'tags'])
export const searchCompanies = (list, q) =>
  searchIn(list, q, ['name', 'en', 'field', 'tags'])
export const searchTerms = (list, q) =>
  searchIn(list, q, ['word', 'reading', 'body', 'tags'])

// mail dates read like "8월 21일 (금) 16:42". a reply the player just sent is
// dated "방금" — that one belongs at the very top, so it sorts as the latest.
const JUST_NOW = 1e9

// '방금' 은 화면에 보이는 말이지 시각이 아니다. 상수로 두면 그 메일이 영영
// 맨 위에 박혀, 다음 날 아침에 온 진짜 새 메일이 어제 보낸 회신 밑으로
// 내려간다. 그래서 목록을 세울 시각은 보낸 그 순간의 것으로 따로 박아 둔다 —
// 그날의 끝으로 잡으면 오늘 온 메일보다는 위, 내일 올 메일보다는 아래가 된다.
let mailSeq = 0
export const justNow = (scenario, day) =>
  mailTime((scenario.days[day - 1]?.date ?? '') + ' 23:59') + (++mailSeq)
export function mailTime(date = '') {
  const day = date.match(/(\d+)월\s*(\d+)일/)
  if (!day) return JUST_NOW
  const [, h = 0, m = 0] = date.match(/(\d+):(\d+)/) ?? []
  return ((+day[1] * 31 + +day[2]) * 24 + +h) * 60 + +m
}

// newest first; same timestamp falls back to the order they arrived in.
// `at` 이 박혀 있으면 그것이 시각이다 — '방금' 처럼 날짜로 읽을 수 없는 것.
//
// 안 읽은 것이 먼저 온다. 회신에 딸려 온 답장은 그날 끝의 시각을 달고 오므로,
// 시각만으로 세우면 아침에 온 새 메일이 오늘 주고받은 답장 밑으로 내려간다 —
// 정작 아직 안 읽은 것이 안 보인다. 읽고 나면 제 날짜 자리로 내려간다.
const mailAt = (m) => m.at ?? mailTime(m.date)
export const sortMails = (mails, read = {}) => mails
  .map((m, i) => [m, i])
  .sort(([a, i], [b, j]) =>
    (read[a.id] ? 1 : 0) - (read[b.id] ? 1 : 0) || mailAt(b) - mailAt(a) || j - i)
  .map(([m]) => m)

// Sponsored results are not sites the portal indexed — they are bought, so they
// match on the words the buyer paid for and never show up in a plain site search.
export const searchAds = (ads, q) => searchIn(ads, q, ['title', 'desc', 'tags'])

// Titles and addresses only. Matching page contents would surface the wiki's
// price table in results and let a player skip its password gate entirely.
export const searchSites = (sites, q) => searchIn(sites.filter((s) => !s.unlisted), q, ['title', 'url'])

// path is ['문서', '업무자료', '2026'] — the first name picks the root drive.
// Windows keeps hidden items out of every listing until you ask for them, and
// then draws them faded — one switch, every folder.
export const visible = (entries, showHidden) =>
  entries.filter((e) => showHidden || !e.hidden)

// The pictures beside this one: the folder the file came from, showing what
// that folder shows. A picture the week has taken away has no image left, so
// it is not one to step onto.
export function galleryOf(fs, fileId, showHidden = false) {
  const holding = (entries) => {
    if (entries.some((e) => e.id === fileId)) return entries
    for (const e of entries) {
      const hit = e.children && holding(e.children)
      if (hit) return hit
    }
    return null
  }
  const folder = Object.values(fs).map(holding).find(Boolean) ?? []
  return visible(folder, showHidden).filter((e) => e.image)
}

export function entriesAt(fs, path) {
  return path.slice(1).reduce(
    (entries, name) => entries.find((e) => e.name === name)?.children ?? [],
    fs[path[0]] ?? []
  )
}

// Smallest a window may be dragged down to, in px.
// 시트의 =SUM(). 이 게임의 표는 숫자를 단위와 함께 쓴다 — '1,410,000원',
// '40대'. 쉼표와 단위를 떼고 남는 것이 숫자다. 숫자가 없으면 0으로 친다
// (진짜 스프레드시트도 글자는 더하기에서 빠뜼린다).
export function cellNumber(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// A1 표기. 머리글이 1행이라 화면의 줄 번호와 그대로 맞는다.
export function cellRef(name) {
  const m = /^([A-Z]+)([0-9]+)$/.exec(String(name).trim().toUpperCase())
  if (!m) return null
  let c = 0
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64)
  return { c: c - 1, r: Number(m[2]) - 1 }
}

export const SHEET_ERR = '#REF!'

// 한 칸의 보이는 값. '=' 로 시작하면 식이고, 아니면 적힌 그대로다.
// 식이 자기를 도로 가리키면 여기서 멈춘다 — 안 그러면 칸 하나가 창을 멈추게 한다.
export function sheetCell(rows, r, c, seen = new Set()) {
  const raw = rows[r]?.[c]
  if (raw === undefined) return ''
  const text = String(raw)
  if (!text.startsWith('=')) return text
  const key = r + ':' + c
  if (seen.has(key)) return SHEET_ERR
  return evalFormula(text, rows, new Set([...seen, key]))
}

// 아는 식은 SUM 하나다. 범위(A2:A9)와 나열(A2,B4) 둘 다 받는다.
// 더 받기 시작하면 파서가 되고, 반쪽짜리 파서는 도구가 아니라 함정이다.
export function evalFormula(text, rows, seen = new Set()) {
  const m = /^=\s*SUM\s*\(([^)]*)\)\s*$/i.exec(text)
  if (!m) return SHEET_ERR
  let total = 0
  let counted = 0
  for (const part of m[1].split(',')) {
    const span = part.split(':')
    if (span.length > 2) return SHEET_ERR
    const a = cellRef(span[0])
    const b = cellRef(span[span.length - 1])
    if (!a || !b) return SHEET_ERR
    for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
      for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
        const v = sheetCell(rows, r, c, seen)
        if (v === SHEET_ERR) return SHEET_ERR
        total += cellNumber(v)
        counted++
      }
    }
  }
  return counted ? total.toLocaleString('ko-KR') : SHEET_ERR
}

// 기록에 남기는 수. 메뉴 하나에 들어갈 만큼만 남긴다.
export const VISITS = 12

// 주소창이 거드는 곳들.
//
// ⚠ 시나리오의 사이트 목록에서 거들면 안 된다. 공유기 주소도, 8층도,
// 피싱 도메인도 거기 있다 — 찾아내는 것이 퍼즘인 주소를 주소창이 먼저
// 말해 버린다. 이미 아는 곳 — 북마크, 가 본 곳, 한별이가 휴가 전에 본 곳 — 만 내민다.
export function addressHints(q, { visited = [], bookmarks = [], history = [] } = {}, limit = 6) {
  const term = String(q ?? '').trim().toLowerCase()
  if (!term) return []
  const out = []
  const seen = new Set()
  for (const h of [...visited, ...bookmarks, ...history]) {
    if (!h?.url || seen.has(h.url)) continue
    const title = h.title ?? h.url
    if (!`${h.url} ${title}`.toLowerCase().includes(term)) continue
    seen.add(h.url)
    out.push({ url: h.url, title, blog: h.blog })
    if (out.length === limit) break
  }
  return out
}

// 끓긴 문장이 이어지는가. 네 가지 흔적 — 8층 방을 캐물은 것, 이름을 찾은 것(근태·복합기),
// 자동복구 문서, 소통방 글 — 중 셔이면 된다. 8층 로그는 세지 않는다: 여는 순간 주가 끝난다.
export function noteOpens(scenario, { digging = {}, traces = {} } = {}) {
  const n = scenario.sites.find((x) => x.layout === 'notes')?.notes
  if (!n?.traces) return false
  const seen = [digging.asked, digging.found, ...Object.keys(n.traces).map((k) => traces[k])]
  return seen.filter(Boolean).length >= (n.opens ?? 3)
}

export const MIN_SIZE = { w: 360, h: 220 }

// New rect for a resize drag. `dir` names the edges being pulled ('se', 'n', …).
// Dragging a left or top edge moves the window's corner, but only by as much as
// the window actually shrank — so it stops dead once it hits the minimum.
// 창을 화면 가장자리로 밀었을 때 어디에 놀지. 포인터 위치로만 따진다 —
// 창의 모서리로 따지면 큰 창은 가운데서 놓아도 물고 작은 창은 끝까지 밀어도 안 물린다.
export const SNAP_EDGE = 14
export function snapZone(px, py, vw, vh, edge = SNAP_EDGE) {
  if (py <= edge) return 'max'
  if (px <= edge) return 'left'
  if (px >= vw - edge) return 'right'
  return null
}

// 반쪽짜리 자리. 작업 표시줄 위까지만 차지하고, 홈수가 남지 않게 오른쪽이
// 나머지를 전부 가져간다. 'max' 는 자리가 아니라 상태라 여기서 다루지 않는다.
export function snapRect(zone, vw, vh, taskbar = 48, min = MIN_SIZE) {
  if (zone !== 'left' && zone !== 'right') return null
  const h = Math.max(min.h, vh - taskbar)
  const half = Math.max(min.w, Math.round(vw / 2))
  return zone === 'left'
    ? { x: 0, y: 0, w: half, h }
    : { x: vw - half, y: 0, w: vw - half, h }
}
export function resizeRect(start, dir, dx, dy, min = MIN_SIZE) {
  const rect = { x: start.x, y: start.y, w: start.w, h: start.h }
  if (dir.includes('e')) rect.w = Math.max(min.w, start.w + dx)
  if (dir.includes('s')) rect.h = Math.max(min.h, start.h + dy)
  if (dir.includes('w')) {
    rect.w = Math.max(min.w, start.w - dx)
    rect.x = start.x + (start.w - rect.w)
  }
  if (dir.includes('n')) {
    rect.h = Math.max(min.h, start.h - dy)
    rect.y = start.y + (start.h - rect.h)
  }
  return rect
}

// Files under `path` whose name matches, each with the folder trail that leads to
// it. Explorer searches subfolders too — in a tree this messy that is the point.
export function searchFiles(fs, path, q) {
  const term = q.trim().toLowerCase()
  if (!term) return []
  const out = []
  const walk = (entries, trail) => {
    for (const e of entries) {
      if (e.children) walk(e.children, [...trail, e.name])
      else if (e.name.toLowerCase().includes(term)) out.push({ file: e, trail })
    }
  }
  walk(entriesAt(fs, path), [])
  return out
}

// Pull a window up when its cascade offset would push its bottom past the taskbar,
// so a tall window opens anchored to the top instead of hanging off a short screen.
export function fitY(y, height, viewportH, taskbar = 48) {
  const avail = viewportH - taskbar
  const shown = Math.min(height, avail)
  return y + shown > avail ? Math.max(0, avail - shown) : y
}
