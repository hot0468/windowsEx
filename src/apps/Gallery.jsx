import { useState } from 'react'
import { dreamGallery, entriesAt, fsView, useGame } from '../engine/store.js'
import { cameraShot, fileImage } from '../assets/photos.js'
import { Camera as CameraIcon } from '../icons/line.jsx'

// 갤러리. 탐색기로도 같은 폴더를 볼 수 있지만, 폰에서 사진을 보는 방식은
// 목록이 아니라 격자다 — 찍은 것과 원래 있던 것이 한자리에 섞여 쌓인다.
export default function Gallery() {
  const scenario = useGame((s) => s.scenario)
  const dreamt = useGame((s) => s.dreamt)
  const pinned = useGame((s) => s.pinned)
  const restored = useGame((s) => s.restored)
  const tiles = useGame((s) => s.tiles)
  const placed = useGame((s) => s.placed)
  const touched = useGame((s) => s.touched)
  const shots = useGame((s) => s.shots)
  const photos = useGame((s) => s.photos)
  const showHidden = useGame((s) => s.showHidden)
  const openWindow = useGame((s) => s.openWindow)
  const pushScreen = useGame((s) => s.pushScreen)
  const [tab, setTab] = useState('all')

  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt),
    { pinned, restored, tiles, placed, touched, shots, photos, scenario })
  const all = entriesAt(fs, ['휴대폰', '갤러리']).filter((e) => showHidden || !e.hidden)
  const mine = all.filter((e) => e.shot)
  const list = tab === 'mine' ? mine : all

  const open = (file) => {
    openWindow('viewer', { fileId: file.id })
    pushScreen('app:gallery')
  }

  return (
    <div className="gl">
      <div className="gl-tabs">
        <button className={'gl-tab' + (tab === 'all' ? ' on' : '')} onClick={() => setTab('all')}>
          전체 <em>{all.length}</em>
        </button>
        <button className={'gl-tab' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>
          찍은 사진 <em>{mine.length}</em>
        </button>
      </div>

      {list.length === 0 && (
        <p className="gl-none">
          {tab === 'mine' ? '아직 찍은 사진이 없습니다' : '사진이 없습니다'}
        </p>
      )}

      <div className="gl-grid">
        {list.map((file) => (
          <button key={file.id} className="gl-cell" onClick={() => open(file)}
                  title={file.name}>
            {file.image || cameraShot(file.shot?.lens) ? (
              <img src={fileImage(file.image) ?? cameraShot(file.shot.lens)}
                   alt={file.alt ?? file.name} draggable="false" />
            ) : file.shot ? (
              /* 찍은 사진에는 아직 그림이 없다 — 언제 무엇을 찍었는지가 대신 선다. */
              <span className="gl-shot">
                <CameraIcon size={18} strokeWidth={1.7} />
                <b>{file.shot.title ?? '화면'}</b>
                <i>{file.shot.day}일차 {file.shot.at}</i>
              </span>
            ) : (
              /* 사라진 사진. 이름만 남고 그 자리는 비어 있다. */
              <span className="gl-gone">{file.missing ?? '없음'}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
