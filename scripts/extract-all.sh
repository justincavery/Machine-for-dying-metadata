#!/bin/bash
# Extract all 6000 NFTs in batches

set -e

RPC_URL="${RPC_URL:-https://eth.llamarpc.com}"
BATCH_SIZE=25
TOTAL_SUPPLY=6000
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  NFT Batch Extraction Script"
echo "═══════════════════════════════════════════"
echo "RPC: $RPC_URL"
echo "Batch Size: $BATCH_SIZE"
echo "Total: $TOTAL_SUPPLY"
echo ""

cd "$PROJECT_ROOT"

# Function to update BatchExtract.t.sol with new range
update_batch_range() {
    local start=$1
    local end=$2

    sed -i.bak "s/uint256 constant START_TOKEN = [0-9]*;/uint256 constant START_TOKEN = $start;/" test/BatchExtract.t.sol
    sed -i.bak "s/uint256 constant END_TOKEN = [0-9]*;/uint256 constant END_TOKEN = $end;/" test/BatchExtract.t.sol
    rm -f test/BatchExtract.t.sol.bak
}

# Extract in batches
for ((start=0; start<TOTAL_SUPPLY; start+=BATCH_SIZE)); do
    end=$((start + BATCH_SIZE))
    if [ $end -gt $TOTAL_SUPPLY ]; then
        end=$TOTAL_SUPPLY
    fi

    echo ""
    echo "─────────────────────────────────────────"
    echo "Extracting tokens $start to $end..."
    echo "─────────────────────────────────────────"

    # Update the test file with new range
    update_batch_range $start $end

    # Extract images
    echo "Extracting images..."
    forge test --match-test testBatchExtractImages -vv \
        --rpc-url "$RPC_URL" \
        --gas-limit 18446744073709551615 \
        2>&1 | grep -E "(Token|Extracted|Error)" || true

    # Extract URIs
    echo "Extracting URIs..."
    forge test --match-test testBatchExtractURI -vv \
        --rpc-url "$RPC_URL" \
        --gas-limit 18446744073709551615 \
        2>&1 | grep -E "(Token|Extracted|Error)" || true

    # Progress
    extracted=$(ls -1 uri/*.txt 2>/dev/null | wc -l | tr -d ' ')
    echo "✓ Batch complete. Total extracted: $extracted"

    # Small delay to be nice to RPC
    sleep 1
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Extraction Complete!"
echo "═══════════════════════════════════════════"
echo "URIs: $(ls -1 uri/*.txt | wc -l)"
echo "Images: $(ls -1 images/*.svg | wc -l)"
echo ""
echo "Next steps:"
echo "  1. Generate thumbnails: cd scripts && npm run thumbnails"
echo "  2. Import to Cloudflare: cd scripts && npm run import"
