// Cloudflare Pages Function for clean NFT URLs: /nft/123
// Serves nft.html with dynamic meta tags based on token ID

const API_BASE = 'https://nft-api.simplethings.workers.dev';
const SITE_URL = 'https://diabolicalmachines.simplethin.gs';

interface NFTData {
  token_id: number;
  name: string;
  description: string;
}

export const onRequest: PagesFunction = async (context) => {
  const tokenId = context.params.id as string;

  // Validate token ID is a number
  if (!/^\d+$/.test(tokenId)) {
    return new Response('Invalid token ID', { status: 400 });
  }

  // Fetch the static nft.html
  const assetUrl = new URL('/nft.html', context.request.url);
  const response = await context.env.ASSETS.fetch(assetUrl);

  if (!response.ok) {
    return response;
  }

  // Fetch NFT data from API
  let nft: NFTData;
  try {
    const apiResponse = await fetch(`${API_BASE}/api/nft/${tokenId}`);
    if (!apiResponse.ok) {
      // Return page without dynamic meta if NFT not found
      return response;
    }
    nft = await apiResponse.json();
  } catch {
    return response;
  }

  // Get the HTML content
  let html = await response.text();

  // Build the meta tag replacements
  const pageUrl = `${SITE_URL}/nft/${tokenId}`;
  const imageUrl = `${SITE_URL}/img/${tokenId}.webp`;
  // Title: 50-60 chars optimal
  const title = `${nft.name} | On-Chain Animated NFT Collection`;
  // Description: 110-160 chars optimal
  const description = `View ${nft.name}. Resurrected from the blockchain—an on-chain animated NFT exploring the Worker in a Box, trapped and toiling forever.`;

  // Replace title
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(title)}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(description)}">`
  );

  // Replace OG tags
  html = html.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${pageUrl}">`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${escapeHtml(title)}">`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escapeHtml(description)}">`
  );
  html = html.replace(
    /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${imageUrl}">`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta property="twitter:url" content="[^"]*">/,
    `<meta property="twitter:url" content="${pageUrl}">`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`
  );
  html = html.replace(
    /<meta name="twitter:image" content="[^"]*">/,
    `<meta name="twitter:image" content="${imageUrl}">`
  );

  // Return modified HTML with long cache for HTML (it has unique meta per NFT)
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=86400', // 1 day cache for HTML
    },
  });
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
