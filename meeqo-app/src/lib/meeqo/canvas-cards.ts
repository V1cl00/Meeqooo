/** Souvenir images drawn on this device (canvas). Nothing is uploaded; the person saves or shares the file. */

const SAND = "#F4E8D8";
const TERRA = "#E07A5F";
const GREEN = "#81B29A";
const INK = "#3D405B";

function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("Canvas fehlt.");
  return { el, ctx };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(/\s+/);
  let row = "";
  let yy = y;
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max && row) {
      ctx.fillText(row, x, yy);
      row = word;
      yy += line;
    } else row = next;
  }
  if (row) ctx.fillText(row, x, yy);
  return yy;
}

const toBlob = (el: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => el.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bild ging nicht."))), "image/png"));

async function fonts() {
  try {
    await Promise.all([document.fonts.load('600 64px "Fraunces Variable"'), document.fonts.load('500 32px "Outfit Variable"')]);
  } catch {
    /* fall back to system fonts */
  }
}

/** A ticket for a past meetup. Only offered from the history, never as a pass for entry. */
export async function drawTicket(input: { title: string; when: string; place: string; label: string; footer: string }) {
  await fonts();
  const { el, ctx } = canvas(1080, 1350);
  ctx.fillStyle = SAND;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#FFFBF5";
  ctx.beginPath();
  ctx.roundRect(80, 120, 920, 1110, 36);
  ctx.fill();
  ctx.fillStyle = TERRA;
  ctx.beginPath();
  ctx.roundRect(80, 120, 920, 260, [36, 36, 0, 0]);
  ctx.fill();
  ctx.fillStyle = "#241C18";
  ctx.font = '600 44px "Outfit Variable", sans-serif';
  ctx.fillText("MeeQo", 140, 210);
  ctx.font = '500 32px "Outfit Variable", sans-serif';
  ctx.fillText(input.label, 140, 320);
  // perforation
  ctx.fillStyle = SAND;
  for (let x = 110; x < 1000; x += 44) {
    ctx.beginPath();
    ctx.arc(x, 380, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.font = '600 84px "Fraunces Variable", serif';
  const end = wrap(ctx, input.title, 140, 520, 800, 96);
  ctx.font = '500 40px "Outfit Variable", sans-serif';
  ctx.fillText(input.when, 140, end + 110);
  ctx.fillStyle = "#5B5D75";
  wrap(ctx, input.place, 140, end + 170, 800, 52);
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(860, 1090, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '500 30px "Outfit Variable", sans-serif';
  ctx.fillText(input.footer, 140, 1160);
  return toBlob(el);
}

/** Sunday story: "Deine Woche mit MeeQo" with real numbers only. */
export async function drawWeekStory(input: { heading: string; lines: string[]; footer: string }) {
  await fonts();
  const { el, ctx } = canvas(1080, 1920);
  ctx.fillStyle = SAND;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(900, 260, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TERRA;
  ctx.beginPath();
  ctx.arc(160, 1700, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '600 52px "Outfit Variable", sans-serif';
  ctx.fillText("MeeQo", 100, 200);
  ctx.font = '600 120px "Fraunces Variable", serif';
  let y = wrap(ctx, input.heading, 100, 640, 880, 132);
  ctx.font = '500 56px "Outfit Variable", sans-serif';
  for (const line of input.lines) {
    y = wrap(ctx, line, 100, y + 130, 880, 70);
  }
  ctx.font = '500 36px "Outfit Variable", sans-serif';
  ctx.fillText(input.footer, 100, 1560);
  return toBlob(el);
}

/** Share the file where the system sheet can take files, otherwise download it. */
export async function saveOrShare(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return "shared";
    } catch {
      /* fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}
