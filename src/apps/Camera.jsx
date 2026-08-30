import { useEffect, useState } from 'react'
import { gameClock, useGame } from '../engine/store.js'
import { Camera as CameraIcon, Image } from '../icons/line.jsx'

// 폰 카메라. 실제 렌즈가 없으므로 '무엇을 찍었는지'를 남긴다 — PC 의 화면
// 캡처와 같은 방식이다. 이 앱의 요점은 찍는 것이 아니라, 찍은 것을 톡으로
// 보낼 수 있는 파일로 만드는 데 있다.
const SUBJECTS = [
  ['desk', '책상 위'],
  ['screen', '모니터 화면'],
  ['paper', '서류'],
  ['window', '창밖']
]

export default function Camera() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const overtime = useGame((s) => s.overtime)
  const dayAt = useGame((s) => s.dayAt)
  const takePhoto = useGame((s) => s.takePhoto)
  const openWindow = useGame((s) => s.openWindow)
  const pushScreen = useGame((s) => s.pushScreen)
  const photos = useGame((s) => s.photos)
  const [subject, setSubject] = useState(SUBJECTS[0][0])
  const [shot, setShot] = useState(null)
  const clock = gameClock(scenario, { day, overtime, dayAt })

  // 찍은 직후의 흰 번쩍임. 셔터를 눌렀다는 것을 화면이 알린다.
  useEffect(() => {
    if (!shot) return
    const t = setTimeout(() => setShot(null), 1400)
    return () => clearTimeout(t)
  }, [shot])

  const label = SUBJECTS.find(([id]) => id === subject)?.[1]

  return (
    <div className="cam">
      <div className="cam-view">
        {shot ? (
          <div className="cam-flash">
            <b>{shot.name}</b>
            <span>갤러리에 저장했습니다</span>
          </div>
        ) : (
          <>
            <div className="cam-grid" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="cam-meta">
              <span>{day}일차 {clock.time}</span>
              <span>{label}</span>
            </div>
          </>
        )}
      </div>

      <div className="cam-subjects">
        {SUBJECTS.map(([id, name]) => (
          <button key={id} className={'cam-subject' + (subject === id ? ' on' : '')}
                  onClick={() => setSubject(id)}>{name}</button>
        ))}
      </div>

      <div className="cam-bar">
        <button className="cam-roll" aria-label="갤러리 열기"
                onClick={() => {
                  const props = { startFolder: ['휴대폰', '갤러리'], roots: ['휴대폰'] }
                  openWindow('explorer', props)
                  pushScreen('app:photos')
                }}>
          <Image size={20} strokeWidth={1.8} />
          <em>{photos.length}</em>
        </button>
        <button className="cam-shutter" aria-label="사진 찍기"
                onClick={() => setShot(takePhoto(label))}>
          <span />
        </button>
        <span className="cam-space" />
      </div>
    </div>
  )
}
