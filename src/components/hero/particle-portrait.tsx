'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type * as THREE_NS from 'three';

/**
 * GPU particle layer over the hero portrait.
 *
 * The static <img> stays in the DOM (LCP, no-JS, reduced motion, weak GPU, WebGL failure).
 * This canvas samples that already-downloaded image ONCE and uploads every point to the GPU.
 * Per frame the CPU only writes a few uniforms:
 *   - idle: subtle edge shimmer, capped at ~30fps
 *   - scroll: points fade out in place, bottom rows first, as the name slides over them
 *
 * Lag guards:
 *   1. Never starts on reduced motion, data saver, ≤ 4 cores, or software-rendered WebGL.
 *   2. Watchdog: if the first frames stutter, it tears itself down and the static image returns.
 *   3. Layout is only measured after scroll/resize, never every frame.
 *   4. Fully paused when the hero is offscreen or the tab is hidden.
 */

type Props = {
    /** Hero section: canvas covers it, scroll progress is measured against it. */
    sectionRef: RefObject<HTMLElement | null>;
    /** Box the points are aligned to (the portrait wrapper). */
    portraitRef: RefObject<HTMLElement | null>;
    /** The name: streaks form at its vertical centre and span its width. */
    nameRef: RefObject<HTMLElement | null>;
    /** Wrapper of the static <img>; dimmed while the points are live. */
    imageLayerRef: RefObject<HTMLElement | null>;
    theme: 'dark' | 'light';
};

// ---- Look -----------------------------------------------------------------
/** Sample columns. Points ≈ cols² × opaque share (~18k desktop, ~7k mobile). */
const SAMPLE_COLS_DESKTOP = 170;
const SAMPLE_COLS_MOBILE = 110;
/** Alpha (0–255) above which a pixel becomes a point. Luminance never decides existence. */
const ALPHA_CUTOFF = 128;
/** Brightness floor so the near-black hair and hoodie stay visible. */
const MIN_B = 0.15;
/** < 1 lifts mid-tones. */
const GAMMA = 0.8;
/** Static photo opacity underneath the live points. Higher = more photo, less dot texture. */
const IMAGE_OPACITY_LIVE = 0.55;
/** Dot opacity multiplier. Lower = subtler dot texture. */
const DOT_OPACITY = 0.5;
/** Dot diameter as a share of the grid spacing (min at black, max at white). */
const DOT_SIZE_MIN = 0.3;
const DOT_SIZE_MAX = 0.6;
/** Share of the hero height scrolled before the portrait has faded out. */
const DISSOLVE_DISTANCE = 0.5;

// ---- Budget ---------------------------------------------------------------
const MAX_DPR = 1.25;
/** Frame interval when nothing is moving (shimmer only). */
const IDLE_FRAME_MS = 33;
/** Keep measuring layout this long after mount: the Framer entry animation is still moving things. */
const ENTRY_SETTLE_MS = 1800;
/** Watchdog: sample this many frames after start... */
const WATCHDOG_FRAMES = 90;
/** ...and bail out if more than this share took longer than JANK_MS. */
const WATCHDOG_MAX_JANK_SHARE = 0.25;
const JANK_MS = 50;

const INK = {
    dark: [0.949, 0.937, 0.91], // #f2efe8
    light: [0.067, 0.067, 0.067], // #111111
} as const;
const HEAT = {
    dark: [0.0, 0.941, 0.314], // #00F050
    light: [0.0, 0.55, 0.22],
} as const;

