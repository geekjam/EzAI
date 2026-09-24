# 构思脑图预览工具（.ai/think）

一个本地实时预览的思维导图工具，用于 **头脑风暴**。AI 助手在和你聊的过程中把想法实时写进 `think.json`，浏览器自动重绘，边聊边看。

本目录从 `E:/MyWork/swdt`（复古思维导图）抽离而来，去掉了多主题切换，改为单一数据文件 `think.json`，并默认只监听本机。

---

## 快速开始

在**项目根目录**执行：

```bash
python .ai/think/server.py
```

然后打开 <http://localhost:8787>。

需要 **Python 3.9+**，无需安装任何依赖，无需构建。

---

## 启动参数

```bash
python .ai/think/server.py --port 3000        # 指定端口（默认 8787）
python .ai/think/server.py --no-watch         # 关闭热更新
python .ai/think/server.py --interval 2       # 轮询间隔 2 秒（默认 1 秒）
python .ai/think/server.py --host 0.0.0.0     # 允许局域网访问（默认仅本机）
```

默认绑定 `127.0.0.1`，仅本机可访问。加 `--host 0.0.0.0` 后同网段设备也能打开，**不要暴露到公网**。

---

## 目录内容

| 文件 | 说明 |
|---|---|
| `server.py` | Python 标准库 HTTP 服务器：静态文件白名单 + SSE 热更新 + `/api/data` |
| `index.html` | 复古纸张风格的页面骨架、样式、缩放控件 |
| `mindmap.js` | 自适应布局引擎（放射 / 纵向 / 横向）、SVG 连线、缩放平移、SSE 客户端 |
| `think.json` | 当前构思脑图数据，AI 实时更新此文件 |
| `README.md` | 本文件 |

---

## 热更新

服务器每秒轮询 `think*.json`。文件变化且 JSON 合法时，通过 `/sse` 推送完整数据，页面自动重绘，不需要手动刷新。

JSON 语法错误时服务器只打印告警、不推送，浏览器保留上一次的画面。修好再保存即可。

---

## 交互

- **桌面端**：滚轮以光标为中心缩放（20%–300%）；按住左键拖拽平移；右下角按钮放大 / 缩小 / 重置。
- **手机端**：双指捏合缩放、单指拖动平移；打开时若画布宽于屏幕会自动缩放到适配宽度。
- 窗口缩放、热更新重绘后，当前缩放比例保持不变。

---

## 数据结构

`think.json` 是 `swdt` 主题格式的简化版，包含 `meta`、`groups`、可选的 `stickers` 和 `insights`。

```jsonc
{
  "meta": {
    "title": "构思脑图",          // 页面大标题
    "subtitle": "副标题",
    "layoutMode": "radial",      // radial 放射 / down 纵向 / right 横向
    "centerIcon": "💭",          // 中心节点图标
    "centerLabel": "构思",        // 中心节点文字
    "center": { "size": 150 },   // 中心节点直径
    "lineStyle": { /* 可选，连线样式覆盖 */ }
  },
  "stickers": [ { "emoji": "🧠", "top": 18, "left": 22 } ],
  "groups": [
    {
      "id": "problem",           // 必须唯一
      "side": "L",               // radial 布局下 L / R
      "icon": "🎯",
      "title": "要解决的问题",
      "sub": "Problem",          // 可选英文副标题
      "color": "#c97b3a",        // 分支主色
      "bg": "#fdf0e0",           // 可选背景色
      "leaves": [
        { "emoji": "❓", "text": "谁遇到了什么问题？" },
        {
          "emoji": "😖",
          "text": "现在是怎么凑合的？",
          "children": [            // 可选，可递归嵌套
            { "emoji": "🔧", "text": "现有替代方案" }
          ]
        }
      ]
    }
  ],
  "insights": [ { "emoji": "💡", "text": "关键洞察" } ]
}
```

要点：

- `groups[].leaves[].text` 是必填内容，其余字段都可选。
- 深层节点用 `children` 递归嵌套，层级越深字号越小、边框越淡。
- `layoutMode` 三种取值：`radial`（中心放射，适合发散）、`down`（自上而下，适合流程）、`right`（自左向右，适合清单）。
- 节点间距由前端按实测文字尺寸自动推算，**不要**手写像素间距。
- 想调整视觉，改 `meta.lineStyle` 与各节点的 `color` / `bg` 即可。

---

## 接口

| 路径 | 说明 |
|---|---|
| `GET /` | 页面 |
| `GET /mindmap.js` | 布局引擎 |
| `GET /think.json` | 脑图数据 |
| `GET /api/data` | 同上，供脚本读取 |
| `GET /sse` | SSE 事件流；`data-changed` 事件携带完整数据 |

静态资源走白名单，目录内其他文件不会被提供。

---

## 安全边界

本工具面向**本机预览**，没有认证、没有 TLS、没有写入接口。

`think.json` 的文本会被前端通过 `innerHTML` 组合进页面，因此它属于**本地可信配置**：只写你自己和 AI 生成的构思内容，不要把外部来源的文本直接塞进去。

---

## 与 swdt 的差异

| 项 | swdt | .ai/think |
|---|---|---|
| 数据文件 | 5 个 `mindmap-*.json` 主题 + 下拉切换 | 单一 `think.json` |
| 默认端口 | 8080 | 8787 |
| 监听地址 | `0.0.0.0` | `127.0.0.1`（可用 `--host` 放开） |
| 主题下拉框 | 有 | 已移除 |
| 静态文件 | 允许目录回退 | 仅白名单，其余 404 |
| 页面标题 | 思维导图 | 构思脑图 · Think Map |
