import { useEffect, useState } from 'react'
import { ChevronLeft, FolderOpen, LayoutGrid, List, Search } from '../icons/line.jsx'
import { useGame } from '../engine/store.js'
import WikiDoc from './wikiDoc.jsx'

// 사내 드라이브는 사내위키와 같은 문서를 담지만 위키가 아니다 — 팀이 파일을
// 올려 두는 공유 폴더다. 둘이 똑같이 생겨서 어느 쪽을 보고 있는지 구분이 안
// 됐다. 여기서는 문서함이 아니라 파일 목록으로 그린다: 폴더를 열고, 이름 ·
// 소유자 · 수정 날짜로 훑고, 하나를 눌러 연다. 데이터는 그대로다.
export default function Drive({ site, path = '' }) {
  const w = site.wiki
  // 주소로 곧장 지목한 페이지 — 사이드바에 없는 것도 열린다
  const wanted = path && w.pages[path.slice(1)] ? path.slice(1) : null
  const unlockSite = useGame((s) => s.unlockSite)
  // Reaching a host-only page is itself the objective.
  useEffect(() => { if (site.requiresHost) unlockSite(site.url) }, [site.url])

  const folderOf = (id) => w.nav.find((sec) => sec.pages.some((p) => p.id === id))?.section ?? null
  const [open, setOpen] = useState(wanted)
  const [folder, setFolder] = useState(wanted ? folderOf(wanted) : null)
  useEffect(() => {
    if (!wanted) return
    setOpen(wanted)
    setFolder(folderOf(wanted))
  }, [wanted])

  const foundMissing = useGame((s) => s.foundMissing)
  // reading the page that will not let a sixth employee go
  useEffect(() => { if (open === 'attend') foundMissing() }, [open])
  const traceObserver = useGame((s) => s.traceObserver)
  // reading who was on the seventh floor that night
  useEffect(() => { if (open === 'printlog') traceObserver() }, [open])

  const section = w.nav.find((sec) => sec.section === folder)
  const enter = (sec) => { setFolder(sec); setOpen(null) }
  const rows = section?.pages ?? []

  return (
    <div className="dr">
      <aside className="dr-side">
        <div className="dr-brand"><FolderOpen size={18} strokeWidth={1.8} />{w.space}</div>
        <button className={'dr-nav' + (folder === null ? ' on' : '')} onClick={() => enter(null)}>
          <FolderOpen size={15} strokeWidth={1.9} />내 드라이브
        </button>
        {w.nav.map((sec) => (
          <button key={sec.section} className={'dr-nav dr-nav-sub' + (folder === sec.section ? ' on' : '')}
                  onClick={() => enter(sec.section)}>
            <FolderOpen size={15} strokeWidth={1.9} />{sec.section}
          </button>
        ))}
        <div className="dr-quota">
          <div className="dr-quota-bar"><i style={{ width: '38%' }} /></div>
          <span>200GB 중 76.4GB 사용</span>
        </div>
      </aside>

      <main className="dr-main">
        <div className="dr-search">
          <Search size={16} strokeWidth={1.9} />
          <span>드라이브에서 검색</span>
        </div>

        <div className="dr-crumb">
          {open ? (
            <button className="dr-back" onClick={() => setOpen(null)}>
              <ChevronLeft size={14} strokeWidth={2.2} />{folder ?? '내 드라이브'}
            </button>
          ) : (
            <h2>{folder ?? '내 드라이브'}</h2>
          )}
          <span className="dr-crumb-gap" />
          <span className="dr-view"><List size={15} strokeWidth={2} /></span>
          <span className="dr-view off"><LayoutGrid size={15} strokeWidth={2} /></span>
        </div>

        {open ? (
          <article className="dr-doc">
            <WikiDoc site={site} id={open} />
          </article>
        ) : (
          <table className="dr-table">
            <thead>
              <tr>
                <th>이름</th>
                <th className="dr-col-who">소유자</th>
                <th className="dr-col-when">수정 날짜</th>
              </tr>
            </thead>
            <tbody>
              {folder === null
                ? w.nav.map((sec) => (
                  <tr key={sec.section}>
                    <td>
                      <button className="dr-name" onClick={() => enter(sec.section)}>
                        <FolderOpen size={16} strokeWidth={1.8} />{sec.section}
                      </button>
                    </td>
                    <td className="dr-col-who">공유 폴더</td>
                    <td className="dr-col-when">파일 {sec.pages.length}개</td>
                  </tr>
                ))
                : rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button className="dr-name" onClick={() => setOpen(p.id)}>
                        <List size={16} strokeWidth={1.8} />{p.title}
                      </button>
                    </td>
                    <td className="dr-col-who">{w.pages[p.id]?.author}</td>
                    <td className="dr-col-when">{w.pages[p.id]?.updated}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
