// Faces are bundled (Iconify fluent-emoji-flat) so everyone has a picture out of
// the box. `npm run images` can drop a real Pexels photo in avatars/ to override.
const PHOTOS = import.meta.glob('./avatars/*.jpg', { eager: true, query: '?url', import: 'default' })
const FACES = import.meta.glob('./faces/*.svg', { eager: true, query: '?url', import: 'default' })
const WALLPAPER = import.meta.glob('./wallpaper.jpg', { eager: true, query: '?url', import: 'default' })

export const photoOf = (id) => PHOTOS[`./avatars/${id}.jpg`]
export const faceOf = (id) => FACES[`./faces/${id}.svg`]
export const wallpaper = WALLPAPER['./wallpaper.jpg']
