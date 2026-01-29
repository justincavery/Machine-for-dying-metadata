import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const URI_DIR = path.join(process.cwd(), '..', 'uri');
const IMAGES_DIR = path.join(process.cwd(), '..', 'images');
const OUTPUT_DIR = path.join(process.cwd(), '..', 'indexed-data');

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

async function importExistingData() {
  console.log('═══════════════════════════════════════════');
  console.log('  Import Existing Extracted Data');
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

  // Create output directory
  await fs.mkdir(path.join(OUTPUT_DIR, 'metadata'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, 'images'), { recursive: true });

  let sql = '-- Imported from existing uri/ and images/ directories\n';
  sql += '-- Generated at: ' + new Date().toISOString() + '\n\n';

  let imported = 0;
  let failed = 0;

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
      // Remove large base64 data to keep SQL statements small
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

      // Generate SQL - only store essential data, not the full base64 content
      sql += `INSERT OR REPLACE INTO nfts (token_id, name, description, image_cid, metadata_json) VALUES (${tokenId}, '${escapeSQL(metadata.name)}', '${escapeSQL(metadata.description || '')}', '${tokenId}.svg', '${escapeSQL(JSON.stringify(metadataToSave))}');\n`;

      for (const attr of metadata.attributes || []) {
        sql += `INSERT INTO attributes (token_id, trait_type, value) VALUES (${tokenId}, '${escapeSQL(attr.trait_type)}', '${escapeSQL(String(attr.value))}');\n`;
      }

      console.log(`✓ Token ${tokenId}: ${metadata.name}`);
      imported++;
    } catch (error) {
      console.error(`✗ Failed to import token ${tokenId}:`, (error as Error).message);
      failed++;
    }
  }

  // Update collection metadata
  sql += `\nUPDATE collection_metadata SET value = '${imported}', updated_at = CURRENT_TIMESTAMP WHERE key = 'indexed_count';\n`;
  sql += `UPDATE collection_metadata SET value = '${imported}', updated_at = CURRENT_TIMESTAMP WHERE key = 'total_supply';\n`;

  // Write SQL file
  const sqlPath = path.join(OUTPUT_DIR, 'import.sql');
  await fs.writeFile(sqlPath, sql, 'utf-8');

  console.log('\n═══════════════════════════════════════════');
  console.log('  Import Complete');
  console.log('═══════════════════════════════════════════');
  console.log(`Imported: ${imported}`);
  console.log(`Failed: ${failed}`);
  console.log(`SQL file: ${sqlPath}`);

  // Execute SQL on local D1
  console.log('\nExecuting SQL on local D1...');
  try {
    execSync(`wrangler d1 execute nft-metadata-db --file="${sqlPath}"`, {
      stdio: 'inherit',
      cwd: path.join(process.cwd(), '..'),
    });
    console.log('✓ Local D1 updated');
  } catch (error) {
    console.error('✗ Local D1 update failed');
  }

  // Execute SQL on remote D1
  console.log('\nExecuting SQL on remote D1...');
  try {
    execSync(`wrangler d1 execute nft-metadata-db --file="${sqlPath}" --remote`, {
      stdio: 'inherit',
      cwd: path.join(process.cwd(), '..'),
    });
    console.log('✓ Remote D1 updated');
  } catch (error) {
    console.error('✗ Remote D1 update failed');
  }
}

importExistingData().catch(console.error);
