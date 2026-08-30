import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { useGame } from '../src/engine/store.js'
import { phoneApps, startMenuApps, APPS } from '../src/apps/registry.jsx'
import { NET_ROWS } from '../src/apps/Settings.jsx'
import { ping } from '../src/apps/Cmd.jsx'
import scenario from '../src/scenarios/workday.json'

beforeEach(() => useGame.setState({ screens: [] }))

describe('화면 스택', () => {
  it('처음에는 홈이다', () => {
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().currentApp()).toBe(null)
  })

  it('앱을 열면 쌓인다', () => {
    useGame.getState().pushScreen('app:messenger')
    expect(useGame.getState().screens).toEqual(['app:messenger'])
    expect(useGame.getState().currentApp()).toBe('messenger')
  })

  it('앱 안에서 더 들어가도 앱은 그대로다', () => {
    useGame.getState().pushScreen('app:messenger')
    useGame.getState().pushScreen('thread:junho')
    expect(useGame.getState().currentApp()).toBe('messenger')
    expect(useGame.getState().screens).toHaveLength(2)
  })

  it('뒤로는 한 겹만 벗긴다', () => {
    useGame.getState().pushScreen('app:messenger')
    useGame.getState().pushScreen('thread:junho')
    useGame.getState().popScreen()
    expect(useGame.getState().screens).toEqual(['app:messenger'])
  })

  it('홈에서 뒤로를 눌러도 안전하다', () => {
    useGame.getState().popScreen()
    expect(useGame.getState().screens).toEqual([])
  })

  it('홈은 깊이와 무관하게 한 번에 간다', () => {
    useGame.getState().pushScreen('app:explorer')
    useGame.getState().pushScreen('folder:문서')
    useGame.getState().pushScreen('folder:2026')
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().currentApp()).toBe(null)
  })

  // goHome은 게임의 '퇴근하기'다. 폰 홈 버튼이 그걸 실행하면 그날 야근
  // 여부가 조용히 확정되어 overwork 엔딩이 망가진다.
  it('폰 홈은 퇴근시키지 않는다', () => {
    useGame.setState({ overtime: {}, day: 1 })
    useGame.getState().pushScreen('app:mail')
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().overtime[1]).toBeUndefined()
  })

  // 같은 화면을 두 번 밀면 뒤로가 헛돈다 — 눌린 것 같은데 안 나가는 버그가 된다.
  it('같은 키를 연속으로 밀지 않는다', () => {
    useGame.getState().pushScreen('app:mail')
    useGame.getState().pushScreen('app:mail')
    expect(useGame.getState().screens).toEqual(['app:mail'])
  })

  // 소프트락 방지: 어떤 깊이에서도 홈으로 나올 수 있어야 한다.
  it('아무리 깊어도 홈으로 나올 수 있다', () => {
    for (let i = 0; i < 30; i++) useGame.getState().pushScreen(`deep:${i}`)
    useGame.getState().goPhoneHome()
    expect(useGame.getState().screens).toEqual([])
  })
})

