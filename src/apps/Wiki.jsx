import { useState } from 'react'
import { ChevronRight, Clock, FolderOpen } from '../icons/line.jsx'

export default function Wiki({ site }) {
  const w = site.wiki
  const [id, setId] = useState(w.home)
  const page = w.pages[id]

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
      </article>
    </div>
  )
}
