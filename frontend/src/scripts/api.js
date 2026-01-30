// API Configuration
// Use the deployed Workers API
const API_BASE = 'https://nft-api.simplethings.workers.dev';

export async function fetchNFT(tokenId) {
  const response = await fetch(`${API_BASE}/api/nft/${tokenId}`);
  if (!response.ok) {
    throw new Error('NFT not found');
  }
  return response.json();
}

export async function fetchNFTs(page = 1, limit = 20) {
  const response = await fetch(`${API_BASE}/api/nfts?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch NFTs');
  }
  return response.json();
}

export async function searchNFTs(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.trait_type) searchParams.set('trait_type', params.trait_type);
  if (params.trait_value) searchParams.set('trait_value', params.trait_value);
  if (params.limit) searchParams.set('limit', params.limit);

  const response = await fetch(`${API_BASE}/api/search?${searchParams}`);
  if (!response.ok) {
    throw new Error('Search failed');
  }
  return response.json();
}

export async function fetchStats() {
  const response = await fetch(`${API_BASE}/api/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}

export async function fetchAttributes() {
  const response = await fetch(`${API_BASE}/api/attributes`);
  if (!response.ok) {
    throw new Error('Failed to fetch attributes');
  }
  return response.json();
}

export async function fetchAttributeValues(traitType) {
  const response = await fetch(`${API_BASE}/api/attributes/${encodeURIComponent(traitType)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch attribute values');
  }
  return response.json();
}

export function getImageURL(tokenId) {
  return `/img/${tokenId}.svg`;
}

export function getThumbURL(tokenId) {
  return `/img/${tokenId}.webp`;
}

export function getNFTPageURL(tokenId) {
  return `/nft/${tokenId}`;
}
