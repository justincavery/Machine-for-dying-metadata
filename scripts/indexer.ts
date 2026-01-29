import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

// Configuration
const CLIFFORD_ADDRESS = '0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C';
const RPC_URL = process.env.RPC_URL || 'https://eth.llamarpc.com';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const START_TOKEN = parseInt(process.env.START_TOKEN || '0');
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '10000');

// ERC721 ABI (minimal)
const ERC721_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

async function decodeDataURI(dataUri: string): Promise<string> {
  const base64Data = dataUri.replace(/^data:application\/json;base64,/, '');
  return Buffer.from(base64Data, 'base64').toString('utf-8');
}

async function extractImageFromMetadata(imageUri: string): Promise<string> {
  const base64Data = imageUri.replace(/^data:image\/svg\+xml;base64,/, '');
  return Buffer.from(base64Data, 'base64').toString('utf-8');
}

async function indexToken(
  contract: ethers.Contract,
  tokenId: number,
  outputDir: string
): Promise<NFTMetadata | null> {
  try {
    // Get token URI (base64-encoded JSON)
    const tokenURI = await contract.tokenURI(tokenId);

    // Decode metadata
    const metadataJson = await decodeDataURI(tokenURI);
    const metadata: NFTMetadata = JSON.parse(metadataJson);

    // Extract and save SVG image
    const svg = await extractImageFromMetadata(metadata.image);
    const imagePath = path.join(outputDir, 'images', `${tokenId}.svg`);
    await fs.writeFile(imagePath, svg, 'utf-8');

    // Save metadata (without the base64 image to save space)
    const metadataToSave = {
      ...metadata,
      image: `${tokenId}.svg`, // Reference to saved file
    };
    const metadataPath = path.join(outputDir, 'metadata', `${tokenId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadataToSave, null, 2), 'utf-8');

    console.log(`✓ Token ${tokenId}: ${metadata.name}`);
    return metadata;
  } catch (error) {
    console.error(`✗ Error indexing token ${tokenId}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  NFT Metadata Indexer');
  console.log('  A Machine For Dying Collection');
  console.log('═══════════════════════════════════════════\n');

  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Start Token: ${START_TOKEN}`);
  console.log(`Max Tokens: ${MAX_TOKENS}\n`);

  // Setup output directories
  const outputDir = path.join(process.cwd(), '..', 'indexed-data');
  await fs.mkdir(path.join(outputDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'metadata'), { recursive: true });

  console.log(`Output directory: ${outputDir}\n`);

  // Connect to Ethereum
  console.log('Connecting to Ethereum...');
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: 1,
    name: 'mainnet',
  });
  const contract = new ethers.Contract(CLIFFORD_ADDRESS, ERC721_ABI, provider);

  // Get total supply
  console.log('Fetching total supply...');
  let totalSupply: number;
  try {
    totalSupply = Number(await contract.totalSupply());
    console.log(`Total Supply: ${totalSupply}\n`);
  } catch (error) {
    console.error('Failed to get total supply:', (error as Error).message);
    console.log('Using MAX_TOKENS as limit instead.\n');
    totalSupply = MAX_TOKENS;
  }

  const maxToken = Math.min(totalSupply, MAX_TOKENS);

  // Index tokens in batches
  let indexed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = START_TOKEN; i < maxToken; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, maxToken);
    console.log(`\n─── Batch: ${i} to ${batchEnd - 1} ───`);

    // Process batch in parallel
    const promises = [];
    for (let tokenId = i; tokenId < batchEnd; tokenId++) {
      promises.push(
        indexToken(contract, tokenId, outputDir)
          .then((result) => {
            if (result) indexed++;
            else failed++;
          })
      );
    }

    await Promise.allSettled(promises);

    // Progress update
    const progress = ((batchEnd / maxToken) * 100).toFixed(1);
    console.log(`Progress: ${progress}% (${indexed} indexed, ${failed} failed)`);

    // Rate limiting - wait between batches to avoid RPC limits
    if (batchEnd < maxToken) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════');
  console.log('  Indexing Complete!');
  console.log('═══════════════════════════════════════════');
  console.log(`Total indexed: ${indexed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log(`Output directory: ${outputDir}`);
  console.log('\nNext step: Run `npm run upload` to upload to Cloudflare');
}

main().catch(console.error);
