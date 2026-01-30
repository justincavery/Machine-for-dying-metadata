export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
}

interface NFTRow {
  token_id: number;
  name: string;
  description: string;
  image_cid: string;
  metadata_json: string;
  created_at: string;
}

interface AttributeRow {
  trait_type: string;
  value: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

async function handleGetNFT(tokenId: string, env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM nfts WHERE token_id = ?'
  ).bind(tokenId).first<NFTRow>();

  if (!result) {
    return errorResponse('NFT not found', 404);
  }

  const attributes = await env.DB.prepare(
    'SELECT trait_type, value FROM attributes WHERE token_id = ?'
  ).bind(tokenId).all<AttributeRow>();

  return jsonResponse({
    token_id: result.token_id,
    name: result.name,
    description: result.description,
    image_url: `/api/image/${result.token_id}`,
    attributes: attributes.results,
    metadata: JSON.parse(result.metadata_json || '{}'),
  });
}

async function handleListNFTs(url: URL, env: Env): Promise<Response> {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const nfts = await env.DB.prepare(
    'SELECT token_id, name, image_cid FROM nfts ORDER BY token_id LIMIT ? OFFSET ?'
  ).bind(limit, offset).all<NFTRow>();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM nfts'
  ).first<{ count: number }>();

  const totalCount = total?.count || 0;

  return jsonResponse({
    nfts: nfts.results?.map(nft => ({
      token_id: nft.token_id,
      name: nft.name,
      image_url: `/api/image/${nft.token_id}`,
      thumb_url: `/api/thumb/${nft.token_id}`,
    })) || [],
    total: totalCount,
    page,
    limit,
    hasMore: offset + limit < totalCount,
  });
}

