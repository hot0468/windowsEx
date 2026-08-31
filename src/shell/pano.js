// 180° 파노라마를 뷰파인더에 그리는 자리. three.js 없이 WebGL 하나로 한다 —
// 구를 만들 필요가 없다. 화면을 덮는 사각형 하나에 광선을 쏴서 파노라마를
// 샘플링하면 같은 그림이 나오고, 의존성은 늘지 않는다.
//
// 계산은 전부 여기 순수 함수에 있다. 화면 없이 검사할 수 있어야, 기울일 때
// 어디를 보는지가 어긋나도 테스트가 잡는다.

// 파노라마인가. 가로가 세로의 두 배에 가까우면 그렇다 — 평면 사진(3:4)과
// 구분하는 데는 이것으로 충분하고, 파일 이름에 규칙을 더 두지 않아도 된다.
export const isPano = ({ width = 0, height = 0 } = {}) =>
  height > 0 && Math.abs(width / height - 2) < 0.1

// 180° 파노라마가 덮는 각도. 가로 180°, 세로는 그 절반인 90°다(2:1 이므로).
export const FOV_H = Math.PI          // 180°
export const FOV_V = Math.PI / 2      // 90°

// 뷰파인더가 한 번에 보여 주는 각도. 파노라마 전체의 약 1/3 — 좁을수록
// 원근이 강해지고 둘러볼 여지가 커진다. 기존 평면 사진의 1.6배 확대와
// 비슷한 감각으로 맞췄다.
export const VIEW = Math.PI / 3       // 60°

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// 화면이 사방으로 얼마나 멀리 보는가. 가장 멀리 보는 곳은 모서리가 아니다 —
// 위아래로 가장 먼 곳은 위쪽 변의 **한가운데**이고(대각선은 광선이 정규화되며
// 눌린다), 좌우로 가장 먼 곳은 옆 변의 한가운데다. 모서리만 재다가 화면 위쪽에
// 검은 띠가 남았다.
export function reachOf(view = VIEW, aspect = 1) {
  const t = Math.tan(view / 2)
  // 세로: uv = (0, 1) — 옆으로 벌어지지 않은 광선이 가장 위를 본다
  const lat = Math.atan(t)
  // 가로: uv = (±1, 0)
  const lon = Math.atan(aspect * t)
  return { lon, lat }
}

// 남겨 두는 여유. 요와 피치를 동시에 최대로 주면 두 회전이 서로 영향을 주어
// 변의 한가운데가 계산보다 몇 도 더 나간다 — 그 상호작용까지 풀기보다, 어느
// 비율·어느 방향에서도 안전한 값을 재서 쓴다(4°부터 안전, 1° 더 얹었다).
// 5° 를 빼도 좌우로 ±65° 는 돈다.
const MARGIN = (5 * Math.PI) / 180

// 기울기(-1..1)를 바라보는 각도로. 파노라마 밖을 보면 검은 자리가 생기므로
// 화면이 실제로 닿는 만큼을 빼고 남은 각도에서만 돈다.
export function lookAt({ x = 0, y = 0 } = {}, view = VIEW, aspect = 1) {
  const r = reachOf(view, aspect)
  const room = (fov, reach) => Math.max(0, fov / 2 - reach - MARGIN)
  return {
    yaw: clamp(x, -1, 1) * room(FOV_H, r.lon),
    pitch: clamp(y, -1, 1) * room(FOV_V, r.lat)
  }
}

// 지금 보고 있는 자리를 사진 안의 퍼센트로. 찍은 사진에 남겨 두면 그때의
// 구도가 그대로 남는다 — 평면 사진의 framePct 와 같은 값을 돌려준다.
export function panoFrame({ x = 0, y = 0 } = {}, view = VIEW, aspect = 1) {
  const { yaw, pitch } = lookAt({ x, y }, view, aspect)
  return {
    x: Math.round(50 + (yaw / FOV_H) * 100),
    y: Math.round(50 + (pitch / FOV_V) * 100)
  }
}

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

