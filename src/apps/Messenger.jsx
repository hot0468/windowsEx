import { useEffect, useState } from 'react'
import { useGame, WORK_FOLDER, findFile } from '../engine/store.js'
import FileDialog from './FileDialog.jsx'
import { useFileDrop } from './dragFile.js'
import { faceOf, photoOf } from '../assets/photos.js'
import {
  BellOff, ChevronDown, MessageSquare,
  Paperclip, Search, Settings, Sliders, UserPlus, Users
} from '../icons/line.jsx'

// Fallback only — each thread carries replies in the register that person expects.
const QUICK = ['네, 알겠습니다', '감사합니다']

const Avatar = ({ t, size }) => {
  const photo = photoOf(t.id)
  const face = faceOf(t.id)
  return (
    <span className={'mg-av' + (t.room ? ' room' : '')}
          style={{ background: t.color, width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {photo && <img className="mg-photo" src={photo} alt="" draggable="false" />}
      {!photo && face && <img className="mg-face" src={face} alt="" draggable="false" />}
      {!photo && !face && t.name[0]}
      {t.online && <i className="mg-dot" />}
    </span>
  )
}

const Row = ({ t, preview, unread, selected, onOpen }) => (
  <button className={'mg-row' + (selected ? ' sel' : '')} onClick={onOpen}>
    <Avatar t={t} size={40} />
    <span className="mg-row-mid">
      <span className="mg-row-name">
        {t.name}{t.muted && <BellOff size={12} strokeWidth={2.2} />}
      </span>
      <span className="mg-row-sub">{preview ?? t.sub}</span>
    </span>
    {unread > 0 && <span className="mg-badge">{unread}</span>}
  </button>
)

export default function Messenger({ source }) {
  const m = useGame((s) => s.scenario[source])
  const fs = useGame((s) => s.scenario.fs)
  const liveMessages = useGame((s) => s.scenario.messenger)
  const msgCount = useGame((s) => s.msgCount)
  const openId = useGame((s) => s.openThread[source] ?? null)
  const setOpenThread = useGame((s) => s.setOpenThread)
  const seen = useGame((s) => s.seenThreads)
  const markThreadSeen = useGame((s) => s.markThreadSeen)
  const typing = useGame((s) => s.typing)
  const [replies, setReplies] = useState({})
  const [collapsed, setCollapsed] = useState({})
  const [tab, setTab] = useState('friends')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const pinned = useGame((s) => s.pinned)

  // A live thread's messages arrive on the scenario's timer; the rest are already there.
  const msgsOf = (t) => (t.live ? liveMessages.slice(0, msgCount) : t.messages)
  const threads = m.sections.flatMap((s) => s.threads)
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

  const row = (t, preview) => (
    <Row key={t.id} t={t} preview={preview} unread={unreadOf(t)}
         selected={t.id === openId} onOpen={() => setOpenThread(source, t.id)} />
  )

  const busy = !!(thread && typing[thread.id])
  const mine = thread ? replies[thread.id] ?? [] : []
  const say = (entry) =>
    setReplies((r) => ({ ...r, [thread.id]: [...(r[thread.id] ?? []), entry] }))
  const drop = useFileDrop((id) => {
    const file = findFile(fs, id)
    if (file && thread && !busy) say({ file: file.name })
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
            <Avatar t={{ id: 'me', name: m.me.name, color: m.me.color, online: true }} size={42} />
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
              <Avatar t={thread} size={32} />
              <div className="mg-chat-who">
                <div className="mg-chat-name">{thread.name}</div>
                <div className="mg-chat-sub">{thread.sub}</div>
              </div>
            </div>
            <div className="msg-list">
              {msgsOf(thread).length === 0 && <div className="msg-empty">아직 메시지가 없습니다</div>}
              {msgsOf(thread).map((msg, i, all) => {
                if (msg.me) return <div key={i} className="bubble me">{msg.text}</div>
                const prev = all[i - 1]
                const opens = !prev || prev.me || prev.from !== msg.from
                const who = people[msg.from] ?? thread
                return (
                  <div key={i} className="msg-row">
                    <span className="msg-av">{opens && <Avatar t={who} size={32} />}</span>
                    <div className="bubble them">{opens && <b>{msg.from}</b>}{msg.text}</div>
                  </div>
                )
              })}
              {mine.map((sent, i) => (
                <div key={'r' + i} className={'bubble me' + (sent.file ? ' file' : '')}>
                  {sent.file ? <><Paperclip size={13} strokeWidth={2} />{sent.file}</> : sent.text}
                </div>
              ))}
              {busy && (
                <div className="msg-row">
                  <span className="msg-av"><Avatar t={thread} size={32} /></span>
                  <div className="typing"><span className="spinner sm" />작성중…</div>
                </div>
              )}
            </div>
            <div className="quick">
              <button className="quick-att" disabled={busy} title="파일 보내기"
                      onClick={() => setPicking(true)}>
                <Paperclip size={16} strokeWidth={1.9} />
              </button>
              {(thread.quick ?? QUICK).map((text) => (
                <button key={text} disabled={busy} onClick={() => say({ text })}>{text}</button>
              ))}
            </div>
            {picking && (
              <FileDialog start={pinned.length ? ['바탕화면', WORK_FOLDER] : '문서'}
                          onPick={(f) => { say({ file: f.name }); setPicking(false) }}
                          onClose={() => setPicking(false)} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
