// Dynamic OG Image Generator for NFT pages
// Generates an SVG-based social sharing image with:
// - Blurred dark background
// - NFT thumbnail on the left
// - "Diabolical Machines" / "A Machine for Dying" / "#123" on the right

const SITE_URL = 'https://diabolicalmachines.simplethin.gs';

// OG Image dimensions (1200x630 is standard)
const WIDTH = 1200;
const HEIGHT = 630;

export const onRequest: PagesFunction = async (context) => {
  // Extract token ID from filename (e.g., "123.png" -> "123")
  const file = context.params.id as string;
  const tokenId = file.replace('.png', '');

  // Validate token ID
  if (!/^\d+$/.test(tokenId)) {
    return new Response('Invalid token ID', { status: 400 });
  }

  // Generate the SVG OG image
  const svg = generateOGImage(tokenId);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

function generateOGImage(tokenId: string): string {
  const nftImageUrl = `${SITE_URL}/img/${tokenId}.webp`;
  const bannerUrl = `${SITE_URL}/diabolical-machines-banner.jpg`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Blur filter for background -->
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="30"/>
    </filter>

    <!-- Gradient overlay for better text readability -->
    <linearGradient id="overlay" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgba(10,10,15,0.3)"/>
      <stop offset="40%" style="stop-color:rgba(10,10,15,0.7)"/>
      <stop offset="100%" style="stop-color:rgba(10,10,15,0.95)"/>
    </linearGradient>

    <!-- Shadow for NFT image -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>

  <!-- Dark base background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0a0f"/>

  <!-- Blurred banner background -->
  <image
    href="${bannerUrl}"
    x="-100" y="-100"
    width="${WIDTH + 200}" height="${HEIGHT + 200}"
    preserveAspectRatio="xMidYMid slice"
    filter="url(#blur)"
    opacity="0.4"
  />

  <!-- Gradient overlay -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#overlay)"/>

  <!-- NFT Image (left side) with shadow -->
  <g filter="url(#shadow)">
    <rect x="60" y="65" width="500" height="500" rx="16" fill="#1a1a1f"/>
    <clipPath id="nftClip">
      <rect x="60" y="65" width="500" height="500" rx="16"/>
    </clipPath>
    <image
      href="${nftImageUrl}"
      x="60" y="65"
      width="500" height="500"
      preserveAspectRatio="xMidYMid slice"
      clip-path="url(#nftClip)"
    />
  </g>

  <!-- Text content (right side) -->
  <g fill="white" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
    <!-- "Diabolical Machines" - smaller, muted -->
    <text x="620" y="220" font-size="28" font-weight="400" fill="rgba(255,255,255,0.6)">
      Diabolical Machines
    </text>

    <!-- "A Machine for Dying" - main title -->
    <text x="620" y="290" font-size="42" font-weight="700" fill="white">
      A Machine for Dying
    </text>

    <!-- Token number - large, prominent -->
    <text x="620" y="400" font-size="96" font-weight="800" fill="white">
      #${tokenId}
    </text>

    <!-- Tagline -->
    <text x="620" y="480" font-size="22" font-weight="400" fill="rgba(255,255,255,0.5)">
      On-Chain Animated NFT
    </text>
  </g>

  <!-- Subtle border -->
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
</svg>`;
}