// 화면의 한 점 → 광선 방향 → 요·피치만큼 돌리기 → 파노라마의 uv.
// 구면좌표를 그대로 쓰므로 기울이면 원근이 실제로 바뀐다(가운데는 적게,
// 가장자리는 많이 움직인다). 평면으로 밀 때는 없던 것이다.
const FRAG = `
precision mediump float;
uniform sampler2D img;
uniform vec2 size;        // 캔버스 크기
uniform vec2 look;        // yaw, pitch
uniform float view;       // 세로 화각
uniform float fovH;       // 파노라마가 덮는 가로 각도
uniform float fovV;       // 세로 각도

void main() {
  vec2 uv = (gl_FragCoord.xy / size) * 2.0 - 1.0;   // -1..1
  float aspect = size.x / size.y;
  // 화각만큼 벌어진 광선. tan 을 쓰면 가장자리가 실제 렌즈처럼 늘어난다.
  float t = tan(view * 0.5);
  vec3 dir = normalize(vec3(uv.x * aspect * t, uv.y * t, -1.0));
  // 광선을 바라보는 방향으로 돌린다 — 피치 먼저, 그다음 요.
  float cp = cos(look.y), sp = sin(look.y);
  dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);
  float cy = cos(look.x), sy = sin(look.x);
  dir = vec3(dir.x * cy + dir.z * sy, dir.y, -dir.x * sy + dir.z * cy);
  // 구면좌표 → 180° 파노라마의 uv. 정면(-z)이 사진 한가운데다.
  float lon = atan(dir.x, -dir.z);
  float lat = asin(clamp(dir.y, -1.0, 1.0));
  vec2 st = vec2(0.5 + lon / fovH, 0.5 + lat / fovV);
  // 가장자리를 넘어가면 끝 픽셀을 늘려 쓴다. lookAt 이 넘어가지 않게 막고 있지만
  // 반올림 한 줄까지 막지는 못한다 — 검은 띠 대신 사진이 이어지는 편이 낫다.
  st = clamp(st, 0.0, 1.0);
  gl_FragColor = texture2D(img, vec2(st.x, 1.0 - st.y));
}
`

const compile = (gl, type, src) => {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader')
  return sh
}

// 캔버스에 파노라마를 그리는 것. 만들어 두고 draw 를 부르면 그 각도로 다시
// 그린다. 쓰고 나면 dispose 로 GPU 자원을 돌려준다.
export function makePano(canvas, image) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true })
  if (!gl) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const p = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(p)
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // 파노라마는 2의 거듭제곱이 아니므로 밉맵을 쓸 수 없다 — CLAMP + LINEAR.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

  const uSize = gl.getUniformLocation(prog, 'size')
  const uLook = gl.getUniformLocation(prog, 'look')
  const uView = gl.getUniformLocation(prog, 'view')
  gl.uniform1f(gl.getUniformLocation(prog, 'fovH'), FOV_H)
  gl.uniform1f(gl.getUniformLocation(prog, 'fovV'), FOV_V)

  const draw = (pan, view = VIEW) => {
    const w = canvas.clientWidth || canvas.width
    const h = canvas.clientHeight || canvas.height
    const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2)
    const cw = Math.max(1, Math.round(w * dpr))
    const ch = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }
    const { yaw, pitch } = lookAt(pan, view, cw / ch)
    gl.viewport(0, 0, cw, ch)
    gl.uniform2f(uSize, cw, ch)
    gl.uniform2f(uLook, yaw, pitch)
    gl.uniform1f(uView, view)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  return {
    draw,
    // 지금 화면에 보이는 것을 그대로 이미지로. 파노라마 원본이 아니라 뷰파인더가
    // 잘라 낸 그 장면이라, 갤러리에 든 것과 눈으로 본 것이 같아진다.
    // preserveDrawingBuffer 를 켜 두었으므로 그린 직후가 아니어도 읽을 수 있다.
    // 세이브(localStorage)에 실리므로 작게 남긴다. 긴 변 720px, jpeg 0.72 면
    // 폰 화면에서 볼 만하면서 40KB 안팎이다 — 큰 것을 그대로 두면 몇 장 만에
    // 한도(5MB)를 넘어 저장이 통째로 실패한다.
    snap: (long = 720, quality = 0.72) => {
      try {
        const w = canvas.width
        const h = canvas.height
        const k = Math.min(1, long / Math.max(w, h))
        if (k >= 1) return canvas.toDataURL('image/jpeg', quality)
        const small = document.createElement('canvas')
        small.width = Math.round(w * k)
        small.height = Math.round(h * k)
        small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height)
        return small.toDataURL('image/jpeg', quality)
      } catch {
        return null
      }
    },
    dispose: () => {
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }
}
