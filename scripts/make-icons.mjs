// Renders PWA icons from the SVG mark. Run: npm run icons
import sharp from "sharp";

const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${pad ? "" : 'rx="112"'} fill="#13233f"/>
  <circle cx="256" cy="256" r="${pad ? 112 : 150}" fill="none" stroke="#f7f6f2" stroke-width="${pad ? 40 : 52}"/>
  <path d="M256 ${256 - (pad ? 112 : 150)}a${pad ? 112 : 150} ${pad ? 112 : 150} 0 0 1 ${pad ? 112 : 150} ${pad ? 112 : 150}" fill="none" stroke="#ee6c1f" stroke-width="${pad ? 40 : 52}" stroke-linecap="round"/>
</svg>`;

const out = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/icon-maskable-512.png", 512, true],
  ["public/icons/apple-touch-icon.png", 180, true],
];
for (const [file, size, pad] of out) await sharp(Buffer.from(mark(pad))).resize(size, size).png().toFile(file);
console.log("Icons written.");
