import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronDown, Flag, Info, Lock, MessageSquare, ThumbsDown, ThumbsUp, X } from '../icons/line.jsx'
import { useGame, boardPosts, myPosts, roomReply, roomTopic } from '../engine/store.js'

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
  const [writing, setWriting] = useState(null)
  const [notice, setNotice] = useState(false)
  // Hers sit on top of the board's own, newest first, the way a board works.
  const mine = b.compose ? myPosts(scenario, { posted, day }, site.url) : []
  const posts = [...mine, ...boardPosts(b.posts, day)]
  const post = posts.find((p) => p.id === id)
  // 전 사용자를 말하는 글을 열었다. 메모 서버가 이걸 센다.
  const traces = scenario.sites.find((x) => x.layout === 'notes')?.notes.traces
  const sawTrace = useGame((s) => s.sawTrace)
  useEffect(() => { if (post && post.id === traces?.sotong) sawTrace('sotong') }, [post?.id])
  // A post of hers that is no longer listed was taken down. Saying so is the
  // whole point — silently bouncing back to the list would read as a bug.
  const removed = !post && id
    ? b.compose?.options.find((o) => o.id === id && posted[site.url + '/' + id] !== undefined)
    : null

  // 이미 올린 주제는 다시 올리지 못한다. 카드를 열면 키보드가 곳바로 여기로 온다.
  const writeRef = useRef(null)
  const isPosted = (o) => posted[site.url + '/' + o.id] !== undefined
  const chosen = b.compose?.options.find((o) => o.id === writing) ?? null
  const submitPost = () => {
    if (!chosen) return
    postTo(site.url, chosen.id)
    setWriting(null)
    setNotice(true)
  }
  useEffect(() => { if (writing) writeRef.current?.focus() }, [writing])

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
          <div className="bd-cm-head">댓글 {post.comments.length}</div>
          {post.comments.map((c, i) => (
            <div key={i} className="bd-cm">
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
                <span className="bd-n"><MessageSquare size={12} strokeWidth={2} />{p.comments.length}</span>
                <span className="bd-n"><ThumbsUp size={12} strokeWidth={2} />{p.likes}</span>
                <span className="bd-time">{p.time}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {writing && (
        <div className="mg-ask" onPointerDown={() => setWriting(null)}>
          {/* 고르는 것이 쓰는 것보다 낫다: 주제마다 써 둔 반응은 게시판이 글을 알아들은 것처럼
              읽히고, 키워드 매칭은 그런 읽힘을 만들지 못한다. 그래서 선택지다 — 다만
              뭐가 올라가는지 보여 주고 고르게 한다. 되돌릴 수 없다고 경고해 놓고
              무엇을 올리는지 숨기면 그건 선택이 아니라 막기다. */}
          <div className="bd-write-card" tabIndex={-1} ref={writeRef}
               onPointerDown={(e) => e.stopPropagation()}
               onKeyDown={(e) => {
                 if (e.key === 'Escape') return setWriting(null)
                 if (e.key === 'Enter' && chosen) return submitPost()
                 const n = Number(e.key)
                 const o = n >= 1 && b.compose.options[n - 1]
                 if (o && !isPosted(o)) setWriting(o.id)
               }}>
            <div className="bd-write-head">
              <h2>{b.compose.title}</h2>
              <button className="bd-write-x" onClick={() => setWriting(null)}
                      aria-label={b.compose.cancel}><X size={15} strokeWidth={2.2} /></button>
            </div>
            <p className="bd-write-hint">{b.compose.hint}</p>

            <div className="bd-write-picks" role="radiogroup" aria-label={b.compose.title}>
              {b.compose.options.map((o, i) => {
                const already = isPosted(o)
                const on = writing === o.id
                return (
                  <button key={o.id} disabled={already} role="radio" aria-checked={on}
                          className={'bd-write-pick' + (on ? ' on' : '')}
                          onClick={() => setWriting(o.id)}>
                    <span className="bd-write-cue">{on ? '▶' : ''}</span>
                    <span className="bd-write-no">{i + 1}</span>
                    <span className="bd-write-text">{o.pick}</span>
                    {already && <Lock size={12} strokeWidth={2} />}
                  </button>
                )
              })}
            </div>

            {/* 미리보기는 고르기 전에도 자리를 지킨다 — 고를 때마다 창이 뛰면
                들융날융해서 읽달 수가 없다. */}
            <div className="bd-write-preview">
              <b>이렇게 올라갑니다</b>
              {chosen ? (
                <>
                  <span className="bd-write-pv-title">{chosen.title}</span>
                  <span className="bd-write-pv-body">{chosen.body[0]}</span>
                  <span className="bd-write-pv-by">
                    {b.compose.author} · {b.compose.company} · 방금
                  </span>
                </>
              ) : <span className="bd-write-pv-none">주제를 고르면 여기에 보입니다.</span>}
            </div>

            <p className="bd-write-warn"><Info size={13} strokeWidth={2} />{b.compose.warn}</p>

            <div className="bd-write-row">
              <button className="btn-primary" disabled={!chosen} onClick={submitPost}>
                {b.compose.submit}
              </button>
              <button className="sm-cancel" onClick={() => setWriting(null)}>{b.compose.cancel}</button>
            </div>
            <p className="bd-write-keys">1–{b.compose.options.length} 선택 · Enter {b.compose.submit} · Esc {b.compose.cancel}</p>
          </div>
        </div>
      )}
    </div>
  )
}
