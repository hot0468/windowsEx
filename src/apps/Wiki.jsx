import { useEffect, useState } from 'react'
import { ChevronRight, Clock, FolderOpen } from '../icons/line.jsx'
import { useGame, wikiPage } from '../engine/store.js'

export default function Wiki({ site, path = '' }) {
  const w = site.wiki
  // a path names a page directly — including ones the sidebar never lists
  const wanted = path && w.pages[path.slice(1)] ? path.slice(1) : null
  const unlockSite = useGame((s) => s.unlockSite)
  // Reaching a host-only page is itself the objective.
  useEffect(() => { if (site.requiresHost) unlockSite(site.url) }, [site.url])
  const [id, setId] = useState(wanted ?? w.home)
  useEffect(() => { if (wanted) setId(wanted) }, [wanted])
  const scenario = useGame((s) => s.scenario)
  const wikiEdits = useGame((s) => s.wikiEdits)
  const day = useGame((s) => s.day)
  const editWiki = useGame((s) => s.editWiki)
  const [writing, setWriting] = useState(false)
  const [line, setLine] = useState('')
  // Three pages take an edit; the rest are the answer sheets the week is built
  // on, and letting her rewrite those would break the walkthrough.
  const canEdit = scenario.wikiEdit?.pages.includes(id)
  const page = canEdit ? wikiPage(scenario, { wikiEdits, day }, id) : w.pages[id]
  const save = () => {
    if (!line.trim()) return
    editWiki(id, line)
    setWriting(false)
    setLine('')
  }
  const foundMissing = useGame((s) => s.foundMissing)
  // reading the page that will not let a sixth employee go
  useEffect(() => { if (id === 'attend') foundMissing() }, [id])
  const traceObserver = useGame((s) => s.traceObserver)
  // reading who was on the seventh floor that night
  useEffect(() => { if (id === 'printlog') traceObserver() }, [id])

  return (
    <div className="wk">
      <aside className="wk-side">
        <div className="wk-space">
          <FolderOpen size={15} strokeWidth={1.9} />{w.space}
        </div>
        {w.nav.map((sec) => (
          <div key={sec.section} className="wk-sec">
            <div className="wk-sec-name">{sec.section}</div>
            {sec.pages.map((p) => (
              <button key={p.id} className={'wk-link' + (p.id === id ? ' on' : '')}
                      onClick={() => setId(p.id)}>
                {p.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <article className="wk-page">
        <div className="wk-crumb">
          {page.crumb.map((c, i) => (
            <span key={i}>{i > 0 && <ChevronRight size={11} strokeWidth={2.4} />}{c}</span>
          ))}
        </div>
        <h1>{page.title}</h1>
        <div className="wk-meta">
          <Clock size={12} strokeWidth={2} />최종 수정 {page.updated} · {page.author}
        </div>

        <p className="wk-intro">{page.intro}</p>

        {page.table && (
          <table className="wk-table">
            <thead>
              <tr>{page.table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {page.table.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}

        {page.list && (
          <ol className="wk-list">
            {page.list.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        )}

        {page.notes?.map((n, i) => <div key={i} className="wk-note">※ {n}</div>)}

        {canEdit && (
          <div className="wk-edit">
            {writing ? (
              <>
                <p className="wk-edit-hint">{scenario.wikiEdit.hint}</p>
                <input value={line} spellCheck={false}
                       placeholder={scenario.wikiEdit.placeholder}
                       aria-label={scenario.wikiEdit.placeholder}
                       onChange={(e) => setLine(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && save()} />
                <div className="wk-edit-row">
                  <button className="btn-primary" disabled={!line.trim()} onClick={save}>
                    {scenario.wikiEdit.save}
                  </button>
                  <button className="sm-cancel" onClick={() => { setWriting(false); setLine('') }}>
                    {scenario.wikiEdit.cancel}
                  </button>
                </div>
              </>
            ) : (
              <button className="wk-edit-btn" onClick={() => setWriting(true)}>
                {scenario.wikiEdit.button}
              </button>
            )}
          </div>
        )}
      </article>
    </div>
  )
}
