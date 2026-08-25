// A scratch notes server the last occupant of this desk left running. Nothing
// here is an answer to anything — it is what was on the machine before it was
// hers, and it stops mid-sentence.
export default function Notes({ site }) {
  const n = site.notes
  return (
    <div className="nt">
      <div className="nt-head">
        <h1>{n.header}</h1>
        <p>{n.sub}</p>
      </div>

      {n.entries.map((e, i) => (
        <article key={i} className={'nt-entry' + (e.cut ? ' cut' : '')}>
          <div className="nt-meta">
            <span className="nt-date">{e.date}</span>
            {e.title && <span className="nt-title">{e.title}</span>}
          </div>
          {e.lines.map((line, k) => <p key={k}>{line}</p>)}
          {e.cut && <span className="nt-caret" />}
        </article>
      ))}

      <div className="nt-foot">
        <span>{n.footer}</span>
        <span className="nt-uptime">{n.uptime}</span>
      </div>
    </div>
  )
}
