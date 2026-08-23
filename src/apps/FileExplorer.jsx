import { useState } from 'react'
import { useGame, entriesAt, searchFiles } from '../engine/store.js'
import { useFolderNav } from './folderNav.js'
import Icon from '../icons/Icon.jsx'
import { ArrowUp, ChevronLeft, ChevronRight, Search } from '../icons/line.jsx'

export default function FileExplorer({ startFolder }) {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  const roots = Object.keys(scenario.fs)
  const nav = useFolderNav(startFolder ?? roots[0])
  const [q, setQ] = useState('')

  const here = nav.path[nav.path.length - 1]
  const searching = Boolean(q.trim())
  const hits = searching ? searchFiles(scenario.fs, nav.path, q) : []
  const entries = entriesAt(scenario.fs, nav.path)
  const folders = entries.filter((e) => e.children)
  const files = entries.filter((e) => !e.children)

  const goTo = (path) => { setQ(''); nav.goTo(path) }

  return (
    <div className="explorer">
      <div className="ex-side">
        {roots.map((name) => (
          <button key={name} className={'ex-folder' + (nav.path[0] === name ? ' sel' : '')}
                  onClick={() => goTo([name])}>
            <Icon name={name === '휴지통' ? 'trash' : 'folder'} size={17} />{name}
          </button>
        ))}
      </div>

      <div className="ex-body">
        <div className="ex-bar">
          <button className="ex-up" onClick={() => { setQ(''); nav.goBack() }}
                  disabled={!nav.canBack} title="뒤로">
            <ChevronLeft size={17} strokeWidth={1.9} />
          </button>
          <button className="ex-up" onClick={() => { setQ(''); nav.goForward() }}
                  disabled={!nav.canForward} title="앞으로">
            <ChevronRight size={17} strokeWidth={1.9} />
          </button>
          <button className="ex-up" onClick={() => { setQ(''); nav.goUp() }}
                  disabled={!nav.canUp} title="상위 폴더">
            <ArrowUp size={16} strokeWidth={1.9} />
          </button>
          <div className="ex-crumbs">
            {nav.path.map((name, i) => (
              <span key={i} className="ex-crumb">
                {i > 0 && <ChevronRight size={13} strokeWidth={2} />}
                <button onClick={() => goTo(nav.path.slice(0, i + 1))}>{name}</button>
              </span>
            ))}
          </div>
          <div className="ex-search">
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder={`${here} 검색`} aria-label="파일 검색" spellCheck={false} />
            <Search size={14} strokeWidth={1.9} />
          </div>
        </div>

        {searching ? (
          <div className="ex-hits">
            <div className="ex-hits-head">'{q.trim()}' 검색 결과 {hits.length}건 — {here} 및 하위 폴더</div>
            {hits.length === 0 && <div className="ex-empty">일치하는 파일이 없습니다</div>}
            {hits.map(({ file, trail }) => (
              <button key={file.id} className="ex-hit"
                      onDoubleClick={() => openWindow('notepad', { fileId: file.id })}>
                <Icon name="doc" size={26} />
                <span className="ex-hit-mid">
                  <span>{file.name}</span>
                  <span className="ex-hit-path">{[here, ...trail].join(' › ')}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ex-main">
            {entries.length === 0 && <div className="ex-empty">이 폴더는 비어 있습니다</div>}
            {folders.map((f) => (
              <button key={f.name} className="ex-file"
                      onDoubleClick={() => goTo([...nav.path, f.name])}>
                <div className="glyph"><Icon name="folder" size={36} /></div>{f.name}
              </button>
            ))}
            {files.map((f) => (
              <button key={f.id} className="ex-file"
                      onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
                <div className="glyph"><Icon name="doc" size={36} /></div>{f.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
