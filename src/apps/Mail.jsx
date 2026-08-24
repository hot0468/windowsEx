import { useState } from 'react'
import { sortMails, useGame } from '../engine/store.js'
import Compose from './Compose.jsx'
import { ChevronDown, ChevronUp, Paperclip, PenLine, Search, Send, Star } from '../icons/line.jsx'

export default function Mail() {
  const scenario = useGame((s) => s.scenario)
  const extraMails = useGame((s) => s.extraMails)
  const readMails = useGame((s) => s.readMails)
  const starred = useGame((s) => s.starred)
  const markMailRead = useGame((s) => s.markMailRead)
  const obituary = useGame((s) => s.scenario.ending.clues.mail)
  const witness = useGame((s) => s.witness)
  const toggleStar = useGame((s) => s.toggleStar)
  const sendReply = useGame((s) => s.sendReply)
  const sendMail = useGame((s) => s.sendMail)
  const restored = useGame((s) => s.restored)
  const restoreFile = useGame((s) => s.restoreFile)
  const crash = useGame((s) => s.crash)
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [sent, setSent] = useState(false)
  const [q, setQ] = useState('')

  const all = sortMails([...scenario.mails, ...extraMails])
  const term = q.trim().toLowerCase()
  const mails = term
    ? all.filter((m) => `${m.subject} ${m.from} ${m.body}`.toLowerCase().includes(term))
    : all
  const mail = all.find((m) => m.id === selected)
  const at = mails.findIndex((m) => m.id === selected)
  const unread = all.filter((m) => !readMails[m.id]).length

  const open = (m) => {
    setSelected(m.id)
    setComposing(false)
    setSent(false)
    markMailRead(m.id)
    if (m.id === obituary) witness()
  }
  const step = (by) => {
    const next = mails[at + by]
    if (next) open(next)
  }
  const send = (draft) => {
    if (mail) sendReply(draft)
    else sendMail(draft)
    setSent(true)
    setComposing(false)
  }

  // Composing takes over the window, the way webmail does.
  if (composing) {
    return <Compose mail={mail} onSend={send} onCancel={() => setComposing(false)} />
  }

  return (
    <div className="mail-layout">
      <div className="mail-list">
        <div className="ml-head">
          <button className="ml-write" onClick={() => { setSelected(null); setComposing(true); setSent(false) }}>
            <PenLine size={14} strokeWidth={2} />메일쓰기
          </button>
          <div className="ml-title">받은메일함 <b>{unread}</b> / {all.length}</div>
          <div className="ml-search">
            <Search size={14} strokeWidth={1.9} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="메일 검색" aria-label="메일 검색" spellCheck={false} />
          </div>
        </div>
        {mails.length === 0 && <div className="ml-none">검색 결과가 없습니다</div>}
        {mails.map((m) => (
          <div key={m.id}
               className={'mail-item' + (readMails[m.id] ? '' : ' unread') + (selected === m.id ? ' sel' : '')}
               onClick={() => open(m)}>
            <div className="mi-from">{m.from}</div>
            <div className="mi-subject">{m.subject}</div>
            <div className="mi-date">{m.date}</div>
          </div>
        ))}
      </div>

      <div className="mail-detail">
        {!mail && (
          <div className="mail-empty">
            {sent ? '메일을 보냈습니다. 곧 답장이 올지도 모릅니다…' : '메일을 선택하세요'}
          </div>
        )}
        {mail && (
          <>
            <div className="md-bar">
              {mail.canReply && (
                <button className="md-act" onClick={() => { setComposing(true); setSent(false) }}>답장</button>
              )}
              <button className="md-act"
                      onClick={() => { markMailRead(mail.id, false); setSelected(null) }}>안읽음</button>
              <span className="md-bar-gap" />
              <button className="md-nav" onClick={() => step(-1)} disabled={at <= 0} title="이전 메일">
                <ChevronUp size={16} strokeWidth={1.9} />
              </button>
              <button className="md-nav" onClick={() => step(1)}
                      disabled={at < 0 || at >= mails.length - 1} title="다음 메일">
                <ChevronDown size={16} strokeWidth={1.9} />
              </button>
            </div>

            {sent && (
              <div className="mail-sent">
                <Send size={15} strokeWidth={1.8} />메일을 보냈습니다. 곧 답장이 올지도 모릅니다…
              </div>
            )}

            <div className="md-head">
              <button className={'md-star' + (starred[mail.id] ? ' on' : '')}
                      onClick={() => toggleStar(mail.id)}
                      title={starred[mail.id] ? '중요 표시 해제' : '중요 표시'}>
                <Star size={18} strokeWidth={1.8} />
              </button>
              <h3>{mail.subject}</h3>
            </div>
            <div className="md-sender">
              <span className="md-sender-label">보낸사람</span>
              <span className="md-chip">{mail.from}</span>
            </div>
            <div className="md-date">{mail.date}</div>
            <pre className="md-body">{mail.body}</pre>
            {mail.attach && (
              <div className="md-attach">
                <div className="md-attach-head">
                  <Paperclip size={13} strokeWidth={2} />첨부파일 1개
                </div>
                <div className="md-attach-row">
                  <span className="md-attach-name">{mail.attach.name}</span>
                  <span className="md-attach-size">{mail.attach.size}</span>
                  {mail.attach.fileId ? (
                    <button className="md-attach-run" disabled={!!restored[mail.attach.fileId]}
                            onClick={() => restoreFile(mail.attach.fileId)}>
                      {restored[mail.attach.fileId] ? '다운로드 폴더에 저장됨' : '저장'}
                    </button>
                  ) : (
                    <button className="md-attach-run" onClick={() => mail.attach.danger && crash()}>
                      실행
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
