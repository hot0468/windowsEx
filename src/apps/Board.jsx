import { useState } from 'react'
import { ChevronLeft, MessageSquare, ThumbsUp } from '../icons/line.jsx'
import { roomReply } from '../engine/store.js'

// An outside community site: a list of posts, one post at a time, nothing to
// log into. A room with an `ask` block also lets the player post a question.
export default function Board({ site }) {
  const b = site.board
  const [id, setId] = useState(null)
  const [draft, setDraft] = useState('')
  const [thread, setThread] = useState([])
  const [waiting, setWaiting] = useState(false)
  const post = b.posts.find((p) => p.id === id)

  const send = () => {
    const question = draft.trim()
    if (!question || waiting) return
    const reply = roomReply(b.ask, question, thread.length)
    setThread((t) => [...t, { question, reply: null }])
    setDraft('')
    setWaiting(true)
    setTimeout(() => {
      setThread((t) => t.map((entry, i) => (i === t.length - 1 ? { ...entry, reply } : entry)))
      setWaiting(false)
    }, 1600)
  }

  return (
    <div className="bd">
      <div className="bd-top">
        <button className="bd-logo" onClick={() => setId(null)}>{b.name}</button>
        <span className="bd-tag">{b.tagline}</span>
      </div>

      {post ? (
        <article className="bd-post">
          <button className="bd-back" onClick={() => setId(null)}>
            <ChevronLeft size={13} strokeWidth={2.2} />목록
          </button>
          <h1>{post.title}</h1>
          <div className="bd-meta">
            <span className="bd-co">{post.company}</span>{post.author} · {post.time}
            <span className="bd-likes"><ThumbsUp size={12} strokeWidth={2} />{post.likes}</span>
          </div>
          {post.body.map((line, i) => <p key={i}>{line}</p>)}
          <div className="bd-cm-head">댓글 {post.comments.length}</div>
          {post.comments.map((c, i) => (
            <div key={i} className="bd-cm">
              <span className="bd-cm-who">{c.author}</span>
              <span className="bd-cm-text">{c.text}</span>
              <span className="bd-likes"><ThumbsUp size={11} strokeWidth={2} />{c.likes}</span>
            </div>
          ))}
        </article>
      ) : (
        <>
          {b.ask && (
            <div className="bd-ask">
              <div className="bd-ask-row">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && send()}
                       placeholder={b.ask.placeholder} aria-label={b.ask.placeholder}
                       spellCheck={false} />
                <button className="btn-primary" disabled={!draft.trim() || waiting}
                        onClick={send}>{b.ask.send}</button>
              </div>
              <div className="bd-ask-note">{b.ask.posting}</div>
              {thread.map((entry, i) => (
                <div key={i} className="bd-ask-pair">
                  <div className="bd-ask-q"><span>익명(나)</span>{entry.question}</div>
                  {entry.reply
                    ? <div className="bd-ask-a"><span>{entry.reply.author}</span>{entry.reply.text}</div>
                    : <div className="bd-ask-wait">{b.ask.waiting}</div>}
                </div>
              ))}
            </div>
          )}
          <div className="bd-list">
            {b.posts.map((p) => (
              <button key={p.id} className="bd-row" onClick={() => setId(p.id)}>
                <span className="bd-co">{p.company}</span>
                <span className="bd-title">{p.title}</span>
                <span className="bd-n"><MessageSquare size={12} strokeWidth={2} />{p.comments.length}</span>
                <span className="bd-n"><ThumbsUp size={12} strokeWidth={2} />{p.likes}</span>
                <span className="bd-time">{p.time}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
