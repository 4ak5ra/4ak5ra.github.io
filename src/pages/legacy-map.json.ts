import type { APIRoute } from 'astro';
import { postHref, publishedPosts } from '../lib/posts';

export const GET: APIRoute = async () => {
  const posts = await publishedPosts();
  const map: Record<string, string> = {};
  for (const post of posts) {
    const stem = post.id.split('/').pop() ?? post.id;
    map[stem] = postHref(post.id);
  }
  return new Response(JSON.stringify(map), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
