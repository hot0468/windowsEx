import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame, entriesAt } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { ArrowUp, ChevronLeft, ChevronRight, FolderOpen, Search, X } from '../icons/line.jsx'

// Windows' "열기" dialog, over the whole desktop like the real one.
export default function FileDialog({ start = '문서', onPick, onClose }) {
  const fs = useGame((s) => s.scenario.fs)
  const roots = Object.keys(fs)
  const [path, setPath] = useState([roots.includes(start) ? start : roots[0]])
  const [back, setBack] = useState([])
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')

  const goTo = (next) => {
    setBack([...back, path])
    setPath(next)
    setSelected(null)
    setName('')
    setQ('')
  }
  const goBack = () => {
    if (!back.length) return
    setPath(back[back.length - 1])
    setBack(back.slice(0, -1))
    setSelected(null)
  }

  const entries = entriesAt(fs, path).filter(
    (e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()))
  const folders = entries.filter((e) => e.children)
  const files = entries.filter((e) => !e.children)

  const pick = (file) => {
    setSelected(file)
    setName(file.name)
  }
  const confirm = () => {
    const chosen = selected ?? files.find((f) => f.name === name.trim())
    if (chosen) onPick(chosen)
  }

  return createPortal(
    <div className="fd-backdrop" onPointerDown={onClose}>
      <div className="fd" onPointerDown={(e) => e.stopPropagation()}>
        <div className="fd-title">
          <FolderOpen size={16} strokeWidth={1.8} />
          <span>열기</span>
          <button className="fd-x" onClick={onClose} title="닫기"><X size={15} strokeWidth={1.6} /></button>
        </div>

        <div className="fd-nav">
          <button onClick={goBack} disabled={!back.length} title="뒤로">
            <ChevronLeft size={17} strokeWidth={1.9} />
          </button>
          <button onClick={() => path.length > 1 && goTo(path.slice(0, -1))}
                  disabled={path.length < 2} title="상위 폴더">
            <ArrowUp size={16} strokeWidth={1.9} />
          </button>
          <div className="fd-crumbs">
            {path.map((part, i) => (
              <span key={i} className="ex-crumb">
                {i > 0 && <ChevronRight size={13} strokeWidth={2} />}
                <button onClick={() => goTo(path.slice(0, i + 1))}>{part}</button>
              </span>
            ))}
          </div>
          <div className="fd-search">
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder={`${path[path.length - 1]} 검색`} aria-label="파일 검색" />
            <Search size={15} strokeWidth={1.9} />
          </div>
        </div>

        <div className="fd-body">
          <div className="fd-side">
            {roots.map((root) => (
              <button key={root} className={'fd-root' + (path[0] === root ? ' sel' : '')}
                      onClick={() => goTo([root])}>
                <Icon name={root === '휴지통' ? 'trash' : 'folder'} size={16} />{root}
              </button>
            ))}
          </div>

          <div className="fd-grid">
            {entries.length === 0 && <div className="ex-empty">항목이 없습니다</div>}
            {folders.map((f) => (
              <button key={f.name} className="fd-item" onDoubleClick={() => goTo([...path, f.name])}>
                <Icon name="folder" size={44} />{f.name}
              </button>
            ))}
            {files.map((f) => (
              <button key={f.id} className={'fd-item' + (selected?.id === f.id ? ' sel' : '')}
                      onClick={() => pick(f)} onDoubleClick={() => onPick(f)}>
                <Icon name="doc" size={44} />{f.name}
              </button>
            ))}
          </div>
        </div>

        <div className="fd-foot">
          <label htmlFor="fd-name">파일 이름(N):</label>
          <input id="fd-name" value={name} onChange={(e) => { setName(e.target.value); setSelected(null) }}
                 onKeyDown={(e) => e.key === 'Enter' && confirm()} spellCheck={false} />
          <span className="fd-filter">모든 파일 (*.*)</span>
          <button className="btn-primary" onClick={confirm}>열기(O)</button>
          <button className="sm-cancel" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
