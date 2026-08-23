import { useGame } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'

const SHORTCUTS = [
  { label: '내 문서', icon: 'folder', app: 'explorer', props: { startFolder: '문서' } },
  { label: '휴지통', icon: 'trash', app: 'explorer', props: { startFolder: '휴지통' } },
  { label: '브라우저', icon: 'globe', app: 'browser' },
  { label: '한빛톡', icon: 'workchat', app: 'messenger' },
  { label: '톡톡', icon: 'chat', app: 'chat' }
]

export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  return (
    <div className="desktop-icons">
      {SHORTCUTS.map((s) => (
        <button key={s.label} className="desktop-icon"
                onDoubleClick={() => openWindow(s.app, s.props)}>
          <div className="glyph"><Icon name={s.icon} size={38} /></div>{s.label}
        </button>
      ))}
      {scenario.fs['바탕화면'].map((f) => (
        <button key={f.id} className="desktop-icon"
                onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
          <div className="glyph"><Icon name="doc" size={38} /></div>{f.name}
        </button>
      ))}
    </div>
  )
}
