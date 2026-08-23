// Downloads game imagery from Pexels into src/assets/.
// Run: npm run images   (reads PEXELS_API_KEY from .env)
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src/assets/', import.meta.url))

// file → what to search for. `pick` chooses among the first results so faces differ.
const IMAGES = [
  { file: 'wallpaper.jpg', query: 'abstract blue gradient background', size: 'large2x', pick: 0 },
  { file: 'avatars/me.jpg', query: 'person portrait neutral background', size: 'tiny', pick: 1 },
  { file: 'avatars/boss.jpg', query: 'businessman portrait office', size: 'tiny', pick: 0 },
  { file: 'avatars/junho.jpg', query: 'man smiling casual portrait', size: 'tiny', pick: 2 },
  { file: 'avatars/minseo.jpg', query: 'young woman working office', size: 'tiny', pick: 1 },
  { file: 'avatars/room_notice.jpg', query: 'office team meeting', size: 'tiny', pick: 0 },
  { file: 'avatars/room_bs200.jpg', query: 'barcode scanner warehouse', size: 'tiny', pick: 0 },
  { file: 'avatars/jihyun.jpg', query: 'woman laughing portrait', size: 'tiny', pick: 3 },
  { file: 'avatars/mom.jpg', query: 'senior woman smiling portrait', size: 'tiny', pick: 0 },
  { file: 'avatars/guesthouse.jpg', query: 'man outdoors smiling portrait', size: 'tiny', pick: 4 }
]

const key = process.env.PEXELS_API_KEY
if (!key) {
  console.error('PEXELS_API_KEY가 비어 있습니다. .env 파일에 키를 넣어주세요.')
  process.exit(1)
}

const credits = []

for (const { file, query, size, pick } of IMAGES) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${pick + 1}`
  const res = await fetch(url, { headers: { Authorization: key } })
  if (!res.ok) {
    console.error(`✗ ${file}: Pexels ${res.status} ${res.statusText}`)
    process.exit(1)
  }
  const photo = (await res.json()).photos[pick]
  if (!photo) {
    console.error(`✗ ${file}: "${query}" 검색 결과가 부족합니다.`)
    continue
  }

  const bytes = Buffer.from(await (await fetch(photo.src[size])).arrayBuffer())
  const out = join(ROOT, file)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, bytes)
  credits.push(`- \`${file}\` — ${photo.photographer} ([Pexels](${photo.url}))`)
  console.log(`✓ ${file}  ${(bytes.length / 1024).toFixed(0)}KB  ${photo.photographer}`)
}

await writeFile(
  join(ROOT, 'CREDITS.md'),
  `# 이미지 출처\n\n모든 사진은 [Pexels](https://www.pexels.com) 제공.\n\n${credits.join('\n')}\n`
)
console.log(`\n${credits.length}개 완료. 출처는 src/assets/CREDITS.md 에 기록했습니다.`)
