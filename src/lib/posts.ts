import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

const DATE_RE = /(20\d{2})[-_. ](\d{1,2})[-_. ](\d{1,2})/;

export function categoryOf(post: PostEntry): string {
  return post.data.category ?? post.id.split('/')[0] ?? '未分类';
}

export function dateOf(post: PostEntry): Date {
  if (post.data.date) return post.data.date;
  const match = post.id.match(DATE_RE);
  if (!match) return new Date(0);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 10, 0, 0);
}

export function titleOf(post: PostEntry): string {
  return post.data.title?.trim() || post.id.split('/').pop() || post.id;
}

export function imageOf(post: PostEntry): string {
  const raw = (post.data.featured_image || post.data.featuredImage || '').replace(/\\/g, '/');
  const index = raw.indexOf('assets/');
  if (index >= 0) return `/${raw.slice(index)}`;
  return '/assets/images/btn/posts.jpg';
}

export function postHref(id: string): string {
  const path = id.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `/posts/${path}/`;
}

export function categoryHref(category = ''): string {
  if (!category) return '/category/';
  return `/category/${encodeURIComponent(category)}/`;
}

export function formatZh(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatEn(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function excerptOf(body: string | undefined, max = 160): string {
  if (!body) return '';
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, max);
}

export async function publishedPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts', ({ data }) => data.draft !== true);
  return posts.sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime());
}
