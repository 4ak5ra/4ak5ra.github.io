<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reveal.js 示例</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.3.1/reveal.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.3.1/reveal.min.js"></script>
    <style>
        section {
            position: relative; /* 使 section 成为定位上下文 */
            height: 100vh; /* 设置高度为视口高度 */
        }
        h2 {
            position: absolute; /* 绝对定位 */
            top: 20px; /* 距离顶部 20px */
            left: 20px; /* 距离左边 20px */
            color: white; /* 设置文本颜色为白色 */
            margin: 0; /* 去掉默认边距 */
        }
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
            <section data-background-image="https://s2.loli.net/2024/12/26/wjM3InBDafFsbkQ.png" data-background-opacity="0.7">
                <h2>welcome!</h2>
            </section>
        </div>
    </div>
    <script>
        Reveal.initialize();
    </script>
</body>
</html>