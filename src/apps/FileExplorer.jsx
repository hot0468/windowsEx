import { useState } from 'react'
import { useGame, entriesAt } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { ArrowUp, ChevronRight } from '../icons/line.jsx'

export default function FileExplorer({ startFolder }) {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  const roots = Object.keys(scenario.fs)
  const [path, setPath] = useState([startFolder ?? roots[0]])

  const entries = entriesAt(scenario.fs, path)
  const folders = entries.filter((e) => e.children)
  const files = entries.filter((e) => !e.children)

  return (
    <div className="explorer">
      <div className="ex-side">
        {roots.map((name) => (
          <button key={name} className={'ex-folder' + (path[0] === name ? ' sel' : '')}
                  onClick={() => setPath([name])}>
            <Icon name={name === '휴지통' ? 'trash' : 'folder'} size={17} />{name}
          </button>
        ))}
      </div>

      <div className="ex-body">
        <div className="ex-bar">
          <button className="ex-up" disabled={path.length < 2} title="상위 폴더"
                  onClick={() => setPath(path.slice(0, -1))}>
            <ArrowUp size={16} strokeWidth={1.9} />
          </button>
          <div className="ex-crumbs">
            {path.map((name, i) => (
              <span key={i} className="ex-crumb">
                {i > 0 && <ChevronRight size={13} strokeWidth={2} />}
                <button onClick={() => setPath(path.slice(0, i + 1))}>{name}</button>
              </span>
            ))}
          </div>
        </div>

        <div className="ex-main">
          {entries.length === 0 && <div className="ex-empty">이 폴더는 비어 있습니다</div>}
          {folders.map((f) => (
            <button key={f.name} className="ex-file"
                    onDoubleClick={() => setPath([...path, f.name])}>
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
      </div>
    </div>
  )
}
