# Requirements Document: NFT Metadata Viewer using Cloudflare

## Executive Summary

This document outlines the requirements for deploying a cost-effective NFT metadata viewer for the "A Machine For Dying" NFT collection using Cloudflare's modern infrastructure. The goal is to restore public access to NFT metadata and images that was previously shut down due to prohibitive costs.

## Current State Analysis

### Existing Components

1. **Smart Contracts (Ethereum Mainnet)**
   - NFT Contract: `0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C` (Clifford)
   - Metadata Contract: `0x248B1149203933c1B08E985aD67138AF0dDd1b94`
   - On-chain metadata generation (no external storage needed)

2. **Metadata Format**
   - Base64-encoded JSON data URIs
   - Embedded SVG images (also base64-encoded)
   - Attributes including: Machine, State, Small Asset, etc.
   - Example structure:
     ```json
     {
       "name": "A Machine For Dying # 0",
       "description": "...",
       "image": "data:image/svg+xml;base64,...",
       "attributes": [...]
     }
     ```

3. **Existing Tooling**
   - Foundry-based Solidity test framework
   - Scripts to extract metadata and images for individual tokens
   - No existing web frontend

### Problem Statement

The project previously had an NFT viewer that was shut down due to high hosting/infrastructure costs. Users need a way to:
- Search for their NFTs by token ID
- View NFT metadata and images
- Download NFT images
- All at minimal to zero ongoing cost

## Proposed Solution: Cloudflare-Based Architecture

### Technology Stack

1. **Cloudflare Pages** - Free tier for static site hosting
2. **Cloudflare Workers** - Serverless edge computing for API calls
3. **Cloudflare D1** - Serverless SQL database (free tier: 5GB storage, 5M reads/day)
4. **Cloudflare R2** - S3-compatible object storage (free tier: 10GB storage, 1M requests/month)
5. **Cloudflare KV** - Key-value store for caching (optional)

### Architecture Components

#### 1. Data Indexing Pipeline

**Purpose**: Extract and store NFT metadata in Cloudflare infrastructure

**Components**:
- **Indexer Script**: Node.js/TypeScript script using ethers.js or viem
- **Data Storage**: 
  - Cloudflare D1: Store searchable metadata (token IDs, attributes, names)
  - Cloudflare R2: Store SVG images as individual files
- **Execution**: Can run locally or via GitHub Actions on-demand

**Data to Store**:
```sql
CREATE TABLE nfts (
  token_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,
  image_url TEXT,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  trait_type TEXT,
  value TEXT,
  FOREIGN KEY (token_id) REFERENCES nfts(token_id)
);

CREATE INDEX idx_trait_type ON attributes(trait_type);
CREATE INDEX idx_value ON attributes(value);
```

**Features**:
- Batch processing for efficiency
- Resume capability (track last indexed token)
- Error handling and retry logic
- Progress reporting

#### 2. API Layer (Cloudflare Workers)

**Endpoints**:

1. `GET /api/nft/:tokenId`
   - Returns metadata for a specific token
   - Serves from D1 database
   - Returns 404 if not found

2. `GET /api/nfts`
   - List NFTs with pagination
   - Query params: `page`, `limit` (default 20, max 100)
   - Returns: `{nfts: [], total: number, page: number, hasMore: boolean}`

3. `GET /api/search`
   - Search by token ID, name, or attributes
   - Query params: 
     - `q`: search term (token ID or name)
     - `trait_type`: filter by trait type
     - `trait_value`: filter by trait value
     - `page`, `limit`
   - Returns paginated results

4. `GET /api/image/:tokenId`
   - Returns SVG image from R2 storage
   - Sets appropriate Content-Type headers
   - Implements caching headers (immutable content)

5. `GET /api/stats`
   - Returns collection statistics
   - Total supply, attribute distributions, etc.

