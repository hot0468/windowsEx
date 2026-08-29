import { Fragment, useEffect, useRef, useState } from 'react'
import { useGame, WORK_FOLDER, answerFits, fileFits, findFile, heldThreads, hintAfter, hintKey, hintReply, offerable, quickSets, readUpTo, threadMessages, unreadCount } from '../engine/store.js'
import { historyChunks } from '../engine/history.js'
import FileDialog from './FileDialog.jsx'
import { useFileDrop } from './dragFile.js'
import { useViewport } from '../shell/useViewport.js'
import { faceOf, fileImage, photoOf } from '../assets/photos.js'
import {
  BellOff, ChevronDown, ChevronLeft, HelpCircle, MessageSquare,
  Paperclip, Search, Settings, Sliders, UserPlus, Users
} from '../icons/line.jsx'

const Avatar = ({ t, size, onOpen }) => {
  const photo = photoOf(t.id)
  const face = faceOf(t.id)
  // a row is already a button, so this stays a span rather than nesting one
  const opens = onOpen && {
    role: 'button', tabIndex: 0, title: t.name + ' 프로필',
    onClick: (e) => { e.stopPropagation(); onOpen(t) },
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen(t) }
    }
  }
  return (
    <span className={'mg-av' + (t.room ? ' room' : '') + (onOpen ? ' tap' : '')} {...opens}
          style={{ background: t.color, width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {photo && <img className="mg-photo" src={photo} alt="" draggable="false" />}
      {!photo && face && <img className="mg-face" src={face} alt="" draggable="false" />}
      {!photo && !face && t.name[0]}
      {t.online && <i className="mg-dot" />}
    </span>
  )
}

const Row = ({ t, preview, unread, selected, onOpen, onProfile }) => (
  <button className={'mg-row' + (selected ? ' sel' : '')} onClick={onOpen}>
    <Avatar t={t} size={40} onOpen={onProfile} />
    <span className="mg-row-mid">
      <span className="mg-row-name">
        {t.name}{t.muted && <BellOff size={12} strokeWidth={2.2} />}
      </span>
      <span className="mg-row-sub">{preview ?? t.sub}</span>
    </span>
    {unread > 0 && <span className="mg-badge">{unread}</span>}
  </button>
)

// Clicking a face opens the card behind it. Everything on it is already known
// about the thread — there is no second source of truth to keep in step.
const ProfileCard = ({ who, team, onChat, onClose }) => (
  <div className="mg-profile" onPointerDown={onClose}>
    <div className="mg-profile-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mg-profile-top" style={{ background: who.color }}>
        <Avatar t={who} size={92} />
      </div>
      <div className="mg-profile-body">
        <div className="mg-profile-name">
          {who.name}
          {who.muted && <BellOff size={13} strokeWidth={2.2} />}
        </div>
        {who.sub && <div className="mg-profile-sub">{who.sub}</div>}
        <dl className="mg-profile-meta">
          {team && <div><dt>소속</dt><dd>{team}</dd></div>}
          {who.phone && <div><dt>번호</dt><dd>{who.phone}</dd></div>}
          <div>
            <dt>상태</dt>
            <dd className={who.online ? 'on' : ''}>{who.online ? '온라인' : '오프라인'}</dd>
          </div>
        </dl>
        <div className="mg-profile-row">
          {onChat && <button className="btn-primary" onClick={onChat}>대화하기</button>}
          <button className="sm-cancel" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  </div>
)

// 요청마다 문구를 적어 두지 않은 곳에서 쓰는 되묻기. 1번 힌트는 설계상 가장
// 약한 단서라 "어디"를 알려주지 않는 경우가 많다 — 버튼이 장소를 물으면
// 답이 질문을 비껴가고, 플레이어는 그 문서가 없다고 읽는다. 무엇이 돌아오든
// 말이 되는 문구를 쓴다.
//
// 말투는 상대에 따라 갈린다. 지현이한테 "조금만 더 알려주시겠어요?" 라고 하면
// 그 한 줄만 남의 대화처럼 뜬다 — 대화가 반말이면 되묻기도 반말이다.
const HINT_ASK = '조금만 더 알려주시겠어요?'
const HINT_ASK_CASUAL = '조금만 더 알려줘'
const hintAskOf = (thread, ask) =>
  ask?.hintAsk ?? (thread?.casual ? HINT_ASK_CASUAL : HINT_ASK)

export default function Messenger({ source }) {
  const m = useGame((s) => s.scenario[source])
  const fs = useGame((s) => s.scenario.fs)
  const scenario = useGame((s) => s.scenario)
  const msgCount = useGame((s) => s.msgCount)
  const extraMessages = useGame((s) => s.extraMessages)
  const days = useGame((s) => s.scenario.days)
  const day = useGame((s) => s.day)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const ripples = useGame((s) => s.ripples)
  const openId = useGame((s) => s.openThread[source] ?? null)
  const setOpenThread = useGame((s) => s.setOpenThread)
  const seen = useGame((s) => s.seenThreads)
  const markThreadSeen = useGame((s) => s.markThreadSeen)
  const setTyping = useGame((s) => s.setTyping)
  const say = useGame((s) => s.say)
  const sayBack = useGame((s) => s.sayBack)
  const branch = useGame((s) => s.branches)
  const setBranch = useGame((s) => s.setBranch)
  const pendingAsks = useGame((s) => s.pendingAsks)
  const setAsk = useGame((s) => s.setAsk)
  const grant = useGame((s) => s.grant)
  const slip = useGame((s) => s.slip)
  const mercy = useGame((s) => s.mercy)
  // 좁은 화면에서는 목록과 대화가 한 화면에 같이 못 선다.
  const phone = useViewport() === 'phone'
  const hinted = useGame((s) => s.hinted)
  const markHinted = useGame((s) => s.markHinted)
  const typing = useGame((s) => s.typing)
  const [collapsed, setCollapsed] = useState({})
  const [tab, setTab] = useState('friends')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const [answeredAt, setAnsweredAt] = useState({})
  const [shrugs, setShrugs] = useState({})
  const [wrongs, setWrongs] = useState({})
  const [confirming, setConfirming] = useState(null)
  const [draft, setDraft] = useState('')
  const [profile, setProfile] = useState(null)
  const list = useRef(null)
  const stick = useRef(true)
  const openedHistory = useGame((s) => s.openedHistory)
  const openHistory = useGame((s) => s.openHistory)
  const readAllBack = useGame((s) => s.readAllBack)
  // 불러오는 시늉이 도는 동안에는 버튼을 다시 누를 수 없다.
  const [loading, setLoading] = useState(false)
  const pinned = useGame((s) => s.pinned)

  // On the first days the work arrives one request at a time: a conversation
  // whose turn has not come keeps today to itself.
  // A thread can also be waiting on something the player has not run into yet:
  // it keeps its history and says nothing about today until that happens.
  const held = heldThreads(scenario, day, { grants, unlocked, overtime, drawn, ripples })
  // A thread that waits to be spoken to: 강 사장님's last question went
  // unanswered in July, and offering a reply under it is worse than silence.
  // It keeps its history and nothing else until he writes again himself.
  const spoke = (t) => threadMessages(t, scenario, msgCount, extraMessages)
    .some((m) => m.day === day && !m.me)
  const heldBack = (t) =>
    (held?.has(t.id) || (t.wait && !grants[t.wait]) || (t.awaits && !spoke(t)) ? day : 0)
  const msgsOf = (t) => threadMessages(t, scenario, msgCount, extraMessages, heldBack(t))
  // History carries the date it was said on; this week's messages carry their day.
  const dateOf = (m) => m?.date ?? (m?.day === undefined ? null : days[m.day - 1]?.date ?? `${m.day}일차`)
  // Two kinds of picture end up in a conversation: a file this machine holds,
  // which describes itself from disk, and one somebody simply sent, which is
  // only ever a picture and says what it is on the message.
  const attached = (msg) => {
    const f = msg.photo ? findFile(fs, msg.photo) : null
    const src = fileImage(f ? f.image : msg.image)
    return src ? <img className="bubble-img" src={src} alt={(f ? f.alt ?? f.name : msg.alt) ?? ''} /> : null
  }
  const threads = m.sections.flatMap((s) => s.threads)
  const teamOf = (id) => m.sections.find((sec) => sec.threads.some((t) => t.id === id))?.title
  const unreadOf = (t) => unreadCount(msgsOf(t), seen[t.id] ?? 0)
  const thread = threads.find((t) => t.id === openId)
  // Room messages come from several people, so the sender's name picks the face.
  const people = Object.fromEntries(threads.map((t) => [t.name, t]))
  const matches = (t) => !q.trim() || t.name.includes(q.trim())
  const totalUnread = threads.reduce((n, t) => n + unreadOf(t), 0)

  // 대화를 열면 곧바로 다 읽은 것으로 표시되므로, 그 전에 어디까지 읽었는지를
  // 붙잡아 둔다. 이 값은 대화를 바꿀 때만 다시 잡는다 — 보고 있는 동안 새 줄이
  // 와도 선이 따라 내려가면 어디부터가 새 말인지 알 수 없다.
  const [readMark, setReadMark] = useState(0)
  useEffect(() => {
    const t = threads.find((x) => x.id === openId)
    setReadMark(t ? readUpTo(msgsOf(t), seen[t.id] ?? 0) : 0)
  }, [openId])

  useEffect(() => {
    const t = threads.find((x) => x.id === openId)
    if (t) markThreadSeen(t.id, msgsOf(t).length)
  }, [openId, msgCount, extraMessages])

  // Follow new messages down, but don't yank the view away from someone who has
  // scrolled up to re-read something.
  const toBottom = () => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }
  const onScroll = () => {
    const el = list.current
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    stick.current = true
    toBottom()
  }, [openId])

  const row = (t, preview) => (
    <Row key={t.id} t={t} preview={preview} unread={unreadOf(t)}
         selected={t.id === openId} onOpen={() => setOpenThread(source, t.id)}
         onProfile={setProfile} />
  )

  const busy = !!(thread && typing[thread.id])
  const all = thread ? msgsOf(thread) : []
  // 지난 기록은 접어 두고 이번 주 것만 펼쳐 둔다. 펼친 묶음은 뒤(최근)에서부터
  // 꺼내므로, 두 묶음을 열었다면 가장 최근 두 날짜 뭉치가 올라온다.
  // 접기는 보여주는 자리에서만 일어난다 — 아래 대화 판정은 전부 `shown`(전체)을
  // 그대로 읽는다. 무엇을 펼쳐 두었느냐가 오갈 말을 바꾸면 안 된다.
  const chunks = thread ? historyChunks(all) : []
  const opened = openedHistory[thread?.id] ?? 0
  const folded = chunks.slice(0, Math.max(0, chunks.length - opened))
  const hidden = folded.flat().length
  const shown = all
  const visible = hidden ? all.slice(hidden) : all
  // One pick per batch of incoming messages: the choices go quiet until the
  // other side says something new.
  const arrived = shown.filter((msg) => !msg.me).length
  const spent = thread && answeredAt[thread.id] >= arrived
  // A reaction can hand the conversation a new set of choices; otherwise the
  // thread's own sets advance as you keep replying.
  // A conversation still waiting its turn offers nothing to say back yet.
  const quiet = Boolean(thread && heldBack(thread))
  // The sets advance as the player keeps replying — their own replies, not
  // every line pushed into the thread, or a day's opening alone would jump
  // straight to the last set.
  const exchanged = shown.filter((m) => m.me).length
  // What the player has already said here, so a canned line is not handed back
  // the next time the other side speaks.
  const said = new Set(shown.filter((m) => m.me).map((m) => m.text))
  // 그리고 무엇을 이미 들었는지. 반응은 한 번뿐인데, 창을 닫으면 컴포넌트
  // state는 날아가고 기록은 남는다 — 그래서 기록 쪽을 읽는다. 같은 반응을 쓰는
  // 사진이 둘이면(고양이 두 장) 어느 쪽을 보내도 반응은 한 번이다.
  const heard = new Set(shown.filter((m) => !m.me).map((m) => m.text))
  const choices = !thread || quiet
    ? []
    : offerable(branch[thread.id]
      ?? quickSets(thread)[Math.min(exchanged, quickSets(thread).length - 1)],
    { gate: thread.gate, grants, said })
  // 기록이 위에 붙으면 읽고 있던 자리가 그만큼 밀린다. 붙기 전 높이를 재 두고
  // 그 차이만큼 내려 주면 보던 자리가 그대로 남는다.
  const loadMore = () => {
    if (loading) return
    setLoading(true)
    const el = list.current
    const before = el ? el.scrollHeight : 0
    setTimeout(() => {
      const next = opened + 1
      openHistory(thread.id, next)
      setLoading(false)
      // Reaching the bottom of a conversation is its own kind of looking, and
      // one of them looks back.
      if (next >= chunks.length && thread.id === scenario.readBack?.thread) readAllBack()
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - before
      })
    }, 400)
  }

  const speak = (lines) => sayBack(thread.id, thread.name, lines)

  const reactTo = (key) => {
    const hit = thread.reactions?.find(
      (r) => r.files?.includes(key) || r.choice === key)
    // Sharing the same photo twice shouldn't repeat the same gushing; a wrong
    // answer, on the other hand, has to stay answerable until it's right.
    if (!hit || (hit.files && heard.has(hit.reply[0]))) return
    if (hit.next) setBranch(thread.id, hit.next)
    if (hit.ask) setAsk(thread.id, hit.ask)
    if (hit.grants) grant(hit.grants)
    speak(hit.reply)
  }

  // Anything the player has to look up gets typed in, so picking from a list
  // can't stand in for actually finding it.
  const ask = !thread || quiet ? null : (thread.id in pendingAsks ? pendingAsks[thread.id] : thread.ask ?? null)
  // Right and wrong are the same whether the answer was typed or dropped in.
  const solved = () => {
    // a question may hand straight over to the next one
    setAsk(thread.id, ask.then ?? null)
    if (ask.next) setBranch(thread.id, ask.next)
    if (ask.grants) grant(ask.grants)
    speak(ask.ok)
  }
  const missed = () => {
    slip()
    nextHint()
  }
  // 힌트를 달라고 되묻는 것은 틀린 답이 아니다 — slip() 을 부르지 않는다.
  // 대신 힌트 단계는 함께 올라간다. 물어서 1번을 듣고 틀렸는데 또 1번을
  // 들으면 되묻기가 한 번 낭비된 셈이 된다.
  const nextHint = () => {
    const n = wrongs[thread.id] ?? 0
    setWrongs((w) => ({ ...w, [thread.id]: n + 1 }))
    speak(hintAfter(ask, n, mercy))
  }
  // 요청을 받고도 어디서부터 봐야 할지 모를 때 되묻는 자리. 문구는 요청이
  // 직접 들고 있으면 그것을, 없으면 어디에나 맞는 말을 쓴다.
  const askHint = () => {
    // 1단계는 "그거 말고 이거요" — 틀린 답을 바로잡는 말이라, 아직 아무
    // 답도 안 낸 사람에게는 무엇을 묻는지만 되풀이하는 셈이 된다. 되묻는
    // 사람에게 필요한 것은 어디를 보라는 말이고, 그건 2단계부터다.
    const { lines, step } = hintReply(ask, Math.max(wrongs[thread.id] ?? 0, 1))
    say(thread.id, { text: hintAskOf(thread, ask) })
    setAnsweredAt((a) => ({ ...a, [thread.id]: arrived }))
    // 다음 오답은 여기서 이어받는다.
    setWrongs((w) => ({ ...w, [thread.id]: step }))
    markHinted(hintKey(thread.id, ask))
    speak(lines)
  }

  const answer = () => {
    const text = draft.trim()
    if (!text) return
    say(thread.id, { text })
    setDraft('')
    // typing at a question that wants a file is always the wrong kind of answer
    if (!ask.files && answerFits(ask, text)) solved()
    else missed()
  }

  const choose = (text) => {
    say(thread.id, { text })
    setAnsweredAt((a) => ({ ...a, [thread.id]: arrived }))
    reactTo(text)
  }

  // A question with buttons instead of a box: the thread's own reactions answer it.
  const pick = (text) => {
    setAsk(thread.id, ask.then ?? null)
    choose(text)
  }

  // A file nobody asked for gets a puzzled reply — a different one the second time.
  const shrug = () => {
    const lines = thread.shrug ?? m.shrug
    if (!lines?.length) return
    const n = shrugs[thread.id] ?? 0
    setShrugs((c) => ({ ...c, [thread.id]: n + 1 }))
    speak(lines[n % lines.length])
  }

  const sendFile = (file) => {
    say(thread.id, { file: file.name, image: file.image })
    if (!ask?.files) {
      return thread.reactions?.some((r) => r.files?.includes(file.id)) ? reactTo(file.id) : shrug()
    }
    if (fileFits(ask, file.id)) solved()
    else missed()
  }

  useEffect(() => {
    if (stick.current) toBottom()
  }, [shown.length, busy])

  // A drop is easy to do by accident and sending can't be undone, so it asks first.
  const drop = useFileDrop((id) => {
    const file = findFile(fs, id)
    if (file && thread && !busy) setConfirming(file)
  })

  return (
    <div className={'mg mg-' + (source === 'workMessenger' ? 'work' : 'private')
      + (phone ? ' mg-phone' : '') + (phone && thread ? ' on' : '')}>
      <div className="mg-rail">
        <button className={'mg-rail-btn' + (tab === 'friends' ? ' on' : '')}
                onClick={() => setTab('friends')} title="친구">
          <Users size={20} strokeWidth={1.8} />
        </button>
        <button className={'mg-rail-btn' + (tab === 'chats' ? ' on' : '')}
                onClick={() => setTab('chats')} title="채팅">
          <MessageSquare size={20} strokeWidth={1.8} />
          {totalUnread > 0 && <span className="mg-rail-badge">{totalUnread}</span>}
        </button>
        <span className="mg-rail-gap" />
        <span className="mg-rail-btn off" title="설정"><Settings size={19} strokeWidth={1.8} /></span>
      </div>

      <div className="mg-side">
        <div className="mg-top">
          <Search size={17} strokeWidth={1.9} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="이름으로 검색" aria-label="친구 검색" spellCheck={false} />
          <span className="mg-top-btn" title="친구 추가"><UserPlus size={17} strokeWidth={1.8} /></span>
          <span className="mg-top-btn" title="목록 설정"><Sliders size={17} strokeWidth={1.8} /></span>
        </div>

        <div className="mg-list">
          <div className="mg-me">
            <Avatar t={{ id: m.me.avatar ?? 'me', name: m.me.name, sub: m.me.sub,
                             color: m.me.color, phone: m.me.phone, online: true }}
                    size={42} onOpen={setProfile} />
            <span className="mg-row-mid">
              <span className="mg-row-name">{m.me.name}</span>
              <span className="mg-row-sub">{m.me.sub}</span>
            </span>
            <span className="mg-pc">PC</span>
          </div>

          {tab === 'friends' && m.sections.map((sec) => {
            const list = sec.threads.filter(matches)
            if (!list.length) return null
            const shut = collapsed[sec.title]
            return (
              <div key={sec.title}>
                <button className="mg-sec"
                        onClick={() => setCollapsed((c) => ({ ...c, [sec.title]: !shut }))}>
                  {sec.title} {sec.threads.length}
                  <ChevronDown size={15} strokeWidth={2}
                               style={{ transform: shut ? 'rotate(-90deg)' : 'none' }} />
                </button>
                {!shut && list.map((t) => row(t))}
              </div>
            )
          })}

          {tab === 'chats' && (() => {
            const list = threads.filter((t) => matches(t) && msgsOf(t).length > 0)
            if (!list.length) return <div className="mg-none">대화가 없습니다</div>
            return list.map((t) => row(t, msgsOf(t).slice(-1)[0].text))
          })()}
        </div>
      </div>

      <div className={'mg-conv' + (drop.over && thread ? ' drop' : '')} {...drop.dropProps}>
        {!thread && <div className="mg-none">왼쪽에서 대화 상대를 선택하세요</div>}
        {thread && (
          <>
            <div className="mg-chat-top">
              {phone && (
                <button className="mg-back" onClick={() => setOpenThread(source, null)}
                        title="목록" aria-label="목록으로">
                  <ChevronLeft size={18} strokeWidth={2.2} />
                </button>
              )}
              <Avatar t={thread} size={32} onOpen={setProfile} />
              <div className="mg-chat-who">
                <div className="mg-chat-name">{thread.name}</div>
                <div className="mg-chat-sub">{thread.sub}</div>
              </div>
            </div>
            <div className="msg-list" ref={list} onScroll={onScroll}>
              {folded.length > 0 && (
                loading ? (
                  <div className="msg-more busy">
                    <span className="spinner sm" />불러오는 중…
                  </div>
                ) : (
                  <button className="msg-more" onClick={loadMore}>
                    이전 메시지 {folded[folded.length - 1].length}개 더 보기
                  </button>
                )
              )}
              {visible.length === 0 && <div className="msg-empty">아직 메시지가 없습니다</div>}
              {visible.map((msg, i, all) => {
                const prev = all[i - 1]
                const label = dateOf(msg)
                const dated = label !== null && label !== dateOf(prev)
                const date = dated && <div className="msg-date">{label}</div>
                // 열었을 때 안 읽고 있던 첫 줄 앞에 금을 긋는다. 오늘 날짜
                // 안에서도 어디부터가 새로 온 말인지 보이게.
                const fresh = readMark > hidden && i === readMark - hidden && (
                  <div className="msg-unread"><span>여기까지 읽었습니다</span></div>
                )
                if (msg.me) return (
                  <Fragment key={i}>
                    {fresh}
                    {date}
                    <div className={'bubble me' + (msg.file ? ' file' : '')}>
                      {!msg.file && <>{msg.text}{attached(msg)}</>}
                      {msg.file && msg.image && (
                        <img className="bubble-img" src={fileImage(msg.image)} alt={msg.file} />
                      )}
                      {msg.file && !msg.image && (
                        <><Paperclip size={13} strokeWidth={2} />{msg.file}</>
                      )}
                    </div>
                  </Fragment>
                )
                const opens = !prev || prev.me || prev.from !== msg.from || dated
                const who = people[msg.from] ?? thread
                return (
                  <Fragment key={i}>
                    {fresh}
                    {date}
                    <div className="msg-row">
                      <span className="msg-av">{opens && <Avatar t={who} size={32} onOpen={setProfile} />}</span>
                      <div className="bubble them">{opens && <b>{msg.from}</b>}{msg.text}{attached(msg)}</div>
                    </div>
                  </Fragment>
                )
              })}
              {busy && (
                <div className="msg-row">
                  <span className="msg-av"><Avatar t={thread} size={32} onOpen={setProfile} /></span>
                  <div className="typing"><span className="spinner sm" />작성중…</div>
                </div>
              )}
            </div>
            {ask && !ask.choices && ask.no?.length > 0 && !hinted[hintKey(thread.id, ask)] && (
              <div className="quick-hint-row">
                <button className="quick-hint" disabled={busy} onClick={askHint}>
                  <HelpCircle size={14} strokeWidth={2} />
                  {hintAskOf(thread, ask)}
                </button>
              </div>
            )}
            <div className="quick">
              <button className="quick-att" disabled={busy} title="파일 보내기"
                      onClick={() => setPicking(true)}>
                <Paperclip size={16} strokeWidth={1.9} />
              </button>
              {quiet ? (
                <span className="quick-done">새 메시지가 없습니다</span>
              ) : ask?.choices ? (
                ask.choices.map((text) => (
                  <button key={text} disabled={busy} onClick={() => pick(text)}>{text}</button>
                ))
              ) : ask ? (
                <>
                  {/* 상대가 아직 치고 있는 동안에는 다음 질문을 미리 보여주지
                      않는다 — 답을 맞히자마자 입력칸이 다음 질문으로 바뀌면,
                      상대가 그 질문을 말하기도 전에 답부터 알게 된다. */}
                  <input className="quick-input" value={draft} disabled={busy}
                         onChange={(e) => setDraft(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && !busy && answer()}
                         placeholder={busy ? '' : ask.placeholder} aria-label={ask.placeholder} />
                  <button className="quick-send" disabled={busy || !draft.trim()}
                          onClick={answer}>전송</button>
                </>
              ) : choices.length === 0 ? (
                <span className="quick-done">대화가 끝났습니다</span>
              ) : spent ? (
                <span className="quick-done">답장을 보냈습니다</span>
              ) : (
                choices.map((text) => (
                  <button key={text} disabled={busy} onClick={() => choose(text)}>{text}</button>
                ))
              )}
            </div>
            {confirming && (
              <div className="mg-ask">
                <div className="mg-ask-card">
                  {confirming.image
                    ? <img className="mg-ask-img" src={fileImage(confirming.image)} alt={confirming.name} />
                    : <div className="mg-ask-file"><Paperclip size={15} strokeWidth={2} />{confirming.name}</div>}
                  <p><b>{thread.name}</b>님에게 이 파일을 전송하시겠습니까?</p>
                  <div className="mg-ask-row">
                    <button className="btn-primary"
                            onClick={() => { sendFile(confirming); setConfirming(null) }}>
                      보내기
                    </button>
                    <button className="sm-cancel" onClick={() => setConfirming(null)}>취소</button>
                  </div>
                </div>
              </div>
            )}
            {picking && (
              <FileDialog start={pinned.length ? ['바탕화면', WORK_FOLDER] : '문서'}
                          onPick={(f) => { sendFile(f); setPicking(false) }}
                          onClose={() => setPicking(false)} />
            )}
          </>
        )}
      </div>

      {profile && (
        <ProfileCard who={profile} team={teamOf(profile.id)}
                     onChat={profile.id !== openId && threads.some((t) => t.id === profile.id)
                       ? () => { setOpenThread(source, profile.id); setProfile(null) }
                       : null}
                     onClose={() => setProfile(null)} />
      )}
    </div>
  )
}
