import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useGame, dreamGallery, entriesAt, fileOpener, rootIcon, fsView, searchFiles, visible
} from '../engine/store.js'
import { useFolderNav } from './folderNav.js'
import Icon, { FileGlyph } from '../icons/Icon.jsx'
import { ArrowUp, ChevronLeft, ChevronRight, FolderOpen, Search, X } from '../icons/line.jsx'

// Windows' "열기" dialog, over the whole desktop like the real one.
export default function FileDialog({ start = '문서', onPick, onClose }) {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const shots = useGame((s) => s.shots)
  const restored = useGame((s) => s.restored)
  const showHidden = useGame((s) => s.showHidden)
  const dreamt = useGame((s) => s.dreamt)
  const tiles = useGame((s) => s.tiles)
  const placed = useGame((s) => s.placed)
  const touched = useGame((s) => s.touched)
  // a photo the dream gave back is not a file you can attach either
  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt), { pinned, restored, tiles, placed, touched, shots, scenario })
  // a binned file is not a file you can attach
  const roots = Object.keys(fs).filter((r) => r !== '휴지통')
  const nav = useFolderNav(start)
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')

  const here = nav.path[nav.path.length - 1]
  const searching = Boolean(q.trim())
  const entries = visible(entriesAt(fs, nav.path), showHidden)
  const folders = searching ? [] : entries.filter((e) => e.children)
  const files = (searching
    ? visible(searchFiles(fs, nav.path, q).map((h) => h.file), showHidden)
    : entries.filter((e) => !e.children)).filter((f) => !f.missing)

  const move = (fn) => () => { setQ(''); setSelected(null); setName(''); fn() }
  const goTo = (path) => move(() => nav.goTo(path))()

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
          <button onClick={move(nav.goBack)} disabled={!nav.canBack} title="뒤로">
            <ChevronLeft size={17} strokeWidth={1.9} />
          </button>
          <button onClick={move(nav.goForward)} disabled={!nav.canForward} title="앞으로">
            <ChevronRight size={17} strokeWidth={1.9} />
          </button>
          <button onClick={move(nav.goUp)} disabled={!nav.canUp} title="상위 폴더">
            <ArrowUp size={16} strokeWidth={1.9} />
          </button>
          <div className="fd-crumbs">
            {nav.path.map((part, i) => (
              <span key={i} className="ex-crumb">
                {i > 0 && <ChevronRight size={13} strokeWidth={2} />}
                <button onClick={() => goTo(nav.path.slice(0, i + 1))}>{part}</button>
              </span>
            ))}
          </div>
          <div className="fd-search">
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder={`${here} 검색`} aria-label="파일 검색" spellCheck={false} />
            <Search size={15} strokeWidth={1.9} />
          </div>
        </div>

        <div className="fd-body">
          <div className="fd-side">
            {roots.map((root) => (
              <button key={root} className={'fd-root' + (nav.path[0] === root ? ' sel' : '')}
                      onClick={() => goTo([root])}>
                <Icon name={rootIcon(root)} size={16} />{root}
              </button>
            ))}
          </div>

          <div className="fd-grid">
            {folders.length + files.length === 0 && (
              <div className="ex-empty">{searching ? '일치하는 파일이 없습니다' : '항목이 없습니다'}</div>
            )}
            {folders.map((f) => (
              <button key={f.name} className="fd-item" onDoubleClick={() => goTo([...nav.path, f.name])}>
                <Icon name="folder" size={44} />{f.name}
              </button>
            ))}
            {files.map((f) => (
              <button key={f.id} className={'fd-item' + (selected?.id === f.id ? ' sel' : '')}
                      onClick={() => pick(f)} onDoubleClick={() => onPick(f)}>
                <FileGlyph file={f} size={44} />{f.name}
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
