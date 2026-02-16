// src/effects/sakura.js
import { sakura_shaders } from './sakura_shaders.js';

/**
 * @file sakura webgl effect (configurable module)
 * - no shader <script> tags needed (we bundle GLSL in sakura_shaders.js)
 * - exports init_sakura / destroy_sakura
 *
 * Usage:
 *   import { init_sakura } from './effects/sakura.js';
 *   init_sakura({
 *     canvas_id: 'sakura',
 *     num_flowers: 900,
 *     speed: 0.7,
 *     size_min: 0.8,
 *     size_max: 1.4,
 *     rotation: 0.25,
 *     area: 18,
 *     time_scale: 1.0,
 *   });
 */

let _running = false;
let _raf = 0;
let _on_resize = null;

let _gl = null;
let _canvas = null;

function make_canvas_fullscreen(canvas) {
  const b = document.body;
  const d = document.documentElement;
  const fullw = Math.max(b.clientWidth, b.scrollWidth, d.scrollWidth, d.clientWidth);
  const fullh = Math.max(b.clientHeight, b.scrollHeight, d.scrollHeight, d.clientHeight);
  canvas.width = fullw;
  canvas.height = fullh;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function get_shader_text(id) {
  const src = sakura_shaders[id];
  if (!src) throw new Error(`[sakura] shader ${id} not found in sakura_shaders`);
  return src;
}

export function init_sakura(options = {}) {
  const {
    canvas_id = 'sakura',
    pointer_events = 'none', // keep UI clickable
    // ---- tunables ----
    num_flowers = 1600, // 500~2500 reasonable
    speed = 1.0, // velocity multiplier
    time_scale = 1.0, // delta-time multiplier
    size_min = 0.9,
    size_max = 1.0,
    rotation = 0.5, // 0~1-ish, bigger = more spin
    area = 20.0, // bigger = wider space, more "sparse"
    // ---- behavior ----
    bg_pass = false, // keep YOUR CSS background, do NOT draw shader background
    clear_alpha = 0.0 // canvas clear alpha (0 keeps transparent)
  } = options;

  // Hard guardrails (avoid crazy values)
  const CFG = {
    num_flowers: clamp(Number(num_flowers) || 1600, 50, 20000),
    speed: clamp(Number(speed) || 1.0, 0.05, 10.0),
    time_scale: clamp(Number(time_scale) || 1.0, 0.05, 5.0),
    size_min: clamp(Number(size_min) || 0.9, 0.05, 10.0),
    size_max: clamp(Number(size_max) || 1.0, 0.05, 10.0),
    rotation: clamp(Number(rotation) || 0.5, 0.0, 3.0),
    area: clamp(Number(area) || 20.0, 1.0, 200.0),
    bg_pass: Boolean(bg_pass),
    clear_alpha: clamp(Number(clear_alpha) ?? 0.0, 0.0, 1.0)
  };
  if (CFG.size_max < CFG.size_min) {
    const t = CFG.size_min;
    CFG.size_min = CFG.size_max;
    CFG.size_max = t;
  }

  const canvas = document.getElementById(canvas_id);
  if (!canvas) {
    console.warn(`[sakura] canvas #${canvas_id} not found`);
    return;
  }

  // Make sure canvas doesn't block clicks
  canvas.style.pointerEvents = pointer_events;

  // We want the canvas to be transparent so your .scene background shows through.
  // Also: premultipliedAlpha false reduces dark halos on some GPUs.
  destroy_sakura();

  let gl = null;
  try {
    make_canvas_fullscreen(canvas);
    gl =
      canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
      canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });

    if (!gl) throw new Error('WebGL not supported');
  } catch (e) {
    console.error(e);
    alert('WebGL not supported.');
    return;
  }

  _gl = gl;
  _canvas = canvas;

  // ---- math helpers ----
  const Vector3 = {};
  const Matrix44 = {};

  Vector3.create = (x, y, z) => ({ x, y, z });
  Vector3.cross = (v, v0, v1) => {
    v.x = v0.y * v1.z - v0.z * v1.y;
    v.y = v0.z * v1.x - v0.x * v1.z;
    v.z = v0.x * v1.y - v0.y * v1.x;
  };
  Vector3.normalize = (v) => {
    let l = v.x * v.x + v.y * v.y + v.z * v.z;
    if (l > 0.00001) {
      l = 1.0 / Math.sqrt(l);
      v.x *= l;
      v.y *= l;
      v.z *= l;
    }
  };
  Vector3.arrayForm = (v) => {
    if (v.array) {
      v.array[0] = v.x;
      v.array[1] = v.y;
      v.array[2] = v.z;
    } else {
      v.array = new Float32Array([v.x, v.y, v.z]);
    }
    return v.array;
  };

  Matrix44.createIdentity = () =>
    new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  Matrix44.loadProjection = (m, aspect, vdeg, near, far) => {
    const h = near * Math.tan((vdeg * Math.PI / 180.0) * 0.5) * 2.0;
    const w = h * aspect;
    m[0] = 2.0 * near / w; m[1] = 0.0; m[2] = 0.0; m[3] = 0.0;
    m[4] = 0.0; m[5] = 2.0 * near / h; m[6] = 0.0; m[7] = 0.0;
    m[8] = 0.0; m[9] = 0.0; m[10] = -(far + near) / (far - near); m[11] = -1.0;
    m[12] = 0.0; m[13] = 0.0; m[14] = -2.0 * far * near / (far - near); m[15] = 0.0;
  };

  Matrix44.loadLookAt = (m, vpos, vlook, vup) => {
    const frontv = Vector3.create(vpos.x - vlook.x, vpos.y - vlook.y, vpos.z - vlook.z);
    Vector3.normalize(frontv);

    const sidev = Vector3.create(1.0, 0.0, 0.0);
    Vector3.cross(sidev, vup, frontv);
    Vector3.normalize(sidev);

    const topv = Vector3.create(1.0, 0.0, 0.0);
    Vector3.cross(topv, frontv, sidev);
    Vector3.normalize(topv);

    m[0] = sidev.x; m[1] = topv.x; m[2] = frontv.x; m[3] = 0.0;
    m[4] = sidev.y; m[5] = topv.y; m[6] = frontv.y; m[7] = 0.0;
    m[8] = sidev.z; m[9] = topv.z; m[10] = frontv.z; m[11] = 0.0;
    m[12] = -(vpos.x * m[0] + vpos.y * m[4] + vpos.z * m[8]);
    m[13] = -(vpos.x * m[1] + vpos.y * m[5] + vpos.z * m[9]);
    m[14] = -(vpos.x * m[2] + vpos.y * m[6] + vpos.z * m[10]);
    m[15] = 1.0;
  };

  // ---- time ----
  const timeInfo = { start: 0, prev: 0, delta: 0, elapsed: 0 };

  // ---- render spec ----
  const renderSpec = {
    width: 0, height: 0, aspect: 1,
    array: new Float32Array(3),
    halfWidth: 0, halfHeight: 0,
    halfArray: new Float32Array(3)
  };

  renderSpec.setSize = (w, h) => {
    renderSpec.width = w;
    renderSpec.height = h;
    renderSpec.aspect = w / h;
    renderSpec.array[0] = w;
    renderSpec.array[1] = h;
    renderSpec.array[2] = renderSpec.aspect;
    renderSpec.halfWidth = Math.max(1, Math.floor(w / 2));
    renderSpec.halfHeight = Math.max(1, Math.floor(h / 2));
    renderSpec.halfArray[0] = renderSpec.halfWidth;
    renderSpec.halfArray[1] = renderSpec.halfHeight;
    renderSpec.halfArray[2] = renderSpec.halfWidth / renderSpec.halfHeight;
  };

  // ---- GL helpers ----
  function compile_shader(shtype, shsrc) {
    const sh = gl.createShader(shtype);
    gl.shaderSource(sh, shsrc);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`[sakura] shader compile failed: ${err}`);
    }
    return sh;
  }

  function create_shader(vtxsrc, frgsrc, uniformlist, attrlist) {
    const vsh = compile_shader(gl.VERTEX_SHADER, vtxsrc);
    const fsh = compile_shader(gl.FRAGMENT_SHADER, frgsrc);

    const prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);

    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      throw new Error(`[sakura] program link failed: ${err}`);
    }

    prog.uniforms = {};
    (uniformlist || []).forEach((u) => (prog.uniforms[u] = gl.getUniformLocation(prog, u)));

    prog.attributes = {};
    (attrlist || []).forEach((a) => (prog.attributes[a] = gl.getAttribLocation(prog, a)));

    return prog;
  }

  function use_shader(prog) {
    gl.useProgram(prog);
    for (const attr in prog.attributes) gl.enableVertexAttribArray(prog.attributes[attr]);
  }
  function unuse_shader(prog) {
    for (const attr in prog.attributes) gl.disableVertexAttribArray(prog.attributes[attr]);
    gl.useProgram(null);
  }

  function delete_render_target(rt) {
    gl.deleteFramebuffer(rt.frameBuffer);
    gl.deleteRenderbuffer(rt.renderBuffer);
    gl.deleteTexture(rt.texture);
  }

  function create_render_target(w, h) {
    const ret = {
      width: w,
      height: h,
      sizeArray: new Float32Array([w, h, w / h]),
      dtxArray: new Float32Array([1.0 / w, 1.0 / h])
    };

    ret.frameBuffer = gl.createFramebuffer();
    ret.renderBuffer = gl.createRenderbuffer();
    ret.texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, ret.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, ret.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ret.texture, 0);

    gl.bindRenderbuffer(gl.RENDERBUFFER, ret.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ret.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ret;
  }

  // ---- scene objects ----
  const projection = {
    angle: 60,
    nearfar: new Float32Array([0.1, 100.0]),
    matrix: Matrix44.createIdentity()
  };

  const camera = {
    position: Vector3.create(0, 0, 100),
    lookat: Vector3.create(0, 0, 0),
    up: Vector3.create(0, 1, 0),
    dof: Vector3.create(10.0, 4.0, 8.0),
    matrix: Matrix44.createIdentity()
  };

  const pointFlower = {};
  const effectLib = {};
  let sceneStandBy = false;

  // ---- particle ----
  function BlossomParticle() {
    this.velocity = new Array(3);
    this.rotation = new Array(3);
    this.position = new Array(3);
    this.euler = new Array(3);
    this.size = 1.0;
    this.alpha = 1.0;
    this.zkey = 0.0;
  }

  BlossomParticle.prototype.setVelocity = function (vx, vy, vz) {
    this.velocity[0] = vx; this.velocity[1] = vy; this.velocity[2] = vz;
  };
  BlossomParticle.prototype.setRotation = function (rx, ry, rz) {
    this.rotation[0] = rx; this.rotation[1] = ry; this.rotation[2] = rz;
  };
  BlossomParticle.prototype.setPosition = function (nx, ny, nz) {
    this.position[0] = nx; this.position[1] = ny; this.position[2] = nz;
  };
  BlossomParticle.prototype.setEulerAngles = function (rx, ry, rz) {
    this.euler[0] = rx; this.euler[1] = ry; this.euler[2] = rz;
  };
  BlossomParticle.prototype.setSize = function (s) {
    this.size = s;
  };
  BlossomParticle.prototype.update = function (dt) {
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;
    this.euler[0] += this.rotation[0] * dt;
    this.euler[1] += this.rotation[1] * dt;
    this.euler[2] += this.rotation[2] * dt;
  };

  // ---- point flowers ----
  function create_point_flowers() {
    const prm = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    renderSpec.pointSize = { min: prm[0], max: prm[1] };

    const vtxsrc = get_shader_text('sakura_point_vsh');
    const frgsrc = get_shader_text('sakura_point_fsh');

    pointFlower.program = create_shader(
      vtxsrc,
      frgsrc,
      ['uProjection', 'uModelview', 'uResolution', 'uOffset', 'uDOF', 'uFade'],
      ['aPosition', 'aEuler', 'aMisc']
    );

    use_shader(pointFlower.program);
    pointFlower.offset = new Float32Array([0.0, 0.0, 0.0]);
    pointFlower.fader = Vector3.create(0.0, 10.0, 0.0);

    pointFlower.numFlowers = CFG.num_flowers;
    pointFlower.particles = new Array(pointFlower.numFlowers);
    pointFlower.dataArray = new Float32Array(pointFlower.numFlowers * (3 + 3 + 2));
    pointFlower.positionArrayOffset = 0;
    pointFlower.eulerArrayOffset = pointFlower.numFlowers * 3;
    pointFlower.miscArrayOffset = pointFlower.numFlowers * 6;
    pointFlower.buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, pointFlower.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, pointFlower.dataArray, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unuse_shader(pointFlower.program);

    for (let i = 0; i < pointFlower.numFlowers; i++) {
      pointFlower.particles[i] = new BlossomParticle();
    }
  }

  function init_point_flowers() {
    pointFlower.area = Vector3.create(CFG.area, CFG.area, CFG.area);
    pointFlower.area.x = pointFlower.area.y * renderSpec.aspect;

    pointFlower.fader.x = 10.0;
    pointFlower.fader.y = pointFlower.area.z;
    pointFlower.fader.z = 0.1;

    const PI2 = Math.PI * 2.0;
    const tmpv3 = Vector3.create(0, 0, 0);
    const symmetryrand = () => (Math.random() * 2.0 - 1.0);

    for (let i = 0; i < pointFlower.numFlowers; i++) {
      const p = pointFlower.particles[i];

      tmpv3.x = symmetryrand() * 0.3 + 0.8;
      tmpv3.y = symmetryrand() * 0.2 - 1.0;
      tmpv3.z = symmetryrand() * 0.3 + 0.5;
      Vector3.normalize(tmpv3);

      const sp = (2.0 + Math.random() * 1.0) * CFG.speed;
      p.setVelocity(tmpv3.x * sp, tmpv3.y * sp, tmpv3.z * sp);

      const rot = CFG.rotation;
      p.setRotation(symmetryrand() * PI2 * rot, symmetryrand() * PI2 * rot, symmetryrand() * PI2 * rot);

      p.setPosition(symmetryrand() * pointFlower.area.x, symmetryrand() * pointFlower.area.y, symmetryrand() * pointFlower.area.z);
      p.setEulerAngles(Math.random() * PI2, Math.random() * PI2, Math.random() * PI2);

      const s = CFG.size_min + Math.random() * (CFG.size_max - CFG.size_min);
      p.setSize(s);
    }
  }

  // ---- effects ----
  function create_effect_program(vtxsrc, frgsrc, exunifs, exattrs) {
    const ret = {};
    let unifs = ['uResolution', 'uSrc', 'uDelta'];
    if (exunifs) unifs = unifs.concat(exunifs);
    let attrs = ['aPosition'];
    if (exattrs) attrs = attrs.concat(exattrs);

    ret.program = create_shader(vtxsrc, frgsrc, unifs, attrs);

    use_shader(ret.program);
    ret.dataArray = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    ret.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ret.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, ret.dataArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unuse_shader(ret.program);

    return ret;
  }

  function use_effect(fxobj, srctex) {
    const prog = fxobj.program;
    use_shader(prog);
    gl.uniform3fv(prog.uniforms.uResolution, renderSpec.array);
    if (srctex) {
      gl.uniform2fv(prog.uniforms.uDelta, srctex.dtxArray);
      gl.uniform1i(prog.uniforms.uSrc, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srctex.texture);
    }
  }

  function draw_effect(fxobj) {
    gl.bindBuffer(gl.ARRAY_BUFFER, fxobj.buffer);
    gl.vertexAttribPointer(fxobj.program.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function unuse_effect(fxobj) {
    unuse_shader(fxobj.program);
  }

  function create_effect_lib() {
    const cmnvtxsrc = get_shader_text('fx_common_vsh');

    effectLib.sceneBg = create_effect_program(cmnvtxsrc, get_shader_text('bg_fsh'), ['uTimes'], null);
    effectLib.mkBrightBuf = create_effect_program(cmnvtxsrc, get_shader_text('fx_brightbuf_fsh'), null, null);
    effectLib.dirBlur = create_effect_program(cmnvtxsrc, get_shader_text('fx_dirblur_r4_fsh'), ['uBlurDir'], null);

    const ppv = get_shader_text('pp_final_vsh');
    const ppf = get_shader_text('pp_final_fsh');
    effectLib.finalComp = create_effect_program(ppv, ppf, ['uBloom'], null);
  }

  function render_background() {
    gl.disable(gl.DEPTH_TEST);
    use_effect(effectLib.sceneBg, null);
    gl.uniform2f(effectLib.sceneBg.program.uniforms.uTimes, timeInfo.elapsed, timeInfo.delta);
    draw_effect(effectLib.sceneBg);
    unuse_effect(effectLib.sceneBg);
    gl.enable(gl.DEPTH_TEST);
  }

  function render_point_flowers() {
    const PI2 = Math.PI * 2.0;
    const repeatPos = (prt, cmp, limit) => {
      if (Math.abs(prt.position[cmp]) - prt.size * 0.5 > limit) {
        prt.position[cmp] += prt.position[cmp] > 0 ? -limit * 2.0 : limit * 2.0;
      }
    };
    const repeatEuler = (prt, cmp) => {
      prt.euler[cmp] = prt.euler[cmp] % PI2;
      if (prt.euler[cmp] < 0.0) prt.euler[cmp] += PI2;
    };

    const dt = timeInfo.delta * CFG.time_scale;

    for (let i = 0; i < pointFlower.numFlowers; i++) {
      const p = pointFlower.particles[i];
      p.update(dt);

      repeatPos(p, 0, pointFlower.area.x);
      repeatPos(p, 1, pointFlower.area.y);
      repeatPos(p, 2, pointFlower.area.z);

      repeatEuler(p, 0);
      repeatEuler(p, 1);
      repeatEuler(p, 2);

      p.alpha = 1.0;
      p.zkey =
        camera.matrix[2] * p.position[0] +
        camera.matrix[6] * p.position[1] +
        camera.matrix[10] * p.position[2] +
        camera.matrix[14];
    }

    pointFlower.particles.sort((p0, p1) => p0.zkey - p1.zkey);

    let ipos = pointFlower.positionArrayOffset;
    let ieuler = pointFlower.eulerArrayOffset;
    let imisc = pointFlower.miscArrayOffset;

    for (let i = 0; i < pointFlower.numFlowers; i++) {
      const p = pointFlower.particles[i];

      pointFlower.dataArray[ipos++] = p.position[0];
      pointFlower.dataArray[ipos++] = p.position[1];
      pointFlower.dataArray[ipos++] = p.position[2];

      pointFlower.dataArray[ieuler++] = p.euler[0];
      pointFlower.dataArray[ieuler++] = p.euler[1];
      pointFlower.dataArray[ieuler++] = p.euler[2];

      pointFlower.dataArray[imisc++] = p.size;
      pointFlower.dataArray[imisc++] = p.alpha;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const prog = pointFlower.program;
    use_shader(prog);

    gl.uniformMatrix4fv(prog.uniforms.uProjection, false, projection.matrix);
    gl.uniformMatrix4fv(prog.uniforms.uModelview, false, camera.matrix);
    gl.uniform3fv(prog.uniforms.uResolution, renderSpec.array);
    gl.uniform3fv(prog.uniforms.uDOF, Vector3.arrayForm(camera.dof));
    gl.uniform3fv(prog.uniforms.uFade, Vector3.arrayForm(pointFlower.fader));

    gl.bindBuffer(gl.ARRAY_BUFFER, pointFlower.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, pointFlower.dataArray, gl.DYNAMIC_DRAW);

    gl.vertexAttribPointer(prog.attributes.aPosition, 3, gl.FLOAT, false, 0, pointFlower.positionArrayOffset * 4);
    gl.vertexAttribPointer(prog.attributes.aEuler, 3, gl.FLOAT, false, 0, pointFlower.eulerArrayOffset * 4);
    gl.vertexAttribPointer(prog.attributes.aMisc, 2, gl.FLOAT, false, 0, pointFlower.miscArrayOffset * 4);

    // draw only once (keep it light)
    gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset);
    gl.drawArrays(gl.POINT, 0, pointFlower.numFlowers);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unuse_shader(prog);

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  }

  function render_post_process() {
    gl.disable(gl.DEPTH_TEST);

    const bindRT = (rt, isclear) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.frameBuffer);
      gl.viewport(0, 0, rt.width, rt.height);
      if (isclear) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      }
    };

    // bright buffer
    bindRT(renderSpec.wHalfRT0, true);
    use_effect(effectLib.mkBrightBuf, renderSpec.mainRT);
    draw_effect(effectLib.mkBrightBuf);
    unuse_effect(effectLib.mkBrightBuf);

    // blur passes
    for (let i = 0; i < 2; i++) {
      const p = 1.5 + 1 * i;
      const s = 2.0 + 1 * i;

      bindRT(renderSpec.wHalfRT1, true);
      use_effect(effectLib.dirBlur, renderSpec.wHalfRT0);
      gl.uniform4f(effectLib.dirBlur.program.uniforms.uBlurDir, p, 0.0, s, 0.0);
      draw_effect(effectLib.dirBlur);
      unuse_effect(effectLib.dirBlur);

      bindRT(renderSpec.wHalfRT0, true);
      use_effect(effectLib.dirBlur, renderSpec.wHalfRT1);
      gl.uniform4f(effectLib.dirBlur.program.uniforms.uBlurDir, 0.0, p, 0.0, s);
      draw_effect(effectLib.dirBlur);
      unuse_effect(effectLib.dirBlur);
    }

    // final composite (draws to screen)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, renderSpec.width, renderSpec.height);

    // IMPORTANT: do NOT clear with opaque color; keep transparent canvas.
    gl.clearColor(0, 0, 0, CFG.clear_alpha);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    use_effect(effectLib.finalComp, renderSpec.mainRT);
    gl.uniform1i(effectLib.finalComp.program.uniforms.uBloom, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, renderSpec.wHalfRT0.texture);
    draw_effect(effectLib.finalComp);
    unuse_effect(effectLib.finalComp);

    gl.enable(gl.DEPTH_TEST);
  }

  // ---- scene ----
  function create_scene() {
    create_effect_lib();
    create_point_flowers();
    sceneStandBy = true;
  }

  function init_scene() {
    init_point_flowers();
    camera.position.z = pointFlower.area.z + projection.nearfar[0];
    projection.angle =
      (Math.atan2(pointFlower.area.y, camera.position.z + pointFlower.area.z) * 180.0) / Math.PI * 2.0;
    Matrix44.loadProjection(
      projection.matrix,
      renderSpec.aspect,
      projection.angle,
      projection.nearfar[0],
      projection.nearfar[1]
    );
  }

  function render_scene() {
    Matrix44.loadLookAt(camera.matrix, camera.position, camera.lookat, camera.up);

    gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.mainRT.frameBuffer);
    gl.viewport(0, 0, renderSpec.mainRT.width, renderSpec.mainRT.height);

    // Clear to TRANSPARENT so your CSS background shows through
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (CFG.bg_pass) render_background();
    render_point_flowers();
    render_post_process();
  }

  function set_viewports() {
    renderSpec.setSize(gl.canvas.width, gl.canvas.height);
    gl.viewport(0, 0, renderSpec.width, renderSpec.height);

    const rtfunc = (rtname, w, h) => {
      const old = renderSpec[rtname];
      if (old) delete_render_target(old);
      renderSpec[rtname] = create_render_target(w, h);
    };

    rtfunc('mainRT', renderSpec.width, renderSpec.height);
    rtfunc('wHalfRT0', renderSpec.halfWidth, renderSpec.halfHeight);
    rtfunc('wHalfRT1', renderSpec.halfWidth, renderSpec.halfHeight);
  }

  function animate() {
    const now = new Date();
    timeInfo.elapsed = (now - timeInfo.start) / 1000.0;
    timeInfo.delta = (now - timeInfo.prev) / 1000.0;
    timeInfo.prev = now;

    render_scene();

    if (_running) _raf = requestAnimationFrame(animate);
  }

  _on_resize = () => {
    make_canvas_fullscreen(canvas);
    set_viewports();
    if (sceneStandBy) init_scene();
  };

  window.addEventListener('resize', _on_resize);

  set_viewports();
  create_scene();
  init_scene();

  timeInfo.start = new Date();
  timeInfo.prev = timeInfo.start;

  _running = true;
  _raf = requestAnimationFrame(animate);
}

export function destroy_sakura() {
  _running = false;
  if (_raf) cancelAnimationFrame(_raf);
  _raf = 0;

  if (_on_resize) {
    window.removeEventListener('resize', _on_resize);
    _on_resize = null;
  }

  // Try to release GL context references
  _gl = null;
  _canvas = null;
}
