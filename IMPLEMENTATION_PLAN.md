# Implementation Plan: NFT Metadata Viewer

This document provides a detailed, step-by-step implementation plan for building the NFT metadata viewer using Cloudflare infrastructure.

## Prerequisites

Before starting, ensure you have:

1. **Cloudflare Account** (free tier is sufficient to start)
2. **Node.js** (v18 or later)
3. **Git** (for version control)
4. **Ethereum RPC Access** (free tier from Alchemy, Infura, or use public RPC)
5. **Foundry** (already installed for this project)

## Phase 1: Project Setup (2-3 hours)

### Step 1.1: Cloudflare Infrastructure Setup

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create nft-metadata-db

# Create R2 bucket
wrangler r2 bucket create nft-images

# Note the IDs from the above commands for configuration
```

### Step 1.2: Project Structure

Create the following directory structure:

```
Machine-for-dying-metadata/
├── frontend/              # Static site for Cloudflare Pages
│   ├── src/
│   │   ├── index.html
│   │   ├── nft.html
│   │   ├── gallery.html
│   │   ├── styles/
│   │   └── scripts/
│   ├── public/
│   └── package.json
├── workers/               # Cloudflare Workers API
│   ├── src/
│   │   ├── index.ts
│   │   ├── handlers/
│   │   ├── db/
│   │   └── utils/
│   ├── wrangler.toml
│   └── package.json
├── scripts/               # Indexing and utility scripts
│   ├── indexer.ts
│   ├── setup-db.sql
│   └── package.json
└── docs/
    ├── REQUIREMENTS.md
    └── IMPLEMENTATION_PLAN.md
