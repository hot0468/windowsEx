// Faces are bundled (Iconify fluent-emoji-flat) so everyone has a picture out of
// the box. `npm run images` can drop a real Pexels photo in avatars/ to override.
const PHOTOS = import.meta.glob('./avatars/*.webp', { eager: true, query: '?url', import: 'default' })
const FACES = import.meta.glob('./faces/*.svg', { eager: true, query: '?url', import: 'default' })
const WALLPAPER = import.meta.glob('./wallpaper.webp', { eager: true, query: '?url', import: 'default' })
// WebP throughout: these are read on screen, so size matters more than the
// extension the scenario shows the player (a scan is still named .jpg in-game).
const FILES = import.meta.glob('./files/*.webp', { eager: true, query: '?url', import: 'default' })
const SHOTS = import.meta.glob('./shots/*.webp', { eager: true, query: '?url', import: 'default' })
const NEWS = import.meta.glob('./news/*.webp', { eager: true, query: '?url', import: 'default' })
// Photographs with a mahjong tile somewhere in the frame. Missing until the
// pictures are dropped in — everything around them works either way.
const TILES = import.meta.glob('./tiles/*.webp', { eager: true, query: '?url', import: 'default' })
// 폰 카메라의 렌즈에 보이는 것. 없으면 뷰파인더가 어두운 채로 남는다 —
// 사진을 넣는 것은 언제든 나중에 할 수 있는 일이다.
const CAMERA = import.meta.glob('./camera/*.webp', { eager: true, query: '?url', import: 'default' })

export const photoOf = (id) => PHOTOS[`./avatars/${id}.webp`]
export const faceOf = (id) => FACES[`./faces/${id}.svg`]
export const fileImage = (name) => FILES[`./files/${name}.webp`] ?? TILES[`./tiles/${name}.webp`]
export const shotOf = (name) => SHOTS[`./shots/${name}.webp`] ?? TILES[`./tiles/${name}.webp`]
export const tileShot = (name) => TILES[`./tiles/${name}.webp`]
// a headline's thumbnail is named after the article id
export const newsShot = (id) => NEWS[`./news/${id}.webp`]
export const cameraShot = (name) => CAMERA[`./camera/${name}.webp`]
export const wallpaper = WALLPAPER['./wallpaper.webp']
