// Pictures for a mod: one card at the game's 2x size (142x190; the game draws
// the 1x 71x95 doubled). Images come in from files, drawings and the game's
// sheets, and go out as PNG data URLs (what a package's `assets` hold).

export const CARD_W = 71;
export const CARD_H = 95;
export const ASSET_W = 142;
export const ASSET_H = 190;

export function load_image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('the image did not load'));
    img.src = src;
  });
}

export function make_canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export const png_url = (c: HTMLCanvasElement) => c.toDataURL('image/png');

export function file_url(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** the size in bytes of a data URL's content */
export function data_url_bytes(url: string): number {
  const i = url.indexOf(',');
  const b64 = i < 0 ? '' : url.slice(i + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** an image as one card of 142x190: `pixel` keeps its pixels sharp (pixel art), `smooth` scales it smoothly;
 * a picture of another shape fits inside, centred */
export async function fit_card(src: string, mode: 'pixel' | 'smooth'): Promise<string> {
  const img = await load_image(src);
  const [c, ctx] = make_canvas(ASSET_W, ASSET_H);
  ctx.imageSmoothingEnabled = mode === 'smooth';
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.min(ASSET_W / img.naturalWidth, ASSET_H / img.naturalHeight);
  // (pixel art keeps whole multiples when it can: 71x95 becomes exactly 2x)
  const s = mode === 'pixel' && scale >= 1 ? Math.floor(scale) : scale;
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  ctx.drawImage(img, Math.floor((ASSET_W - w) / 2), Math.floor((ASSET_H - h) / 2), w, h);
  return png_url(c);
}

/** the pixels of an image at its own size */
export async function image_pixels(src: string): Promise<ImageData> {
  const img = await load_image(src);
  const [, ctx] = make_canvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
}

/** whether every 2x2 block of the image is one colour (a 1x picture drawn at 2x: it can be edited at 1x) */
export function is_doubled(d: ImageData): boolean {
  if (d.width % 2 || d.height % 2) return false;
  const px = new Uint32Array(d.data.buffer);
  for (let y = 0; y < d.height; y += 2) {
    for (let x = 0; x < d.width; x += 2) {
      const a = px[y * d.width + x];
      if (px[y * d.width + x + 1] !== a || px[(y + 1) * d.width + x] !== a || px[(y + 1) * d.width + x + 1] !== a) return false;
    }
  }
  return true;
}

/** RGBA pixels (one Uint32 each, as the browser stores them) scaled up `k` times, as a PNG data URL */
export function pixels_png(px: Uint32Array, w: number, h: number, k = 1): string {
  const [c, ctx] = make_canvas(w * k, h * k);
  const data = ctx.createImageData(w * k, h * k);
  const out = new Uint32Array(data.data.buffer);
  for (let y = 0; y < h * k; y++) {
    const row = Math.floor(y / k) * w;
    for (let x = 0; x < w * k; x++) out[y * w * k + x] = px[row + Math.floor(x / k)];
  }
  ctx.putImageData(data, 0, 0);
  return png_url(c);
}
