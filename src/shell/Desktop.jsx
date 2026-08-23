import { useGame } from '../engine/store.js'

const SHORTCUTS = [
  { label: '내 문서', glyph: '📁', app: 'explorer', props: { startFolder: '문서' } },
  { label: '휴지통', glyph: '🗑️', app: 'explorer', props: { startFolder: '휴지통' } },
  { label: '브라우저', glyph: '🌐', app: 'browser' },
  { label: '한빛톡', glyph: '💬', app: 'messenger' },
  { label: '톡톡', glyph: '🗨️', app: 'chat' }
]

export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  return (
    <div className="desktop-icons">
      {SHORTCUTS.map((s) => (
        <button key={s.label} className="desktop-icon"
                onDoubleClick={() => openWindow(s.app, s.props)}>
          <div className="glyph">{s.glyph}</div>{s.label}
        </button>
      ))}
      {scenario.fs['바탕화면'].map((f) => (
        <button key={f.id} className="desktop-icon"
                onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
          <div className="glyph">📄</div>{f.name}
        </button>
      ))}
    </div>
  )
}