```

### Step 1.3: Initialize Packages

Create package.json files for each directory:

**scripts/package.json**:
```json
{
  "name": "nft-indexer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "index": "tsx indexer.ts",
    "setup-db": "wrangler d1 execute nft-metadata-db --file=setup-db.sql"
  },
  "dependencies": {
    "ethers": "^6.10.0",
    "better-sqlite3": "^9.2.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**workers/package.json**:
```json
{
  "name": "nft-api-worker",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest"
  },
  "dependencies": {},
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231218.0",
    "wrangler": "^3.22.0",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0"
  }
}
```

**frontend/package.json**:
```json
{
  "name": "nft-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0"
  }
}
```

## Phase 2: Database Setup and Indexing (4-8 hours)

### Step 2.1: Create Database Schema

**scripts/setup-db.sql**:
```sql
-- Drop existing tables if they exist
DROP TABLE IF EXISTS attributes;
DROP TABLE IF EXISTS nfts;

-- Create NFTs table
CREATE TABLE nfts (
  token_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_cid TEXT,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create attributes table for searchable traits
CREATE TABLE attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  trait_type TEXT NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES nfts(token_id)
);

-- Create indexes for fast searching
CREATE INDEX idx_attributes_trait_type ON attributes(trait_type);
CREATE INDEX idx_attributes_value ON attributes(value);
CREATE INDEX idx_attributes_token_id ON attributes(token_id);
CREATE INDEX idx_nfts_name ON nfts(name);

-- Create metadata table for collection info
CREATE TABLE collection_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metadata
INSERT INTO collection_metadata (key, value) VALUES ('total_supply', '0');
INSERT INTO collection_metadata (key, value) VALUES ('indexed_count', '0');
INSERT INTO collection_metadata (key, value) VALUES ('last_indexed_token', '-1');
```

Run the setup:
```bash
cd scripts
npm install
npm run setup-db
```

### Step 2.2: Create Indexer Script

**scripts/indexer.ts**:
```typescript
import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

// Configuration
const CLIFFORD_ADDRESS = '0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C';
const METADATA_ADDRESS = '0x248B1149203933c1B08E985aD67138AF0dDd1b94';
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
  // Remove data URI prefix and decode base64
  const base64Data = dataUri.replace(/^data:application\/json;base64,/, '');
  return Buffer.from(base64Data, 'base64').toString('utf-8');
}

async function extractImageFromMetadata(imageUri: string): Promise<string> {
  // Image is also a data URI (SVG)
  const base64Data = imageUri.replace(/^data:image\/svg\+xml;base64,/, '');
  return Buffer.from(base64Data, 'base64').toString('utf-8');
}

async function indexToken(
  contract: ethers.Contract,
  tokenId: number,
  outputDir: string
): Promise<void> {
  console.log(`Indexing token ${tokenId}...`);

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
    
    // Save metadata
    const metadataPath = path.join(outputDir, 'metadata', `${tokenId}.json`);
    await fs.writeFile(metadataPath, metadataJson, 'utf-8');
    
    console.log(`✓ Token ${tokenId} indexed successfully`);
    
    return;
  } catch (error) {
    console.error(`✗ Error indexing token ${tokenId}:`, error);
    throw error;
  }
}

async function main() {
  console.log('NFT Metadata Indexer Starting...\n');
  
  // Setup output directories
  const outputDir = path.join(process.cwd(), '..', 'indexed-data');
  await fs.mkdir(path.join(outputDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'metadata'), { recursive: true });
  
  // Connect to Ethereum
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CLIFFORD_ADDRESS, ERC721_ABI, provider);
  
  // Get total supply
  console.log('Fetching total supply...');
  const totalSupply = await contract.totalSupply();
  console.log(`Total Supply: ${totalSupply.toString()}\n`);
  
  const maxToken = Math.min(Number(totalSupply), MAX_TOKENS);
  
  // Index tokens in batches
  let indexed = 0;
  let failed = 0;
  
  for (let i = START_TOKEN; i < maxToken; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, maxToken);
    console.log(`\nProcessing batch: ${i} to ${batchEnd - 1}`);
    
    // Process batch in parallel
    const promises = [];
    for (let tokenId = i; tokenId < batchEnd; tokenId++) {
      promises.push(
        indexToken(contract, tokenId, outputDir)
          .then(() => indexed++)
          .catch(() => failed++)
      );
    }
    
    await Promise.allSettled(promises);
    
    // Rate limiting - wait between batches
    if (batchEnd < maxToken) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n=== Indexing Complete ===');
  console.log(`Total indexed: ${indexed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch(console.error);
```

**scripts/.env.example**:
```
RPC_URL=https://eth.llamarpc.com
BATCH_SIZE=10
START_TOKEN=0
MAX_TOKENS=10000
```

### Step 2.3: Upload Data to Cloudflare

**scripts/upload-to-cloudflare.ts**:
```typescript
import fs from 'fs/promises';
import path from 'path';

// This script uploads indexed data to Cloudflare D1 and R2
// Requires wrangler CLI to be configured

async function uploadToR2(imagePath: string, tokenId: number) {
  // Use wrangler to upload to R2
  const command = `wrangler r2 object put nft-images/${tokenId}.svg --file=${imagePath}`;
  // Execute command (use child_process)
}

async function uploadToD1(metadataPath: string, tokenId: number) {
  // Parse metadata and insert into D1
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  
  // Build SQL insert statements
  const insertNFT = `
    INSERT INTO nfts (token_id, name, description, image_cid, metadata_json)
    VALUES (${tokenId}, '${metadata.name}', '${metadata.description}', '${tokenId}.svg', '${JSON.stringify(metadata)}');
  `;
  
  // Insert attributes
  for (const attr of metadata.attributes) {
    const insertAttr = `
      INSERT INTO attributes (token_id, trait_type, value)
      VALUES (${tokenId}, '${attr.trait_type}', '${attr.value}');
    `;
  }
  
  // Execute SQL (use wrangler d1 execute)
}

// Main upload loop
```

Run the indexer:
```bash
cd scripts
cp .env.example .env
# Edit .env with your RPC URL
npm run index
```

## Phase 3: API Development (6-10 hours)

### Step 3.1: Create Worker Configuration

**workers/wrangler.toml**:
```toml
name = "nft-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[ d1_databases ]]
binding = "DB"
database_name = "nft-metadata-db"
database_id = "<YOUR_DATABASE_ID>"

[[ r2_buckets ]]
binding = "IMAGES"
bucket_name = "nft-images"

[vars]
ENVIRONMENT = "production"
```

### Step 3.2: Implement API Endpoints

**workers/src/index.ts**:
```typescript
export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Route handling
      if (url.pathname.startsWith('/api/nft/')) {
        return await handleGetNFT(url, env, corsHeaders);
      } else if (url.pathname === '/api/nfts') {
        return await handleListNFTs(url, env, corsHeaders);
      } else if (url.pathname === '/api/search') {
        return await handleSearch(url, env, corsHeaders);
      } else if (url.pathname.startsWith('/api/image/')) {
        return await handleGetImage(url, env, corsHeaders);
      } else if (url.pathname === '/api/stats') {
        return await handleStats(env, corsHeaders);
      }
      
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleGetNFT(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const tokenId = url.pathname.split('/').pop();
  
  const result = await env.DB.prepare(
    'SELECT * FROM nfts WHERE token_id = ?'
  ).bind(tokenId).first();
  
  if (!result) {
    return new Response(JSON.stringify({ error: 'NFT not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Get attributes
  const attributes = await env.DB.prepare(
    'SELECT trait_type, value FROM attributes WHERE token_id = ?'
  ).bind(tokenId).all();
  
  return new Response(JSON.stringify({
    ...result,
    attributes: attributes.results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListNFTs(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;
  
  const nfts = await env.DB.prepare(
    'SELECT token_id, name, image_cid FROM nfts ORDER BY token_id LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();
  
  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM nfts'
  ).first();
  
  return new Response(JSON.stringify({
    nfts: nfts.results,
    total: total.count,
    page,
    hasMore: offset + limit < total.count,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSearch(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const q = url.searchParams.get('q');
  const traitType = url.searchParams.get('trait_type');
  const traitValue = url.searchParams.get('trait_value');
  
  let query = 'SELECT DISTINCT n.* FROM nfts n';
  const bindings: any[] = [];
  const conditions: string[] = [];
  
  if (q) {
    conditions.push('(n.token_id = ? OR n.name LIKE ?)');
    bindings.push(q, `%${q}%`);
  }
  
  if (traitType || traitValue) {
    query += ' JOIN attributes a ON n.token_id = a.token_id';
    if (traitType) {
      conditions.push('a.trait_type = ?');
      bindings.push(traitType);
    }
    if (traitValue) {
      conditions.push('a.value = ?');
      bindings.push(traitValue);
    }
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' LIMIT 50';
  
  const results = await env.DB.prepare(query).bind(...bindings).all();
  
  return new Response(JSON.stringify({ results: results.results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetImage(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const tokenId = url.pathname.split('/').pop();
  const key = `${tokenId}.svg`;
  
  const object = await env.IMAGES.get(key);
  
  if (!object) {
    return new Response('Image not found', { status: 404 });
  }
  
  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

async function handleStats(env: Env, corsHeaders: any): Promise<Response> {
  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM nfts'
  ).first();
  
  const traitCounts = await env.DB.prepare(
    'SELECT trait_type, COUNT(DISTINCT token_id) as count FROM attributes GROUP BY trait_type'
  ).all();
  
  return new Response(JSON.stringify({
    total_nfts: total.count,
    traits: traitCounts.results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

Deploy the worker:
```bash
cd workers
npm install
npm run deploy
```

## Phase 4: Frontend Development (12-20 hours)

### Step 4.1: Create Basic HTML Structure

**frontend/src/index.html**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A Machine For Dying - NFT Viewer</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <header>
    <h1>A Machine For Dying</h1>
    <p>Explore the collection</p>
  </header>
  
  <main>
    <section class="search-section">
      <input type="text" id="searchInput" placeholder="Search by token ID or name..." />
      <button id="searchButton">Search</button>
    </section>
    
    <section class="gallery">
      <div id="nftGrid" class="nft-grid"></div>
      <button id="loadMore">Load More</button>
    </section>
  </main>
  
  <script type="module" src="./scripts/main.js"></script>
</body>
</html>
```

**frontend/src/nft.html**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFT Details - A Machine For Dying</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <header>
    <a href="/">← Back to Gallery</a>
    <h1>NFT Details</h1>
  </header>
  
  <main class="nft-detail">
    <div class="nft-image">
      <img id="nftImage" alt="NFT Image" />
      <button id="downloadBtn">Download SVG</button>
    </div>
    
    <div class="nft-info">
      <h2 id="nftName"></h2>
      <p id="nftDescription"></p>
      
      <h3>Attributes</h3>
      <div id="attributes" class="attributes-list"></div>
      
      <div class="navigation">
        <button id="prevBtn">← Previous</button>
        <button id="nextBtn">Next →</button>
      </div>
    </div>
  </main>
  
  <script type="module" src="./scripts/nft.js"></script>
</body>
</html>
```

### Step 4.2: Implement JavaScript API Client

**frontend/src/scripts/api.js**:
```javascript
const API_BASE = 'https://your-worker.workers.dev/api';

export async function fetchNFT(tokenId) {
  const response = await fetch(`${API_BASE}/nft/${tokenId}`);
  if (!response.ok) throw new Error('NFT not found');
  return response.json();
}

export async function fetchNFTs(page = 1, limit = 20) {
  const response = await fetch(`${API_BASE}/nfts?page=${page}&limit=${limit}`);
  return response.json();
}

export async function searchNFTs(query) {
  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  return response.json();
}

export function getImageURL(tokenId) {
  return `${API_BASE}/image/${tokenId}`;
}
```

### Step 4.3: Implement Frontend Logic

**frontend/src/scripts/main.js**:
```javascript
import { fetchNFTs, searchNFTs, getImageURL } from './api.js';

let currentPage = 1;
const grid = document.getElementById('nftGrid');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const loadMoreButton = document.getElementById('loadMore');

async function loadNFTs() {
  const data = await fetchNFTs(currentPage, 20);
  
  data.nfts.forEach(nft => {
    const card = createNFTCard(nft);
    grid.appendChild(card);
  });
  
  loadMoreButton.style.display = data.hasMore ? 'block' : 'none';
}

function createNFTCard(nft) {
  const card = document.createElement('div');
  card.className = 'nft-card';
  card.innerHTML = `
    <img src="${getImageURL(nft.token_id)}" alt="${nft.name}" loading="lazy" />
    <h3>${nft.name}</h3>
  `;
  card.onclick = () => window.location.href = `/nft.html?id=${nft.token_id}`;
  return card;
}

searchButton.addEventListener('click', async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  
  grid.innerHTML = '';
  const results = await searchNFTs(query);
  
  results.results.forEach(nft => {
    const card = createNFTCard(nft);
    grid.appendChild(card);
  });
  
  loadMoreButton.style.display = 'none';
});

loadMoreButton.addEventListener('click', () => {
  currentPage++;
  loadNFTs();
});

// Initial load
loadNFTs();
```

**frontend/src/scripts/nft.js**:
```javascript
import { fetchNFT, getImageURL } from './api.js';

const params = new URLSearchParams(window.location.search);
const tokenId = params.get('id');

async function loadNFT() {
  const nft = await fetchNFT(tokenId);
  
  document.getElementById('nftName').textContent = nft.name;
  document.getElementById('nftDescription').textContent = nft.description;
  document.getElementById('nftImage').src = getImageURL(nft.token_id);
  
  const attributesDiv = document.getElementById('attributes');
  nft.attributes.forEach(attr => {
    const attrEl = document.createElement('div');
    attrEl.className = 'attribute';
    attrEl.innerHTML = `<strong>${attr.trait_type}:</strong> ${attr.value}`;
    attributesDiv.appendChild(attrEl);
  });
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = getImageURL(tokenId);
  link.download = `machine-for-dying-${tokenId}.svg`;
  link.click();
});

document.getElementById('prevBtn').addEventListener('click', () => {
  const prev = Math.max(0, parseInt(tokenId) - 1);
  window.location.href = `/nft.html?id=${prev}`;
});

document.getElementById('nextBtn').addEventListener('click', () => {
  const next = parseInt(tokenId) + 1;
  window.location.href = `/nft.html?id=${next}`;
});

loadNFT();
```

### Step 4.4: Add Styling

**frontend/src/styles/main.css**:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
}

header {
  background: #222;
  color: white;
  padding: 2rem;
  text-align: center;
}

.search-section {
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1rem;
  display: flex;
  gap: 0.5rem;
}

#searchInput {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  background: #222;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background: #444;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.nft-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.nft-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.nft-card img {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

.nft-card h3 {
  padding: 1rem;
  font-size: 0.9rem;
}

.nft-detail {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.nft-image img {
  width: 100%;
  border-radius: 8px;
}

.attributes-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.attribute {
  padding: 0.5rem;
  background: #f0f0f0;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .nft-detail {
    grid-template-columns: 1fr;
  }
}
```

### Step 4.5: Configure Cloudflare Pages

Create **frontend/wrangler.toml** (for Pages):
```toml
name = "nft-frontend"
pages_build_output_dir = "dist"
```

Deploy to Cloudflare Pages:
```bash
cd frontend
npm install
npm run build
wrangler pages deploy dist --project-name=nft-viewer
```

## Phase 5: Testing and Deployment

### Step 5.1: Local Testing

```bash
# Test worker locally
cd workers
npm run dev

# Test frontend locally
cd frontend
npm run dev
```

### Step 5.2: Production Deployment

```bash
# Deploy worker
cd workers
npm run deploy

# Deploy frontend
cd frontend
npm run build
wrangler pages deploy dist
```

### Step 5.3: Configure Custom Domain (Optional)

In Cloudflare Dashboard:
1. Go to Pages → Your Project → Custom Domains
2. Add your domain (e.g., nft.yourdomain.com)
3. Update DNS records as instructed

## Monitoring and Maintenance

### Performance Monitoring
- Use Cloudflare Analytics to track requests
- Monitor D1 and R2 usage in Cloudflare Dashboard
- Set up alerts for quota approaching limits

### Updating Data
If new NFTs are minted or data needs updating:
```bash
cd scripts
# Set START_TOKEN to last indexed token
npm run index
# Run upload script to update D1 and R2
```

## Troubleshooting

### Common Issues

1. **RPC Rate Limiting**
   - Solution: Add delays between requests, use multiple RPC providers

2. **Exceeding Free Tier**
   - Solution: Optimize queries, implement aggressive caching, consider paid tier

3. **Slow Image Loading**
   - Solution: Implement lazy loading, add CDN caching headers

4. **CORS Errors**
   - Solution: Verify CORS headers in worker response

## Cost Optimization Tips

1. Enable caching for images (immutable content)
2. Use pagination to limit data transfer
3. Implement search debouncing in frontend
4. Compress responses where possible
5. Monitor usage and adjust limits accordingly

## Next Steps

After completing this implementation:
1. Gather user feedback
2. Monitor performance and costs
3. Consider additional features from the requirements doc
4. Optimize based on actual usage patterns

## Conclusion

This implementation plan provides a complete path from setup to deployment. Each phase builds on the previous one, allowing for incremental progress and testing. The final result is a fully functional, cost-effective NFT metadata viewer hosted entirely on Cloudflare's infrastructure.
