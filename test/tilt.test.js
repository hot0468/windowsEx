import { describe, expect, it } from 'vitest'
import { DEAD, EASE, framePct, panFrom, REST, RANGE, sensorState, shiftPct, smoothPan, tiltNote } from '../src/shell/tilt.js'

// 뷰파인더보다 큰 사진을 기울여 둘러보는 계산. 화면 없이 검사할 수 있게
// 순수 함수로 떼어 두었다 — 여기서 어긋나면 사진 가장자리가 빈다.
describe('기울기 읽기', () => {
  it('세워 든 자세가 한가운데다', () => {
    expect(panFrom({ beta: REST, gamma: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('좌우로 기울이면 좌우로, 앞뒤로 기울이면 위아래로 간다', () => {
    expect(panFrom({ beta: REST, gamma: RANGE }).x).toBe(1)
    expect(panFrom({ beta: REST, gamma: -RANGE }).x).toBe(-1)
    expect(panFrom({ beta: REST + RANGE, gamma: 0 }).y).toBe(1)
    expect(panFrom({ beta: REST - RANGE, gamma: 0 }).y).toBe(-1)
  })

  it('아무리 기울여도 끝에서 멈춘다', () => {
    const far = panFrom({ beta: 180, gamma: 90 })
    expect(far.x).toBe(1)
    expect(far.y).toBe(1)
  })

  it('센서가 아무 값도 주지 않으면 한가운데로 둔다', () => {
    expect(panFrom({})).toEqual({ x: 0, y: 0 })
    expect(panFrom()).toEqual({ x: 0, y: 0 })
  })
})

describe('사진 움직이기', () => {
  // 끝까지 기울였을 때 사진이 딱 가장자리에 닿아야 한다. 더 가면 빈 자리가
  // 보이고, 덜 가면 볼 수 있는 데를 못 본다.
  const over = 1.6

  it('끝까지 기울이면 사진의 끝이 화면 끝에 닿는다', () => {
    const room = ((over - 1) / 2 / over) * 100     // 사진 크기 대비 여백
    expect(shiftPct({ x: 1, y: 0 }, over).x).toBeCloseTo(-room, 6)
    expect(shiftPct({ x: 0, y: -1 }, over).y).toBeCloseTo(room, 6)
    // 화면 폭으로 환산하면 남는 여백((over-1)/2)과 같아야 한다
    expect(Math.abs(shiftPct({ x: 1, y: 0 }, over).x) * over / 100)
      .toBeCloseTo((over - 1) / 2, 6)
  })

  it('한가운데면 움직이지 않는다', () => {
    expect(shiftPct({ x: 0, y: 0 }, over)).toEqual({ x: -0, y: -0 })
  })

  it('사진이 뷰파인더와 같은 크기면 움직일 데가 없다', () => {
    expect(shiftPct({ x: 1, y: 1 }, 1)).toEqual({ x: -0, y: -0 })
  })
})

describe('찍은 구도', () => {
  it('보고 있던 자리가 사진에 남는다', () => {
    expect(framePct({ x: 0, y: 0 })).toEqual({ x: 50, y: 50 })
    expect(framePct({ x: 1, y: 1 })).toEqual({ x: 80, y: 80 })
    expect(framePct({ x: -1, y: -1 })).toEqual({ x: 20, y: 20 })
  })
})

// 기울기가 안 될 때 왜 안 되는지 말해 줘야 한다 — 사람이 고칠 수 있는 것은
// https 로 여는 일뿐인데, 아무 말이 없으면 게임이 고장 난 줄 안다.
describe('기울기가 안 될 때', () => {
  it('이유마다 다른 말을 한다', () => {
    const notes = ['insecure', 'denied', 'unsupported', 'idle'].map(tiltNote)
    for (const n of notes) expect(n).toBeTruthy()
    expect(new Set(notes).size).toBe(notes.length)
    // 어느 경우에도 대신 할 수 있는 일을 알려 준다
    for (const n of notes) expect(n).toContain('끌어서')
  })

  it('https 문제일 때는 그것을 짚는다', () => {
    expect(tiltNote('insecure')).toContain('https')
  })

  it('되고 있을 때는 아무 말도 하지 않는다', () => {
    expect(tiltNote('on')).toBe(null)
    expect(tiltNote('off')).toBe(null)
  })
})

// 기울기가 안 되는 이유를 가리는 규칙. 틀린 진단은 없는 것만 못하다 — 폴드에
// 자이로가 없을 리 없는데 "이 기기에는 센서가 없습니다"가 떴다.
describe('왜 안 되는지 가리기', () => {
  // 안드로이드 크롬은 http 로 열면 이벤트를 주지 않는다. 생성자는 그대로 있으므로
  // 센서가 없는 것이 아니라 주소가 문제다.
  it('http 로 열었으면 주소 문제라고 한다', () => {
    expect(sensorState({ hasEvent: true, secure: false, protocol: 'http:', host: '192.168.0.5' })).toBe('insecure')
  })

  // isSecureContext 를 안 주는 브라우저가 있다. 없다고 안전한 것으로 치면
  // http 인데도 그냥 지나쳐 엉뚱한 진단이 나온다.
  it('보안 컨텍스트를 모르겠으면 주소로 판단한다', () => {
    expect(sensorState({ hasEvent: true, secure: undefined, protocol: 'http:', host: '192.168.0.5' })).toBe('insecure')
    expect(sensorState({ hasEvent: true, secure: undefined, protocol: 'https:', host: 'example.com' })).toBe('listen')
  })

  // localhost 는 http 라도 보안 컨텍스트다 — PC 개발 중에 잘못된 경고가 뜨면 안 된다.
  it('localhost 는 http 라도 괜찮다', () => {
    expect(sensorState({ hasEvent: true, secure: undefined, protocol: 'http:', host: 'localhost' })).toBe('listen')
    expect(sensorState({ hasEvent: true, secure: undefined, protocol: 'http:', host: '127.0.0.1' })).toBe('listen')
  })

  // 주소가 멀쩡한데 생성자가 없으면 그때가 진짜 '센서 없음'이다.
  it('주소가 멀쩡한데 이벤트가 없으면 그때가 센서 없음이다', () => {
    expect(sensorState({ hasEvent: false, secure: true, protocol: 'https:', host: 'example.com' })).toBe('unsupported')
  })

  // http 이면서 생성자도 없으면 주소부터 고쳐야 한다 — 고치면 생성자가 없다는
  // 사실 자체가 달라질 수 있으므로, 먼저 짚을 것을 짚는다.
  it('둘 다 문제면 주소를 먼저 짚는다', () => {
    expect(sensorState({ hasEvent: false, secure: false, protocol: 'http:', host: '192.168.0.5' })).toBe('insecure')
  })

  // iOS 는 손짓 안에서만 권한을 묻는다 — 버튼을 보여야 한다.
  it('권한을 물어야 하는 기기는 물어야 한다고 한다', () => {
    expect(sensorState({ hasEvent: true, secure: true, protocol: 'https:', host: 'x', needsPermission: true })).toBe('off')
  })
})

// 센서는 초당 예순 번씩 값을 준다. 그대로 넣으면 손 떨림이 그대로 보여 화면이
// 부들거린다 — 사람은 폰을 완벽히 고정하지 못한다.
describe('기울기를 부드럽게 잇기', () => {
  it('목표 쪽으로 조금씩 간다 — 한 번에 가지 않는다', () => {
    const a = smoothPan({ x: 0, y: 0 }, { x: 1, y: 0 })
    expect(a.x).toBeGreaterThan(0)
    expect(a.x).toBeLessThan(1)
    expect(a.x).toBeCloseTo(EASE, 6)
  })

  // 떨림은 한 프레임에 끝난다. 데드존보다 작은 차이는 조금씩 따라가지 않고
  // 바로 맞춰 버리므로, 다음 프레임부터는 아무 일도 일어나지 않는다 —
  // 미세한 값이 계속 들어와도 화면이 흔들리지 않는다.
  it('아주 작은 흔들림은 한 프레임에 삼킨다', () => {
    const still = { x: 0.5, y: 0.5 }
    const jitter = { x: 0.5 + DEAD / 2, y: 0.5 }
    const after = smoothPan(still, jitter)
    expect(after).toEqual(jitter)
    // 그리고 멈춘다 — 같은 값이 또 들어와도 더 움직이지 않는다
    expect(smoothPan(after, jitter)).toEqual(after)
    // 눈에 보일 만큼 움직이지도 않았다
    expect(Math.abs(after.x - still.x)).toBeLessThan(DEAD)
  })

  it('큰 움직임은 따라간다', () => {
    const moved = smoothPan({ x: 0, y: 0 }, { x: 0.8, y: -0.8 })
    expect(moved.x).toBeGreaterThan(0)
    expect(moved.y).toBeLessThan(0)
  })

  // 끝에 다다르면 목표에 붙인다. 안 그러면 영영 0.001 씩 남아 루프가 안 멈춘다.
  it('충분히 가까워지면 목표에 붙는다', () => {
    const to = { x: 1, y: 1 }
    expect(smoothPan({ x: 1 - DEAD / 2, y: 1 }, to)).toEqual(to)
  })

  // 여러 번 부르면 결국 도착한다 — 영영 못 가면 화면이 목표를 따라잡지 못한다.
  it('되풀이하면 도착한다', () => {
    let at = { x: 0, y: 0 }
    const to = { x: 1, y: -1 }
    for (let i = 0; i < 200; i++) at = smoothPan(at, to)
    expect(at).toEqual(to)
  })

  it('이미 도착했으면 그대로다', () => {
    const at = { x: 0.3, y: -0.3 }
    expect(smoothPan(at, at)).toEqual(at)
  })
})
