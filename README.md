# 错题记忆复盘台

一个可部署到 GitHub Pages 的静态网页，用于记录错题图片、动态复盘窗口、学习日历，并可通过 Supabase 同步多设备数据。

## 文件

- `index.html`：页面入口
- `styles.css`：样式
- `app.js`：本地记录、复盘算法、日历、Supabase 云同步
- `supabase_schema.sql`：Supabase 数据表与权限脚本
- `.nojekyll`：让 GitHub Pages 按普通静态文件发布

## GitHub Pages 发布

把以下文件上传到 GitHub 仓库根目录：

- `index.html`
- `styles.css`
- `app.js`
- `supabase_schema.sql`
- `.nojekyll`
- `README.md`

然后在仓库 `Settings -> Pages` 中选择：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

保存后等待 Pages 生成网址。
