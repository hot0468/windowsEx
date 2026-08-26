import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, dreamGallery, fsView, galleryOf } from '../src/engine/store.js'

const fs = fsView(scenario.fs, {})
const pics = allFiles(scenario.fs).filter((f) => f.image)
const some = (pred) => pics.find(pred)

describe('stepping through a folder of pictures', () => {
  it('finds the pictures beside the one that is open', () => {
    const cat = some((f) => f.name.includes('고양이')) ?? pics[0]
    const gallery = galleryOf(fs, cat.id)
    expect(gallery.some((f) => f.id === cat.id)).toBe(true)
    for (const f of gallery) expect(f.image).toBeTruthy()
  })

  it('has folders worth stepping through', () => {
    // if every folder held one picture the arrow keys would have nowhere to go
    const sizes = pics.map((f) => galleryOf(fs, f.id).length)
    expect(Math.max(...sizes)).toBeGreaterThan(3)
  })

  it('stays inside the folder the picture came from', () => {
    // no folder can offer every picture on the PC
    for (const f of pics.slice(0, 20)) {
      expect(galleryOf(fs, f.id).length).toBeLessThan(pics.length)
    }
  })

  it('leaves out what the folder is hiding, unless hidden items are shown', () => {
    const hidden = allFiles(scenario.fs).find((f) => f.image && f.hidden)
    if (!hidden) return
    expect(galleryOf(fs, hidden.id, false).some((f) => f.id === hidden.id)).toBe(false)
    expect(galleryOf(fs, hidden.id, true).some((f) => f.id === hidden.id)).toBe(true)
  })

  it('will not step onto a picture the week has taken away', () => {
    const gone = scenario.dream?.photos ?? []
    expect(gone.length).toBeGreaterThan(0)
    const dreamt = fsView(dreamGallery(scenario, scenario.fs, true), {})
    for (const id of gone) expect(galleryOf(dreamt, id).some((f) => f.id === id)).toBe(false)
    // and they are there for anyone who never read the blog to the end
    const kept = fsView(dreamGallery(scenario, scenario.fs, false), {})
    expect(galleryOf(kept, gone[0]).some((f) => f.id === gone[0])).toBe(true)
  })

  it('gives an empty list for a file that is not a picture', () => {
    const doc = allFiles(scenario.fs).find((f) => f.name.endsWith('.hwp'))
    expect(galleryOf(fs, doc.id).every((f) => f.image)).toBe(true)
  })
})
