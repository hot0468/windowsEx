import { useGame } from '../engine/store.js'

export default function Desktop() {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  return (
    <div className="desktop-icons">
      {scenario.fs['바탕화면'].map((f) => (
        <button key={f.id} className="desktop-icon"
                onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
          <div className="glyph">📄</div>{f.name}
        </button>
      ))}
    </div>
  )
}
