import { useState } from 'react'
import { useGame, allFiles } from '../engine/store.js'

export default function Mail() {
  const scenario = useGame((s) => s.scenario)
  const extraMails = useGame((s) => s.extraMails)
  const readMails = useGame((s) => s.readMails)
  const markMailRead = useGame((s) => s.markMailRead)
  const sendReply = useGame((s) => s.sendReply)
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [body, setBody] = useState('')
  const [att, setAtt] = useState('')
  const [sent, setSent] = useState(false)

  const mails = [...scenario.mails, ...extraMails]
  const mail = mails.find((m) => m.id === selected)

  const open = (m) => {
    setSelected(m.id)
    setComposing(false)
    setSent(false)
    markMailRead(m.id)
  }
  const send = () => {
    sendReply({ attachmentId: att || null, body })
    setSent(true)
    setComposing(false)
    setBody('')
    setAtt('')
  }

  return (
    <div className="mail-layout">
      <div className="mail-list">
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
        {sent && <div className="mail-sent">📨 메일을 보냈습니다. 곧 답장이 올지도 모릅니다…</div>}
        {!mail && !sent && <div className="mail-empty">메일을 선택하세요</div>}
        {mail && !composing && (
          <>
            <h3>{mail.subject}</h3>
            <div className="md-meta">{mail.from} · {mail.date}</div>
            <pre className="md-body">{mail.body}</pre>
            {mail.canReply && (
              <button className="btn-primary" onClick={() => { setComposing(true); setSent(false) }}>↩ 회신</button>
            )}
          </>
        )}
        {mail && composing && (
          <div className="compose">
            <div className="md-meta">받는 사람: {mail.from}</div>
            <div className="md-meta">제목: RE: {mail.subject}</div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder="본문을 입력하세요" aria-label="메일 본문" />
            <div className="compose-row">
              <span>📎</span>
              <select value={att} onChange={(e) => setAtt(e.target.value)} aria-label="첨부 파일 선택">
                <option value="">첨부 없음</option>
                {allFiles(scenario.fs).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button className="btn-primary" onClick={send}>보내기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
