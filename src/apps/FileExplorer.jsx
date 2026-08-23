import { useState } from 'react'
import { useGame } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'

export default function FileExplorer({ startFolder }) {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  const folders = Object.keys(scenario.fs)
  const [folder, setFolder] = useState(startFolder ?? folders[0])
  return (
    <div className="explorer">
      <div className="ex-side">
        {folders.map((name) => (
          <button key={name} className={'ex-folder' + (folder === name ? ' sel' : '')}
                  onClick={() => setFolder(name)}>
            <Icon name={name === '휴지통' ? 'trash' : 'folder'} size={17} />{name}
          </button>
        ))}
      </div>
      <div className="ex-main">
        {scenario.fs[folder].map((f) => (
          <button key={f.id} className="ex-file"
                  onDoubleClick={() => openWindow('notepad', { fileId: f.id })}>
            <div className="glyph"><Icon name="doc" size={36} /></div>{f.name}
          </button>
        ))}
      </div>
    </div>
  )
}
