import { useGame } from '../engine/store.js'
import { play } from '../shell/sound.js'

// Every download on the web works the same way: the file lands in 다운로드 and
// the button remembers that it did. Which folder it lands in is the file's own
// business — this only flips it from hidden to there.
export default function Download({ item }) {
  const restored = useGame((s) => s.restored)
  const restoreFile = useGame((s) => s.restoreFile)
  const showToast = useGame((s) => s.showToast)
  const saved = Boolean(restored[item.fileId])

  const take = () => {
    if (saved) return
    restoreFile(item.fileId)
    play('ok')
    showToast({ from: '다운로드 완료', text: `${item.name} — 다운로드 폴더에 저장했습니다.`, app: 'explorer', props: { startFolder: '다운로드' } })
  }

  return (
    <div className="dl">
      <div className="dl-mid">
        <span className="dl-name">{item.name}</span>
        {item.size && <span className="dl-size">{item.size}</span>}
      </div>
      <button className="dl-btn" onClick={take} disabled={saved}>
        {saved ? '다운로드 폴더에 저장됨' : (item.label ?? '다운로드')}
      </button>
    </div>
  )
}
