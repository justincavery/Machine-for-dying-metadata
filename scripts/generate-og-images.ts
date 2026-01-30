import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SITE_URL = 'https://diabolicalmachines.simplethin.gs';
const OG_DIR = path.join(__dirname, '..', 'og-images');
const TOTAL_NFTS = 6000;
const WIDTH = 1200;
const HEIGHT = 630;
const PARALLEL_UPLOADS = 10;
const PARALLEL_RENDERS = 6; // Number of browser tabs to use in parallel

// Generate SVG for an NFT
function generateOGSvg(tokenId: number): string {
  const nftImageUrl = `${SITE_URL}/img/${tokenId}.webp`;
  const bannerUrl = `${SITE_URL}/diabolical-machines-banner.jpg`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="30"/>
    </filter>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgba(10,10,15,0.3)"/>
      <stop offset="40%" style="stop-color:rgba(10,10,15,0.7)"/>
      <stop offset="100%" style="stop-color:rgba(10,10,15,0.95)"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0a0f"/>

  <image
    href="${bannerUrl}"
    x="-100" y="-100"
    width="${WIDTH + 200}" height="${HEIGHT + 200}"
    preserveAspectRatio="xMidYMid slice"
    filter="url(#blur)"
    opacity="0.4"
  />

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#overlay)"/>

  <g filter="url(#shadow)">
    <rect x="60" y="65" width="500" height="500" rx="16" fill="#1a1a1f"/>
    <clipPath id="nftClip">
      <rect x="60" y="65" width="500" height="500" rx="16"/>
    </clipPath>
    <image
      href="${nftImageUrl}"
      x="60" y="65"
      width="500" height="500"
      preserveAspectRatio="xMidYMid slice"
      clip-path="url(#nftClip)"
    />
  </g>

  <g fill="white" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
    <text x="620" y="220" font-size="28" font-weight="400" fill="rgba(255,255,255,0.6)">
      Diabolical Machines
    </text>
    <text x="620" y="290" font-size="42" font-weight="700" fill="white">
      A Machine for Dying
    </text>
    <text x="620" y="400" font-size="96" font-weight="800" fill="white">
      #${tokenId}
    </text>
    <text x="620" y="480" font-size="22" font-weight="400" fill="rgba(255,255,255,0.5)">
      On-Chain Animated NFT
    </text>
  </g>

  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
</svg>`;
}

async function generateOGImages(limit: number = TOTAL_NFTS) {
  console.log('═══════════════════════════════════════════');
  console.log('  Generate OG Images for Social Sharing');
  console.log(`  Generating: ${limit} images`);
  console.log('═══════════════════════════════════════════\n');

  // Ensure output directory exists
  if (!fs.existsSync(OG_DIR)) {
    fs.mkdirSync(OG_DIR, { recursive: true });
  }

  // Check how many already exist
  const existingFiles = fs.readdirSync(OG_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${existingFiles.length} existing OG images`);

  // Build list of tokens to generate
  const tokensToGenerate: number[] = [];
  let skipped = 0;

  for (let tokenId = 0; tokenId < limit; tokenId++) {
    const outputPath = path.join(OG_DIR, `${tokenId}.png`);
    if (fs.existsSync(outputPath)) {
      skipped++;
    } else {
      tokensToGenerate.push(tokenId);
    }
  }

  console.log(`Tokens to generate: ${tokensToGenerate.length} (${skipped} already exist)`);
  console.log(`Using ${PARALLEL_RENDERS} parallel browser tabs\n`);

  if (tokensToGenerate.length === 0) {
    console.log('Nothing to generate!');
    return;
  }

  // Launch browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Create multiple pages for parallel processing
  const pages = await Promise.all(
    Array.from({ length: PARALLEL_RENDERS }, async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: WIDTH, height: HEIGHT });
      return page;
    })
  );

  let generated = 0;
  let failed = 0;
  const startTime = Date.now();
  const total = tokensToGenerate.length;

  // Process in parallel batches
  for (let i = 0; i < tokensToGenerate.length; i += PARALLEL_RENDERS) {
    const batch = tokensToGenerate.slice(i, i + PARALLEL_RENDERS);

    await Promise.all(batch.map(async (tokenId, index) => {
      const page = pages[index];
      const outputPath = path.join(OG_DIR, `${tokenId}.png`);

      try {
        const svg = generateOGSvg(tokenId);
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              * { margin: 0; padding: 0; }
              body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
            </style>
          </head>
          <body>${svg}</body>
          </html>
        `;

        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 2500)); // Wait for external images

        await page.screenshot({
          path: outputPath,
          type: 'png',
          clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT }
        });

        generated++;
      } catch (error) {
        failed++;
        console.error(`Error generating token ${tokenId}:`, (error as Error).message);
      }
    }));

    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = generated / elapsed;
    const remaining = (total - generated - failed) / rate;

    if ((generated + failed) % 50 < PARALLEL_RENDERS || i + PARALLEL_RENDERS >= tokensToGenerate.length) {
      console.log(`Generated: ${generated}/${total} | ${rate.toFixed(1)}/sec | ~${Math.ceil(remaining / 60)} min remaining`);
    }
  }

  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✓ Generated ${generated} OG images in ${totalTime} minutes`);
  console.log(`  Skipped: ${skipped} (already existed)`);
  console.log(`  Failed: ${failed}`);

  // Calculate total size
  const files = fs.readdirSync(OG_DIR).filter(f => f.endsWith('.png'));
  const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(OG_DIR, f)).size, 0);
  console.log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Average size: ${Math.round(totalSize / files.length / 1024)} KB per image`);
}

async function uploadToR2() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  Uploading OG Images to R2');
  console.log('═══════════════════════════════════════════\n');

  const files = fs.readdirSync(OG_DIR)
    .filter(f => f.endsWith('.png'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  console.log(`Found ${files.length} PNG files to upload\n`);

  let uploaded = 0;
  let failed = 0;
  const cwd = path.join(__dirname, '..');

  // Upload in batches for better progress tracking
  for (let i = 0; i < files.length; i += PARALLEL_UPLOADS) {
    const batch = files.slice(i, i + PARALLEL_UPLOADS);

    await Promise.all(batch.map(async (file) => {
      const filePath = path.join(OG_DIR, file);
      try {
        execSync(
          `wrangler r2 object put nft-images/og/${file} --file="${filePath}" --content-type="image/png" --remote`,
          { stdio: 'pipe', cwd }
        );
        uploaded++;
      } catch {
        failed++;
        console.error(`Failed to upload og/${file}`);
      }
    }));

    if ((uploaded + failed) % 100 === 0 || i + PARALLEL_UPLOADS >= files.length) {
      console.log(`Uploaded: ${uploaded}/${files.length}`);
    }
  }

  console.log(`\n✓ R2 upload complete!`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
}

async function main() {
  const args = process.argv.slice(2);

  // Check for --limit flag (e.g., --limit=10)
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : TOTAL_NFTS;

  if (args.includes('--upload-only')) {
    await uploadToR2();
  } else if (args.includes('--generate-only')) {
    await generateOGImages(limit);
  } else {
    await generateOGImages(limit);
    await uploadToR2();
  }
}

main().catch(console.error);
