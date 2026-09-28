"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A 360° panorama, drawn in WebGL with no library.
 *
 * WHY NOT THE CHAOS LINK. The booth's panorama lives on Chaos Cloud, and the
 * share link works when opened on its own. Framed inside this site it does
 * not: Chaos needs a session cookie that browsers refuse to a cross-site
 * frame, so the viewer answered 401 and drew nothing — a black box on the
 * Events page, under a cookie banner and a "Sign in" bar. The panorama itself
 * is a single equirectangular image, so it is hosted here and drawn here.
 *
 * WHY NO LIBRARY. Photo Sphere Viewer and friends bring three.js with them.
 * Looking around a sphere is one fragment shader: turn the view direction of
 * each pixel into a longitude and latitude, and read the image there. This
 * file is the whole viewer, and it loads only when someone asks for it.
 *
 * WHAT IT DOES
 *   - drag to look around (and, full screen, up and down as well)
 *   - pinch or scroll to zoom
 *   - arrow keys, and turn buttons, because dragging must never be the only
 *     way to operate something (WCAG 2.2, 2.5.7)
 *   - drifts slowly until touched; never for prefers-reduced-motion
 *   - stops drawing when off screen or in a background tab
 */

const VERTEX = `
attribute vec2 p;
varying vec2 v;
void main() { v = p; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `
precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform float yaw;
uniform float pitch;
uniform float tanHalfFov;
uniform float aspect;
const float PI = 3.14159265358979;
void main() {
  vec3 d = normalize(vec3(v.x * tanHalfFov * aspect, v.y * tanHalfFov, -1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  gl_FragColor = texture2D(tex, vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI));
}`;

const DEG = Math.PI / 180;
const MIN_FOV = 38 * DEG;
const MAX_FOV = 100 * DEG;
const MAX_PITCH = 80 * DEG;
/** Slow enough to read as the room settling, not as a carousel. */
const DRIFT = 0.045; // radians per second

export type PanoramaLabels = {
  view: string;
  hint: string;
  turnLeft: string;
  turnRight: string;
};

type Props = {
  /** 4096 × 2048, for phones and anything that cannot hold a larger texture. */
  src: string;
  /** 8192 × 4096, for large screens that can. */
  srcLarge?: string;
  /** Where the camera looks first, in degrees of longitude (0 = image centre). */
  initialLongitude?: number;
  labels: PanoramaLabels;
  reducedMotion: boolean;
  /** Full screen: vertical drags look up and down instead of scrolling. */
  immersive: boolean;
  onReady: () => void;
  onFail: () => void;
};

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/** cubic-bezier(0.22, 1, 0.36, 1) is close enough to an ease-out quint. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 5);

export function PanoramaViewer({
  src,
  srcLarge,
  initialLongitude = 0,
  labels,
  reducedMotion,
  immersive,
  onReady,
  onFail,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [touched, setTouched] = useState(false);

  /* Everything the render loop reads lives in one mutable object, so a drag
     never re-renders React — only the canvas. */
  const view = useRef({
    yaw: -initialLongitude * DEG,
    /* A little above the horizon: the camera in this panorama stands just
       behind the striped lamp, and level it fills the lower half. */
    pitch: 6 * DEG,
    fov: 78 * DEG,
    velocity: 0,
    drifting: true,
    turn: null as null | { from: number; to: number; start: number },
    kick: () => {},
  });
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const immersiveRef = useRef(immersive);
  immersiveRef.current = immersive;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      failRef.current();
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      failRef.current();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      failRef.current();
      return;
    }
    gl.useProgram(program);

    /* One triangle that covers the screen. */
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uYaw = gl.getUniformLocation(program, "yaw");
    const uPitch = gl.getUniformLocation(program, "pitch");
    const uTan = gl.getUniformLocation(program, "tanHalfFov");
    const uAspect = gl.getUniformLocation(program, "aspect");

    let loaded = false;
    let disposed = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let dirty = true;

    const draw = () => {
      if (!loaded) return;
      const v = view.current;
      gl.uniform1f(uYaw, v.yaw);
      gl.uniform1f(uPitch, v.pitch);
      gl.uniform1f(uTan, Math.tan(v.fov / 2));
      gl.uniform1f(uAspect, canvas.width / Math.max(canvas.height, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      dirty = false;
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const v = view.current;
      let moving = false;

      if (v.turn) {
        const t = Math.min((now - v.turn.start) / 700, 1);
        v.yaw = v.turn.from + (v.turn.to - v.turn.from) * easeOut(t);
        if (t >= 1) v.turn = null;
        moving = true;
      } else if (Math.abs(v.velocity) > 0.0005) {
        v.yaw += v.velocity;
        v.velocity *= 0.9;
        moving = true;
      } else if (v.drifting && !reducedRef.current) {
        v.yaw += DRIFT * dt;
        moving = true;
      }

      if (moving || dirty) draw();
      if (moving) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const kick = () => {
      dirty = true;
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    view.current.kick = kick;

    /* Sharp without overdrawing: a phone at 3× gains nothing visible here
       beyond 2×, and pays for every extra pixel in the shader. */
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      kick();
    };
    const sizer = new ResizeObserver(resize);
    sizer.observe(canvas);

    const watcher = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) kick();
    });
    watcher.observe(canvas);
    const onVisibility = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    /* The large image only where the screen is large and the GPU can hold
       it: 8192 × 4096 is 128 MB of texture, which a phone should never be
       asked for. */
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const wantLarge =
      Boolean(srcLarge) && maxTexture >= 8192 && window.innerWidth >= 1200;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) return;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      /* Wraps around horizontally (both sizes are powers of two), clamps at
         the poles. No mipmaps: a mip chain puts a visible seam where the
         longitude wraps from +180° to −180°. */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      loaded = true;
      /* A portrait screen narrows the horizontal view, so it opens wider;
         otherwise a phone sees one panel from arm's length. */
      if (canvas.clientHeight > canvas.clientWidth) view.current.fov = 95 * DEG;
      resize();
      draw();
      readyRef.current();
      kick();
    };
    image.onerror = () => failRef.current();
    image.src = wantLarge && srcLarge ? srcLarge : src;

    const onLost = (e: Event) => {
      e.preventDefault();
      failRef.current();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      sizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      image.onload = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [src, srcLarge]);

  /* ---------------------------------------------------------- input ------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let lastDx = 0;

    const stopDrift = () => {
      const v = view.current;
      if (v.drifting) {
        v.drifting = false;
        setTouched(true);
      }
    };
    /* Angle per pixel, so a drag moves the room exactly under the finger. */
    const perPixel = () => view.current.fov / Math.max(canvas.clientHeight, 1);

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      view.current.velocity = 0;
      view.current.turn = null;
      stopDrift();
    };
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const v = view.current;
      if (pointers.size === 2) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch) v.fov = Math.min(MAX_FOV, Math.max(MIN_FOV, v.fov * (pinch / dist)));
        pinch = dist;
        v.kick();
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      v.yaw += dx * perPixel();
      lastDx = dx * perPixel();
      /* Inline, a vertical swipe scrolls the page (touch-action: pan-y), so
         only a mouse or the full-screen view tilts the camera. */
      if (immersiveRef.current || e.pointerType === "mouse") {
        v.pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, v.pitch + dy * perPixel()));
      }
      v.kick();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (pointers.size === 0) {
        view.current.velocity = reducedRef.current ? 0 : lastDx * 0.6;
        lastDx = 0;
        view.current.kick();
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      v.fov = Math.min(MAX_FOV, Math.max(MIN_FOV, v.fov + e.deltaY * 0.0012));
      stopDrift();
      v.kick();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, []);

  /** A quarter-ish turn, eased — the buttons' and the arrow keys' step. */
  const turn = (direction: 1 | -1) => {
    const v = view.current;
    v.drifting = false;
    setTouched(true);
    v.velocity = 0;
    /* The centre of the view is at longitude −yaw, so looking left (towards
       lower longitude) means increasing yaw. */
    v.turn = { from: v.yaw, to: v.yaw - direction * 35 * DEG, start: performance.now() };
    if (reducedRef.current) {
      v.yaw = v.turn.to;
      v.turn = null;
    }
    v.kick();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const v = view.current;
    if (e.key === "ArrowLeft") turn(-1);
    else if (e.key === "ArrowRight") turn(1);
    else if (e.key === "ArrowUp") v.pitch = Math.min(MAX_PITCH, v.pitch + 10 * DEG);
    else if (e.key === "ArrowDown") v.pitch = Math.max(-MAX_PITCH, v.pitch - 10 * DEG);
    else if (e.key === "+" || e.key === "=") v.fov = Math.max(MIN_FOV, v.fov - 8 * DEG);
    else if (e.key === "-") v.fov = Math.min(MAX_FOV, v.fov + 8 * DEG);
    else return;
    e.preventDefault();
    v.kick();
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={labels.view}
        onKeyDown={onKey}
        className="block h-full w-full cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream active:cursor-grabbing"
        style={{ touchAction: immersive ? "none" : "pan-y" }}
      />

      {/* A hint, once, until the first touch. */}
      {/* On the same frosted plate as the buttons, so it reads over the pale
          ceiling and the dark panels alike. */}
      <p
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-4 flex justify-center transition-opacity duration-700 ease-bloom ${
          touched ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="rounded-[3px] bg-burgundy/60 px-3 py-1.5 font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream backdrop-blur-sm">
          {labels.hint}
        </span>
      </p>

      {/* Physical left and right: these turn the camera, so they stay in
          screen order whatever the reading direction. */}
      <div dir="ltr" className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
        {([-1, 1] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            onClick={() => turn(direction)}
            aria-label={direction < 0 ? labels.turnLeft : labels.turnRight}
            className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-cream/40 bg-burgundy/55 text-cream backdrop-blur-sm transition-colors duration-200 ease-bloom hover:border-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                d={direction < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
