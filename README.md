# A Machine For Dying - NFT Metadata Viewer

This repository contains tools for viewing and accessing metadata for the "A Machine For Dying" NFT collection.

## 🎯 Project Overview

This project aims to restore public access to NFT metadata and images using cost-effective Cloudflare infrastructure. The original viewer was shut down due to prohibitive hosting costs. This new implementation leverages Cloudflare's generous free tier to provide a sustainable, long-term solution.

**Key Features:**
- 🔍 Search NFTs by token ID, name, or attributes
- 🖼️ View high-resolution SVG images
- ⬇️ Download NFT images
- 🌐 Fast global access via Cloudflare edge network
- 💰 Minimal cost ($0-5/month)

## 📚 Documentation

This repository contains comprehensive documentation for implementing the NFT viewer:

### Planning & Requirements
- **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)** - High-level overview for stakeholders (start here!)
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** - Detailed requirements and architecture for the Cloudflare-based solution
- **[TECH_STACK_COMPARISON.md](./TECH_STACK_COMPARISON.md)** - Comparison of different hosting options and why Cloudflare was chosen
- **[COST_ESTIMATES.md](./COST_ESTIMATES.md)** - Detailed time and cost analysis

### Implementation Guides
- **[PRE_IMPLEMENTATION_CHECKLIST.md](./PRE_IMPLEMENTATION_CHECKLIST.md)** - ⭐ **Ready to build? Start here!** What you need before beginning
- **[GITHUB_VS_CLAUDE.md](./GITHUB_VS_CLAUDE.md)** - Should you use GitHub Copilot or Claude? Decision guide
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Step-by-step implementation guide with code examples
- **[QUICK_START.md](./QUICK_START.md)** - Get started quickly with a proof of concept

## 🚀 Quick Start

### Planning Phase (You Are Here ✅)
**New here?** Start with the [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) for a high-level overview.

**Evaluating options?** See [TECH_STACK_COMPARISON.md](./TECH_STACK_COMPARISON.md) for alternatives.

### Implementation Phase (Ready to Build? 🏗️)

**🎯 Ready to proceed with the build?**
1. **First:** Complete [PRE_IMPLEMENTATION_CHECKLIST.md](./PRE_IMPLEMENTATION_CHECKLIST.md)
   - What information is needed
   - Cloudflare account setup
   - Resource creation steps

2. **Second:** Review [GITHUB_VS_CLAUDE.md](./GITHUB_VS_CLAUDE.md)
   - Should you use GitHub Copilot or Claude locally?
   - Comparison and recommendation
   - Workflow for each approach

3. **Third:** Follow [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
   - Phase-by-phase implementation guide
   - Complete code examples
   - Testing and deployment

4. **Alternative:** Use [QUICK_START.md](./QUICK_START.md) for a 30-minute proof of concept

## 🛠️ Current Repository Tools

This repository includes Foundry-based tools for extracting NFT metadata from the Ethereum blockchain:

### Install Foundry
https://book.getfoundry.sh/getting-started/installation

### Clone the repo
```bash
git clone https://github.com/justincavery/Machine-for-dying-metadata.git
cd Machine-for-dying-metadata
```

### Extract Metadata for Specific Token

Edit the `tokenId` variable in `test/Metadata.t.sol` to choose which token to extract.

**Get the URI for a specific token:**
```bash
forge test --match-test testGetTokenURI -vv --rpc-url wss://mainnet.gateway.tenderly.co
```
Result will be saved in the `uri/` folder.

**Get the image for a specific token:**
```bash
forge test --match-test testWriteImage -vv --rpc-url wss://mainnet.gateway.tenderly.co
```
Result will be saved in the `images/` folder.

**Get both URI and image:**
```bash
forge test -vv --rpc-url wss://mainnet.gateway.tenderly.co
```

## 📊 Smart Contract Information

- **NFT Contract (Clifford)**: `0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C`
- **Metadata Contract**: `0x248B1149203933c1B08E985aD67138AF0dDd1b94`
- **Network**: Ethereum Mainnet
- **Metadata**: On-chain, base64-encoded JSON with embedded SVG images

## 🏗️ Proposed Architecture

The new implementation uses:
- **Cloudflare Pages** - Static site hosting (free)
- **Cloudflare Workers** - Serverless API (free tier: 100k requests/day)
- **Cloudflare D1** - Serverless SQL database (free tier: 5GB storage)
- **Cloudflare R2** - Object storage for images (free tier: 10GB)

See [REQUIREMENTS.md](./REQUIREMENTS.md) for detailed architecture information.

## 💡 Why This Approach?

1. **Cost-effective**: Can operate entirely on free tier or ~$5/month
2. **Performant**: Global edge network for fast access worldwide
3. **Scalable**: Handles traffic spikes automatically
4. **Maintainable**: Minimal ongoing maintenance required
5. **Secure**: Built-in DDoS protection and security features

See [TECH_STACK_COMPARISON.md](./TECH_STACK_COMPARISON.md) for comparison with other options.

## 📝 Implementation Status

- [x] Requirements analysis complete
- [x] Architecture designed
- [x] Implementation plan documented
- [ ] Infrastructure setup (Cloudflare account, D1, R2)
- [ ] Data indexing (extract all NFT metadata)
- [ ] API development (Cloudflare Workers)
- [ ] Frontend development (Cloudflare Pages)
- [ ] Testing and deployment

## 🤝 Contributing

Contributions are welcome! If you'd like to help implement this solution:

1. Review the documentation
2. Pick a phase from the implementation plan
3. Submit a pull request with your contribution

## 📄 License

This project is open source and available for anyone to use and modify.

## 🔗 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

## ❓ Questions?

Review the documentation files in this repository. If you have questions not covered there, please open an issue.
