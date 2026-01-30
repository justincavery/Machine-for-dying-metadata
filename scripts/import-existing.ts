import fs from 'fs/promises';
import path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const URI_DIR = path.join(process.cwd(), '..', 'uri');
const IMAGES_DIR = path.join(process.cwd(), '..', 'images');
const THUMBS_DIR = path.join(process.cwd(), '..', 'thumbnails');
const OUTPUT_DIR = path.join(process.cwd(), '..', 'indexed-data');

// CONFIGURATION
const TEST_LIMIT = 0; // Limit to first 500 tokens (0-499) for testing. Set to 0 for all.
const PARALLEL_UPLOADS = 10; // Number of concurrent uploads
const MAX_RETRIES = 3; // Retry failed uploads up to 3 times

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

interface UploadResult {
  tokenId: number;
  type: 'svg' | 'thumb';
  success: boolean;
  error?: string;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// Process items in batches with concurrency limit
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

// Upload a single file to R2 with retry logic
async function uploadToR2(
  localPath: string,
  r2Key: string,
  contentType: string,
  cwd: string,
  retries = MAX_RETRIES
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await execAsync(
        `wrangler r2 object put nft-images/${r2Key} --file="${localPath}" --remote --content-type="${contentType}"`,
        { cwd }
      );
      return true;
    } catch (error) {
      if (attempt === retries) {
        return false;
      }
      // Wait before retry (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return false;
}

async function importExistingData() {
  console.log('═══════════════════════════════════════════');
  console.log('  Import Existing Extracted Data');
  console.log('  (Optimized with parallel uploads)');
  console.log('═══════════════════════════════════════════\n');

  // Check for existing uri files
  let uriFiles: string[] = [];
  try {
    const files = await fs.readdir(URI_DIR);
    uriFiles = files.filter(f => f.endsWith('.txt')).sort((a, b) => {
      const numA = parseInt(a.replace('.txt', ''));
      const numB = parseInt(b.replace('.txt', ''));
      return numA - numB;
    });
    console.log(`Found ${uriFiles.length} URI files in uri/`);
  } catch {
    console.log('No uri/ directory found');
  }

  if (uriFiles.length === 0) {
    console.log('\nNo existing data to import.');
    console.log('Please run the Foundry extraction first:');
    console.log('  forge test --match-test testGetTokenURI -vv --rpc-url <RPC_URL>');
    return;
  }

  // Apply test limit if set
  if (TEST_LIMIT > 0) {
    uriFiles = uriFiles.slice(0, TEST_LIMIT);
    console.log(`Limited to first ${TEST_LIMIT} tokens for testing`);
  }

  // Create output directory
  await fs.mkdir(path.join(OUTPUT_DIR, 'metadata'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, 'images'), { recursive: true });

  let sql = '-- Imported from existing uri/ and images/ directories\n';
  sql += '-- Generated at: ' + new Date().toISOString() + '\n\n';

  let imported = 0;
  let failed = 0;

  console.log('\n─────────────────────────────────────────');
  console.log('  Phase 1: Processing metadata');
  console.log('─────────────────────────────────────────');

  for (const file of uriFiles) {
    const tokenId = parseInt(file.replace('.txt', ''));
    const uriPath = path.join(URI_DIR, file);

    try {
      // Read the data URI
      const dataUri = await fs.readFile(uriPath, 'utf-8');

      // Decode base64 JSON
      const base64Data = dataUri.replace(/^data:application\/json;base64,/, '');
      const metadataJson = Buffer.from(base64Data, 'base64').toString('utf-8');
      const metadata: NFTMetadata = JSON.parse(metadataJson);

      // Extract and save SVG image
      if (metadata.image.startsWith('data:image/svg+xml;base64,')) {
        const svgBase64 = metadata.image.replace(/^data:image\/svg\+xml;base64,/, '');
        const svg = Buffer.from(svgBase64, 'base64').toString('utf-8');
        await fs.writeFile(path.join(OUTPUT_DIR, 'images', `${tokenId}.svg`), svg, 'utf-8');
      }

      // Save metadata JSON (with reference to image file instead of embedded data)
      const metadataToSave = {
        name: metadata.name,
        description: metadata.description,
        attributes: metadata.attributes,
        image: `${tokenId}.svg`,
      };
      await fs.writeFile(
        path.join(OUTPUT_DIR, 'metadata', `${tokenId}.json`),
        JSON.stringify(metadataToSave, null, 2),
        'utf-8'
      );

      // Generate SQL
      sql += `INSERT OR REPLACE INTO nfts (token_id, name, description, image_cid, metadata_json) VALUES (${tokenId}, '${escapeSQL(metadata.name)}', '${escapeSQL(metadata.description || '')}', '${tokenId}.svg', '${escapeSQL(JSON.stringify(metadataToSave))}');\n`;

      for (const attr of metadata.attributes || []) {
        sql += `INSERT INTO attributes (token_id, trait_type, value) VALUES (${tokenId}, '${escapeSQL(attr.trait_type)}', '${escapeSQL(String(attr.value))}');\n`;
      }

      imported++;
      if (imported % 50 === 0) {
        console.log(`  Processed ${imported}/${uriFiles.length} metadata files...`);
      }
    } catch (error) {
      console.error(`✗ Failed to import token ${tokenId}:`, (error as Error).message);
      failed++;
    }
  }
  console.log(`✓ Processed ${imported} metadata files (${failed} failed)`);

  // Update collection metadata
  sql += `\nUPDATE collection_metadata SET value = '${imported}', updated_at = CURRENT_TIMESTAMP WHERE key = 'indexed_count';\n`;
  sql += `UPDATE collection_metadata SET value = '${imported}', updated_at = CURRENT_TIMESTAMP WHERE key = 'total_supply';\n`;

  // Write SQL file
  const sqlPath = path.join(OUTPUT_DIR, 'import.sql');
  await fs.writeFile(sqlPath, sql, 'utf-8');
  console.log(`  SQL file written: ${sqlPath}`);

  // Execute SQL on D1
  console.log('\n─────────────────────────────────────────');
  console.log('  Phase 2: Updating D1 database');
  console.log('─────────────────────────────────────────');

  console.log('  Executing on remote D1...');
  try {
    execSync(`wrangler d1 execute nft-metadata-db --file="${sqlPath}" --remote`, {
      stdio: 'inherit',
      cwd: path.join(process.cwd(), '..'),
    });
    console.log('✓ Remote D1 updated');
  } catch (error) {
    console.error('✗ Remote D1 update failed');
  }

  // Parallel R2 uploads
  console.log('\n─────────────────────────────────────────');
  console.log('  Phase 3: Uploading to R2 (parallel)');
  console.log(`  Concurrency: ${PARALLEL_UPLOADS} uploads`);
  console.log(`  Max retries: ${MAX_RETRIES} per file`);
  console.log('─────────────────────────────────────────');

  const cwd = path.join(process.cwd(), '..');
  const failedUploads: UploadResult[] = [];

  // Prepare upload tasks for SVGs
  const svgTasks: { tokenId: number; path: string }[] = [];
  const thumbTasks: { tokenId: number; path: string }[] = [];

  for (const file of uriFiles) {
    const tokenId = parseInt(file.replace('.txt', ''));

    const svgPath = path.join(IMAGES_DIR, `${tokenId}.svg`);
    try {
      await fs.access(svgPath);
      svgTasks.push({ tokenId, path: svgPath });
    } catch {}

    const thumbPath = path.join(THUMBS_DIR, `${tokenId}.webp`);
    try {
      await fs.access(thumbPath);
      thumbTasks.push({ tokenId, path: thumbPath });
    } catch {}
  }

  console.log(`\n  Uploading ${svgTasks.length} SVG images...`);
  let svgUploaded = 0;
  let svgFailed = 0;

  await processInBatches(svgTasks, PARALLEL_UPLOADS, async (task) => {
    const success = await uploadToR2(task.path, `${task.tokenId}.svg`, 'image/svg+xml', cwd);
    if (success) {
      svgUploaded++;
      if (svgUploaded % 50 === 0) {
        console.log(`    SVGs: ${svgUploaded}/${svgTasks.length} uploaded...`);
      }
    } else {
      svgFailed++;
      failedUploads.push({ tokenId: task.tokenId, type: 'svg', success: false });
    }
    return success;
  });
  console.log(`  ✓ SVGs: ${svgUploaded} uploaded, ${svgFailed} failed`);

  console.log(`\n  Uploading ${thumbTasks.length} thumbnails...`);
  let thumbUploaded = 0;
  let thumbFailed = 0;

  await processInBatches(thumbTasks, PARALLEL_UPLOADS, async (task) => {
    const success = await uploadToR2(task.path, `thumb/${task.tokenId}.webp`, 'image/webp', cwd);
    if (success) {
      thumbUploaded++;
      if (thumbUploaded % 50 === 0) {
        console.log(`    Thumbnails: ${thumbUploaded}/${thumbTasks.length} uploaded...`);
      }
    } else {
      thumbFailed++;
      failedUploads.push({ tokenId: task.tokenId, type: 'thumb', success: false });
    }
    return success;
  });
  console.log(`  ✓ Thumbnails: ${thumbUploaded} uploaded, ${thumbFailed} failed`);

  // Report results
  console.log('\n═══════════════════════════════════════════');
  console.log('  Import Complete');
  console.log('═══════════════════════════════════════════');
  console.log(`  Metadata processed: ${imported}`);
  console.log(`  SVGs uploaded: ${svgUploaded}/${svgTasks.length}`);
  console.log(`  Thumbnails uploaded: ${thumbUploaded}/${thumbTasks.length}`);

  if (failedUploads.length > 0) {
    console.log(`\n  ⚠ ${failedUploads.length} uploads failed after ${MAX_RETRIES} retries:`);
    // Write failed uploads to file for retry
    const failedPath = path.join(OUTPUT_DIR, 'failed-uploads.json');
    await fs.writeFile(failedPath, JSON.stringify(failedUploads, null, 2));
    console.log(`  Failed uploads saved to: ${failedPath}`);
  } else {
    console.log('\n  ✓ All uploads successful!');
  }
}

importExistingData().catch(console.error);