async function handleSearch(url: URL, env: Env): Promise<Response> {
  const q = url.searchParams.get('q');
  const traitType = url.searchParams.get('trait_type');
  const traitValue = url.searchParams.get('trait_value');
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  let query = 'SELECT DISTINCT n.token_id, n.name, n.image_cid FROM nfts n';
  const bindings: (string | number)[] = [];
  const conditions: string[] = [];

  if (traitType || traitValue) {
    query += ' JOIN attributes a ON n.token_id = a.token_id';
    if (traitType) {
      conditions.push('a.trait_type = ?');
      bindings.push(traitType);
    }
    if (traitValue) {
      conditions.push('a.value = ?');
      bindings.push(traitValue);
    }
  }

  if (q) {
    // Check if it's a number (token ID search)
    const tokenNum = parseInt(q);
    if (!isNaN(tokenNum)) {
      conditions.push('n.token_id = ?');
      bindings.push(tokenNum);
    } else {
      conditions.push('n.name LIKE ?');
      bindings.push(`%${q}%`);
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY n.token_id LIMIT ?';
  bindings.push(limit);

  const results = await env.DB.prepare(query).bind(...bindings).all<NFTRow>();

  return jsonResponse({
    results: results.results?.map(nft => ({
      token_id: nft.token_id,
      name: nft.name,
      image_url: `/api/image/${nft.token_id}`,
      thumb_url: `/api/thumb/${nft.token_id}`,
    })) || [],
    query: { q, trait_type: traitType, trait_value: traitValue },
  });
}

async function handleGetImage(tokenId: string, env: Env): Promise<Response> {
  const key = `${tokenId}.svg`;
  const object = await env.IMAGES.get(key);

  if (!object) {
    return new Response('Image not found', { status: 404, headers: corsHeaders });
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

async function handleGetThumbnail(tokenId: string, env: Env): Promise<Response> {
  const key = `thumb/${tokenId}.webp`;
  const object = await env.IMAGES.get(key);

  if (!object) {
    // Fallback to full image if thumbnail doesn't exist
    return handleGetImage(tokenId, env);
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600',  // 1 hour during dev, increase later
    },
  });
}

async function handleGetOGImage(tokenId: string, env: Env): Promise<Response> {
  const key = `og/${tokenId}.jpg`;
  const object = await env.IMAGES.get(key);

  if (!object) {
    return new Response('OG image not found', { status: 404, headers: corsHeaders });
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

async function handleStats(env: Env): Promise<Response> {
  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM nfts'
  ).first<{ count: number }>();

  const traitCounts = await env.DB.prepare(
    'SELECT trait_type, COUNT(DISTINCT token_id) as count FROM attributes GROUP BY trait_type ORDER BY count DESC'
  ).all<{ trait_type: string; count: number }>();

  const traitValues = await env.DB.prepare(
    'SELECT trait_type, value, COUNT(*) as count FROM attributes GROUP BY trait_type, value ORDER BY trait_type, count DESC'
  ).all<{ trait_type: string; value: string; count: number }>();

  // Group trait values by type
  const traitsByType: Record<string, Array<{ value: string; count: number }>> = {};
  for (const row of traitValues.results || []) {
    if (!traitsByType[row.trait_type]) {
      traitsByType[row.trait_type] = [];
    }
    traitsByType[row.trait_type].push({ value: row.value, count: row.count });
  }

  return jsonResponse({
    total_nfts: total?.count || 0,
    traits: traitCounts.results || [],
    trait_values: traitsByType,
  });
}

async function handleAttributes(env: Env): Promise<Response> {
  const traits = await env.DB.prepare(
    'SELECT DISTINCT trait_type FROM attributes ORDER BY trait_type'
  ).all<{ trait_type: string }>();

  return jsonResponse({
    trait_types: traits.results?.map(t => t.trait_type) || [],
  });
}

async function handleAttributeValues(traitType: string, env: Env): Promise<Response> {
  const values = await env.DB.prepare(
    'SELECT value, COUNT(*) as count FROM attributes WHERE trait_type = ? GROUP BY value ORDER BY count DESC'
  ).bind(traitType).all<{ value: string; count: number }>();

  return jsonResponse({
    trait_type: traitType,
    values: values.results || [],
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    try {
      // API Routes
      if (path === '/api/nfts') {
        return handleListNFTs(url, env);
      }

      if (path === '/api/search') {
        return handleSearch(url, env);
      }

      if (path === '/api/stats') {
        return handleStats(env);
      }

      if (path === '/api/attributes') {
        return handleAttributes(env);
      }

      // /api/attributes/:traitType
      const attrMatch = path.match(/^\/api\/attributes\/(.+)$/);
      if (attrMatch) {
        return handleAttributeValues(decodeURIComponent(attrMatch[1]), env);
      }

      // /api/nft/:tokenId
      const nftMatch = path.match(/^\/api\/nft\/(\d+)$/);
      if (nftMatch) {
        return handleGetNFT(nftMatch[1], env);
      }

      // /api/image/:tokenId
      const imageMatch = path.match(/^\/api\/image\/(\d+)$/);
      if (imageMatch) {
        return handleGetImage(imageMatch[1], env);
      }

      // /api/thumb/:tokenId - static thumbnail (WebP)
      const thumbMatch = path.match(/^\/api\/thumb\/(\d+)$/);
      if (thumbMatch) {
        return handleGetThumbnail(thumbMatch[1], env);
      }

      // /api/og/:tokenId - OG image (PNG)
      const ogMatch = path.match(/^\/api\/og\/(\d+)$/);
      if (ogMatch) {
        return handleGetOGImage(ogMatch[1], env);
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      // Root - API documentation
      if (path === '/' || path === '/api') {
        return jsonResponse({
          name: 'A Machine For Dying - NFT API',
          version: '1.0.0',
          endpoints: {
            'GET /api/nfts': 'List NFTs (params: page, limit)',
            'GET /api/nft/:tokenId': 'Get NFT details',
            'GET /api/image/:tokenId': 'Get NFT image (animated SVG)',
            'GET /api/thumb/:tokenId': 'Get NFT thumbnail (static WebP)',
            'GET /api/og/:tokenId': 'Get OG image for social sharing (PNG)',
            'GET /api/search': 'Search NFTs (params: q, trait_type, trait_value)',
            'GET /api/stats': 'Get collection statistics',
            'GET /api/attributes': 'List all trait types',
            'GET /api/attributes/:traitType': 'Get values for a trait type',
            'GET /api/health': 'Health check',
          },
        });
      }

      return errorResponse('Not found', 404);
    } catch (error) {
      console.error('API Error:', error);
      return errorResponse('Internal server error', 500);
    }
  },
};
