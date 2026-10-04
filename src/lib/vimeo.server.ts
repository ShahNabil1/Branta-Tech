// Server-only: resolves a Vimeo thumbnail through the public oEmbed endpoint (no API key). Cached per worker instance.
const cache = new Map<string, string | null>();

export async function vimeoThumb(id: string): Promise<string | null> {
  if (cache.has(id)) return cache.get(id)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(`https://vimeo.com/${id}`)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = res.ok ? ((await res.json()) as { thumbnail_url?: string }) : null;
    const url = j?.thumbnail_url && /^https:\/\//.test(j.thumbnail_url) ? j.thumbnail_url : null;
    cache.set(id, url);
    return url;
  } catch {
    return null;
  }
}
