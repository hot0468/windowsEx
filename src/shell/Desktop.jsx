import { useGame, fileOpener, fsWithPinned } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { fileDragProps, useFileDrop } from '../apps/dragFile.js'

const SHORTCUTS = [
  { label: '내 문서', icon: 'folder', app: 'explorer', props: { startFolder: '문서' } },
  { label: '휴지통', icon: 'trash', app: 'explorer', props: { startFolder: '휴지통' } },
  { label: '브라우저', icon: 'globe', app: 'browser' },
  { label: '메일', icon: 'mail', app: 'mail' },
  { label: '한빛톡', icon: 'workchat', app: 'messenger' },
  { label: '톡톡', icon: 'chat', app: 'chat' },
  { label: '메모장', icon: 'notepad', app: 'notepad' }
]

export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const openWindow = useGame((s) => s.openWindow)
  const pinFile = useGame((s) => s.pinFile)
  const desktop = fsWithPinned(scenario.fs, pinned)['바탕화면']
  const work = useFileDrop(pinFile)
  return (
    <div className="desktop-icons">
      {SHORTCUTS.map((s) => (
        <button key={s.label} className="desktop-icon"
                onDoubleClick={() => openWindow(s.app, s.props)}>
          <div className="glyph"><Icon name={s.icon} size={38} /></div>{s.label}
        </button>
      ))}
      {desktop.map((e) => (e.children ? (
        <button key={e.name} className={'desktop-icon' + (work.over ? ' drop' : '')} {...work.dropProps}
                onDoubleClick={() => openWindow('explorer', { startFolder: ['바탕화면', e.name] })}>
          <div className="glyph"><Icon name="folder" size={38} /></div>{e.name}
          {e.children.length > 0 && <span className="di-count">{e.children.length}</span>}
        </button>
      ) : (
        <button key={e.id} className="desktop-icon" {...fileDragProps(e)}
                onDoubleClick={() => openWindow(fileOpener(e).app, { fileId: e.id })}>
          <div className="glyph"><Icon name={fileOpener(e).icon} size={38} /></div>{e.name}
        </button>
      )))}
    </div>
  )
}
