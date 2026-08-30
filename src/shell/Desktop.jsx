import { useState } from 'react'
import { WORK_FOLDER, dreamGallery, entriesAt, installedShortcuts, opensAnew, useGame, fileOpener, fsView, visible } from '../engine/store.js'
import Icon, { FileGlyph } from '../icons/Icon.jsx'
import { fileImage } from '../assets/photos.js'
import { fileDragProps, useFileDrop } from '../apps/dragFile.js'

const SHORTCUTS = [
  { label: '내 문서', icon: 'folder', app: 'explorer', props: { startFolder: '문서' } },
  { label: '휴지통', icon: 'trash', app: 'explorer', props: { startFolder: '휴지통' } },
  { label: '브라우저', icon: 'globe', app: 'browser' },
  { label: '메일', icon: 'mail', app: 'mail' },
  { label: 'AR톡', icon: 'workchat', app: 'messenger' },
  { label: '톡톡', icon: 'chat', app: 'chat' },
  { label: '메모장', icon: 'notepad', app: 'notepad' }
]

// 배경 고르기. 폰 갤러리에 있는 사진이 그대로 후보다 — 이 사람이 가진
// 사진은 그것뿐이고, 그중 하나를 회사 PC 바탕에 걸어 두는 일은 흔하다.
function Walls({ current, onPick, onClose }) {
  const scenario = useGame((s) => s.scenario)
  const dreamt = useGame((s) => s.dreamt)
  const fs = dreamGallery(scenario, scenario.fs, dreamt)
  const shots = entriesAt(fs, ['휴대폰', '갤러리']).filter((e) => e.image)
  return (
    <>
      <div className="ctx-catch" onPointerDown={onClose} />
      <div className="walls">
        <div className="walls-head">배경 바꾸기</div>
        <div className="walls-grid">
          <button className={'walls-one' + (current ? '' : ' on')} onClick={() => onPick(null)}>
            <span className="walls-default" />
            <em>기본 배경</em>
          </button>
          {shots.map((e) => (
            <button key={e.id} className={'walls-one' + (current === e.id ? ' on' : '')}
                    onClick={() => onPick(e.id)}>
              <img src={fileImage(e.image)} alt={e.alt ?? e.name} draggable="false" />
              <em>{e.name}</em>
            </button>
          ))}
        </div>
        {shots.length === 0 && <p className="walls-none">걸 사진이 없습니다</p>}
      </div>
    </>
  )
}

export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const shots = useGame((s) => s.shots)
  const photos = useGame((s) => s.photos)
  const grants = useGame((s) => s.grants)
  const openWindow = useGame((s) => s.openWindow)
  const pinFile = useGame((s) => s.pinFile)
  const restored = useGame((s) => s.restored)
  const showHidden = useGame((st) => st.showHidden)
  const tiles = useGame((st) => st.tiles)
  const placed = useGame((s) => s.placed)
  const touched = useGame((s) => s.touched)
  const desktop = visible(fsView(scenario.fs, { pinned, restored, tiles, placed, touched, shots, photos, scenario })['바탕화면'], showHidden)
  const work = useFileDrop(pinFile)
  // The tile folder takes a drop too, but only a photograph with a tile in it
  // belongs there. Anything else is put back with a word about why, rather
  // than swallowed — a folder that ignores a drop looks broken.
  const takeTile = useGame((s) => s.takeTile)
  const gates = scenario.nineGates
  const [refused, setRefused] = useState(null)
  // 바탕화면 오른쪽 단추. 탐색기에만 있던 것을 여기에도 둔다 — 숨긴 항목
  // 스위치가 폴더 안에만 있으면, 힌트가 '숨긴 항목'을 말해도 찾을 곳이 없다.
  const [menu, setMenu] = useState(null)
  const toggleHidden = useGame((s) => s.toggleHidden)
  // 새로 고침은 진짜 윈도우에서도 아이콘을 다시 그리는 것이 전부다.
  const [drawn, redraw] = useState(0)
  // 배경 고르기 판. 갤러리에 있는 사진 중에서 고른다.
  const [picking, setPicking] = useState(false)
  const wall = useGame((s) => s.wall)
  const setWall = useGame((s) => s.setWall)
  const gather = useFileDrop((id) => {
    if (gates?.shots.some((x) => x.id === id)) return takeTile(id)
    setRefused(id)
    setTimeout(() => setRefused(null), 2600)
  })
  const NO_DROP = { over: false, dropProps: {} }
  const dropFor = (name) => (name === WORK_FOLDER ? work : name === gates?.folder ? gather : NO_DROP)
  const icons = [...SHORTCUTS, ...installedShortcuts(scenario.programs, grants)]
  return (
    <>
      {/* 빈 바탕화면만 받는다. 창 위의 오른 단추는 그 창이 가져간다. */}
      <div className="desktop-back"
           onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }} />
      {picking && (
        <Walls current={wall} onPick={(id) => { setWall(id); setPicking(false) }}
               onClose={() => setPicking(false)} />
      )}
      {menu && (
        <>
          <div className="ctx-catch" onPointerDown={() => setMenu(null)}
               onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div className="ctx" style={{ left: menu.x, top: menu.y }}>
            <button onClick={() => { redraw((n) => n + 1); setMenu(null) }}>새로 고침</button>
            <div className="ctx-line" />
            <button onClick={() => { toggleHidden(); setMenu(null) }}>
              <span className="ctx-check">{showHidden ? '✓' : ''}</span>숨긴 항목 표시
            </button>
            <div className="ctx-line" />
            <button onClick={() => { setPicking(true); setMenu(null) }}>배경 바꾸기</button>
          </div>
        </>
      )}
    <div className="desktop-icons" key={drawn}>
      {refused && <div className="di-refused">{gates.refuse}</div>}
      {icons.map((s) => (
        <button key={s.label} className="desktop-icon"
                onDoubleClick={() => openWindow(s.app, s.props, opensAnew(s.app))}>
          <div className="glyph"><Icon name={s.icon} size={38} /></div>{s.label}
        </button>
      ))}
      {desktop.map((e) => (e.children ? (
        // Each folder answers to its own drop: the work folder pins what lands
        // on it, the tile folder gathers. Before, every folder carried the work
        // folder's handler, so a drop on the tiles pinned it somewhere else.
        <button key={e.name}
                className={'desktop-icon' + (dropFor(e.name).over ? ' drop' : '')}
                {...dropFor(e.name).dropProps}
                onDoubleClick={() => openWindow('explorer', { startFolder: ['바탕화면', e.name] })}>
          <div className="glyph"><Icon name="folder" size={38} /></div>{e.name}
          {/* The tile folder wears no number: how many are in there is a thing
              you find out by opening it, not by glancing at the desktop. */}
          {e.children.length > 0 && e.name !== scenario.nineGates?.folder && (
            <span className="di-count">{e.children.length}</span>
          )}
        </button>
      ) : (
        <button key={e.id} className="desktop-icon" {...fileDragProps(e)}
                onDoubleClick={() => openWindow(fileOpener(e).app, { fileId: e.id })}>
          <div className="glyph"><FileGlyph file={e} size={38} /></div>{e.name}
        </button>
      )))}
    </div>
    </>
  )
}
