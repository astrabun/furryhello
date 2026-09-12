/**
 * Regenerates the per-locale OpenGraph/Twitter social cards under
 * src/assets/images/ (og-default.png for English, og-{locale}.png for each
 * other locale in LOCALE_CONFIG below). Edit the config below, then run:
 *
 *   pnpm --filter website generate-og-image
 *
 * Requires `rsvg-convert` on PATH (brew install librsvg).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "..", "src", "assets", "images");
const LOGO_PATH = path.join(IMAGES_DIR, "furryhello_t.png");

const WIDTH = 1200;
const HEIGHT = 630;

const colors = {
  bgTop: "#1e293b",
  bgBottom: "#0f172a",
  accent: "#16f9db",
  heading: "#f8fafc",
  subheading: "#cbd5e1",
};

interface LocaleCopy {
  outputFile: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  chatGreeting: string;
  chatReply: string;
}

// "en" writes to og-default.png since that's site.defaultOgImage's filename
// (and what's already referenced by cached shares); every other locale gets
// its own og-{locale}.png, referenced via that page's `ogImage` front matter.
const LOCALE_CONFIG: Record<string, LocaleCopy> = {
  en: {
    outputFile: "og-default.png",
    eyebrow: "FURRIES",
    title: 'please don\'t just say "hello"',
    subtitle: "give them something to actually respond to",
    chatGreeting: "hi",
    chatReply: "... yes?",
  },
  fr: {
    outputFile: "og-fr.png",
    eyebrow: "FURRIES",
    title: 'n\'écris pas juste "salut"',
    subtitle: "donne-leur quelque chose à quoi vraiment répondre",
    chatGreeting: "salut",
    chatReply: "... oui ?",
  },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvg(logoBase64: string, copy: LocaleCopy): string {
  const eyebrow = escapeXml(copy.eyebrow);
  const title = escapeXml(copy.title);
  const subtitle = escapeXml(copy.subtitle);
  const chatGreeting = escapeXml(copy.chatGreeting);
  const chatReply = escapeXml(copy.chatReply);

  const glowCx = 1000;
  const glowCy = 120;
  const logoSize = 280;
  const logoCx = glowCx;
  const logoCy = 225;
  const logoX = logoCx - logoSize / 2;
  const logoY = logoCy - logoSize / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.bgTop}"/>
      <stop offset="100%" stop-color="${colors.bgBottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${colors.accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="${glowCx}" cy="${glowCy}" r="380" fill="url(#glow)"/>
  <image
    x="${logoX}"
    y="${logoY}"
    width="${logoSize}"
    height="${logoSize}"
    xlink:href="data:image/png;base64,${logoBase64}"
  />
  <rect x="0" y="0" width="${WIDTH}" height="8" fill="${colors.accent}"/>

  <g transform="translate(90, 130)">
    <rect x="0" y="0" width="380" height="130" rx="22" fill="none" stroke="${colors.accent}" stroke-width="3" stroke-opacity="0.55"/>
    <text x="34" y="60" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="${colors.accent}">${chatGreeting}</text>
    <text x="34" y="102" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${colors.subheading}" opacity="0.7">${chatReply}</text>
  </g>

  <g font-family="Helvetica, Arial, sans-serif">
    <text x="90" y="360" font-size="30" font-weight="700" fill="${colors.accent}" letter-spacing="6">${eyebrow}</text>
    <text x="90" y="440" font-size="66" font-weight="700" fill="${colors.heading}">${title}</text>
    <text x="90" y="490" font-size="30" font-weight="500" fill="${colors.subheading}">${subtitle}</text>
  </g>
</svg>`;
}

function main() {
  const logoBase64 = readFileSync(LOGO_PATH).toString("base64");
  const tmpDir = mkdtempSync(path.join(tmpdir(), "og-image-"));

  try {
    for (const copy of Object.values(LOCALE_CONFIG)) {
      const svg = buildSvg(logoBase64, copy);
      const svgPath = path.join(tmpDir, "og.svg");
      writeFileSync(svgPath, svg);
      const outputPath = path.join(IMAGES_DIR, copy.outputFile);

      try {
        execFileSync("rsvg-convert", [
          "-w",
          String(WIDTH),
          "-h",
          String(HEIGHT),
          svgPath,
          "-o",
          outputPath,
        ]);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          console.error(
            "rsvg-convert not found on PATH. Install it with `brew install librsvg` (macOS) or your package manager's equivalent.",
          );
          process.exit(1);
        }
        throw err;
      }

      console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
