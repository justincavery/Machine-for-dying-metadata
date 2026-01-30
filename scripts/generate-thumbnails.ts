import puppeteer from 'puppeteer';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, '..', 'images');
const THUMBS_DIR = path.join(__dirname, '..', 'thumbnails');
// SVG native dimensions
const SVG_WIDTH = 936;
const SVG_HEIGHT = 1080;
// Thumbnail output dimensions (maintain aspect ratio)
const THUMB_WIDTH = 400;
const THUMB_HEIGHT = Math.round(400 * (SVG_HEIGHT / SVG_WIDTH)); // ~462px

async function generateThumbnails() {
  // Ensure thumbnails directory exists
  if (!fs.existsSync(THUMBS_DIR)) {
    fs.mkdirSync(THUMBS_DIR, { recursive: true });
  }

  // Get all SVG files
  const svgFiles = fs.readdirSync(IMAGES_DIR)
    .filter(f => f.endsWith('.svg'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('.svg', ''));
      const numB = parseInt(b.replace('.svg', ''));
      return numA - numB;
    });

  console.log(`Found ${svgFiles.length} SVG files to process`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Render at native SVG size for accurate capture, then scale down
  await page.setViewport({ width: SVG_WIDTH, height: SVG_HEIGHT });

  let processed = 0;
  let skipped = 0;

  for (const svgFile of svgFiles) {
    const tokenId = svgFile.replace('.svg', '');
    const thumbPath = path.join(THUMBS_DIR, `${tokenId}.webp`);

    // Skip if thumbnail already exists
    if (fs.existsSync(thumbPath)) {
      skipped++;
      continue;
    }

    const svgPath = path.join(IMAGES_DIR, svgFile);

    try {
      // Read SVG content
      const svgContent = fs.readFileSync(svgPath, 'utf-8');

      // Modify SVG to ensure it scales correctly and pause animations
      let modifiedSvg = svgContent;

      // Add viewBox if missing
      if (!modifiedSvg.includes('viewBox')) {
        modifiedSvg = modifiedSvg.replace(
          /<svg([^>]*)>/,
          `<svg$1 viewBox="0 0 936 1080">`
        );
      }

      // Inject CSS to pause all animations at the start of the SVG
      // This must be inside the SVG for img tag rendering
      const pauseAnimStyle = `
        <style type="text/css">
          * { animation-play-state: paused !important; animation-delay: -0.001s !important; }
        </style>`;
      modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/, `<svg$1>${pauseAnimStyle}`);

      // Remove or disable any audio/interactive elements
      // These NFTs might have sound icons from the animation system
      modifiedSvg = modifiedSvg.replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, '');
      modifiedSvg = modifiedSvg.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

      // Create HTML that renders SVG at native size
      // We'll capture at full size and let Puppeteer scale it down
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: ${SVG_WIDTH}px;
              height: ${SVG_HEIGHT}px;
              overflow: hidden;
              background: transparent;
            }
            svg {
              width: ${SVG_WIDTH}px;
              height: ${SVG_HEIGHT}px;
              display: block;
            }
          </style>
        </head>
        <body>
          ${modifiedSvg}
        </body>
        </html>
      `;

      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Delay to ensure SVG is fully rendered (animations start but we capture first frame)
      await new Promise(r => setTimeout(r, 500));

      // Capture at full native size as PNG (for quality), then resize to thumbnail
      const fullSizeBuffer = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT },
        omitBackground: true  // Transparent background
      });

      // Resize to thumbnail dimensions and save as WebP
      await sharp(fullSizeBuffer)
        .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 85 })
        .toFile(thumbPath);

      processed++;
      if (processed % 10 === 0 || processed === svgFiles.length) {
        console.log(`Processed ${processed}/${svgFiles.length - skipped} thumbnails`);
      }
    } catch (error) {
      console.error(`Error processing ${svgFile}:`, error);
    }
  }

  await browser.close();

  // Report file sizes
  const thumbFiles = fs.readdirSync(THUMBS_DIR).filter(f => f.endsWith('.webp'));
  const totalThumbSize = thumbFiles.reduce((sum, f) => {
    return sum + fs.statSync(path.join(THUMBS_DIR, f)).size;
  }, 0);
  const avgThumbSize = Math.round(totalThumbSize / thumbFiles.length / 1024);

  console.log(`\n✓ Generated ${processed} thumbnails (${skipped} skipped)`);
  console.log(`  Average thumbnail size: ${avgThumbSize}KB`);
  console.log(`  Total size: ${Math.round(totalThumbSize / 1024)}KB`);
}

generateThumbnails().catch(console.error);
