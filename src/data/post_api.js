/**
 * @file data source for posts (JSON as DB)
 */

/**
 * @returns {Promise<any[]>}
 */
export async function fetchPosts() {
  const url = new URL('../data/posts.json', window.location.href);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load posts.json: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('posts.json must be an array');
  return data;
}
