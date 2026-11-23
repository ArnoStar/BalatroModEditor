// A drawing: its layers of pixels (RGBA, one Uint32 each as the browser keeps
// ImageData), drawn with the tools, flattened into the card's PNG.
import { ASSET_W, make_canvas, pixels_png, png_url } from '@/shared/lib';

export interface Layer { id: number; name: string; visible: boolean; opacity: number; px: Uint32Array }
export interface Doc { w: number; h: number; layers: Layer[] }

let next_id = 1;
export const layer = (w: number, h: number, name: string, px?: Uint32Array): Layer => ({
  id: next_id++, name, visible: true, opacity: 1, px: px ?? new Uint32Array(w * h),
});

/** a colour as the pixels hold it (little-endian: 0xAABBGGRR) */
export const pack = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const unpack = (c: number) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24] as const;
export const hex_of = (c: number) => '#' + unpack(c).slice(0, 3).map((x) => x.toString(16).padStart(2, '0')).join('');
export function from_hex(hex: string, a = 255): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return pack(0, 0, 0, a);
  const n = parseInt(m[1], 16);
  return pack((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

/** the visible layers, one over the other */
export function flatten(doc: Doc, preview?: { index: number; px: Uint32Array }): Uint32Array {
  const out = new Uint32Array(doc.w * doc.h);
  const acc = new Float32Array(doc.w * doc.h * 4);
  doc.layers.forEach((l, li) => {
    if (!l.visible) return;
    const px = preview && preview.index === li ? preview.px : l.px;
    for (let i = 0; i < px.length; i++) {
      const c = px[i];
      const a = ((c >>> 24) / 255) * l.opacity;
      if (a <= 0) continue;
      const o = i * 4;
      const da = acc[o + 3];
      const na = a + da * (1 - a);
      for (let k = 0; k < 3; k++) {
        const sc = (c >>> (k * 8)) & 255;
        acc[o + k] = na > 0 ? (sc * a + acc[o + k] * da * (1 - a)) / na : 0;
      }
      acc[o + 3] = na;
    }
  });
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    const a = acc[o + 3];
    out[i] = a > 0 ? pack(Math.round(acc[o]), Math.round(acc[o + 1]), Math.round(acc[o + 2]), Math.round(a * 255)) : 0;
  }
  return out;
}

/** the drawing as the package keeps it: one card at 142 x 190 */
export function export_png(doc: Doc): string {
  return pixels_png(flatten(doc), doc.w, doc.h, Math.max(1, Math.round(ASSET_W / doc.w)));
}

export function layer_png(l: Layer, w: number, h: number): string {
  return pixels_png(l.px, w, h, 1);
}

/** pixels from an image (scaled to w x h without smoothing) */
export async function pixels_of(src: string | CanvasImageSource, w: number, h: number, crop?: { x: number; y: number; w: number; h: number }): Promise<Uint32Array> {
  let img: CanvasImageSource;
  if (typeof src === 'string') {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image'));
      i.src = src;
    });
  } else img = src;
  const [, ctx] = make_canvas(w, h);
  ctx.imageSmoothingEnabled = false;
  if (crop) ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
  else ctx.drawImage(img, 0, 0, w, h);
  return new Uint32Array(ctx.getImageData(0, 0, w, h).data.buffer.slice(0));
}

// ------------------------------------------------------------------ drawing
export function put(px: Uint32Array, w: number, h: number, x: number, y: number, c: number, size = 1, mirror = false) {
  const half = Math.floor((size - 1) / 2);
  const dot = (cx: number) => {
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const xx = cx - half + dx;
      const yy = y - half + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) px[yy * w + xx] = c;
    }
  };
  dot(x);
  if (mirror) dot(w - 1 - x);
}

export function line(px: Uint32Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, c: number, size = 1, mirror = false) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(px, w, h, x0, y0, c, size, mirror);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function rect(px: Uint32Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, c: number, filled: boolean, size = 1, mirror = false) {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  if (filled) { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) put(px, w, h, x, y, c, 1, mirror); return; }
  line(px, w, h, ax, ay, bx, ay, c, size, mirror);
  line(px, w, h, ax, by, bx, by, c, size, mirror);
  line(px, w, h, ax, ay, ax, by, c, size, mirror);
  line(px, w, h, bx, ay, bx, by, c, size, mirror);
}

export function ellipse(px: Uint32Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, c: number, filled: boolean, size = 1, mirror = false) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  if (rx < 0.5 || ry < 0.5) { line(px, w, h, x0, y0, x1, y1, c, size, mirror); return; }
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
      if (filled ? d <= 1 : d <= 1 && d >= (1 - (1.6 * size) / Math.max(1, Math.min(rx, ry))) ** 2) put(px, w, h, x, y, c, 1, mirror);
    }
  }
}

/** flood fill from (x, y): the pixels of the same colour, touching */
export function fill(px: Uint32Array, w: number, h: number, x: number, y: number, c: number) {
  const from = px[y * w + x];
  if (from === c) return;
  const stack = [y * w + x];
  while (stack.length) {
    const i = stack.pop()!;
    if (px[i] !== from) continue;
    px[i] = c;
    const xx = i % w;
    if (xx > 0) stack.push(i - 1);
    if (xx < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
}

export function shifted(px: Uint32Array, w: number, h: number, dx: number, dy: number): Uint32Array {
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - dx;
    const sy = y - dy;
    if (sx >= 0 && sy >= 0 && sx < w && sy < h) out[y * w + x] = px[sy * w + sx];
  }
  return out;
}

export function flipped(px: Uint32Array, w: number, h: number, across: boolean): Uint32Array {
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out[y * w + x] = across ? px[y * w + (w - 1 - x)] : px[(h - 1 - y) * w + x];
  }
  return out;
}

/** a blank card: rounded, a dark rim, a light face (the shape of the game's cards) */
export function card_template(w: number, h: number, face: number, rim: number): Uint32Array {
  const px = new Uint32Array(w * h);
  const k = w / 71;
  const r = Math.round(5 * k);
  const t = Math.max(1, Math.round(1.5 * k));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x < r ? r - x : x > w - 1 - r ? x - (w - 1 - r) : 0;
    const cy = y < r ? r - y : y > h - 1 - r ? y - (h - 1 - r) : 0;
    const d = Math.hypot(cx, cy);
    if (d > r + 0.35) continue;
    const edge = x < t || y < t || x >= w - t || y >= h - t || d > r - t + 0.35;
    px[y * w + x] = edge ? rim : face;
  }
  return px;
}

export const export_url = png_url;
