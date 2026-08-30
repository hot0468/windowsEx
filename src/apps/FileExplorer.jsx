import { useState } from 'react'
import {
  useGame, WORK_FOLDER, dreamGallery, entriesAt, fileOpener, rootIcon, fsView, searchFiles, visible,
  fileStamp, fileCreated, fileKind, fileSize, fileLocation, fmtStampLong, fmtStampShort, fmtSize, fmtBytes, gameClock
} from '../engine/store.js'
import { useFolderNav } from './folderNav.js'
import { fileDragProps } from './dragFile.js'
import Icon, { FileGlyph } from '../icons/Icon.jsx'
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Monitor, Search, X } from '../icons/line.jsx'
import { useViewport } from '../shell/useViewport.js'

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
  const placed = useGame((s) => s.placed)
  const touched = useGame((s) => s.touched)
  const clipboard = useGame((s) => s.clipboard)
  const cutFile = useGame((s) => s.cutFile)
  const placeFile = useGame((s) => s.placeFile)
  const renameFile = useGame((s) => s.renameFile)
  const [renaming, setRenaming] = useState(null)   // { id, value }
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(null)
  const [viewOpen, setViewOpen] = useState(false)
  // 큰 아이콘 / 자세히. 자세히 보기는 날짜·종류·크기를 나란히 보여 준다 — 사진이
  // 언제 찍혔는지는 여기 아니면 속성 창에서만 읽힌다.
  const view = useGame((s) => s.explorerView)
  const setView = useGame((s) => s.setExplorerView)
  const details = view === 'details'
  const [props, setProps] = useState(null)   // { file, path } 속성 창
  const day = useGame((s) => s.day)
  const overtime = useGame((s) => s.overtime)
  const dayAt = useGame((s) => s.dayAt)
  // 폰에는 우클릭이 없다 — 같은 메뉴를 여는 손잡이를 대신 그린다.
  const phone = useViewport() === 'phone'

  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt), { pinned, restored, tiles, placed, touched, scenario })
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
  const onContext = (file, path = nav.path) => (e) => {
    e.preventDefault()
    const box = e.currentTarget.closest('.ex-body').getBoundingClientRect()
    setMenu({ file, path, x: e.clientX - box.left, y: e.clientY - box.top })
  }
  // 빈자리 우클릭: 잘라낸 것이 있을 때만 붙여넣기 메뉴가 뜬다.
  const onBlank = (e) => {
    if (e.target !== e.currentTarget || !clipboard) return
    e.preventDefault()
    const box = e.currentTarget.closest('.ex-body').getBoundingClientRect()
    setMenu({ paste: true, x: e.clientX - box.left, y: e.clientY - box.top })
  }
  // 휴지통과 작업 폴더에는 붙여 넣지 않는다 — 하나는 지운 것, 하나는 복사본이다.
  const canPaste = !inTrash && !inWork && !searching
  const paste = () => { placeFile(clipboard, nav.path.join('/')); setMenu(null) }
  // 이름 바꾸기는 본문만. 확장자가 바뀌면 여는 앱이 바뀌어 버린다.
  // 점이 없는 이름(hosts)은 통째로 본문이다.
  const split = (name) => {
    const i = name.lastIndexOf('.')
    return i < 0 ? [name, ''] : [name.slice(0, i), name.slice(i)]
  }
  const commitRename = () => {
    const v = renaming.value.trim()
    if (v) renameFile(renaming.id, v + split(renaming.name)[1])
    setRenaming(null)
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
                  <button onClick={() => { setView('icons'); setViewOpen(false) }}>
                    <span className="ex-check">{!details ? '●' : ''}</span><LayoutGrid size={14} strokeWidth={1.8} />큰 아이콘
                  </button>
                  <button onClick={() => { setView('details'); setViewOpen(false) }}>
                    <span className="ex-check">{details ? '●' : ''}</span><List size={14} strokeWidth={1.8} />자세히
                  </button>
                  <div className="ctx-line" />
                  <button onClick={() => { toggleHidden(); setViewOpen(false) }}>
                    <span className="ex-check">{showHidden ? '✓' : ''}</span>숨긴 항목
                  </button>
                </div>
              </>
            )}
          </div>
          {phone && clipboard && canPaste && (
            <button className="ex-paste" onClick={paste}>붙여넣기</button>
          )}
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
                      onContextMenu={onContext(file, [...nav.path, ...trail])}
                      onDoubleClick={() => openWindow(fileOpener(file).app, { fileId: file.id })}>
                <FileGlyph file={file} size={26} />
                <span className="ex-hit-mid">
                  <span>{file.name}</span>
                  <span className="ex-hit-path">{[here, ...trail].join(' › ')}</span>
                </span>
              </button>
            ))}
          </div>
        ) : details ? (
          <div className="ex-main ex-list" onContextMenu={onBlank}>
            {entries.length === 0 && <div className="ex-empty">이 폴더는 비어 있습니다</div>}
            {entries.length > 0 && (
              <table className="ex-table">
                <thead><tr><th>이름</th><th>수정한 날짜</th><th>유형</th><th className="num">크기</th></tr></thead>
                <tbody>
                  {folders.map((f) => (
                    <tr key={f.name} className={f.hidden ? 'dim' : ''} onDoubleClick={() => goTo([...nav.path, f.name])}>
                      <td><Icon name="folder" size={18} />{f.name}</td>
                      <td>{fmtStampShort(fileStamp(f, nav.path))}</td>
                      <td>{fileKind(f)}</td>
                      <td className="num" />
                    </tr>
                  ))}
                  {files.map((f) => f.missing ? (
                    <tr key={f.id} className="ex-gone" title={f.missing}>
                      <td><Icon name="image" size={18} />{f.name}<em>{f.missing}</em></td>
                      <td /><td>{fileKind(f)}</td><td className="num" />
                    </tr>
                  ) : (
                    <tr key={f.id} className={(clipboard === f.id ? 'cut' : '') + (f.hidden ? ' dim' : '')}
                        {...(inTrash ? {} : fileDragProps(f))}
                        onContextMenu={onContext(f)}
                        onDoubleClick={() => openWindow(fileOpener(f).app, { fileId: f.id })}>
                      <td>
                        <FileGlyph file={f} size={18} photo={18} />
                        {renaming?.id === f.id ? (
                          <input className="ex-rename" autoFocus value={renaming.value}
                                 onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                                 onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                                 onBlur={commitRename} onClick={(e) => e.stopPropagation()}
                                 onDoubleClick={(e) => e.stopPropagation()}
                                 onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }} />
                        ) : f.name}
                        {phone && (
                          <span role="button" className="ex-more" aria-label="더 보기"
                                onClick={(e) => { e.stopPropagation(); onContext(f)(e) }}>⋯</span>
                        )}
                      </td>
                      <td>{fmtStampShort(fileStamp(f, nav.path))}</td>
                      <td>{fileKind(f)}</td>
                      <td className="num">{fmtSize(fileSize(scenario, f))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="ex-main" onContextMenu={onBlank}>
            {entries.length === 0 && <div className="ex-empty">이 폴더는 비어 있습니다</div>}
            {folders.map((f) => (
              <button key={f.name} className={'ex-file' + (f.hidden ? ' dim' : '')}
                      onDoubleClick={() => goTo([...nav.path, f.name])}>
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
                <button key={f.id} className={'ex-file' + (clipboard === f.id ? ' cut' : '')} {...(inTrash ? {} : fileDragProps(f))}
                        onContextMenu={onContext(f)}
                        onDoubleClick={() => openWindow(fileOpener(f).app, { fileId: f.id })}>
                  {phone && (
                    <span role="button" className="ex-more" aria-label="더 보기"
                          onClick={(e) => { e.stopPropagation(); onContext(f)(e) }}>⋯</span>
                  )}
                  <div className="glyph"><FileGlyph file={f} size={36} photo={52} /></div>
                  {renaming?.id === f.id ? (
                    <input className="ex-rename" autoFocus value={renaming.value}
                           onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                           onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                           onBlur={commitRename} onClick={(e) => e.stopPropagation()}
                           onDoubleClick={(e) => e.stopPropagation()}
                           onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }} />
                  ) : f.name}
                </button>
              )))}
          </div>
        )}

        {menu && (
          <>
            <div className="ctx-catch" onPointerDown={() => setMenu(null)}
                 onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
            <div className="ctx" style={{ left: menu.x, top: menu.y }}>
              {menu.paste ? (
                <button disabled={!canPaste} onClick={paste}>붙여넣기</button>
              ) : (
                <>
                  <button onClick={() => { openWindow(fileOpener(menu.file).app, { fileId: menu.file.id }); setMenu(null) }}>
                    열기
                  </button>
                  <button onClick={() => { setProps({ file: menu.file, path: menu.path }); setMenu(null) }}>속성</button>
                  {inTrash ? (
                    menu.file.deleted && (
                      <button onClick={() => { restoreFile(menu.file.id); setMenu(null) }}>복원</button>
                    )
                  ) : inWork ? (
                    <button onClick={() => { unpinFile(menu.file.id); setMenu(null) }}>
                      {WORK_FOLDER}에서 빼기
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { pinFile(menu.file.id); setMenu(null) }}>
                        {WORK_FOLDER}에 복사
                      </button>
                      <button onClick={() => { cutFile(menu.file.id); setMenu(null) }}>잘라내기</button>
                      <button onClick={() => {
                        const n = menu.file.name
                        setRenaming({ id: menu.file.id, name: n, value: split(n)[0] })
                        setMenu(null)
                      }}>이름 바꾸기</button>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {props && (
          <FileProps scenario={scenario} file={props.file} path={props.path}
                     now={gameClock(scenario, { day, overtime, dayAt })} onClose={() => setProps(null)} />
        )}
      </div>
    </div>
  )
}

// 속성 창. 윈도우의 그 창이다 — 일반 탭 하나만 살아 있고, 확인·취소는 둘 다 닫는다.
// 적용은 늘 죽어 있다: 바꿀 수 있는 것이 없다.
function FileProps({ scenario, file, path, now, onClose }) {
  const st = fileStamp(file, path)
  const cr = fileCreated(file, path)
  const bytes = fileSize(scenario, file)
  const opener = fileOpener(file)
  const app = { viewer: '사진', hwp: '한글', pdf: 'PDF 뷰어', sheet: '시트', slides: '슬라이드', dcx: 'DY Viewer', installer: '설치 마법사', notepad: '메모장' }[opener.app] ?? opener.app
  // 액세스한 날짜는 지금이다 — 속성 창을 연 것이 곧 액세스다.
  const today = /(\d+)월 (\d+)일/.exec(now.date)
  const [hh, mm] = now.time.split(':').map(Number)
  const accessed = today ? { y: 2026, m: +today[1], d: +today[2], hh, mm, ss: 0 } : st
  return (
    <div className="fp-catch" onPointerDown={onClose}>
      <div className="fp" role="dialog" aria-label={`${file.name} 속성`} onPointerDown={(e) => e.stopPropagation()}>
        <div className="fp-title"><span>{file.name} 속성</span><button onClick={onClose} aria-label="닫기"><X size={14} strokeWidth={2} /></button></div>
        <div className="fp-tabs"><span className="on">일반</span><span>디지털 서명</span><span>보안</span><span>자세히</span><span>이전 버전</span></div>
        <div className="fp-body">
          <div className="fp-name"><FileGlyph file={file} size={32} photo={32} /><span className="fp-name-box">{file.name}</span></div>
          <hr />
          <dl>
            <div><dt>파일 형식:</dt><dd>{fileKind(file)}{file.image || /\./.test(file.name) ? `(.${file.image ? 'jpg' : file.name.split('.').pop()})` : ''}</dd></div>
            <div><dt>연결 프로그램:</dt><dd><Icon name={opener.icon} size={15} />{app}<button className="fp-change" disabled>변경(C)...</button></dd></div>
          </dl>
          <hr />
          <dl>
            <div><dt>위치:</dt><dd className="fp-path">{fileLocation(scenario, path)}</dd></div>
            <div><dt>크기:</dt><dd>{fmtSize(bytes)} ({fmtBytes(bytes)})</dd></div>
            <div><dt>디스크 할당 크기:</dt><dd>{fmtSize(Math.ceil(bytes / 4096) * 4096)} ({fmtBytes(Math.ceil(bytes / 4096) * 4096)})</dd></div>
          </dl>
          <hr />
          <dl>
            <div><dt>만든 날짜:</dt><dd>{fmtStampLong(scenario, cr)}</dd></div>
            <div><dt>수정한 날짜:</dt><dd>{fmtStampLong(scenario, st)}</dd></div>
            <div><dt>액세스한 날짜:</dt><dd>{fmtStampLong(scenario, accessed)}</dd></div>
          </dl>
          <hr />
          <div className="fp-attrs">
            <span>특성:</span>
            <label><input type="checkbox" disabled checked={false} readOnly />읽기 전용(R)</label>
            <label><input type="checkbox" disabled checked={Boolean(file.hidden)} readOnly />숨김(H)</label>
            <button className="fp-change" disabled>고급(D)...</button>
          </div>
        </div>
        <div className="fp-foot">
          <button className="fp-btn fp-ok" onClick={onClose}>확인</button>
          <button className="fp-btn" onClick={onClose}>취소</button>
          <button className="fp-btn" disabled>적용(A)</button>
        </div>
      </div>
    </div>
  )
}
