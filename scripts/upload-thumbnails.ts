import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const THUMBS_DIR = path.join(process.cwd(), '..', 'thumbnails');

async function uploadThumbnailsToR2() {
  console.log('═══════════════════════════════════════════');
  console.log('  Uploading Thumbnails to Cloudflare R2');
  console.log('═══════════════════════════════════════════\n');

  let files: string[];
  try {
    files = await fs.readdir(THUMBS_DIR);
  } catch {
    console.error('No thumbnails directory found.');
    console.error('Run `npx tsx generate-thumbnails.ts` to generate thumbnails first.');
    process.exit(1);
  }

  const webpFiles = files.filter(f => f.endsWith('.webp')).sort((a, b) => {
    const numA = parseInt(a.replace('.webp', ''));
    const numB = parseInt(b.replace('.webp', ''));
    return numA - numB;
  });

  if (webpFiles.length === 0) {
    console.error('No WebP thumbnails found in thumbnails directory.');
    process.exit(1);
  }

  console.log(`Found ${webpFiles.length} WebP thumbnails to upload\n`);

  let uploaded = 0;
  let failed = 0;

  for (const file of webpFiles) {
    const filePath = path.join(THUMBS_DIR, file);
    // Upload to thumb/ prefix in R2 bucket (Worker expects thumb/{tokenId}.webp)
    try {
      execSync(`wrangler r2 object put nft-images/thumb/${file} --file="${filePath}"`, {
        stdio: 'pipe',
        cwd: path.join(process.cwd(), '..'),
      });
      uploaded++;
      if (uploaded % 100 === 0 || uploaded === webpFiles.length) {
        process.stdout.write(`\rUploaded: ${uploaded}/${webpFiles.length}`);
      }
    } catch (error) {
      failed++;
      console.error(`\n✗ Failed to upload thumb/${file}`);
    }
  }

  console.log(`\n\n═══════════════════════════════════════════`);
  console.log(`  Upload complete!`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
  console.log('═══════════════════════════════════════════');
}

uploadThumbnailsToR2().catch(console.error);