**Features**:
- CORS headers for browser access
- Rate limiting (Cloudflare's built-in protection)
- Caching via Cache API
- Error handling with proper HTTP status codes

#### 3. Frontend Application (Cloudflare Pages)

**Technology**: Static site with vanilla JavaScript or lightweight framework (React, Vue, Svelte)

**Pages**:

1. **Home/Search Page** (`/`)
   - Search bar (by token ID or name)
   - Grid view of recent/random NFTs
   - Quick links to browse by attributes

2. **NFT Detail Page** (`/nft/:tokenId`)
   - Display SVG image (full size, responsive)
   - Show all metadata and attributes
   - Download button for SVG
   - Share link
   - Navigation to prev/next token

3. **Gallery/Browse Page** (`/gallery`)
   - Paginated grid view of all NFTs
   - Infinite scroll or pagination
   - Filter by attributes
   - Sort options

4. **Attribute Explorer** (`/attributes`)
   - List all trait types
   - Show distribution of values
   - Click to filter NFTs by attribute

**Features**:
- Responsive design (mobile-first)
- Fast loading (optimized images and code)
- Accessible (WCAG 2.1 AA compliance)
- SEO-friendly (meta tags, OpenGraph)
- No external dependencies for core functionality
- Progressive enhancement

## Implementation Requirements

### Phase 1: Infrastructure Setup (Estimated: 2-4 hours)

**Tasks**:
1. Create Cloudflare account (if not exists)
2. Set up Cloudflare D1 database
3. Set up Cloudflare R2 bucket
4. Configure Cloudflare Pages project
5. Set up domain/subdomain (optional)

**Deliverables**:
- Database schema created
- R2 bucket configured
- Pages project initialized
- wrangler.toml configuration file

### Phase 2: Data Indexing (Estimated: 4-8 hours)

**Tasks**:
1. Create indexer script
   - Connect to Ethereum RPC (use free tier: Alchemy, Infura, or public RPC)
   - Fetch total supply from contract
   - Loop through all tokens
   - Extract metadata and images
   - Store in D1 and R2
2. Add progress tracking and logging
3. Handle errors and retries
4. Test with subset of tokens first

**Deliverables**:
- `scripts/indexer.ts` - Main indexer script
- `scripts/setup-db.sql` - Database initialization
- Documentation for running indexer

**Considerations**:
- RPC rate limits (may need to batch or throttle requests)
- Time to complete (estimate based on collection size)
- Storage limits (track D1 and R2 usage)

### Phase 3: API Development (Estimated: 6-10 hours)

**Tasks**:
1. Set up Cloudflare Workers project
2. Implement all API endpoints
3. Add database queries with proper indexing
4. Implement R2 integration for images
5. Add caching layer
6. Test all endpoints
7. Deploy to production

**Deliverables**:
- `workers/api/` - Worker source code
- API documentation (endpoints, parameters, responses)
- Example requests/responses

**Testing Requirements**:
- Unit tests for business logic
- Integration tests with D1 (use --local)
- Load testing (verify performance under Cloudflare limits)

### Phase 4: Frontend Development (Estimated: 12-20 hours)

**Tasks**:
1. Design UI/UX (wireframes/mockups)
2. Set up frontend build system
3. Implement all pages
4. Integrate with API
5. Add search and filtering
6. Optimize performance
7. Test across browsers/devices
8. Deploy to Cloudflare Pages

**Deliverables**:
- `frontend/` - Complete frontend application
- Build configuration
- Deployment instructions

**Testing Requirements**:
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile responsiveness testing
- Accessibility testing
- Performance testing (Lighthouse scores)

### Phase 5: Documentation & Deployment (Estimated: 3-5 hours)

**Tasks**:
1. Write comprehensive README
2. Create deployment guide
3. Document API endpoints
4. Add troubleshooting guide
5. Create user guide
6. Set up monitoring (optional)

**Deliverables**:
- Updated README.md
- DEPLOYMENT.md
- API.md
- USER_GUIDE.md

## Technical Specifications

### Performance Requirements

- **Page Load**: < 2 seconds (First Contentful Paint)
- **API Response**: < 500ms (p95)
- **Image Load**: < 1 second for SVG
- **Search**: < 200ms for simple queries

### Scalability Requirements

- Support Cloudflare's free tier limits
- Handle 10,000+ NFTs efficiently
- Support 1000+ concurrent users
- Graceful degradation under load

### Security Requirements

- HTTPS only (enforced by Cloudflare)
- Rate limiting on API endpoints
- Input validation and sanitization
- No sensitive data exposure
- CORS properly configured

### Accessibility Requirements

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Alt text for images
- Proper semantic HTML

## Cost Analysis

### Cloudflare Free Tier Limits

1. **Cloudflare Pages**: 
   - 500 builds/month
   - Unlimited requests
   - Unlimited bandwidth
   - **Cost**: $0/month

2. **Cloudflare Workers**:
   - 100,000 requests/day
   - **Cost**: $0/month (paid plan: $5/month for 10M requests)

3. **Cloudflare D1**:
   - 5GB storage
   - 5M row reads/day
   - 100k row writes/day
   - **Cost**: $0/month (paid: $5/month for 10GB + overages)

4. **Cloudflare R2**:
   - 10GB storage
   - 1M Class A operations/month (writes)
   - 10M Class B operations/month (reads)
   - **Cost**: $0/month (paid: $0.015/GB/month + operations)

### Estimated Monthly Cost

**For a 10,000 NFT collection**:
- D1 storage: ~50MB metadata (well within 5GB)
- R2 storage: ~13GB images (1.3MB avg × 10,000) - **Exceeds free tier by 3GB**
- Workers requests: Depends on traffic
- Pages: Free

**Total estimated cost**: $0-5/month
- If staying within free limits: $0
- If using paid R2 tier: ~$0.05/month (3GB overage)
- If needing paid Workers: $5/month (for high traffic)

**Compared to previous solution**: Significant savings (exact previous cost unknown, but "prohibitive" suggests much higher)

## Risks and Mitigations

### Risk 1: Collection Size Unknown
**Mitigation**: Start indexing and monitor progress. Adjust strategy if collection is larger than expected.

### Risk 2: RPC Rate Limiting
**Mitigation**: Use multiple RPC providers with fallback. Implement exponential backoff. Consider running indexer over multiple days if needed.

### Risk 3: Exceeding Free Tier Limits
**Mitigation**: 
- Monitor usage closely
- Implement aggressive caching
- Consider paid tier (~$5/month still very affordable)
- Optimize image sizes if needed

### Risk 4: Smart Contract Changes
**Mitigation**: Store complete metadata snapshot. Document contract addresses and ABI versions used.

### Risk 5: Maintenance Burden
**Mitigation**: Design for minimal maintenance. Static site requires no ongoing updates once indexed.

## Success Criteria

1. **Functionality**: All NFTs are searchable, viewable, and downloadable
2. **Performance**: Meets or exceeds performance requirements
3. **Cost**: Stays within $5/month or less
4. **Usability**: Positive user feedback, intuitive interface
5. **Reliability**: 99%+ uptime (Cloudflare SLA)

## Future Enhancements (Out of Scope)

- Real-time updates (listen to blockchain events)
- User accounts and favorites
- Community features (comments, likes)
- Analytics dashboard
- Advanced filtering and sorting
- Export functionality (bulk download)
- Integration with NFT marketplaces
- Mobile app

## Conclusion

This solution leverages Cloudflare's generous free tier to provide a cost-effective NFT metadata viewer. The static nature of NFT metadata (immutable once minted) makes it an ideal candidate for this architecture. With proper implementation, the solution can provide excellent user experience at minimal to zero ongoing cost.

The key innovation is moving from real-time blockchain queries (expensive, slow) to a pre-indexed database (fast, cheap). This trade-off is acceptable for NFT metadata, which rarely changes post-mint.

**Recommended Approach**: Start with Phase 1-2 to validate the indexing process and storage requirements, then proceed with API and frontend development once data layer is confirmed working.
