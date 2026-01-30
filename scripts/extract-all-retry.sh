#!/bin/bash
# Extract all NFTs with retry logic and resume capability
# URIs are extracted one at a time (they're large), images in batches

set -e

RPC_URL="${RPC_URL:-https://eth.llamarpc.com}"
TOTAL_SUPPLY="${TOTAL_SUPPLY:-6000}"
IMAGE_BATCH_SIZE=25
MAX_RETRIES=3
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED_LOG="$PROJECT_ROOT/extraction_failures.log"

echo "═══════════════════════════════════════════"
echo "  NFT Extraction Script (with retry)"
echo "═══════════════════════════════════════════"
echo "RPC: $RPC_URL"
echo "Total: $TOTAL_SUPPLY"
echo ""

cd "$PROJECT_ROOT"

# Ensure output directories exist
mkdir -p uri images

# Function to extract a single URI
extract_uri() {
    local token_id=$1
    local output_file="uri/${token_id}.txt"

    # Skip if already exists
    if [ -f "$output_file" ]; then
        return 0
    fi

    TOKEN_ID=$token_id forge test --match-test testExtractSingleURI -vv \
        --rpc-url "$RPC_URL" \
        2>&1 | grep -q "SUCCESS:" && return 0 || return 1
}

# Function to extract images in batch by updating BatchExtract.t.sol
extract_images_batch() {
    local start=$1
    local end=$2

    # Update the test file with new range
    sed -i.bak "s/uint256 constant START_TOKEN = [0-9]*;/uint256 constant START_TOKEN = $start;/" test/BatchExtract.t.sol
    sed -i.bak "s/uint256 constant END_TOKEN = [0-9]*;/uint256 constant END_TOKEN = $end;/" test/BatchExtract.t.sol
    rm -f test/BatchExtract.t.sol.bak

    forge test --match-test testBatchExtractImages -vv \
        --rpc-url "$RPC_URL" \
        2>&1 | grep -E "Extracted image:" || true
}

# Function to check which tokens are missing
get_missing_tokens() {
    local type=$1  # "uri" or "images"
    local ext=$2   # ".txt" or ".svg"
    local dir=$3   # "uri" or "images"

    local missing=()
    for ((i=0; i<TOTAL_SUPPLY; i++)); do
        if [ ! -f "${dir}/${i}${ext}" ]; then
            missing+=($i)
        fi
    done
    echo "${missing[@]}"
}

# Clear previous failure log
> "$FAILED_LOG"

echo ""
echo "═══════════════════════════════════════════"
echo "  Phase 1: Extract Images (batch mode)"
echo "═══════════════════════════════════════════"

for ((start=0; start<TOTAL_SUPPLY; start+=IMAGE_BATCH_SIZE)); do
    end=$((start + IMAGE_BATCH_SIZE))
    if [ $end -gt $TOTAL_SUPPLY ]; then
        end=$TOTAL_SUPPLY
    fi

    # Check how many are already done in this range
    done_count=0
    for ((i=start; i<end; i++)); do
        [ -f "images/${i}.svg" ] && ((done_count++)) || true
    done

    if [ $done_count -eq $((end - start)) ]; then
        echo "Batch $start-$end: Already complete, skipping"
        continue
    fi

    echo "Extracting images $start to $end..."
    extract_images_batch $start $end

    # Progress
    extracted=$(ls -1 images/*.svg 2>/dev/null | wc -l | tr -d ' ')
    echo "  Progress: $extracted / $TOTAL_SUPPLY images"

    sleep 0.5
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Phase 2: Extract URIs (one at a time)"
echo "═══════════════════════════════════════════"

uri_count=0
failed_uris=()

for ((token_id=0; token_id<TOTAL_SUPPLY; token_id++)); do
    # Skip if already exists
    if [ -f "uri/${token_id}.txt" ]; then
        ((uri_count++))
        continue
    fi

    # Progress every 50 tokens
    if [ $((token_id % 50)) -eq 0 ]; then
        echo "Progress: $uri_count / $TOTAL_SUPPLY URIs extracted"
    fi

    # Try extraction with retries
    success=false
    for ((retry=1; retry<=MAX_RETRIES; retry++)); do
        if extract_uri $token_id; then
            success=true
            ((uri_count++))
            echo "  Extracted URI: $token_id"
            break
        else
            echo "  Retry $retry/$MAX_RETRIES for token $token_id..."
            sleep 1
        fi
    done

    if [ "$success" = false ]; then
        echo "  FAILED: token $token_id (after $MAX_RETRIES retries)"
        failed_uris+=($token_id)
        echo "URI:$token_id" >> "$FAILED_LOG"
    fi

    # Small delay between extractions
    sleep 0.2
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Phase 3: Retry failed extractions"
echo "═══════════════════════════════════════════"

# Check for missing images
missing_images=($(get_missing_tokens "images" ".svg" "images"))
if [ ${#missing_images[@]} -gt 0 ]; then
    echo "Retrying ${#missing_images[@]} missing images..."
    for token_id in "${missing_images[@]}"; do
        for ((retry=1; retry<=MAX_RETRIES; retry++)); do
            # Extract single image using SingleExtract
            if TOKEN_ID=$token_id forge test --match-test testExtractSingleImage -vv \
                --rpc-url "$RPC_URL" 2>&1 | grep -q "SUCCESS:"; then
                echo "  Extracted image: $token_id"
                break
            else
                echo "  Retry $retry/$MAX_RETRIES for image $token_id..."
                sleep 1
            fi
        done

        if [ ! -f "images/${token_id}.svg" ]; then
            echo "IMAGE:$token_id" >> "$FAILED_LOG"
        fi
    done
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Extraction Complete!"
echo "═══════════════════════════════════════════"
uri_final=$(ls -1 uri/*.txt 2>/dev/null | wc -l | tr -d ' ')
img_final=$(ls -1 images/*.svg 2>/dev/null | wc -l | tr -d ' ')
echo "URIs:   $uri_final / $TOTAL_SUPPLY"
echo "Images: $img_final / $TOTAL_SUPPLY"

if [ -s "$FAILED_LOG" ]; then
    echo ""
    echo "FAILURES logged to: $FAILED_LOG"
    echo "Failed tokens:"
    cat "$FAILED_LOG"
fi

echo ""
echo "Next steps:"
echo "  1. Generate thumbnails: cd scripts && npm run thumbnails"
echo "  2. Import to Cloudflare: cd scripts && npm run import"
