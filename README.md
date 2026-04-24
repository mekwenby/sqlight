# SQLight

一个运行在浏览器中的 SQLite 数据库浏览与编辑工具。无需后端，基于 [SQL.js](https://github.com/sql-js/sql.js) (SQLite 的 WebAssembly 移植) 实现。

![SQLight Logo](./sqlight-logo.png)

[English](./README_EN.md) | 中文

## 功能特性

- **数据库管理** — 打开本地 .db / .sqlite / .sqlite3 文件，导出修改后的数据库
- **表视图** — 分页浏览表数据 (50 行/页)，支持添加、编辑、删除行
- **SQL 编辑器** — 执行任意 SQL 语句，支持 8 种常用语句模板、语法高亮提示、执行历史记录
- **智能编辑** — 自动识别可编辑的查询结果，支持行内编辑
- **中文界面** — 完整的简体中文 UI

## 截图预览

### 表视图

![Table View](./image/1.webp)

### SQL 编辑器

![SQL Editor](./image/2.webp)

## 使用方法

### 直接打开

在浏览器中打开 `index.html` 即可使用：

```bash
# 使用本地服务器
npx serve .
python3 -m http.server 8080
```

### 基本操作

1. 点击工具栏「打开数据库」加载 `.db` / `.sqlite` / `.sqlite3` 文件
2. 在左侧边栏选择表，浏览表数据
3. 双击单元格可直接编辑，按 Enter 保存
4. 切换到「SQL 编辑器」标签执行自定义 SQL 语句
5. 编辑完成后点击「导出」下载修改后的数据库文件

## 技术栈

- 纯原生 JavaScript (ES6+)，无框架依赖
- SQL.js (SQLite WebAssembly 版本)
- CSS 自定义属性，支持亮色/暗色主题
- 无需构建步骤，单 HTML 文件即可运行

## 文件结构

```
sqlight/
├── index.html          # 应用入口
├── app.js             # 全部应用逻辑 (~990 行)
├── style.css          # 样式表 (含暗色主题)
├── lib/sql.js/        # SQL.js WASM 文件
│   ├── sql-wasm.js
│   └── sql-wasm.wasm
├── sqlight-logo.png   # 产品 Logo
├── favicon.png        # 网站图标
├── image/             # 截图
│   ├── 1.webp
│   └── 2.webp
└── README.md          # 本文件
```

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl` + `Enter` | 执行 SQL 语句 |
| `Enter` | 保存单元格编辑 |
| `Escape` | 取消编辑 |

## 注意事项

- 数据库文件全程在本地处理，不会上传至任何服务器
- 复杂的 JOIN、UNION、聚合查询结果不支持行内编辑
- 建议使用现代浏览器 (Chrome、Firefox、Edge、Safari 最新版)

## 许可证

MIT License

---

## MTI 许可证

```text
MIT License

Copyright (c) 2024 SQLight

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
