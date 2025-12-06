# KISS Translator

---

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/dangehub/kiss-translator-obsidian/total)
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
<script type='text/javascript' src='https://storage.ko-fi.com/cdn/widget/Widget_2.js'></script><script type='text/javascript'>kofiwidget2.init('Support me on Ko-fi', '#72a4f2', 'Y8Y51PPQXN');kofiwidget2.draw();</script> 

---

在 Obsidian 里一键翻译界面和笔记：悬浮球操作、本地词典优先、双语对照可编辑，支持 OpenAI 兼容接口与云端词典下载。

## 功能亮点
- 界面/笔记翻译：支持隐藏原文、悬停显示原文、编辑译文。
- 悬浮球：双击开关词典注入（红=关，黄=开且未命中，绿=已注入）；长按/右键打开菜单，悬浮球位置可记忆。
- 词典持久化：本地存储译文、可编辑/重置；自动应用已有译文（不再调用接口）。
- 云端词典：可配置注册表地址并下载指定语言的词典，默认内置注册表。
- 移动端：长按代替右键。

注：有任何问题和建议欢迎在issue中反馈，也可以加本插件的QQ交流群 1034829731

## 配置

### 快速上手
1) 设置 → 填写 API：
   - API URL：如 `https://api.openai.com/v1/chat/completions`
   - API Key：如 `sk-...`
   - Model：如 `gpt-4o-mini`
   - 可选：源语言 `auto`、目标语言 `zh`；仅提取模式开关；最大文本长度（默认 500）
2) 默认云端注册表已内置：`https://raw.githubusercontent.com/dangehub/kiss-translator-obsidian/refs/heads/main/translations/registry.json`。如需自定义，填入后点击刷新，选择语言再下载词典。
3) 打开要翻译的页面，使用悬浮球：
   - 双击：开/关翻译注入模式；颜色显示状态（红/黄/绿）
   - 右键/长按：打开菜单 → 翻译当前页面 / 提取当前页面（提取模式） / 选择或新增 UI 词典 / 编辑模式 / 隐藏原文 / 悬停显示原文

### 悬浮球与词典管理
| 操作/项 | 说明 |
| --- | --- |
| 双击悬浮球 | 开/关翻译注入（红=关，黄=无命中，绿=已注入） |
| 翻译当前页面 | 运行在线翻译并写入当前 UI 词典 |
| 提取当前页面 | 仅提取文本并写入词典（source=translated），用于人工翻译 |
| 词典选择 | 最近词典（最多 3 个）、全部词典列表、添加/改名/删除 |
| 编辑模式 | 展示译文后的编辑按钮；可写回词典或重置 |
| 隐藏原文 / 悬停显示原文 | 仅展示译文；可在悬停时临时查看原文 |

### 设置详解
- **翻译 / 提取**：切换“仅提取”后，悬浮球菜单显示“提取当前页面”，不调用 API。
- **最大文本长度**：单块文本超过此长度会跳过翻译，默认 500。
- **API 设置**：URL / Key / Model / 源语言（建议 auto）/ 目标语言。
- **不翻译的选择器预设**：可为不同界面配置跳过的选择器，支持启用/停用、增删改。

### 词典与云端
- 本地词典存放在插件目录的 `translation/` 下，按 scope 管理。
- 云端注册表可自定义（支持 GitHub/Gitea/raw 静态文件），注册表包含 scope、语言、下载链接、条目数等信息。
- 下载时会优先按 Obsidian 当前语言匹配语言列表；若无则回退到英文。

## 隐私声明
- 网络仅用于调用你配置的 LLM 接口和（可选的）云端词典下载；两项均可关闭或指向自建服务。
- 本地词典读写仅限于插件目录，不会读取/上传其他文件。

## 插件安装

尚未上架官方，请使用`BRAT`或手动安装。

### 手动安装

前往`release`下载并复制 `main.js`、`manifest.json`、`styles.css` 到 `<Vault>/.obsidian/plugins/aqu-kiss-translator/`。


## 开发 / 构建
- 安装依赖：`npm install`
- 开发监视：`npm run dev`
- 构建：`npm run build`

## 已知限制 / 规划
- 翻译带有链接的文本块可能导致链接不可点击，当前默认不翻译这类节点。
- 计划：上架官方市场；可视化导入/导出词典；插件入门引导。

