export interface MenuItem {
  key: string;
  title: string;
  href: string;
  img: string;
  imgHover: string;
  x: number;
  y: number;
  featured?: boolean;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    key: 'posts',
    title: '文章',
    href: '/posts/',
    img: '/assets/images/btn/posts.jpg',
    imgHover: '/assets/images/btn/posts-hover.jpg',
    x: 10,
    y: 39,
    featured: true,
  },
  {
    key: 'category',
    title: '分类文章',
    href: '/category/',
    img: '/assets/images/btn/category.jpg',
    imgHover: '/assets/images/btn/category-hover.jpg',
    x: 23,
    y: 42,
  },
  {
    key: 'links',
    title: '友链',
    href: '/links/',
    img: '/assets/images/btn/links.jpg',
    imgHover: '/assets/images/btn/category-hover.jpg',
    x: 7,
    y: 67,
  },
  {
    key: 'about',
    title: '关于',
    href: '/about/',
    img: '/assets/images/btn/about.jpg',
    imgHover: '/assets/images/btn/category-hover.jpg',
    x: 18,
    y: 65,
  },
];
