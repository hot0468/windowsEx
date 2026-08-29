import { useState } from 'react'
import { ChevronLeft, ChevronDown, Flag, MessageSquare, ThumbsDown, ThumbsUp } from '../icons/line.jsx'
import { useGame, boardPosts, canPick, myPosts, postComments, roomReply, roomTopic } from '../engine/store.js'

// An outside community site: a list of posts, one post at a time, nothing to
// log into. A room with an `ask` block also lets the player post a question.
export default function Board({ site }) {
  const b = site.board
  const [id, setId] = useState(null)
  const [draft, setDraft] = useState('')
  const [thread, setThread] = useState([])
  const [waiting, setWaiting] = useState(false)
  const askedRoom = useGame((s) => s.askedRoom)
  const day = useGame((s) => s.day)
  const scenario = useGame((s) => s.scenario)
  const posted = useGame((s) => s.posted)
  const postTo = useGame((s) => s.postTo)
  const grants = useGame((s) => s.grants)
  const boardPicks = useGame((s) => s.boardPicks)
  const pickOnPost = useGame((s) => s.pickOnPost)
  const [writing, setWriting] = useState(null)
  const [notice, setNotice] = useState(false)
  // Hers sit on top of the board's own, newest first, the way a board works.
  const mine = b.compose ? myPosts(scenario, { posted, day }, site.url) : []
  const posts = [...mine, ...boardPosts(b.posts, day)]
  const post = posts.find((p) => p.id === id)
  // 글에 남긴 답과 그 답글까지 합친 댓글. 목록의 댓글 수도 같은 셈을 쓴다.
  const pickOf = (p) => boardPicks[site.url + '/' + p.id]
  const commentsOf = (p) => postComments(p, pickOf(p), day)
  // A post of hers that is no longer listed was taken down. Saying so is the
  // whole point — silently bouncing back to the list would read as a bug.
  const removed = !post && id
    ? b.compose?.options.find((o) => o.id === id && posted[site.url + '/' + id] !== undefined)
    : null

  const send = () => {
    const question = draft.trim()
    if (!question || waiting) return
    const reply = roomReply(b.ask, question, thread.length)
    setThread((t) => [...t, { question, reply: null }])
    setDraft('')
    setWaiting(true)
    askedRoom(roomTopic(b.ask, question))
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

      {removed ? (
        <article className="bd-post">
          <button className="bd-back" onClick={() => setId(null)}>
            <ChevronLeft size={13} strokeWidth={2.2} />목록
          </button>
          <div className="bd-gone">{removed.gone}</div>
        </article>
      ) : post ? (
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
          <div className="bd-cm-head">댓글 {commentsOf(post).length}</div>
          {commentsOf(post).map((c, i) => (
            <div key={i} className={'bd-cm' + (c.me ? ' me' : '')}>
              <div className="bd-cm-top">
                <span className="bd-cm-who">{c.author}</span>
                <span className="bd-cm-time">{c.time}</span>
                <span className="bd-cm-votes">
                  <span className="up"><ThumbsUp size={13} strokeWidth={2} />{c.likes}</span>
                  <span><ThumbsDown size={13} strokeWidth={2} />{c.dislikes ?? 0}</span>
                  <span className="bd-cm-flag" title="신고"><Flag size={12} strokeWidth={2} /></span>
                </span>
              </div>
              <div className="bd-cm-text">{c.text}</div>
              <div className="bd-cm-foot">
                <span>답글 <b>0</b>개<ChevronDown size={12} strokeWidth={2.2} /></span>
                <i />
                <span>답글쓰기</span>
              </div>
            </div>
          ))}
          {/* 답할 수 있는 글이면 준비된 말 중에서 고른다. 자유 입력이 아닌
              이유는 글쓰기와 같다 — 쓴 말을 읽고 답하는 척은 반드시 들킨다. */}
          {canPick(post, pickOf(post), grants) && (
            <div className="bd-pick">
              {post.picks.map((o) => (
                <button key={o.text} onClick={() => pickOnPost(site.url, post.id, o)}>
                  {o.text}
                </button>
              ))}
            </div>
          )}
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
          {b.compose && (
            <div className="bd-compose">
              <button className="btn-primary" onClick={() => setWriting('pick')}>
                {b.compose.button}
              </button>
              {notice && <span className="bd-posted">{b.compose.posted}</span>}
            </div>
          )}
          <div className="bd-list">
            {posts.map((p) => (
              <button key={p.id} className="bd-row" onClick={() => setId(p.id)}>
                <span className="bd-co">{p.company}</span>
                <span className="bd-title">{p.title}</span>
                <span className="bd-n"><MessageSquare size={12} strokeWidth={2} />{commentsOf(p).length}</span>
                <span className="bd-n"><ThumbsUp size={12} strokeWidth={2} />{p.likes}</span>
                <span className="bd-time">{p.time}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {writing && (
        <div className="mg-ask" onPointerDown={() => setWriting(null)}>
          <div className="bd-write-card" onPointerDown={(e) => e.stopPropagation()}>
            <h2>{b.compose.title}</h2>
            <p className="bd-write-hint">{b.compose.hint}</p>
            {/* Picking beats typing here: a written reaction per topic reads as
                the board having understood, which keyword matching never does. */}
            <div className="bd-write-picks">
              {b.compose.options.map((o) => {
                const already = posted[site.url + '/' + o.id] !== undefined
                return (
                  <button key={o.id} disabled={already}
                          className={'bd-write-pick' + (writing === o.id ? ' on' : '')}
                          onClick={() => setWriting(o.id)}>
                    {o.pick}
                    {already && <i>이미 올림</i>}
                  </button>
                )
              })}
            </div>
            <div className="bd-write-row">
              <button className="btn-primary" disabled={writing === 'pick'}
                      onClick={() => {
                        postTo(site.url, writing)
                        setWriting(null)
                        setNotice(true)
                      }}>
                {b.compose.submit}
              </button>
              <button className="sm-cancel" onClick={() => setWriting(null)}>{b.compose.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
