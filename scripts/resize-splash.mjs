import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const LOGO_PATH = path.resolve('logo/TT logo-01.png');
const RES_DIR = path.resolve('android/app/src/main/res');

if (!fs.existsSync(LOGO_PATH)) {
  console.error('Logo not found at', LOGO_PATH);
  process.exit(1);
}

const splashConfigs = [
  { dir: 'drawable', name: 'splash.png', width: 480, height: 320 },
  { dir: 'drawable-land-hdpi', name: 'splash.png', width: 800, height: 480 },
  { dir: 'drawable-land-mdpi', name: 'splash.png', width: 480, height: 320 },
  { dir: 'drawable-land-xhdpi', name: 'splash.png', width: 1280, height: 720 },
  { dir: 'drawable-land-xxhdpi', name: 'splash.png', width: 1600, height: 960 },
  { dir: 'drawable-land-xxxhdpi', name: 'splash.png', width: 1920, height: 1280 },
  { dir: 'drawable-port-hdpi', name: 'splash.png', width: 480, height: 800 },
  { dir: 'drawable-port-mdpi', name: 'splash.png', width: 320, height: 480 },
  { dir: 'drawable-port-xhdpi', name: 'splash.png', width: 720, height: 1280 },
  { dir: 'drawable-port-xxhdpi', name: 'splash.png', width: 960, height: 1600 },
  { dir: 'drawable-port-xxxhdpi', name: 'splash.png', width: 1280, height: 1920 },
];

async function main() {
  console.log(`Original logo: ${LOGO_PATH}`);

  for (const config of splashConfigs) {
    const targetDir = path.join(RES_DIR, config.dir);
    if (!fs.existsSync(targetDir)) {
      console.log(`  SKIP ${config.dir} (not found)`);
      continue;
    }

    const outputPath = path.join(targetDir, config.name);

    // Target size: 60% of the smaller dimension
    const targetPx = Math.round(Math.min(config.width, config.height) * 0.6);

    // Resize original logo directly (no padding) — fit 'inside' preserves aspect ratio
    const resized = await sharp(LOGO_PATH)
      .resize({ width: targetPx, height: targetPx, fit: 'inside', kernel: 'lanczos3' })
      .png({ compressionLevel: 6, palette: true })
      .toBuffer();

    const meta = await sharp(resized).metadata();

    // Center on splash canvas using actual resized dimensions
    const composite = {
      input: resized,
      top: Math.round((config.height - meta.height) / 2),
      left: Math.round((config.width - meta.width) / 2),
    };

    await sharp({
      create: {
        width: config.width,
        height: config.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([composite])
      .png({ compressionLevel: 6 })
      .toFile(outputPath);

    console.log(`  OK ${config.dir} (${config.width}x${config.height}) logo ${meta.width}x${meta.height}`);
  }
  console.log('\nDone! All splash screens updated.');
}

main().catch(err => { console.error(err); process.exit(1); });
