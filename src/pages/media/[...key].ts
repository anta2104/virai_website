import type { APIRoute } from 'astro';
import { env } from '../../lib/env';

/**
 * Phục vụ ảnh/video từ R2. Key chứa UUID nên không đoán được;
 * object là bất biến (mỗi lần sửa ảnh sẽ sinh key mới) nên cache dài hạn.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const bucket = env.BUCKET;
  const object = await bucket.get(key, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  if (!('body' in object) || object.body === null) {
    // Trả về 304 hoặc 206 không kèm body
    return new Response(null, { status: 304, headers });
  }

  const status = request.headers.has('range') ? 206 : 200;
  if (status === 206 && object.range) {
    const range = object.range as { offset?: number; length?: number; suffix?: number };
    if (range.offset !== undefined && range.length !== undefined) {
      headers.set(
        'content-range',
        `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
      );
    }
  }

  return new Response(object.body, { status, headers });
};
