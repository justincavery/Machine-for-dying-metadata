# Quick Start Guide

This guide helps you get started with deploying the NFT metadata viewer in the fastest way possible.

## Prerequisites Checklist

- [ ] Cloudflare account (free tier)
- [ ] Node.js v18+ installed
- [ ] Git installed
- [ ] Ethereum RPC access (free tier from Alchemy, Infura, or use public RPC)
- [ ] 2-4 hours of time

## 30-Minute Quick Setup (Proof of Concept)

This minimal setup gets you a working demo with sample data.

### Step 1: Install Wrangler (2 minutes)

```bash
npm install -g wrangler
wrangler login
```

### Step 2: Create Cloudflare Resources (5 minutes)

```bash
# Create D1 database
wrangler d1 create nft-metadata-db
# Note the database_id from output

# Create R2 bucket
wrangler r2 bucket create nft-images
```

### Step 3: Clone and Setup Project (3 minutes)

```bash
cd Machine-for-dying-metadata

# Create necessary directories
mkdir -p scripts workers/src frontend/src
```

### Step 4: Index First 10 NFTs (10 minutes)

Create `scripts/quick-index.js`:

```javascript
// Simplified indexer - see IMPLEMENTATION_PLAN.md for full version
import { ethers } from 'ethers';
import fs from 'fs';

const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const contract = new ethers.Contract(
  '0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C',
  ['function tokenURI(uint256) view returns (string)'],
  provider
);

// Index first 10 tokens as proof of concept
for (let i = 0; i < 10; i++) {
  const uri = await contract.tokenURI(i);
  const metadata = JSON.parse(Buffer.from(
    uri.replace('data:application/json;base64,', ''),
    'base64'
  ).toString());
  
  console.log(`Token ${i}: ${metadata.name}`);
  
  // Save to file
  fs.writeFileSync(
    `metadata-${i}.json`,
    JSON.stringify(metadata, null, 2)
  );
}
```

Run it:
```bash
cd scripts
npm init -y
npm install ethers@6
node quick-index.js
```

### Step 5: Deploy Simple API (5 minutes)

Create `workers/wrangler.toml`:
```toml
name = "nft-api-demo"
main = "src/index.js"
compatibility_date = "2024-01-01"
```

