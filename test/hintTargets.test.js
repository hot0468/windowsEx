import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'

// 마지막 힌트는 폴더·파일·줄을 정확히 지목한다. 그래서 그 줄을 다른 말로
// 바꾸거나 화면을 다시 짜면, 게임은 멀쩡히 돌아가는데 힌트만 없는 곳을
// 가리키게 된다 — 답을 못 찾는 플레이어에게 마지막으로 남은 안내가 거짓이
// 되는 셈이라 소프트락과 같다. C테크 홈페이지를 회사 사이트처럼 다시 짜면서
// 힌트가 이름으로 부르는 두 줄이 실제로 남아 있는지 못 박아 둔다.
const site = (url) => scenario.sites.find((s) => s.url === url)
const textOf = (url) => JSON.stringify(site(url))

describe('힌트가 이름으로 부르는 자리는 실제로 있다', () => {
  const ctech = 'ctech.co.kr'

  it('C테크 홈페이지가 열린다', () => {
    expect(site(ctech)).toBeTruthy()
  })

  // "대표번호 옆에 팩스 적혀 있을 거야" / "'대표번호 · 팩스' 줄"
  it('대표번호와 팩스가 한 줄에 같이 있다', () => {
    expect(textOf(ctech)).toContain('대표번호 031-704-8800 · 팩스 031-704-8890')
  })

  // "'오시는 길' 줄에 있어요"
  it('오시는 길이라는 이름의 자리에 본사 주소가 있다', () => {
    const c = site(ctech).corp
    expect(c.map.title).toBe('오시는 길')
    expect(c.map.address).toContain('판교로 255번길 20')
  })

  // 힌트가 맞더라도 답이 화면에 없으면 소용없다. 이 페이지가 품은 두 정답이
  // 글자 그대로 남아 있는지 본다.
  it('이 페이지에서 답을 찾는 요청들이 아직 답을 찾는다', () => {
    const here = textOf(ctech)
    for (const answer of ['031-704-8890', '판교로 255번길 20']) {
      expect(here, answer).toContain(answer)
    }
  })
})
