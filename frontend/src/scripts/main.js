import { fetchNFTs, searchNFTs, fetchStats, fetchAttributes, fetchAttributeValues, getImageURL } from './api.js';

// State
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentSearch = null;
let currentFilters = { trait_type: null, trait_value: null };

// DOM Elements
const grid = document.getElementById('nftGrid');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const loadMoreButton = document.getElementById('loadMore');
const loadingIndicator = document.getElementById('loading');
const statsBar = document.getElementById('statsBar');
const totalCount = document.getElementById('totalCount');
const traitFilter = document.getElementById('traitFilter');
const valueFilter = document.getElementById('valueFilter');
const clearFilters = document.getElementById('clearFilters');

// Initialize
async function init() {
  await Promise.all([
    loadStats(),
    loadTraitFilters(),
    loadNFTs(),
  ]);

  setupEventListeners();
}

function setupEventListeners() {
  searchButton.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  loadMoreButton.addEventListener('click', () => {
    currentPage++;
    loadNFTs();
  });

  traitFilter.addEventListener('change', handleTraitFilterChange);
  valueFilter.addEventListener('change', handleValueFilterChange);
  clearFilters.addEventListener('click', handleClearFilters);
}

async function loadStats() {
  try {
    const stats = await fetchStats();
    totalCount.textContent = `${stats.total_nfts.toLocaleString()} NFTs in collection`;
  } catch (error) {
    totalCount.textContent = 'Collection';
  }
}

async function loadTraitFilters() {
  try {
    const { trait_types } = await fetchAttributes();
    traitFilter.innerHTML = '<option value="">Filter by trait...</option>';
    for (const trait of trait_types) {
      const option = document.createElement('option');
      option.value = trait;
      option.textContent = trait;
      traitFilter.appendChild(option);
    }
  } catch (error) {
    console.error('Failed to load traits:', error);
  }
}

async function handleTraitFilterChange() {
  const traitType = traitFilter.value;

  if (!traitType) {
    valueFilter.innerHTML = '<option value="">Select trait first...</option>';
    valueFilter.disabled = true;
    return;
  }

  valueFilter.innerHTML = '<option value="">Loading...</option>';
  valueFilter.disabled = true;

  try {
    const { values } = await fetchAttributeValues(traitType);
    valueFilter.innerHTML = '<option value="">Select value...</option>';
    for (const item of values) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = `${item.value} (${item.count})`;
      valueFilter.appendChild(option);
    }
    valueFilter.disabled = false;
  } catch (error) {
    valueFilter.innerHTML = '<option value="">Error loading values</option>';
  }
}

async function handleValueFilterChange() {
  const traitType = traitFilter.value;
  const traitValue = valueFilter.value;

  if (!traitType || !traitValue) return;

  currentFilters = { trait_type: traitType, trait_value: traitValue };
  currentSearch = null;
  searchInput.value = '';
  clearFilters.style.display = 'inline-block';

  await performSearch();
}

async function handleClearFilters() {
  currentFilters = { trait_type: null, trait_value: null };
  currentSearch = null;
  traitFilter.value = '';
  valueFilter.value = '';
  valueFilter.disabled = true;
  valueFilter.innerHTML = '<option value="">Select trait first...</option>';
  clearFilters.style.display = 'none';

  currentPage = 1;
  hasMore = true;
  grid.innerHTML = '';
  await loadNFTs();
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    await handleClearFilters();
    return;
  }

  currentSearch = query;
  currentFilters = { trait_type: null, trait_value: null };
  traitFilter.value = '';
  valueFilter.value = '';
  valueFilter.disabled = true;
  clearFilters.style.display = 'inline-block';

  await performSearch();
}

async function performSearch() {
  grid.innerHTML = '';
  loadMoreButton.style.display = 'none';
  showLoading(true);

  try {
    const params = { limit: 50 };
    if (currentSearch) params.q = currentSearch;
    if (currentFilters.trait_type) params.trait_type = currentFilters.trait_type;
    if (currentFilters.trait_value) params.trait_value = currentFilters.trait_value;

    const data = await searchNFTs(params);

    if (data.results.length === 0) {
      grid.innerHTML = '<div class="no-results">No NFTs found matching your search.</div>';
    } else {
      data.results.forEach(nft => {
        grid.appendChild(createNFTCard(nft));
      });
    }
  } catch (error) {
    grid.innerHTML = '<div class="error">Failed to search. Please try again.</div>';
  }

  showLoading(false);
}

async function loadNFTs() {
  if (isLoading || !hasMore) return;

  isLoading = true;
  showLoading(true);

  try {
    const data = await fetchNFTs(currentPage, 20);

    data.nfts.forEach(nft => {
      grid.appendChild(createNFTCard(nft));
    });

    hasMore = data.hasMore;
    loadMoreButton.style.display = hasMore ? 'block' : 'none';
  } catch (error) {
    console.error('Failed to load NFTs:', error);
    if (currentPage === 1) {
      grid.innerHTML = '<div class="error">Failed to load NFTs. Please refresh the page.</div>';
    }
  }

  isLoading = false;
  showLoading(false);
}

function createNFTCard(nft) {
  const card = document.createElement('div');
  card.className = 'nft-card';

  const img = document.createElement('img');
  img.src = getImageURL(nft.token_id);
  img.alt = nft.name;
  img.loading = 'lazy';

  const info = document.createElement('div');
  info.className = 'nft-card-info';
  info.innerHTML = `<h3>${nft.name}</h3>`;

  card.appendChild(img);
  card.appendChild(info);

  card.addEventListener('click', () => {
    window.location.href = `/nft.html?id=${nft.token_id}`;
  });

  return card;
}

function showLoading(show) {
  loadingIndicator.style.display = show ? 'block' : 'none';
}

// Start the app
init();
