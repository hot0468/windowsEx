import { beforeEach, describe, expect, it } from 'vitest'
import { MULTI_APPS, opensAnew, useGame } from '../src/engine/store.js'

// 위키를 열어 둔 채 거래처 사이트를 봐야 하는 일이 잦은데, 브라우저 창이
// 하나뿐이라 둘 중 하나를 닫아야 했다. 다만 "새로 열까"는 앱의 성질이 아니라
// 여는 쪽의 뜻이다 — 바탕화면 아이콘을 다시 누르는 것은 "하나 더"지만, 폰
// 홈에서 같은 아이콘을 누르는 것은 "그 앱으로 가자"라서 창이 쌓이면 안 된다.
const browsers = () => useGame.getState().windows.filter((w) => w.app === 'browser')

describe('창을 여러 개 여는 앱', () => {
  beforeEach(() => useGame.setState({ windows: [], mining: false }))

  it('브라우저가 그 목록에 있다', () => {
    expect(opensAnew('browser')).toBe(true)
    expect(opensAnew('explorer')).toBe(true)
    expect(opensAnew('mail')).toBe(false)
    expect(MULTI_APPS).toContain('browser')
    expect(MULTI_APPS).toContain('explorer')
  })

  it('새로 열라고 하면 창이 하나 더 생긴다', () => {
    useGame.getState().openWindow('browser', {}, true)
    useGame.getState().openWindow('browser', {}, true)
    expect(browsers()).toHaveLength(2)
  })

  it('두 창은 서로 다른 키를 갖는다 — 같으면 다음에 하나를 앞으로 끌어온다', () => {
    useGame.getState().openWindow('browser', {}, true)
    useGame.getState().openWindow('browser', {}, true)
    const [a, b] = browsers()
    expect(a.key).not.toBe(b.key)
    expect(a.id).not.toBe(b.id)
  })

  it('그냥 열라고 하면 예전처럼 열려 있는 창을 앞으로 끌어온다', () => {
    useGame.getState().openWindow('browser')
    useGame.getState().openWindow('browser')
    expect(browsers()).toHaveLength(1)
  })

  it('내려 둔 창을 다시 열면 올라온다 — 새 창이 아니라', () => {
    useGame.getState().openWindow('mail')
    const id = useGame.getState().windows[0].id
    useGame.getState().minimizeWindow(id)
    useGame.getState().openWindow('mail')
    const mails = useGame.getState().windows.filter((w) => w.app === 'mail')
    expect(mails).toHaveLength(1)
    expect(mails[0].minimized).toBe(false)
  })

  // 폰 홈은 openWindow(app, props) 로만 부른다. 탐색기가 여러 개 열리는 앱이
  // 되었다고 해서 폰에서 사진을 누를 때마다 창이 쌓이면 안 된다.
  it('폰처럼 새로 열라는 말 없이 부르면 탐색기도 한 창을 다시 쓴다', () => {
    const props = { startFolder: ['휴대폰', '갤러리'], roots: ['휴대폰'] }
    useGame.getState().openWindow('explorer', props)
    useGame.getState().openWindow('explorer', props)
    expect(useGame.getState().windows.filter((w) => w.app === 'explorer')).toHaveLength(1)
  })

  // 같은 탐색기라도 보는 곳이 다르면 다른 창이다 — 사진과 문서 폴더가 한 창을
  // 나눠 쓰면 폰에서 사진을 눌렀는데 문서가 열린다.
  it('보는 곳이 다르면 다른 창이다', () => {
    useGame.getState().openWindow('explorer', { startFolder: '문서' })
    useGame.getState().openWindow('explorer', { startFolder: '다운로드' })
    expect(useGame.getState().windows.filter((w) => w.app === 'explorer')).toHaveLength(2)
  })

  it('메일함은 새로 열라고 해도 목록에 없으므로 아무도 그렇게 부르지 않는다', () => {
    expect(opensAnew('mail')).toBe(false)
  })
})
