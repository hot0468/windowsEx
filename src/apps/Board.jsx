import { useState } from 'react'
import { ChevronLeft, MessageSquare, ThumbsUp } from '../icons/line.jsx'

// An outside community site: a list of posts, one post at a time, nothing to log into.
export default function Board({ site }) {
  const b = site.board
  const [id, setId] = useState(null)
  const post = b.posts.find((p) => p.id === id)

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
      )}
    </div>
  )
}
