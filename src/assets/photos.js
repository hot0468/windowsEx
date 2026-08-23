// Filled in by `npm run images` (Pexels). Missing files just fall back to the
// initial-letter avatar and the gradient wallpaper, so the game runs without an API key.
const AVATARS = import.meta.glob('./avatars/*.jpg', { eager: true, query: '?url', import: 'default' })
const WALLPAPER = import.meta.glob('./wallpaper.jpg', { eager: true, query: '?url', import: 'default' })

export const avatarOf = (id) => AVATARS[`./avatars/${id}.jpg`]
export const wallpaper = WALLPAPER['./wallpaper.jpg']
