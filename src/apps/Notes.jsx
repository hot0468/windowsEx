import { useState } from 'react'
import { useGame } from '../engine/store.js'

// A scratch notes server the last occupant of this desk left running. Nothing
// here is an answer to anything — it is what was on the machine before it was
// hers, and it stops mid-sentence.
//
// It also still accepts writes. Whatever she adds lands under his last line,
// dated this week instead of 2023, and is still there on Friday.
export default function Notes({ site }) {
  const n = site.notes
  const myNotes = useGame((s) => s.myNotes)
  const writeNote = useGame((s) => s.writeNote)
  const days = useGame((s) => s.scenario.days)
  const [draft, setDraft] = useState('')

  const save = () => {
    if (!draft.trim()) return
    writeNote(draft)
    setDraft('')
  }
  // His entries carry a real 2023 date; hers carry the day of the week she is in.
  const dateOf = (day) => days[day - 1]?.date ?? `${day}일차`

  return (
    <div className="nt">
      <div className="nt-head">
        <h1>{n.header}</h1>
        {/* The count in the header is his, from 2023. Once she starts adding
            her own it has to include them, or the page contradicts itself. */}
        <p>{myNotes.length
          ? n.sub.replace(/\d+개/, n.entries.length + myNotes.length + '개')
          : n.sub}</p>
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

      {myNotes.map((note, i) => (
        <article key={'me' + i} className="nt-entry nt-mine">
          <div className="nt-meta">
            <span className="nt-date">{dateOf(note.day)}</span>
          </div>
          <p>{note.text}</p>
        </article>
      ))}

      <div className="nt-write">
        <textarea value={draft} rows={3} spellCheck={false}
                  aria-label="메모 쓰기"
                  placeholder="여기에 적으면 저장됩니다."
                  onChange={(e) => setDraft(e.target.value)} />
        <button className="btn-primary" disabled={!draft.trim()} onClick={save}>저장</button>
      </div>

      <div className="nt-foot">
        {/* "이후 수정 없음" stops being true the moment she saves one. */}
        <span>{myNotes.length ? n.footer.split('·')[0].trim() : n.footer}</span>
        <span className="nt-uptime">{n.uptime}</span>
      </div>
    </div>
  )
}
