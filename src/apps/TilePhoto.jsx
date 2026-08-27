import { useState } from 'react'
import { useGame } from '../engine/store.js'
import { tileShot } from '../assets/photos.js'

// A photograph with a mahjong tile somewhere in it. It behaves like any other
// picture until the pointer rests on it, and then it admits what it is. The
// right button offers the only thing to be done about it.
//
// Nothing here counts out loud. How many have been gathered is a question the
// folder on the desktop answers, and only if you go and look.
export default function TilePhoto({ shot, className = '' }) {
  const gates = useGame((s) => s.scenario.nineGates)
  const tiles = useGame((s) => s.tiles)
  const takeTile = useGame((s) => s.takeTile)
  const [menu, setMenu] = useState(null)

  const src = tileShot(shot.shot)
  const taken = tiles.includes(shot.id)

  const onContext = (e) => {
    e.preventDefault()
    if (taken) return
    setMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <img className={'tile-photo' + (taken ? ' taken' : '') + (className ? ' ' + className : '')}
           src={src} alt="" draggable="false"
           title={taken ? undefined : gates.hint}
           onContextMenu={onContext} />
      {menu && (
        <>
          <div className="ctx-catch" onPointerDown={() => setMenu(null)}
               onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div className="ctx" style={{ left: menu.x, top: menu.y }}>
            <button onClick={() => { takeTile(shot.id); setMenu(null) }}>{gates.copy}</button>
          </div>
        </>
      )}
    </>
  )
}