describe('폰 홈 앱 목록', () => {
  it('폰다운 앱들이 있다', () => {
    const ids = phoneApps({}).map((a) => a.id)
    expect(ids).toContain('messenger')
    expect(ids).toContain('chat')
    expect(ids).toContain('mail')
    expect(ids).toContain('browser')
  })

  it('폰 저장소가 앱으로 올라온다', () => {
    const ids = phoneApps({}).map((a) => a.id)
    // 사진은 탐색기가 아니라 갤러리가 연다 — 폰에서 사진은 격자로 본다.
    expect(ids).toContain('gallery')
    expect(ids).toContain('files')
  })

  it('내 PC 드라이브가 있다', () => {
    const drive = phoneApps({}).find((a) => a.id === 'drive')
    expect(drive).toBeTruthy()
    expect(drive.title).toBe('내 PC 드라이브')
  })

  // 게임에 이미 AR 사내 드라이브(drive.ar.local)가 있다. 같은 이름을 쓰면
  // '사내 드라이브 > 전사 > …' 힌트가 플레이어를 엉뚱한 앱으로 보낸다.
  it('사내 드라이브라는 이름을 쓰지 않는다', () => {
    for (const a of phoneApps({})) expect(a.title).not.toBe('사내 드라이브')
    for (const a of phoneApps({})) expect(a.title).not.toBe('AR 사내 드라이브')
  })

  it('창에서만 열리는 것은 홈에 없다', () => {
    const ids = phoneApps({}).map((a) => a.id)
    expect(ids).not.toContain('devtools')
    expect(ids).not.toContain('installer')
  })

  it('설치하지 않은 프로그램은 홈에 없다', () => {
    expect(phoneApps({}).map((a) => a.id)).not.toContain('vpn')
    expect(phoneApps({ vpnInstalled: true }).map((a) => a.id)).toContain('vpn')
  })

  // 실제 폰에 명령 프롬프트는 없다. 대신 설정 앱이 그 값을 들고 있어야 한다 —
  // 둘 다 없으면 hostname·ipconfig를 묻는 요청이 폰에서 답을 찾을 수 없다.
  it('명령 프롬프트는 홈에 없다', () => {
    expect(phoneApps({}).map((a) => a.id)).not.toContain('cmd')
  })

  it('명령 프롬프트가 말해 주던 값을 설정 앱이 모두 보여 준다', () => {
    const shown = NET_ROWS(scenario.network).map(([, v]) => v)
    // pingMs 는 값이 아니라 '응답 확인'이 만들어 내는 결과다(ping()이 쓴다).
    for (const [key, value] of Object.entries(scenario.network)) {
      if (key === 'pingMs') continue
      expect(shown, key + ' 가 폰에서 사라졌다').toContain(value)
    }
  })

  // 요청 하나는 ping 의 평균 응답 시간을 묻는다. 폰의 '응답 확인'도 같은
  // 함수를 쓰므로 그 문장이 그대로 나와야 한다.
  it('응답 확인이 ping 과 같은 결과를 낸다', () => {
    expect(ping(scenario.network, 'vpn.ar.local').join(' '))
      .toContain('평균 = ' + scenario.network.pingMs + 'ms')
  })

  // 홈에 같은 이름이 둘 있으면 어느 쪽이 무엇인지 알 수 없다. viewer의
  // 제목이 '사진'이라 폰 네이티브 photos와 겹쳤다.
  it('홈에 같은 이름이 두 번 나오지 않는다', () => {
    const titles = phoneApps({ vpnInstalled: true }).map((a) => a.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  // 사진 뷰어는 파일을 열면 뜨는 것이지 홈에서 실행하는 앱이 아니다.
  it('사진 뷰어는 홈에 없다', () => {
    expect(phoneApps({}).map((a) => a.id)).not.toContain('viewer')
  })

  it('홈의 모든 항목은 그릴 수 있는 것이다', () => {
    for (const a of phoneApps({ vpnInstalled: true })) {
      expect(a.title).toBeTruthy()
      expect(a.icon).toBeTruthy()
    }
  })

  // 사진·파일은 fs.휴대폰만 봐야 한다. roots가 없으면 FileExplorer가
  // fs의 6개 루트를 전부 보여줘, '사진'에서 한 번에 로컬 디스크 (C:)로
  // 건너뛸 수 있었다.
  it('파일은 휴대폰 루트만 본다', () => {
    const files = phoneApps({}).find((a) => a.id === 'files')
    expect(files.props.roots).toEqual(['휴대폰'])
  })

  // 갤러리는 탐색기가 아니라 제 화면을 가진다 — 폴더를 건너다닐 길이 아예
  // 없으므로 로컬 디스크로 새어 나갈 수도 없다.
  it('갤러리는 탐색기를 열지 않는다', () => {
    const gallery = phoneApps({}).find((a) => a.id === 'gallery')
    expect(gallery.app).toBe('gallery')
    expect(APPS.gallery.phoneOnly).toBe(true)
  })

  // 내 PC 드라이브는 PC의 저장소가 마운트된 것이지 폰 저장소가 아니다.
  // '휴대폰'이 섞여 들어가면 두 저장소가 다시 하나로 합쳐진다.
  it('내 PC 드라이브는 PC의 네 루트만 보고 휴대폰은 보지 않는다', () => {
    const drive = phoneApps({}).find((a) => a.id === 'drive')
    expect(drive.props.roots).toEqual(['문서', '다운로드', '휴지통', '로컬 디스크 (C:)'])
    expect(drive.props.roots).not.toContain('휴대폰')
  })
})

describe('restart()', () => {
  // C2 회귀 방지: restart가 screens를 비우지 않으면, 크래시 후 재부팅한
  // 플레이어가 열지도 않은 앱 화면에 떨어진다 — 그 화면을 뒷받침하는
  // window는 이미 사라졌으므로 사실상 소프트락이다.
  it('screens를 비운다', () => {
    useGame.setState({ screens: ['app:mail', 'win:1'] })
    useGame.getState().restart()
    expect(useGame.getState().screens).toEqual([])
  })
})

// 하단 내비게이션의 '켠 창'. 목록에서 하나를 고르면 그 위에 쌓인 화면을
// 걷어낸다. 창 화면을 걷을 땐 창도 같이 닫아야 한다 — 스택에서만 빼면
// 폰 셸이 그것을 '새로 생긴 창' 으로 보고 도로 밀어 넣는다.
describe('켠 창 목록', () => {
  const win = (id) => ({ id, key: 'k' + id, app: 'mail', props: {} })

  beforeEach(() => useGame.setState({ screens: [], windows: [] }))

  it('고른 화면 위에 쌓인 것을 걷어낸다', () => {
    useGame.setState({ screens: ['app:messenger', 'app:photos', 'win:7'], windows: [win(7)] })
    useGame.getState().goScreen('app:messenger')
    expect(useGame.getState().screens).toEqual(['app:messenger'])
  })

  it('걷어낸 창은 닫는다', () => {
    useGame.setState({ screens: ['app:messenger', 'win:7'], windows: [win(7), win(8)] })
    useGame.getState().goScreen('app:messenger')
    expect(useGame.getState().windows.map((w) => w.id)).toEqual([8])
  })

  it('없는 화면을 고르면 아무 일도 없다', () => {
    useGame.setState({ screens: ['app:messenger'], windows: [] })
    useGame.getState().goScreen('app:mail')
    expect(useGame.getState().screens).toEqual(['app:messenger'])
  })

  it('목록에서 치우면 화면도 창도 사라진다', () => {
    useGame.setState({ screens: ['app:messenger', 'win:7'], windows: [win(7)] })
    useGame.getState().dropScreen('win:7')
    expect(useGame.getState().screens).toEqual(['app:messenger'])
    expect(useGame.getState().windows).toEqual([])
  })

  it('창이 아닌 화면을 치우면 창은 그대로다', () => {
    useGame.setState({ screens: ['app:messenger'], windows: [win(7)] })
    useGame.getState().dropScreen('app:messenger')
    expect(useGame.getState().screens).toEqual([])
    expect(useGame.getState().windows.map((w) => w.id)).toEqual([7])
  })

  // 홈으로 나가는 길이 늘 바닥에 있어야 한다. 앱 안에서도.
  it('화면에 세 버튼이 있다', () => {
    const src = readFileSync('src/shell/PhoneShell.jsx', 'utf8')
    for (const label of ['켠 창', '홈', '뒤로']) expect(src).toContain(`aria-label="${label}"`)
    expect(src).toContain('<NavBar')
  })
})

// 게임을 다루는 버튼(저장 · 불러오기 · 처음부터)은 데스크톱에서는 시작 메뉴에
// 있다. 폰에는 시작 메뉴가 없어 홈 구석의 ⋯ 에 숨어 있었다. 설정 앱으로 옮긴다.
describe('설정 앱', () => {
  const src = readFileSync('src/apps/Settings.jsx', 'utf8')

  it('폰 홈에 있다', () => {
    expect(phoneApps({}).map((a) => a.id)).toContain('settings')
  })

  // 데스크톱은 시작 메뉴가 이미 그 셋을 들고 있다. 두 군데 두면 어느 쪽이
  // 진짜인지 알 수 없다.
  it('데스크톱 시작 메뉴에는 없다', () => {
    expect(startMenuApps({}).map(([id]) => id)).not.toContain('settings')
  })

  it('게임을 다루는 셋을 들고 있다', () => {
    for (const fn of ['saveGame', 'loadGame', 'newGame']) expect(src, fn).toContain(fn)
  })

  it('되돌리는 것은 물어보고 한다', () => {
    expect(src).toContain('CONFIRM')
    expect(src).toContain("setAsking('new')")
    expect(src).toContain("setAsking('load')")
  })

  // 옮겼으면 있던 자리에서는 빠져야 한다.
  it('폰 홈의 ⋯ 메뉴는 사라졌다', () => {
    const shell = readFileSync('src/shell/PhoneShell.jsx', 'utf8')
    expect(shell).not.toContain('PhoneMenu')
    expect(shell).not.toContain('newGame')
  })
})