## 致谢与碎碎念
- 本项目受到 [fishjar/kiss-translator](https://github.com/fishjar/kiss-translator) 启发。
- 沉浸式翻译 SDK 不再公开，遂自研实现。
- 旧版 i18n 插件因修改他人源码无法上架，本插件改为无侵入实现。

## 赞助与打赏

如果您想支持我的话
![](docs/奶茶表情包.jpg)

<table>
  <tr>
    <td align="center"><img src="docs/kofi.jpg" alt="Ko-fi" width="220"></td>
    <td align="center"><img src="docs/支付宝收款码.png" alt="Alipay" width="220"></td>
    <td align="center"><img src="docs/微信收款码.png" alt="WeChat" width="220"></td>
  </tr>
</table>

## Vibe Coding 警告
本插件开发基本使用 AI 完成。

## Changelog
<details>
<summary>展开查看更新记录</summary>

### 0.8.1
- 优化了设置页面
- 增加了 i18n 支持：根据用户语言自动切换；获取云端词典时优先展示用户语言（无则回退英文）

### 0.8.0
- 增加云端词典功能：可自定义 git 仓库下载词典
  - 本仓库默认提供一套词典（暂未更新）
  - 通用化设计，可迁移到 Gitee 等平台
  - 与 crowdin 集成，允许用 crowdin 优化翻译

### 0.7.8
- 默认不翻译笔记，若有需求可手动修改“不翻译的选择器预设”

### 0.7.7
- 增加视口判定/懒加载功能，只注入可视区域，避免长页面卡顿

### 0.7.6
- 技术性微调

### 0.7.5
- 允许词典名称使用 `+`（适配 pdf++）
- 重启插件后会读取 translation 目录下所有词典，为分享功能做准备

### 0.7.2~0.7.4
- 按 Obsidian 官方规范优化代码

### 0.7.1
- 修复编辑译文时出现的 edit 字样
- 用铅笔符号替换 edit 文本

### 0.7.0
- 译文样式：移除额外边框/背景，保留原字号/字体/行高，隐藏原文改为 `display:none`
- 交互兼容：交互元素直接替换文本，保留事件；含输入的 label 仅替换文本节点
- UI 翻译目标：优先捕获通用弹窗，避免落到工作区
- 体验提示：翻译中的文本显示呼吸动画点

### 0.6.0
- 自动应用：监测界面变动后用词典填充译文，只读词典不调用接口
- 悬浮球：双击开关；菜单新增“翻译当前页面”
- 词典查询：遍历所有词典命中译文，便于共享
- 修复：悬停显示原文不再闪烁；状态同步

### 0.5.0
- 悬浮球：双击开关翻译；开关顺序调整
- 译文显示：隐藏原文保留占位，悬停可切换原文并带模糊过渡
- 逻辑：智能展示原文仅在隐藏原文开启时生效

### 0.4.0
- 悬浮球：新增隐藏原文、编辑模式开关；防重复点击
- UI 词典：按列表顺序兜底查询其他词典；重命名/删除同步缓存
- 译文显示：块级译文保持块级显示；默认跳过多项 Obsidian 区域

### 0.3.0
- 不翻译选择器预设：多预设、增删改、默认排除常用区域
- UI 词典管理：悬浮球右键新增/改名/删除/最近
- 译文编辑：支持重置写回；条目精简为 key/source/translated/updatedAt
- 修复：清除翻译后恢复原文；同步缓存；输入可编辑

### 0.2.0
- 本地词典格式升级（version/scope/entries）；支持 UI 词典切换、最近、增删改
- 译文块可编辑与重置；悬浮球右键词典管理
- 修复清除翻译、样式与设置同步

### 0.1.0
- 添加笔记内联翻译/清除/显示隐藏原文命令，支持 OpenAI/LibreTranslate 与自定义 prompt
- 新增全局悬浮球，点击翻译/清除当前界面；支持拖拽位置
- 设置页中文化；新增“不翻译的选择器”；译文样式更紧凑

</details>


<!-- links -->
[your-project-path]:dangehub/kiss-translator-obsidian
[contributors-shield]: https://img.shields.io/github/contributors/dangehub/kiss-translator-obsidian.svg?style=flat-square
[contributors-url]: https://github.com/dangehub/kiss-translator-obsidian/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/dangehub/kiss-translator-obsidian.svg?style=flat-square
[forks-url]: https://github.com/dangehub/kiss-translator-obsidian/network/members
[stars-shield]: https://img.shields.io/github/stars/dangehub/kiss-translator-obsidian.svg?style=flat-square
[stars-url]: https://github.com/dangehub/kiss-translator-obsidian/stargazers
[issues-shield]: https://img.shields.io/github/issues/dangehub/kiss-translator-obsidian.svg?style=flat-square
[issues-url]: https://img.shields.io/github/issues/dangehub/kiss-translator-obsidian.svg
