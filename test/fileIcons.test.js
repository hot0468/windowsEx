import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener } from '../src/engine/store.js'

// 탐색기에서 파일 종류가 한눈에 갈려야 한다. 깨지는 방식은 둘 — 아이콘 이름이
// Icon.jsx 에 없어서 빈 칸이 뜨거나, 서로 다른 확장자가 같은 그림을 쓰거나.
const known = new Set(
  readFileSync('src/icons/Icon.jsx', 'utf8')
    .match(/const SRC = \{([^}]*)\}/)[1].split(',').map((s) => s.trim()).filter(Boolean)
)
const files = allFiles(scenario.fs)

describe('파일 아이콘', () => {
  it('시나리오의 모든 파일이 실제로 있는 아이콘을 가리킨다', () => {
    expect(files.length).toBeGreaterThan(100)
    for (const f of files) expect(known, `${f.name}`).toContain(fileOpener(f).icon)
  })

  it('확장자마다 다른 그림이다 — 같은 그림이면 목록에서 종류가 안 갈린다', () => {
    const seen = {}
    for (const ext of ['.exe', '.xlsx', '.pptx', '.hwp', '.pdf', '.txt']) {
      const icon = fileOpener({ name: 'a' + ext }).icon
      expect(seen[icon], `${ext} 가 ${seen[icon]} 와 같은 아이콘`).toBeUndefined()
      seen[icon] = ext
    }
  })

  it('설치 파일은 명령 프롬프트처럼 보이지 않는다', () => {
    // 실행 파일과 콘솔 창은 다른 물건이다. 게다가 이 게임은 가짜 exe 를 실행하게
    // 만드는 함정이 있어서, 실행 파일이 눈에 또렷해야 한다.
    expect(fileOpener({ name: 'AR-VPN_Setup.exe' }).icon).not.toBe('cmd')
  })

  it('사진은 확장자보다 먼저다', () => {
    expect(fileOpener({ name: 'x.hwp', image: 'cat' }).icon).toBe('image')
  })
})
