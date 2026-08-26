// Downloads game imagery from Pexels into src/assets/.
// Run: npm run images   (reads PEXELS_API_KEY from .env)
import { existsSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src/assets/', import.meta.url))

// file → what to search for. `pick` chooses among the first results so faces differ.
const IMAGES = [
  { file: 'wallpaper.webp', query: 'abstract blue gradient background', size: 'large2x', pick: 0 },
  // 김한별 is the woman on the ID card scan; the rest match how they talk in the scenario.
  { file: 'avatars/me.webp', query: 'asian businesswoman portrait', size: 'tiny', pick: 0 },
  { file: 'avatars/boss.webp', query: 'asian businessman office portrait', size: 'tiny', pick: 1 },
  { file: 'avatars/junho.webp', query: 'asian man smiling casual', size: 'tiny', pick: 2 },
  { file: 'avatars/minseo.webp', query: 'asian woman working laptop', size: 'tiny', pick: 1 },
  { file: 'avatars/room_notice.webp', query: 'office team meeting', size: 'tiny', pick: 0 },
  { file: 'avatars/room_bs200.webp', query: 'barcode scanner warehouse', size: 'tiny', pick: 0 },
  { file: 'avatars/jihyun.webp', query: 'asian woman laughing', size: 'tiny', pick: 3 },
  { file: 'avatars/mom.webp', query: 'asian senior woman smiling', size: 'tiny', pick: 0 },
  { file: 'avatars/guesthouse.webp', query: 'asian man outdoors farmer', size: 'tiny', pick: 1 },
  // Every headline in scenario.news that a stock photo can carry. The two
  // lottery shots are hand-made — Pexels has no Korean 로또 판매점 — so they are
  // not listed here and a refetch leaves them alone.
  // Keyed by article id. A wire photo is
  // generic on purpose: the headline says what it is, the picture only has to
  // look like a newspaper put it there.
  { file: 'news/n_scanner.webp', query: 'warehouse barcode scanner', size: 'landscape', pick: 0 },
  { file: 'news/n_phishing.webp', query: 'cyber security email laptop', size: 'landscape', pick: 0 },
  { file: 'news/n_return.webp', query: 'tired office worker desk', size: 'landscape', pick: 0 },
  { file: 'news/n_accident2.webp', query: 'highway at night headlights', size: 'landscape', pick: 1 },
  { file: 'news/n_weather.webp', query: 'summer rain city street', size: 'landscape', pick: 0 },
  { file: 'news/n_lunch.webp', query: 'korean food restaurant table', size: 'landscape', pick: 0 },
  { file: 'news/n_overtime.webp', query: 'office building windows lit night', size: 'landscape', pick: 0 },
  { file: 'news/n_subway.webp', query: 'seoul subway platform', size: 'landscape', pick: 0 },
  { file: 'news/n_workshop.webp', query: 'team workshop meeting room', size: 'landscape', pick: 0 },
  { file: 'news/n_jeju.webp', query: 'jeju island coast', size: 'landscape', pick: 0 },
  { file: 'news/n_gyul.webp', query: 'tangerine orchard tree', size: 'landscape', pick: 0 },
  { file: 'news/n_reboot.webp', query: 'computer error screen office', size: 'landscape', pick: 0 },
  { file: 'news/n_accident.webp', query: 'highway guardrail dawn', size: 'landscape', pick: 0 },
  { file: 'news/n_d2_restructure.webp', query: 'empty office chairs meeting room', size: 'landscape', pick: 0 },
  { file: 'news/n_d2_icecup.webp', query: 'iced coffee plastic cup', size: 'landscape', pick: 0 },
  { file: 'news/n_d3_libel.webp', query: 'smartphone screen dark room', size: 'landscape', pick: 0 },
  { file: 'news/n_d3_remote.webp', query: 'working from home laptop desk', size: 'landscape', pick: 0 },
  { file: 'news/n_d4_overtime_health.webp', query: 'doctor stethoscope health checkup', size: 'landscape', pick: 0 },
  { file: 'news/n_d4_usedfurniture.webp', query: 'office chairs stacked', size: 'landscape', pick: 0 },
  { file: 'news/n_d5_friday.webp', query: 'traffic jam city evening', size: 'landscape', pick: 0 }
]

// Fetching everything would re-roll the avatars too, so a prefix narrows it:
//   npm run images news
const only = process.argv[2] ?? ''
const wanted = IMAGES.filter((i) => i.file.startsWith(only))

const key = process.env.PEXELS_API_KEY
if (!key) {
  console.error('PEXELS_API_KEY가 비어 있습니다. .env 파일에 키를 넣어주세요.')
  process.exit(1)
}

const credits = []

for (const { file, query, size, pick } of wanted) {
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
  // everything the game draws is webp — photos.js reads nothing else
  const name = file.replace(/\.(jpg|png)$/i, '.webp')
  const out = join(ROOT, name)
  await mkdir(dirname(out), { recursive: true })
  const width = name.startsWith('avatars/') ? 400 : name.startsWith('news/') ? 900 : 1920
  const webp = await sharp(bytes).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  await writeFile(out, webp)
  credits.push(`- \`${name}\` — ${photo.photographer} ([Pexels](${photo.url}))`)
  console.log(`✓ ${name}  ${(webp.length / 1024).toFixed(0)}KB  ${photo.photographer}`)
}

// A partial run must not drop the credits for the files it did not fetch.
const creditsPath = join(ROOT, 'CREDITS.md')
const previous = existsSync(creditsPath)
  ? readFileSync(creditsPath, 'utf8').split('\n')
    .filter((l) => l.startsWith('- `') && !wanted.some((w) => l.startsWith('- `' + w.file + '`')))
  : []
await writeFile(
  creditsPath,
  `# 이미지 출처\n\n모든 사진은 [Pexels](https://www.pexels.com) 제공.\n\n${[...previous, ...credits].sort().join('\n')}\n`
)
console.log(`\n${credits.length}개 완료. 출처는 src/assets/CREDITS.md 에 기록했습니다.`)
