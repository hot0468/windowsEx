import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'

// attend(재직자 근태 조회)를 열면 여섯 번째 직원이 아직 안 지워진 것을 보게
// 되고, printlog(7층 출력 기록)를 열면 그날 밤 누가 7층에 있었는지 보게 된다.
// 둘 다 엔딩이 갈리는 자리다. 그런데 기존 검사는 스토어 액션을 직접 불러서
// 확인할 뿐이라, "그 페이지를 그리는 화면이 실제로 그 액션을 부르는가"는
// 아무도 안 봤다 — 사내 드라이브가 위키에서 떨어져 나올 때 훅이 같이
// 따라오지 않으면 아무 소리 없이 죽는다.
const HOOKS = [['attend', 'foundMissing'], ['printlog', 'traceObserver']]

const browser = readFileSync('src/apps/Browser.jsx', 'utf8')
const alpha = (c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')

// layout을 그리는 컴포넌트. Browser의 분기에서 읽으므로, 화면이 아예 안
// 걸려 있으면 여기서 먼저 터진다. 파일 이름은 컴포넌트 이름과 같다.
const componentFor = (layout) => {
  const at = browser.indexOf("site.layout === '" + layout + "' ?")
  if (at < 0) return null
  let i = browser.indexOf('<', at) + 1
  let name = ''
  while (alpha(browser[i])) name += browser[i++]
  return { name, src: readFileSync(`src/apps/${name}.jsx`, 'utf8') }
}

describe('엔딩이 걸린 페이지는 그것을 그리는 화면이 붙잡는다', () => {
  for (const [page, hook] of HOOKS) {
    it(`${page} 를 열면 ${hook}`, () => {
      const site = scenario.sites.find((s) => s.wiki?.pages?.[page])
      expect(site, `${page} 페이지를 가진 사이트가 없다`).toBeTruthy()
      const view = componentFor(site.layout)
      expect(view, `${site.layout} 레이아웃이 Browser에 안 걸려 있다`).toBeTruthy()
      expect(view.src.includes(hook), `${view.name} 이 ${hook} 을 안 부른다`).toBe(true)
      expect(view.src.includes(`'${page}'`), `${view.name} 이 ${page} 를 안 본다`).toBe(true)
    })
  }
})
