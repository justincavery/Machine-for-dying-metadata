import { fetchNFT, getImageURL } from './api.js';

// Get token ID from URL
const params = new URLSearchParams(window.location.search);
const tokenId = params.get('id');

// DOM Elements
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('nftContent');
const errorEl = document.getElementById('error');
const nftImage = document.getElementById('nftImage');
const nftName = document.getElementById('nftName');
const nftDescription = document.getElementById('nftDescription');
const tokenIdEl = document.getElementById('tokenId');
const attributesEl = document.getElementById('attributes');
const downloadBtn = document.getElementById('downloadBtn');
const openNewTab = document.getElementById('openNewTab');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

async function loadNFT() {
  if (!tokenId) {
    showError();
    return;
  }

  try {
    const nft = await fetchNFT(tokenId);

    // Update page title
    document.title = `${nft.name} - A Machine For Dying`;

    // Populate content
    nftImage.src = getImageURL(nft.token_id);
    nftImage.alt = nft.name;
    nftName.textContent = nft.name;
    nftDescription.textContent = nft.description || '';
    tokenIdEl.textContent = nft.token_id;

    // Set up image actions
    const imageUrl = getImageURL(nft.token_id);
    openNewTab.href = imageUrl;

    // Populate attributes
    attributesEl.innerHTML = '';
    if (nft.attributes && nft.attributes.length > 0) {
      nft.attributes.forEach(attr => {
        const attrEl = document.createElement('a');
        attrEl.className = 'attribute';
        attrEl.href = `/?trait_type=${encodeURIComponent(attr.trait_type)}&trait_value=${encodeURIComponent(attr.value)}`;
        attrEl.innerHTML = `
          <span class="trait-type">${attr.trait_type}</span>
          <span class="trait-value">${attr.value}</span>
        `;
        attributesEl.appendChild(attrEl);
      });
    } else {
      attributesEl.innerHTML = '<p>No attributes</p>';
    }

    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'grid';

  } catch (error) {
    console.error('Failed to load NFT:', error);
    showError();
  }
}

function showError() {
  loadingEl.style.display = 'none';
  errorEl.style.display = 'block';
}

// Download functionality
downloadBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(getImageURL(tokenId));
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `machine-for-dying-${tokenId}.svg`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    alert('Failed to download image');
  }
});

// Navigation
prevBtn.addEventListener('click', () => {
  const prev = parseInt(tokenId) - 1;
  if (prev >= 0) {
    window.location.href = `/nft.html?id=${prev}`;
  }
});

nextBtn.addEventListener('click', () => {
  const next = parseInt(tokenId) + 1;
  window.location.href = `/nft.html?id=${next}`;
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    prevBtn.click();
  } else if (e.key === 'ArrowRight') {
    nextBtn.click();
  }
});

// Initialize
loadNFT();
