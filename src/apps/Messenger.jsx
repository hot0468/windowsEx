import { Fragment, useEffect, useRef, useState } from 'react'
import { useGame, WORK_FOLDER, answerFits, fileFits, findFile, hintAfter, quickSets } from '../engine/store.js'
import FileDialog from './FileDialog.jsx'
import { useFileDrop } from './dragFile.js'
import { faceOf, fileImage, photoOf } from '../assets/photos.js'
import {
  BellOff, ChevronDown, MessageSquare,
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

export default function Messenger({ source }) {
  const m = useGame((s) => s.scenario[source])
  const fs = useGame((s) => s.scenario.fs)
  const liveMessages = useGame((s) => s.scenario.messenger)
  const msgCount = useGame((s) => s.msgCount)
  const extraMessages = useGame((s) => s.extraMessages)
  const days = useGame((s) => s.scenario.days)
  const openId = useGame((s) => s.openThread[source] ?? null)
  const setOpenThread = useGame((s) => s.setOpenThread)
  const seen = useGame((s) => s.seenThreads)
  const markThreadSeen = useGame((s) => s.markThreadSeen)
  const setTyping = useGame((s) => s.setTyping)
  const pendingAsks = useGame((s) => s.pendingAsks)
  const setAsk = useGame((s) => s.setAsk)
  const grant = useGame((s) => s.grant)
  const slip = useGame((s) => s.slip)
  const mercy = useGame((s) => s.mercy)
  const typing = useGame((s) => s.typing)
  const [replies, setReplies] = useState({})
  const [collapsed, setCollapsed] = useState({})
  const [tab, setTab] = useState('friends')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const [answeredAt, setAnsweredAt] = useState({})
  const [reacted, setReacted] = useState({})
  const [shrugs, setShrugs] = useState({})
  const [wrongs, setWrongs] = useState({})
  const [confirming, setConfirming] = useState(null)
  const [branch, setBranch] = useState({})
  const [draft, setDraft] = useState('')
  const [profile, setProfile] = useState(null)
  const list = useRef(null)
  const stick = useRef(true)
  const pending = useRef([])
  const typingFor = useRef(null)
  const pinned = useGame((s) => s.pinned)

  // A live thread's messages arrive on the scenario's timer; the rest are already there.
  const msgsOf = (t) => [
    ...(t.live ? liveMessages.slice(0, msgCount) : t.messages),
    ...(extraMessages[t.id] ?? [])
  ]
  const threads = m.sections.flatMap((s) => s.threads)
  const teamOf = (id) => m.sections.find((sec) => sec.threads.some((t) => t.id === id))?.title
  const unreadOf = (t) => msgsOf(t).length - (seen[t.id] ?? 0)
  const thread = threads.find((t) => t.id === openId)
  // Room messages come from several people, so the sender's name picks the face.
  const people = Object.fromEntries(threads.map((t) => [t.name, t]))
  const matches = (t) => !q.trim() || t.name.includes(q.trim())
  const totalUnread = threads.reduce((n, t) => n + unreadOf(t), 0)

  useEffect(() => {
    const t = threads.find((x) => x.id === openId)
    if (t) markThreadSeen(t.id, msgsOf(t).length)
  }, [openId, msgCount])

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
  const mine = thread ? replies[thread.id] ?? [] : []
  const say = (entry) =>
    setReplies((r) => ({ ...r, [thread.id]: [...(r[thread.id] ?? []), entry] }))
  // One pick per batch of incoming messages: the choices go quiet until the
  // other side says something new.
  const arrived = thread ? msgsOf(thread).length + mine.filter((e) => e.from).length : 0
  const spent = thread && answeredAt[thread.id] >= arrived
  // A reaction can hand the conversation a new set of choices; otherwise the
  // thread's own sets advance as you keep replying.
  const choices = !thread
    ? []
    : branch[thread.id]
      ?? quickSets(thread)[Math.min(mine.filter((e) => e.text).length, quickSets(thread).length - 1)]
  // The other side writes for a beat, then the lines land one after another.
  const speak = (lines) => {
    const id = thread.id
    const who = thread.name
    typingFor.current = id
    setTyping(id, true)
    lines.forEach((text, i) => {
      pending.current.push(setTimeout(() => {
        setReplies((r) => ({ ...r, [id]: [...(r[id] ?? []), { from: who, text }] }))
        if (i === lines.length - 1) {
          setTyping(id, false)
          typingFor.current = null
        }
      }, 1200 + i * 1500))
    })
  }

  const reactTo = (key) => {
    const hit = thread.reactions?.find(
      (r) => r.files?.includes(key) || r.choice === key)
    // Sharing the same photo twice shouldn't repeat the same gushing; a wrong
    // answer, on the other hand, has to stay answerable until it's right.
    if (!hit || (hit.files && reacted[key])) return
    if (hit.files) setReacted((r) => ({ ...r, [key]: true }))
    if (hit.next) setBranch((b) => ({ ...b, [thread.id]: hit.next }))
    if (hit.ask) setAsk(thread.id, hit.ask)
    if (hit.grants) grant(hit.grants)
    speak(hit.reply)
  }

  // Anything the player has to look up gets typed in, so picking from a list
  // can't stand in for actually finding it.
  const ask = thread ? (thread.id in pendingAsks ? pendingAsks[thread.id] : thread.ask ?? null) : null
  // Right and wrong are the same whether the answer was typed or dropped in.
  const solved = () => {
    // a question may hand straight over to the next one
    setAsk(thread.id, ask.then ?? null)
    if (ask.next) setBranch((b) => ({ ...b, [thread.id]: ask.next }))
    if (ask.grants) grant(ask.grants)
    speak(ask.ok)
  }
  const missed = () => {
    slip()
    const n = wrongs[thread.id] ?? 0
    setWrongs((w) => ({ ...w, [thread.id]: n + 1 }))
    speak(hintAfter(ask, n, mercy))
  }

  const answer = () => {
    const text = draft.trim()
    if (!text) return
    say({ text })
    setDraft('')
    // typing at a question that wants a file is always the wrong kind of answer
    if (!ask.files && answerFits(ask, text)) solved()
    else missed()
  }

  const choose = (text) => {
    say({ text })
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
    say({ file: file.name, image: file.image })
    if (!ask?.files) {
      return thread.reactions?.some((r) => r.files?.includes(file.id)) ? reactTo(file.id) : shrug()
    }
    if (fileFits(ask, file.id)) solved()
    else missed()
  }

  useEffect(() => () => {
    pending.current.forEach(clearTimeout)
    if (typingFor.current) setTyping(typingFor.current, false)
  }, [])

  useEffect(() => {
    if (stick.current) toBottom()
  }, [thread ? msgsOf(thread).length : 0, mine.length, busy])

  // A drop is easy to do by accident and sending can't be undone, so it asks first.
  const drop = useFileDrop((id) => {
    const file = findFile(fs, id)
    if (file && thread && !busy) setConfirming(file)
  })

  return (
    <div className="mg">
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
                             color: m.me.color, online: true }}
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
              <Avatar t={thread} size={32} onOpen={setProfile} />
              <div className="mg-chat-who">
                <div className="mg-chat-name">{thread.name}</div>
                <div className="mg-chat-sub">{thread.sub}</div>
              </div>
            </div>
            <div className="msg-list" ref={list} onScroll={onScroll}>
              {msgsOf(thread).length === 0 && <div className="msg-empty">아직 메시지가 없습니다</div>}
              {msgsOf(thread).map((msg, i, all) => {
                const prev = all[i - 1]
                const day = msg.day ?? 1
                const dated = !prev || (prev.day ?? 1) !== day
                const date = dated && <div className="msg-date">{days[day - 1]?.date ?? `${day}일차`}</div>
                if (msg.me) return <Fragment key={i}>{date}<div className="bubble me">{msg.text}</div></Fragment>
                const opens = !prev || prev.me || prev.from !== msg.from || dated
                const who = people[msg.from] ?? thread
                return (
                  <Fragment key={i}>
                    {date}
                    <div className="msg-row">
                      <span className="msg-av">{opens && <Avatar t={who} size={32} onOpen={setProfile} />}</span>
                      <div className="bubble them">{opens && <b>{msg.from}</b>}{msg.text}</div>
                    </div>
                  </Fragment>
                )
              })}
              {mine.map((sent, i) => (sent.from ? (
                <div key={'r' + i} className="msg-row">
                  <span className="msg-av"><Avatar t={thread} size={32} onOpen={setProfile} /></span>
                  <div className="bubble them"><b>{sent.from}</b>{sent.text}</div>
                </div>
              ) : (
                <div key={'r' + i} className={'bubble me' + (sent.file ? ' file' : '')}>
                  {!sent.file && sent.text}
                  {sent.file && sent.image && (
                    <img className="bubble-img" src={fileImage(sent.image)} alt={sent.file} />
                  )}
                  {sent.file && !sent.image && (
                    <><Paperclip size={13} strokeWidth={2} />{sent.file}</>
                  )}
                </div>
              )))}
              {busy && (
                <div className="msg-row">
                  <span className="msg-av"><Avatar t={thread} size={32} onOpen={setProfile} /></span>
                  <div className="typing"><span className="spinner sm" />작성중…</div>
                </div>
              )}
            </div>
            <div className="quick">
              <button className="quick-att" disabled={busy} title="파일 보내기"
                      onClick={() => setPicking(true)}>
                <Paperclip size={16} strokeWidth={1.9} />
              </button>
              {ask?.choices ? (
                ask.choices.map((text) => (
                  <button key={text} disabled={busy} onClick={() => pick(text)}>{text}</button>
                ))
              ) : ask ? (
                <>
                  <input className="quick-input" value={draft} disabled={busy}
                         onChange={(e) => setDraft(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && !busy && answer()}
                         placeholder={ask.placeholder} aria-label={ask.placeholder} />
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