Create `workers/src/index.js`:
```javascript
export default {
  async fetch(request) {
    // Return sample data for now
    return new Response(JSON.stringify({
      name: "A Machine For Dying #0",
      message: "API is working!"
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

Deploy:
```bash
cd workers
npm init -y
wrangler deploy
# Note the deployed URL
```

### Step 6: Create Simple Frontend (5 minutes)

Create `frontend/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>NFT Viewer Demo</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 50px auto; }
    button { padding: 10px 20px; margin: 10px 0; }
    #result { background: #f5f5f5; padding: 20px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>A Machine For Dying - Demo</h1>
  <button onclick="testAPI()">Test API Connection</button>
  <div id="result"></div>
  
  <script>
    async function testAPI() {
      const response = await fetch('YOUR_WORKER_URL');
      const data = await response.json();
      document.getElementById('result').innerHTML = 
        `<h3>Success!</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
  </script>
</body>
</html>
```

Deploy to Pages:
```bash
cd frontend
wrangler pages deploy . --project-name=nft-demo
```

🎉 **You now have a working demo!**

## Full Setup (4-8 hours)

Once your demo is working, follow the full implementation:

### Phase 1: Complete Database Setup (1 hour)

1. Create database schema (see `IMPLEMENTATION_PLAN.md` Phase 2.1)
2. Set up proper database structure
3. Test with sample data

### Phase 2: Full Indexing (2-4 hours)

1. Implement complete indexer script
2. Index entire collection (time depends on collection size)
3. Upload to D1 and R2

**Note**: This is the most time-consuming phase. For a 10,000 NFT collection:
- Estimated indexing time: 2-3 hours
- Storage needed: ~13GB (R2) + ~50MB (D1)

### Phase 3: Complete API (2 hours)

1. Implement all endpoints (see `IMPLEMENTATION_PLAN.md` Phase 3)
2. Add proper error handling
3. Test thoroughly

### Phase 4: Full Frontend (2-3 hours)

1. Build complete UI with search, gallery, and detail pages
2. Add styling and responsive design
3. Test across devices

## Deployment Checklist

Before going live:

- [ ] All NFTs indexed and stored
- [ ] API endpoints tested and working
- [ ] Frontend tested in multiple browsers
- [ ] Custom domain configured (optional)
- [ ] Analytics set up (optional)
- [ ] Documentation updated with your URLs

## Testing Your Deployment

### 1. Test API Endpoints

```bash
# Get NFT by ID
curl https://your-worker.workers.dev/api/nft/0

# List NFTs
curl https://your-worker.workers.dev/api/nfts?page=1&limit=10

# Search
curl https://your-worker.workers.dev/api/search?q=Machine

# Get image
curl https://your-worker.workers.dev/api/image/0 > test.svg

# Get stats
curl https://your-worker.workers.dev/api/stats
```

### 2. Test Frontend

- [ ] Home page loads
- [ ] Search works
- [ ] Gallery displays NFTs
- [ ] Click NFT opens detail page
- [ ] Images load correctly
- [ ] Download button works
- [ ] Navigation works
- [ ] Mobile responsive

### 3. Performance Testing

Use Lighthouse or WebPageTest:
- [ ] Page load < 2s
- [ ] Lighthouse score > 90
- [ ] Images load efficiently
- [ ] No console errors

## Common First-Time Issues

### Issue: "Database not found"
**Solution**: Make sure you've created the D1 database and updated the `database_id` in `wrangler.toml`

### Issue: "CORS error in browser"
**Solution**: Add CORS headers to all Worker responses (see implementation examples)

### Issue: "RPC rate limit exceeded"
**Solution**: Add delays between requests or use a paid RPC provider

### Issue: "Image not loading"
**Solution**: Check that images are uploaded to R2 with correct filenames (tokenId.svg)

### Issue: "Deployment failed"
**Solution**: Run `wrangler login` again and ensure you're in the correct directory

## Next Steps After Deployment

1. **Share with NFT holders**: Post the URL in your community
2. **Gather feedback**: Ask users what they'd like to see
3. **Monitor usage**: Check Cloudflare Analytics
4. **Optimize**: Based on actual usage patterns
5. **Document**: Add any custom setup steps to README

## Cost Monitoring

Keep an eye on these metrics in Cloudflare Dashboard:

- **Workers Requests**: Should stay under 100k/day for free tier
- **D1 Reads**: Should stay under 5M/day for free tier
- **R2 Storage**: Free up to 10GB
- **R2 Operations**: 1M Class A, 10M Class B operations/month free

If approaching limits:
1. Check for inefficient queries or infinite loops
2. Implement more aggressive caching
3. Consider upgrading to paid tier (~$5/month)

## Getting Help

If you run into issues:

1. Check the [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
2. Check the [Cloudflare D1 docs](https://developers.cloudflare.com/d1/)
3. Check the [Cloudflare R2 docs](https://developers.cloudflare.com/r2/)
4. Search Cloudflare Community forums
5. Review this repo's issues (create one if needed)

## Success Metrics

After deployment, you should see:

- ✅ NFTs searchable and viewable
- ✅ Images loading in < 1 second
- ✅ Search results in < 500ms
- ✅ Zero or minimal monthly cost
- ✅ 99%+ uptime (Cloudflare SLA)
- ✅ Positive user feedback

## Tips for Success

1. **Start small**: Index 10-100 NFTs first to validate the approach
2. **Test locally**: Use `wrangler dev` to test Workers locally
3. **Use version control**: Commit changes frequently
4. **Document customizations**: Note any project-specific changes
5. **Monitor costs**: Check usage weekly for the first month

## Conclusion

This quick start should get you from zero to deployed in under 4 hours for a proof of concept, or a full day for a complete production-ready implementation.

The key is to start simple, validate each step, then build up to the full solution.

Good luck! 🚀
