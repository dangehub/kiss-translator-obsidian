# KISS Translator

> [README in English (Updates may not be timely)](docs/README_en.md)

---

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/dangehub/kiss-translator-obsidian/total)
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

---

KISS Translator 是一个用来翻译 Obsidian 内任何文本的插件，能一键翻译 UI 和笔记。

> 注：请在[Issues](https://github.com/dangehub/kiss-translator-obsidian/issues "Issues · dangehub/kiss-translator-obsidian")中反馈bug，在[Discussions](https://github.com/dangehub/kiss-translator-obsidian/discussions "dangehub/kiss-translator-obsidian · Discussions · GitHub")中提出建议
> 
> 如有即时通讯需求，可以加本插件的QQ交流群 `1034829731`

## 功能亮点

- 双语对照可编辑
- 允许用户自定义不翻译的区域
- 允许用户自定义 API Key（BYOK），使用 OpenAI 兼容的大语言模型驱动翻译
- 使用悬浮球开关功能
- 内置云端词库并允许用户自托管词库
- 与 Crowdin 集成，允许社区脱离 Obsidian 本体，在网页端翻译插件
- 插件支持 i18n，会自动读取用户界面语言并适配，目前支持简体中文、英文
- 支持移动端，无功能阉割

## 配置说明

### 快速上手

#### 安装插件

本插件暂未上架官方 Obsidian 市场，请使用 BRAT 插件或手动安装。

**手动安装方法**：前往 `release` 下载并复制 `main.js`、`manifest.json`、`styles.css` 到 `<Vault>/.obsidian/plugins/aqu-kiss-translator/`。

#### 初学者：只使用云端词典

![](docs/快速上手说明.webp)

1. 打开 Obsidian 设置页面
2. 找到 **KISS Translator** 菜单
3. 点击**注册表地址**右侧的刷新按钮，若网络通畅则会获取到云端词库
4. 通过搜索或拖动列表找到自己想要的插件词典
5. 点击下载
6. 默认情况下，下载完成后切换页面，词典会自动注入（悬浮球若为红色，则双击悬浮球切换状态）

### 高级用户：需要自行调用 AI 翻译

![](docs/API配置.webp)

一般只需要配置：

- API URL：采用 OpenAI Compatible 格式，如 `https://api.openai.com/v1/chat/completions`
- API Key：如 `sk-xxx`
- Model：如 `gpt-4o-mini`

然后打开需要翻译的页面，右键点击悬浮球打开菜单，点击 `翻译当前页面` 即可

#### 悬浮球菜单详解

![](docs/悬浮球界面.webp)

1. 触发一次翻译，需要配置好 Key，翻译采用逐行翻译，正在翻译的词条最后会有一个蓝色圆点动画，翻译会被存储到**当前活跃的词典**中
2. 若勾选编辑模式，则会在所有译文后面加上一个编辑图标，点击后可以编辑译文
3. 若勾选隐藏原文，则只显示译文
4. 若勾选悬停时展示原文，则会在鼠标放在译文上时显示对应的原文（无法在关闭 `隐藏原文` 时勾选）
5. 最近使用过的三个词典，方便用户快速切换
6. 用于新建词典（注意，**必须关闭 Obsidian 设置页面**才能输入新建词典名称）
7. 词典列表，双击选择**当前活跃的词典**

### 高级用户：使用 Crowdin 集成翻译

点击链接加入 [Obsidian插件翻译项目-非官方](https://crowdin.com/project/obsidian-plugin-i18n/invite?h=8898cc9f7e6770a327a4370b9cff861d2632512)

#### 提取原文

打开设置中的 `仅提取词典` 即可不调用 AI 翻译，只将原文写入词典。用户可以通过这个办法快速批量获取插件的原文。

#### 上传原文

有两种方式：

- （需要 Github PR 审批）在 Github 中 fork 本项目，在本地 `<Vault>/.obsidian/plugins/aqu-kiss-translator/translation` 中找到原文词典（如 `Admonition.json`）并放到项目的 ` translations/en ` 目录下，发起 PR 申请
- （需要 Crowdin 账号具有权限）在 Crowdin 中上传原文到对应目录

#### 在 Crowdin 中翻译

Crowdin 每隔一个小时（高权限用户可以手动同步）会自动获取 Github 仓库中的原文，同步后就可以在网页端编辑译文了。

#### 使用 Crowdin 快速批量翻译流程展示

手动提取原文 -->上传 crowdin-->调用 ai 一键预翻译 -->词典自动同步到 github-->管理员审核并合并 PR-->github action 自动更新注册表 -->用户在插件内读取注册表后下载云端词典

![](docs/Crowdin展示.webp)

## 开发 / 构建

- 安装依赖：`npm install`
- 开发监视：`npm run dev`
- 构建：`npm run build`

## 已知限制

- 翻译带有链接的文本块可能导致链接不可点击，当前默认不翻译这类节点
- 只能提取可视范围内的词典，因此对于插件的命令、气泡消息等适应性较差
- 翻译笔记文本容易出错，所以预设了不翻译笔记文本，若有需求可手动关闭预设

## 开发规划

- 上架官方市场
- 可视化导入/导出词典
- 动画式入门引导

## 致谢

- 本项目受到 [fishjar/kiss-translator](https://github.com/fishjar/kiss-translator) 启发。

## 碎碎念

- 沉浸式翻译 SDK 不再公开，遂自研实现。
- 旧版 i18n 插件因修改他人源码无法上架，本插件改为无侵入实现。

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

## 赞助与打赏

![](docs/奶茶表情包.jpg)

---

如果您想支持我的话，可以使用 Ko-fi

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y51PPQXN)

---

如果您是中国大陆用户，也可以使用微信或支付宝

<table>
  <tr>
    <td align="center"><img src="docs/支付宝收款码.png" alt="Alipay" width="220"></td>
    <td align="center"><img src="docs/微信收款码.png" alt="WeChat" width="220"></td>
  </tr>
</table>

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
