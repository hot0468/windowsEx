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

// 기울기(-1..1)를 바라보는 각도로. 파노라마의 끝을 넘어가면 화면에 빈 자리가
// 생기므로, 남은 각도만큼만 돈다 — 끝까지 기울여도 가장자리가 비지 않는다.
export function lookAt({ x = 0, y = 0 } = {}, view = VIEW) {
  const room = (fov) => Math.max(0, (fov - view) / 2)
  return {
    yaw: clamp(x, -1, 1) * room(FOV_H),
    pitch: clamp(y, -1, 1) * room(FOV_V)
  }
}

// 지금 보고 있는 자리를 사진 안의 퍼센트로. 찍은 사진에 남겨 두면 그때의
// 구도가 그대로 남는다 — 평면 사진의 framePct 와 같은 값을 돌려준다.
export function panoFrame({ x = 0, y = 0 } = {}, view = VIEW) {
  const { yaw, pitch } = lookAt({ x, y }, view)
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
  // 파노라마 밖을 보면 검게 — 끝을 넘어갔다는 것이 보여야 한다.
  if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) {
    gl_FragColor = vec4(0.04, 0.05, 0.06, 1.0);
    return;
  }
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
    const { yaw, pitch } = lookAt(pan, view)
    gl.viewport(0, 0, cw, ch)
    gl.uniform2f(uSize, cw, ch)
    gl.uniform2f(uLook, yaw, pitch)
    gl.uniform1f(uView, view)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  return {
    draw,
    dispose: () => {
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }
}
