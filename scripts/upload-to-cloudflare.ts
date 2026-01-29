import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const INDEXED_DATA_DIR = path.join(process.cwd(), '..', 'indexed-data');
const METADATA_DIR = path.join(INDEXED_DATA_DIR, 'metadata');
const IMAGES_DIR = path.join(INDEXED_DATA_DIR, 'images');

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function generateSQLInserts(): Promise<string> {
  console.log('Generating SQL inserts...');

  const files = await fs.readdir(METADATA_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort((a, b) => {
    const numA = parseInt(a.replace('.json', ''));
    const numB = parseInt(b.replace('.json', ''));
    return numA - numB;
  });

  let sql = '-- Auto-generated SQL inserts\n';
  sql += '-- Generated at: ' + new Date().toISOString() + '\n\n';

  // NFT inserts
  sql += '-- NFT Records\n';
  for (const file of jsonFiles) {
    const tokenId = parseInt(file.replace('.json', ''));
    const content = await fs.readFile(path.join(METADATA_DIR, file), 'utf-8');
    const metadata: NFTMetadata = JSON.parse(content);

    sql += `INSERT OR REPLACE INTO nfts (token_id, name, description, image_cid, metadata_json) VALUES (${tokenId}, '${escapeSQL(metadata.name)}', '${escapeSQL(metadata.description || '')}', '${tokenId}.svg', '${escapeSQL(JSON.stringify(metadata))}');\n`;
  }

  sql += '\n-- Attribute Records\n';
  sql += 'DELETE FROM attributes;\n'; // Clear existing attributes

  for (const file of jsonFiles) {
    const tokenId = parseInt(file.replace('.json', ''));
    const content = await fs.readFile(path.join(METADATA_DIR, file), 'utf-8');
    const metadata: NFTMetadata = JSON.parse(content);

    for (const attr of metadata.attributes || []) {
      sql += `INSERT INTO attributes (token_id, trait_type, value) VALUES (${tokenId}, '${escapeSQL(attr.trait_type)}', '${escapeSQL(String(attr.value))}');\n`;
    }
  }

  // Update collection metadata
  sql += '\n-- Update collection metadata\n';
  sql += `UPDATE collection_metadata SET value = '${jsonFiles.length}', updated_at = CURRENT_TIMESTAMP WHERE key = 'indexed_count';\n`;
  sql += `UPDATE collection_metadata SET value = '${jsonFiles.length}', updated_at = CURRENT_TIMESTAMP WHERE key = 'total_supply';\n`;

  return sql;
}

async function uploadToD1() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  Uploading to Cloudflare D1');
  console.log('═══════════════════════════════════════════\n');

  const sql = await generateSQLInserts();
  const sqlPath = path.join(INDEXED_DATA_DIR, 'inserts.sql');
  await fs.writeFile(sqlPath, sql, 'utf-8');

  console.log(`SQL file written to: ${sqlPath}`);
  console.log(`Total size: ${(sql.length / 1024).toFixed(1)} KB\n`);

  console.log('Executing SQL on D1...');
  try {
    execSync(`wrangler d1 execute nft-metadata-db --file="${sqlPath}"`, {
      stdio: 'inherit',
      cwd: path.join(process.cwd(), '..'),
    });
    console.log('✓ D1 upload complete!\n');
  } catch (error) {
    console.error('✗ D1 upload failed. You may need to run manually:');
    console.error(`  wrangler d1 execute nft-metadata-db --file="${sqlPath}"`);
  }
}

async function uploadToR2() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  Uploading to Cloudflare R2');
  console.log('═══════════════════════════════════════════\n');

  const files = await fs.readdir(IMAGES_DIR);
  const svgFiles = files.filter(f => f.endsWith('.svg'));

  console.log(`Found ${svgFiles.length} SVG files to upload\n`);

  let uploaded = 0;
  let failed = 0;

  for (const file of svgFiles) {
    const filePath = path.join(IMAGES_DIR, file);
    try {
      execSync(`wrangler r2 object put nft-images/${file} --file="${filePath}"`, {
        stdio: 'pipe',
        cwd: path.join(process.cwd(), '..'),
      });
      uploaded++;
      process.stdout.write(`\rUploaded: ${uploaded}/${svgFiles.length}`);
    } catch (error) {
      failed++;
      console.error(`\n✗ Failed to upload ${file}`);
    }
  }

  console.log(`\n\n✓ R2 upload complete!`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Cloudflare Upload Script');
  console.log('═══════════════════════════════════════════\n');

  // Check if indexed data exists
  try {
    await fs.access(METADATA_DIR);
    await fs.access(IMAGES_DIR);
  } catch {
    console.error('Error: indexed-data directory not found.');
    console.error('Please run `npm run index` first to index the NFTs.');
    process.exit(1);
  }

  // Upload to D1 (database)
  await uploadToD1();

  // Upload to R2 (images)
  await uploadToR2();

  console.log('\n═══════════════════════════════════════════');
  console.log('  All uploads complete!');
  console.log('═══════════════════════════════════════════');
  console.log('\nNext steps:');
  console.log('1. Deploy the API: cd ../workers && npm run deploy');
  console.log('2. Deploy the frontend: cd ../frontend && npm run build && wrangler pages deploy dist');
}

main().catch(console.error);
