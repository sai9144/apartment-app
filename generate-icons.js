// generate-icons.js - Run with: node generate-icons.js
// Generates PNG icons from SVG using sharp (install: npm i sharp)
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, 'client', 'icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateWithSharp() {
  try {
    const sharp = await import('sharp');
    const svgBuffer = await fs.readFile(path.join(ICONS_DIR, 'icon.svg'));

    for (const size of sizes) {
      await sharp.default(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(ICONS_DIR, `icon-${size}.png`));
      console.log(`Generated icon-${size}.png`);
    }
    console.log('All icons generated!');
  } catch (e) {
    console.log('sharp not available, creating placeholder PNGs...');
    await generatePlaceholders();
  }
}

async function generatePlaceholders() {
  // Create minimal valid PNG files (1x1 transparent) as placeholders
  // In production, replace with actual rendered icons
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x1F, 0x15, 0xC4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x01, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, // compressed data
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);

  for (const size of sizes) {
    await fs.writeFile(path.join(ICONS_DIR, `icon-${size}.png`), pngHeader);
    console.log(`Created placeholder icon-${size}.png`);
  }
  console.log('\nNote: These are 1x1 transparent placeholder PNGs.');
  console.log('Run "npm i sharp && node generate-icons.js" to generate real icons from SVG.');
}

generateWithSharp();