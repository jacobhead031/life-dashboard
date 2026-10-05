// Stock covers for the life list. Server only: the key has no NEXT_PUBLIC_ prefix.
// Without UNSPLASH_ACCESS_KEY the wall falls back to the per-category gradients.
export const hasUnsplash = () => !!process.env.UNSPLASH_ACCESS_KEY;

export async function findCover(query: string): Promise<{ url: string; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://api.unsplash.com/search/photos?per_page=1&orientation=portrait&content_filter=high&query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Unsplash search failed (${res.status})`);
  const photo = (await res.json()).results?.[0];
  return photo ? { url: photo.urls.regular, credit: `${photo.user.name} / Unsplash` } : null;
}
