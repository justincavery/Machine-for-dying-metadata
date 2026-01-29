# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains tools for extracting and viewing metadata for the "A Machine For Dying" NFT collection on Ethereum. The project has two main components:

1. **Foundry-based extraction tools** - Extract NFT metadata/images from on-chain contracts
2. **Cloudflare-based viewer** (planned) - Web application to search and view NFTs

## Smart Contracts

- **NFT Contract (Clifford)**: `0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C`
- **Metadata Contract**: `0x248B1149203933c1B08E985aD67138AF0dDd1b94`
- **Network**: Ethereum Mainnet
- **Format**: On-chain base64-encoded JSON with embedded SVG images

## Commands

### Extract NFT Metadata (Foundry)

Edit `tokenId` in `test/Metadata.t.sol` to select the token, then:

```bash
# Get token URI (saves to uri/ folder)
forge test --match-test testGetTokenURI -vv --rpc-url wss://mainnet.gateway.tenderly.co

# Get SVG image (saves to images/ folder)
forge test --match-test testWriteImage -vv --rpc-url wss://mainnet.gateway.tenderly.co

# Get both
forge test -vv --rpc-url wss://mainnet.gateway.tenderly.co
```

Any Ethereum mainnet RPC can be used (Alchemy, Infura, public RPCs like `https://eth.llamarpc.com`).

### Cloudflare Development (when implemented)

```bash
# Install Wrangler CLI
npm install -g wrangler
wrangler login

# Create infrastructure
wrangler d1 create nft-metadata-db
wrangler r2 bucket create nft-images

# Local development
wrangler dev          # Workers API
npm run dev           # Frontend (Vite)

# Deploy
wrangler deploy       # Workers
wrangler pages deploy # Frontend
```

## Architecture

### Current: Metadata Extraction

```
Ethereum Mainnet
      │
      ▼
Foundry Test → Calls tokenURI/composeOnlyImage → Writes to uri/ or images/
```

### Planned: Cloudflare Viewer

```
Cloudflare Pages (frontend) ─► Cloudflare Workers (API)
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                       D1 DB      R2 Storage   (indexed from
                    (metadata)    (SVGs)        blockchain)
```

**Key services:**
- Cloudflare D1: SQL database for searchable metadata
- Cloudflare R2: Object storage for SVG images
- Cloudflare Workers: Serverless API endpoints
- Cloudflare Pages: Static frontend hosting

## Project Structure

```
├── test/Metadata.t.sol     # Foundry tests for metadata extraction
├── foundry.toml            # Foundry configuration
├── lib/                    # Dependencies (forge-std, openzeppelin)
├── uri/                    # Output: token URI JSON files
├── images/                 # Output: SVG image files
├── scripts/                # (planned) Node.js indexer scripts
├── workers/                # (planned) Cloudflare Workers API
└── frontend/               # (planned) Static frontend
```

## Implementation Status

The repository is currently in planning/documentation phase. See:
- `NEXT_STEPS.md` - Immediate action plan
- `PRE_IMPLEMENTATION_CHECKLIST.md` - Prerequisites before building
- `IMPLEMENTATION_PLAN.md` - Detailed build guide with code examples
- `QUICK_START.md` - 30-minute proof of concept

## Key Technical Details

- NFT metadata is generated on-chain (not stored externally)
- Images are SVG, embedded as base64 in the metadata JSON
- The indexing approach extracts once and stores in Cloudflare (avoids expensive repeated RPC calls)
- Free tier targets: <100k Worker requests/day, <5GB D1, <10GB R2
