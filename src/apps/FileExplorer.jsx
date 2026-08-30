import { useState } from 'react'
import {
  useGame, WORK_FOLDER, dreamGallery, entriesAt, fileOpener, rootIcon, fsView, searchFiles, visible
} from '../engine/store.js'
import { useFolderNav } from './folderNav.js'
import { fileDragProps } from './dragFile.js'
import { openTap, useViewport } from '../shell/useViewport.js'
import Icon, { FileGlyph } from '../icons/Icon.jsx'
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Monitor, Search } from '../icons/line.jsx'

export default function FileExplorer({ startFolder, roots: only }) {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const restored = useGame((s) => s.restored)
  const openWindow = useGame((s) => s.openWindow)
  const pinFile = useGame((s) => s.pinFile)
  const unpinFile = useGame((s) => s.unpinFile)
  const restoreFile = useGame((s) => s.restoreFile)
  const showHidden = useGame((s) => s.showHidden)
  const toggleHidden = useGame((s) => s.toggleHidden)
  const dreamt = useGame((s) => s.dreamt)
  const tiles = useGame((s) => s.tiles)
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(null)
  const [viewOpen, setViewOpen] = useState(false)
  // 폰에서는 한 번 탭이 연다 — 더블탭을 기다리면 아무것도 안 열리는 앱이 된다.
  const shell = useViewport()

  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt), { pinned, restored, tiles, scenario })
  const roots = only ?? Object.keys(fs)
  const nav = useFolderNav(startFolder ?? roots[0])

  const here = nav.path[nav.path.length - 1]
  const inWork = here === WORK_FOLDER
  // Nothing leaves the bin by drag or copy — it has to be restored first.
  const inTrash = nav.path[0] === '휴지통'
  const searching = Boolean(q.trim())
  const hits = searching
    ? searchFiles(fs, nav.path, q).filter((h) => showHidden || !h.file.hidden)
    : []
  const entries = visible(entriesAt(fs, nav.path), showHidden)
  const folders = entries.filter((e) => e.children)
  const files = entries.filter((e) => !e.children)

  const goTo = (path) => { setQ(''); setMenu(null); nav.goTo(path) }
  const onContext = (file) => (e) => {
    e.preventDefault()
    const box = e.currentTarget.closest('.ex-body').getBoundingClientRect()
    setMenu({ file, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  return (
    <div className="explorer">
      <div className="ex-side">
        {roots.map((name) => (
          <button key={name} className={'ex-folder' + (nav.path[0] === name ? ' sel' : '')}
                  onClick={() => goTo([name])}>
            <Icon name={rootIcon(name)} size={17} />{name}
          </button>
        ))}
      </div>

      <div className="ex-body">
        <div className="ex-addr" ref={(el) => { if (el) el.scrollLeft = el.scrollWidth }}>
          <Monitor size={15} strokeWidth={1.8} />
          <div className="ex-crumbs">
            {nav.path.map((name, i) => (
              <span key={i} className="ex-crumb">
                <ChevronRight size={13} strokeWidth={2} />
                <button onClick={() => goTo(nav.path.slice(0, i + 1))}>{name}</button>
              </span>
            ))}
            <ChevronRight size={13} strokeWidth={2} />
          </div>
        </div>
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
          <div style={{ flex: 1 }} />
          <div className="ex-view">
            <button className={'ex-view-btn' + (viewOpen ? ' on' : '')}
                    onClick={() => setViewOpen((v) => !v)} aria-expanded={viewOpen}>
              <Monitor size={15} strokeWidth={1.8} />보기
              <ChevronDown size={13} strokeWidth={2}
                           style={{ transform: viewOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {viewOpen && (
              <>
                <div className="ctx-catch" onPointerDown={() => setViewOpen(false)} />
                <div className="ex-view-pop">
                  <button onClick={() => { toggleHidden(); setViewOpen(false) }}>
                    <span className="ex-check">{showHidden ? '✓' : ''}</span>숨긴 항목
                  </button>
                </div>
              </>
            )}
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
              <button key={file.id} className="ex-hit" {...(inTrash ? {} : fileDragProps(file))}
                      onContextMenu={onContext(file)}
                      {...openTap(shell, () => openWindow(fileOpener(file).app, { fileId: file.id }))}>
                <FileGlyph file={file} size={26} />
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
              <button key={f.name} className={'ex-file' + (f.hidden ? ' dim' : '')}
                      {...openTap(shell, () => goTo([...nav.path, f.name]))}>
                <div className="glyph"><Icon name="folder" size={36} /></div>{f.name}
              </button>
            ))}
            {files.map((f) => (f.missing
              ? (
                <span key={f.id} className="ex-file ex-gone" title={f.missing}>
                  <div className="glyph"><Icon name="image" size={36} /></div>
                  {f.name}<em>{f.missing}</em>
                </span>
              )
              : (
                <button key={f.id} className="ex-file" {...(inTrash ? {} : fileDragProps(f))}
                        onContextMenu={onContext(f)}
                        {...openTap(shell, () => openWindow(fileOpener(f).app, { fileId: f.id }))}>
                  <div className="glyph"><FileGlyph file={f} size={36} photo={52} /></div>{f.name}
                </button>
              )))}
          </div>
        )}

        {menu && (
          <>
            <div className="ctx-catch" onPointerDown={() => setMenu(null)}
                 onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
            <div className="ctx" style={{ left: menu.x, top: menu.y }}>
              <button onClick={() => { openWindow(fileOpener(menu.file).app, { fileId: menu.file.id }); setMenu(null) }}>
                열기
              </button>
              {inTrash ? (
                menu.file.deleted && (
                  <button onClick={() => { restoreFile(menu.file.id); setMenu(null) }}>복원</button>
                )
              ) : inWork ? (
                <button onClick={() => { unpinFile(menu.file.id); setMenu(null) }}>
                  {WORK_FOLDER}에서 빼기
                </button>
              ) : (
                <button onClick={() => { pinFile(menu.file.id); setMenu(null) }}>
                  {WORK_FOLDER}에 복사
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
