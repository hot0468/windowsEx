// Faces are bundled (Iconify fluent-emoji-flat) so everyone has a picture out of
// the box. `npm run images` can drop a real Pexels photo in avatars/ to override.
const PHOTOS = import.meta.glob('./avatars/*.jpg', { eager: true, query: '?url', import: 'default' })
const FACES = import.meta.glob('./faces/*.svg', { eager: true, query: '?url', import: 'default' })
const WALLPAPER = import.meta.glob('./wallpaper.jpg', { eager: true, query: '?url', import: 'default' })
// WebP: these are read on screen, so size matters more than the extension the
// scenario shows the player (a scan is still named .jpg in-game).
// jpg is allowed alongside: there is no webp encoder on the machine these were
// added from, and a resized jpg lands in the same size range anyway.
const FILES = import.meta.glob('./files/*.{webp,jpg}', { eager: true, query: '?url', import: 'default' })
const SHOTS = import.meta.glob('./shots/*.webp', { eager: true, query: '?url', import: 'default' })
const NEWS = import.meta.glob('./news/*.{webp,jpg}', { eager: true, query: '?url', import: 'default' })

export const photoOf = (id) => PHOTOS[`./avatars/${id}.jpg`]
export const faceOf = (id) => FACES[`./faces/${id}.svg`]
export const fileImage = (name) => FILES[`./files/${name}.webp`] ?? FILES[`./files/${name}.jpg`]
export const shotOf = (name) => SHOTS[`./shots/${name}.webp`]
// a headline's thumbnail is named after the article id
// A real wire photo wins over the placeholder that shipped with the headline.
export const newsShot = (id) => NEWS[`./news/${id}.jpg`] ?? NEWS[`./news/${id}.webp`]
export const wallpaper = WALLPAPER['./wallpaper.jpg']
