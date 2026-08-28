import { useEffect, useState } from 'react'
import { FolderOpen } from '../icons/line.jsx'
import { useGame } from '../engine/store.js'
import WikiDoc from './wikiDoc.jsx'

export default function Wiki({ site, path = '' }) {
  const w = site.wiki
  // a path names a page directly — including ones the sidebar never lists
  const wanted = path && w.pages[path.slice(1)] ? path.slice(1) : null
  const unlockSite = useGame((s) => s.unlockSite)
  // Reaching a host-only page is itself the objective.
  useEffect(() => { if (site.requiresHost) unlockSite(site.url) }, [site.url])
  const [id, setId] = useState(wanted ?? w.home)
  useEffect(() => { if (wanted) setId(wanted) }, [wanted])

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
        <WikiDoc site={site} id={id} />
      </article>
    </div>
  )
}
