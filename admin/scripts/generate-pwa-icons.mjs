// Generates the PWA icon set for the admin app from the shared 711 logo
// used by the customer app. Run once (and whenever the logo changes):
//   npm run icons
// Outputs to public/icons/ and is committed so builds don't depend on
// the customer app's assets.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = "../customer-mobile/assets/logos/711logo.png";
const OUT_DIR = path.resolve("public/icons");

// Brand green — matches --color-accent in src/index.css and the customer
// app's splash background, so the installed icon reads as the same product.
const BRAND_GREEN = "#007A53";

const ICONS = [
  // Manifest icons (any purpose). Logo at 80% keeps a comfortable margin.
  { name: "pwa-192.png", size: 192, logoRatio: 0.8 },
  { name: "pwa-512.png", size: 512, logoRatio: 0.8 },
  // Maskable icons: content must sit inside the inner 80% safe circle,
  // so the logo is shrunk to 66% of the canvas.
  { name: "pwa-maskable-192.png", size: 192, logoRatio: 0.66, purpose: "maskable" },
  { name: "pwa-maskable-512.png", size: 512, logoRatio: 0.66, purpose: "maskable" },
  // iOS home-screen icon (180×180). No maskable support; opaque background.
  { name: "apple-touch-icon.png", size: 180, logoRatio: 0.76 },
];

const logo = sharp(SOURCE);

await mkdir(OUT_DIR, { recursive: true });

for (const icon of ICONS) {
  const logoSize = Math.round(icon.size * icon.logoRatio);
  const logoPng = await logo
    .clone()
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const png = await sharp({
    create: {
      width: icon.size,
      height: icon.size,
      channels: 4,
      background: BRAND_GREEN,
    },
  })
    .composite([{ input: logoPng, gravity: "center" }])
    .png()
    .toBuffer();

  await writeFile(path.join(OUT_DIR, icon.name), png);
  console.log(`✓ ${icon.name} (${icon.size}×${icon.size}${icon.purpose ? ", " + icon.purpose : ""})`);
}
