import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { categoryOf, dateOf, postHref, publishedPosts, titleOf } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await publishedPosts();
  return rss({
    title: "4ak5ra's Blog",
    description: "4ak5ra 的博客",
    site: context.site ?? 'https://4ak5ra.github.io',
    items: posts.map((post) => ({
      title: titleOf(post),
      pubDate: dateOf(post),
      link: postHref(post.id),
      categories: [categoryOf(post)],
      description: titleOf(post),
    })),
  });
}