const vertexShader = /* glsl */ `
attribute float aBright;
attribute float aSeed;
uniform float uTime;
uniform float uProgress;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uBandY;
uniform float uSpread;
uniform float uPoint;
uniform float uDpr;
uniform float uDotOpacity;
varying float vAlpha;
varying float vHeat;

void main() {
    vec2 p0 = position.xy;

    // Scroll fade: the points stay where they are and sink into the dark,
    // bottom rows a little ahead of the top, with a per-dot jitter so the
    // fade reads as grain rather than a hard line.
    float start = (0.5 - p0.y) * 0.25 + aSeed * 0.12;
    float t = smoothstep(start, start + 0.6, uProgress);

    vec2 p = p0;

    // Shimmer at the silhouette edges.
    float edge = smoothstep(0.18, 0.5, abs(p0.x));
    p.x += sin(uTime * 0.6 + aSeed * 40.0) * 0.004 * edge;
    p.y += cos(uTime * 0.5 + aSeed * 31.0) * 0.002 * edge;

    vec2 world = uCenter + p * uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
    gl_PointSize = uPoint * mix(${DOT_SIZE_MIN.toFixed(2)}, ${DOT_SIZE_MAX.toFixed(2)}, aBright) * uDpr;

    // Mirror the CSS bottom fade on the static image.
    float fromTop = 0.5 - p0.y;
    float mask = 1.0 - smoothstep(0.55, 0.92, fromTop);
    vAlpha = aBright * mask * uDotOpacity * (1.0 - t);
    // A faint glow on the dots that are on their way out.
    vHeat = t * (1.0 - t) * 2.0;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uHeat;
uniform float uIntro;
varying float vAlpha;
varying float vHeat;

void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.2, d) * vAlpha * uIntro;
    if (a < 0.02) discard;
    gl_FragColor = vec4(mix(uInk, uHeat, vHeat * 0.6), a);
}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Frame-rate independent exponential smoothing. */
const damp = (from: number, to: number, lambda: number, dt: number) =>
    from + (to - from) * (1 - Math.exp(-lambda * dt));

const shouldRun = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
        deviceMemory?: number;
    };
    if (nav.connection?.saveData) return false;
    if ((nav.hardwareConcurrency ?? 8) <= 4) return false;
    if ((nav.deviceMemory ?? 8) < 4) return false;
    return true;
};

const waitForImage = (img: HTMLImageElement) =>
    img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => reject(new Error('image failed')), {
                  once: true,
              });
          });

/** Samples the image once: alpha decides existence, remapped luminance decides brightness. */
const sampleImage = (img: HTMLImageElement, cols: number) => {
    const rows = Math.max(1, Math.round((cols * img.naturalHeight) / img.naturalWidth));
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cols, rows);
    const data = ctx.getImageData(0, 0, cols, rows).data;

    const pos: number[] = [];
    const bright: number[] = [];
    const seed: number[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = (r * cols + c) * 4;
            if (data[i + 3] < ALPHA_CUTOFF) continue;
            const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
            pos.push((c + 0.5) / cols - 0.5, 0.5 - (r + 0.5) / rows, 0);
            bright.push(MIN_B + (1 - MIN_B) * Math.pow(lum, GAMMA));
            seed.push(((127 * c + 311 * r) % 997) / 997);
        }
    }
    return { cols, pos, bright, seed };
};

const ParticlePortrait = ({ sectionRef, portraitRef, nameRef, imageLayerRef, theme }: Props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uniformsRef = useRef<Record<string, THREE_NS.IUniform> | null>(null);
    const themeRef = useRef(theme);

    // Theme swaps are a uniform write, never a rebuild.
    useEffect(() => {
        themeRef.current = theme;
        const u = uniformsRef.current;
        if (!u) return;
        (u.uInk.value as THREE_NS.Vector3).fromArray(INK[theme]);
        (u.uHeat.value as THREE_NS.Vector3).fromArray(HEAT[theme]);
    }, [theme]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const section = sectionRef.current;
        const portrait = portraitRef.current;
        const imageLayer = imageLayerRef.current;
        const img = imageLayer?.querySelector('img');
        if (!canvas || !section || !portrait || !imageLayer || !img) return;
        if (!shouldRun()) return;

        let disposed = false;
        let teardown: (() => void) | undefined;

        const restoreImage = () => {
            imageLayer.style.transition = 'opacity 400ms ease';
            imageLayer.style.opacity = '';
            canvas.style.opacity = '0';
        };

        (async () => {
            try {
                await waitForImage(img);
                // Code-split: three.js never lands in the initial bundle.
                const THREE = await import('three');
                if (disposed) return;

                const mobile = window.innerWidth < 768;
                const sampled = sampleImage(img, mobile ? SAMPLE_COLS_MOBILE : SAMPLE_COLS_DESKTOP);
                if (!sampled || disposed) return;

                // Throws when the browser would fall back to software rendering:
                // that is exactly the case that lags, so we keep the static image.
                const renderer = new THREE.WebGLRenderer({
                    canvas,
                    alpha: true,
                    antialias: false,
                    powerPreference: 'low-power',
                    failIfMajorPerformanceCaveat: true,
                });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
                renderer.setClearColor(0x000000, 0);

                const scene = new THREE.Scene();
                const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(sampled.pos, 3));
                geometry.setAttribute('aBright', new THREE.Float32BufferAttribute(sampled.bright, 1));
                geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(sampled.seed, 1));

                const uniforms: Record<string, THREE_NS.IUniform> = {
                    uTime: { value: 0 },
                    uProgress: { value: 0 },
                    uSize: { value: new THREE.Vector2(1, 1) },
                    uCenter: { value: new THREE.Vector2() },
                    uBandY: { value: -0.35 },
                    uSpread: { value: 0.8 },
                    uPoint: { value: 2 },
                    uDpr: { value: renderer.getPixelRatio() },
                    uIntro: { value: 0 },
                    uDotOpacity: { value: DOT_OPACITY },
                    // Vector3, not Color: raw sRGB values, no colour-management conversion.
                    uInk: { value: new THREE.Vector3().fromArray(INK[themeRef.current]) },
                    uHeat: { value: new THREE.Vector3().fromArray(HEAT[themeRef.current]) },
                };
                uniformsRef.current = uniforms;

                const material = new THREE.ShaderMaterial({
                    vertexShader,
                    fragmentShader,
                    uniforms,
                    transparent: true,
                    depthWrite: false,
                    depthTest: false,
                });
                const points = new THREE.Points(geometry, material);
                points.frustumCulled = false; // positions are rewritten in the shader
                scene.add(points);

                // ---- State (plain variables: zero React renders after mount) ----
                let raf = 0;
                let visible = true;
                let last = performance.now();
                const settleUntil = last + ENTRY_SETTLE_MS;
                let lastRender = 0;
                let layoutDirty = true;
                let progress = 0;
                let target = 0;
                let intro = 0;
                let lastOpacity = -1;
                let canvasW = 0;
                let canvasH = 0;
                let watched = 0;
                let janky = 0;

                const resize = () => {
                    const rect = section.getBoundingClientRect();
                    canvasW = rect.width;
                    canvasH = rect.height;
                    renderer.setSize(canvasW, canvasH, false);
                    camera.left = -canvasW / 2;
                    camera.right = canvasW / 2;
                    camera.top = canvasH / 2;
                    camera.bottom = -canvasH / 2;
                    camera.updateProjectionMatrix();
                    layoutDirty = true;
                };

                /** Reads layout. Only runs after scroll/resize or during the entry animation. */
                const measure = () => {
                    const s = section.getBoundingClientRect();
                    const p = portrait.getBoundingClientRect();
                    const n = nameRef.current?.getBoundingClientRect();
                    if (!p.width || !p.height) return;

                    target = clamp01(-s.top / (s.height * DISSOLVE_DISTANCE));
                    // Portrait position relative to the section (canvas space, y up).
                    const pcx = p.left + p.width / 2 - s.left;
                    const pcy = p.top + p.height / 2 - s.top;
                    (uniforms.uSize.value as THREE_NS.Vector2).set(p.width, p.height);
                    (uniforms.uCenter.value as THREE_NS.Vector2).set(
                        pcx - canvasW / 2,
                        canvasH / 2 - pcy,
                    );
                    uniforms.uPoint.value = p.width / sampled.cols;
                    if (n && n.height) {
                        uniforms.uBandY.value =
                            -(n.top + n.height / 2 - (p.top + p.height / 2)) / p.height;
                        uniforms.uSpread.value = (n.width / p.width) * 0.55;
                    }
                };

                const frame = (now: number) => {
                    raf = requestAnimationFrame(frame);
                    const elapsed = now - last;
                    const dt = Math.min(elapsed / 1000, 0.1);
                    last = now;

                    // Watchdog: a device that can't hold frames loses the effect, not the page.
                    if (watched < WATCHDOG_FRAMES) {
                        watched++;
                        if (elapsed > JANK_MS) janky++;
                        if (watched === WATCHDOG_FRAMES && janky / watched > WATCHDOG_MAX_JANK_SHARE) {
                            teardown?.();
                            return;
                        }
                    }

                    if (layoutDirty || now < settleUntil) {
                        layoutDirty = false;
                        measure();
                    }

                    const prevProgress = progress;
                    const prevIntro = intro;
                    progress = damp(progress, target, 6, dt);
                    intro = damp(intro, 1, 3, dt);

                    const settling =
                        Math.abs(progress - prevProgress) > 1e-5 || Math.abs(intro - prevIntro) > 1e-4;
                    if (!settling && now - lastRender < IDLE_FRAME_MS) return;
                    lastRender = now;

                    uniforms.uTime.value = now / 1000;
                    uniforms.uProgress.value = progress;
                    uniforms.uIntro.value = intro;

                    // Static image: dims under the points on intro. Its scroll fade
                    // is on the portrait wrapper (Banner), so it also runs without WebGL.
                    const opacity = 1 + (IMAGE_OPACITY_LIVE - 1) * intro;
                    if (Math.abs(opacity - lastOpacity) > 0.002) {
                        lastOpacity = opacity;
                        imageLayer.style.opacity = opacity.toFixed(3);
                    }

                    renderer.render(scene, camera);
                };

                const start = () => {
                    if (!raf && visible && !document.hidden && !disposed) {
                        last = performance.now();
                        layoutDirty = true;
                        raf = requestAnimationFrame(frame);
                    }
                };
                const stop = () => {
                    cancelAnimationFrame(raf);
                    raf = 0;
                };

                const onScroll = () => {
                    layoutDirty = true;
                };
                window.addEventListener('scroll', onScroll, { passive: true });

                const onVisibility = () => (document.hidden ? stop() : start());
                document.addEventListener('visibilitychange', onVisibility);

                const io = new IntersectionObserver(([entry]) => {
                    visible = entry.isIntersecting;
                    if (visible) start();
                    else stop();
                });
                io.observe(section);

                const ro = new ResizeObserver(resize);
                ro.observe(section);

                const onContextLost = (e: Event) => {
                    e.preventDefault();
                    teardown?.();
                };
                canvas.addEventListener('webglcontextlost', onContextLost);

                teardown = () => {
                    stop();
                    io.disconnect();
                    ro.disconnect();
                    window.removeEventListener('scroll', onScroll);
                    document.removeEventListener('visibilitychange', onVisibility);
                    canvas.removeEventListener('webglcontextlost', onContextLost);
                    geometry.dispose();
                    material.dispose();
                    renderer.dispose();
                    uniformsRef.current = null;
                    restoreImage();
                    teardown = undefined;
                };

                resize();
                start();
            } catch {
                // WebGL unavailable, software-only, or image failed: static portrait covers it.
                restoreImage();
            }
        })();

        return () => {
            disposed = true;
            teardown?.();
        };
    }, [sectionRef, portraitRef, nameRef, imageLayerRef]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden
            // Inline, not utility classes: if this ever falls back into normal flow,
            // the ResizeObserver would feed the canvas height back into the section.
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                pointerEvents: 'none',
            }}
        />
    );
};

export default ParticlePortrait;
