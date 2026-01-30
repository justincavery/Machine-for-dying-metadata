// Cloudflare Pages Function for clean image URLs with aggressive caching
// /img/123.svg -> animated SVG
// /img/123.webp -> thumbnail

const API_BASE = 'https://nft-api.simplethings.workers.dev';

// 1 year cache - these images never change
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
};

export const onRequest: PagesFunction = async (context) => {
  const file = context.params.file as string;

  // Parse filename: expecting "123.svg" or "123.webp"
  const match = file.match(/^(\d+)\.(svg|webp)$/);

  if (!match) {
    return new Response('Invalid image path. Use /img/{id}.svg or /img/{id}.webp', {
      status: 400
    });
  }

  const [, tokenId, extension] = match;

  // Determine API endpoint based on extension
  const apiPath = extension === 'svg'
    ? `/api/image/${tokenId}`
    : `/api/thumb/${tokenId}`;

  try {
    const response = await fetch(`${API_BASE}${apiPath}`);

    if (!response.ok) {
      return new Response('Image not found', { status: 404 });
    }

    const contentType = extension === 'svg' ? 'image/svg+xml' : 'image/webp';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        ...CACHE_HEADERS,
      },
    });
  } catch (error) {
    return new Response('Failed to fetch image', { status: 500 });
  }
};
