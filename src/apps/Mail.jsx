import { useState } from 'react'
import { useViewport } from '../shell/useViewport.js'
import { sortMails, useGame } from '../engine/store.js'
import Compose from './Compose.jsx'
import { ChevronDown, ChevronLeft, ChevronUp, Paperclip, PenLine, Search, Send, Star } from '../icons/line.jsx'

export default function Mail() {
  const scenario = useGame((s) => s.scenario)
  const extraMails = useGame((s) => s.extraMails)
  const readMails = useGame((s) => s.readMails)
  const starred = useGame((s) => s.starred)
  const markMailRead = useGame((s) => s.markMailRead)
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
  // 받은메일함 / 보낸메일함. 보낸 것을 다시 볼 길이 없으면, 거래처가
  // ‘그때 보내주신 것’을 말해도 맞추어 볼 수가 없다.
  const [box, setBox] = useState('in')
  // 폰에서는 목록과 본문이 한 화면에 같이 설 자리가 없다 — 하나씩 본다.
  const phone = useViewport() === 'phone'
  const sentMails = useGame((s) => s.sentMails)

  // 안 읽은 것이 위로. 읽고 나면 제 날짜 자리로 내려간다.
  const inbox = sortMails([...scenario.mails, ...extraMails], readMails)
  // 보낸 것은 최근이 위다. 읽고 안 읽고가 없다.
  const all = box === 'in' ? inbox : [...sentMails].reverse()
  const term = q.trim().toLowerCase()
  const who = (m) => (m.sent ? m.to : m.from)
  const mails = term
    ? all.filter((m) => `${m.subject} ${who(m)} ${m.body}`.toLowerCase().includes(term))
    : all
  const mail = all.find((m) => m.id === selected)
  const at = mails.findIndex((m) => m.id === selected)
  const unread = inbox.filter((m) => !readMails[m.id]).length

  const open = (m) => {
    setSelected(m.id)
    setComposing(false)
    setSent(false)
    if (!m.sent) markMailRead(m.id)
  }
  const goBox = (next) => { setBox(next); setSelected(null); setComposing(false); setSent(false) }
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
    <div className={'mail-layout' + (phone ? ' mail-phone' : '')}>
      {(!phone || !mail) && (
      <div className="mail-list">
        <div className="ml-head">
          <button className="ml-write" onClick={() => { setSelected(null); setComposing(true); setSent(false) }}>
            <PenLine size={14} strokeWidth={2} />메일쓰기
          </button>
          <div className="ml-boxes">
            <button className={box === 'in' ? 'on' : ''} onClick={() => goBox('in')}>
              받은메일함{unread > 0 && <b>{unread}</b>}
            </button>
            <button className={box === 'out' ? 'on' : ''} onClick={() => goBox('out')}>
              보낸메일함{sentMails.length > 0 && <span>{sentMails.length}</span>}
            </button>
          </div>
          <div className="ml-search">
            <Search size={14} strokeWidth={1.9} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="메일 검색" aria-label="메일 검색" spellCheck={false} />
          </div>
        </div>
        {mails.length === 0 && <div className="ml-none">검색 결과가 없습니다</div>}
        {mails.map((m) => (
          <div key={m.id}
               className={'mail-item' + (!m.sent && !readMails[m.id] ? ' unread' : '') + (selected === m.id ? ' sel' : '')}
               onClick={() => open(m)}>
            <div className="mi-from">{box === 'out' && <i>받는사람</i>}{who(m)}</div>
            <div className="mi-subject">{m.subject}</div>
            <div className="mi-date">{m.date}</div>
          </div>
        ))}
      </div>
      )}

      {(!phone || mail) && (
      <div className="mail-detail">
        {!mail && (
          <div className="mail-empty">
            {sent ? '메일을 보냈습니다. 곧 답장이 올지도 모릅니다…'
              : box === 'out' && all.length === 0 ? '아직 보낸 메일이 없습니다'
                : '메일을 선택하세요'}
          </div>
        )}
        {mail && (
          <>
            <div className="md-bar">
              {/* 폰에서는 목록이 이 화면에 가려져 있다 — 돌아갈 길을 준다. */}
              {phone && (
                <button className="md-act md-back" onClick={() => setSelected(null)}>
                  <ChevronLeft size={15} strokeWidth={2.1} />목록
                </button>
              )}
              {mail.canReply && !mail.sent && (
                <button className="md-act" onClick={() => { setComposing(true); setSent(false) }}>답장</button>
              )}
              {/* 이미 나간 메일은 읽고 안 읽고가 없고, 답장할 상대도 나 자신이다. */}
              {!mail.sent && (
                <button className="md-act"
                        onClick={() => { markMailRead(mail.id, false); setSelected(null) }}>안읽음</button>
              )}
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
              {!mail.sent && (
                <button className={'md-star' + (starred[mail.id] ? ' on' : '')}
                        onClick={() => toggleStar(mail.id)}
                        title={starred[mail.id] ? '중요 표시 해제' : '중요 표시'}>
                  <Star size={18} strokeWidth={1.8} />
                </button>
              )}
              <h3>{mail.subject}</h3>
            </div>
            <div className="md-sender">
              <span className="md-sender-label">{mail.sent ? '받는사람' : '보낸사람'}</span>
              <span className="md-chip">{mail.sent ? mail.to : mail.from}</span>
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
                  {mail.sent ? null : mail.attach.fileId ? (
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
      )}
    </div>
  )
}
