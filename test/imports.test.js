import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// Nothing here renders a component, so a component that calls a store helper it
// forgot to import fails only in the browser — as a blank screen. This is the
// cheapest thing that catches it.
const WORD = '[A-Za-z0-9_$]'

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = dir + '/' + e.name
  return e.isDirectory() ? walk(p) : (/[.]jsx?$/.test(e.name) ? [p] : [])
})

const store = readFileSync('src/engine/store.js', 'utf8')
const exported = [...store.matchAll(
  new RegExp('export[ ]+(?:const|function|let)[ ]+([A-Za-z_$]' + WORD + '*)', 'g')
)].map((m) => m[1])

const files = walk('src').filter((p) => !p.endsWith('engine/store.js'))

describe('store imports', () => {
  it('finds helpers to check', () => {
    expect(exported.length).toBeGreaterThan(20)
    expect(files.length).toBeGreaterThan(10)
  })

  it('every store helper a file calls is imported there', () => {
    const missing = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      const imported = new Set(
        [...text.matchAll(/import[ ]*\{([^}]*)\}[ ]*from[ ]*'[^']*store[.]js'/g)]
          .flatMap((m) => m[1].split(',').map((s) => s.trim()))
      )
      for (const name of exported) {
        if (imported.has(name)) continue
        const call = new RegExp('(?<![.' + WORD.slice(1) + ')' + name + '[ ]*[(]')
        if (call.test(text)) missing.push(f + ' -> ' + name)
      }
    }
    expect(missing).toEqual([])
  })
})
