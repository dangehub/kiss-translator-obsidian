# KISS Translator

---

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/dangehub/kiss-translator-obsidian/total)
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

---

翻译 Obsidian 界面和笔记的插件，使用 OpenAI 兼容接口，支持本地词典和双语对照。

## 功能
- 翻译界面与笔记文本，支持隐藏原文、悬停显示原文。
- 悬浮球：双击开关词典注入（红=关闭，黄=已开但无命中，绿=有译文）；长按/右键打开菜单，含“翻译当前页面”和词典管理。
- 词典持久化：本地存储译文，优先命中减少请求；可编辑、重置译文。
- 自动应用：检测界面变化后自动应用已有词典译文（不调用接口）。
- 移动端支持：长按代替右键，悬浮球位置可记忆。

## 快速上手

- 前往设置填写API URL、API Key、Model
- 打开想要翻译的页面，使用悬浮球
    - 双击：开/关翻译注入模式，悬浮球颜色表示状态，红=关闭，黄=开启但无词典译文，绿=已有译文并注入
    - 桌面端右键/移动端长按：打开悬浮球菜单
        - 翻译当前页面：点击后开始翻译当前页面，翻译中的文本后面会出现圆点动画
        - 编辑模式：勾选后所有已翻译文本后会出现编辑按钮
        - 隐藏原文：勾选后只展示译文
            - 悬停时展示原文：勾选后静态下为仅译文模式，把鼠标移动到译文上会切换为原文
    - 最近词典：展示最近的三个词典
    - 新增词典：（不能在打开Obsidian设置输入）新建一个词典，后续翻译会存储在此词典中
    - 词典列表：可选取准备写入的词典，`*`表示当前选中词典

注：有任何问题和建议欢迎在issue中反馈，也可以加本插件的QQ交流群 1034829731

## 隐私声明

本插件在调用LLM翻译和获取云端词典时需要网络权限，但这两个功能均为可选项。
LLM翻译与云端词典库均可自定义。

## 插件安装

尚未上架官方，请使用`BRAT`或手动安装。

### 手动安装

前往`release`下载并复制 `main.js`、`manifest.json`、`styles.css` 到 `<Vault>/.obsidian/plugins/aqu-kiss-translator/`。


## 开发 / 构建
- 安装依赖：`npm install`
- 开发监视：`npm run dev`
- 构建：`npm run build`

## 开发路线/已知BUG
- 上架Obsidian插件市场
- 可视化导入/导出词典
- 可视化插件入门引导
- 翻译带有链接的文本块会导致链接无法点击，因此暂不允许进行此类操作

## 致谢与碎碎念

- 本项目受到[fishjar/kiss-translator: A simple, open source bilingual translation extension &amp; Greasemonkey script (一个简约、开源的 双语对照翻译扩展 &amp; 油猴脚本)](https://github.com/fishjar/kiss-translator)启发
- 沉浸式翻译很好用，但是sdk不公开了，故开发此插件
- 以前开发的i18n插件，因为会修改其他插件的源码所以不被允许上架，这个插件换了一种实现方法，不会修改源代码

## Vibe Coding警告

本插件开发基本使用AI完成。

## Changelog

### 0.8.0

- 增加云端词典功能：现在用户可以自定义一个git仓库，然后下载云端词典
    - 本仓库默认提供一套词典（暂未更新）
    - 通用化设计，可以迁移到Gitee等平台
    - 与crowdin集成，允许用户使用crowdin优化翻译

### 0.7.8

- 设置为默认不翻译笔记，若用户有需求，可手动修改`不翻译的选择器预设`

### 0.7.7

- 增加视口判定/懒加载功能，只注入可视区域，避免在过长的页面卡顿，提升流畅度

### 0.7.6

- 技术性微调

### 0.7.5

- 放宽了词典名称的限制，允许使用`+`以适配pdf++这种名称
- 现在重启插件后会读取translation目录下的所有词典，为未来的词典分享功能打下基础

### 0.7.2~0.7.4

- 根据Obsidian官方规范，优化了代码

### 0.7.1

- 修复了编辑译文时意外出现的edit字样
- 用铅笔符号替代了edit文本，更加美观

### 0.7.0
- 译文样式：移除额外边框/背景，保留原字号/字体/行高等计算样式，避免样式漂移；隐藏原文改为 `display:none` 取消占位。
- 交互兼容：按钮、链接、输入、label、option 等交互元素直接在原节点上替换文本（不克隆不隐藏），保留事件；含输入的 label 仅替换文本节点；下拉选项可翻译。
- UI 翻译目标：优先捕获通用弹窗（非设置也覆盖），避免落到工作区导致二级弹窗不被翻译。
- 体验提示：翻译进行中在识别的文本后显示呼吸动画点，提示正在处理。

### 0.6.0
- 自动应用：监测界面变动后自动用所有词典填充译文，只读词典不调用接口，过滤掉译文内部的 DOM 变动避免闪烁。
- 悬浮球：双击为开关（红=关闭，黄=开启但无词典译文，绿=已有译文），右键菜单新增“翻译当前页面”执行完整翻译。
- 词典查询：遍历所有词典（当前作用域、已保存列表和最近列表）命中译文，便于共享词典。
- 修复：悬停显示原文时不再闪烁；自动应用与手动翻译状态同步。

### 0.5.0
- 悬浮球：双击开启/关闭翻译，状态色红/绿；菜单开关顺序调整（编辑模式、隐藏原文、悬停时展示原文且缩进显示，仅在隐藏原文开启时可用）。
- 译文显示：隐藏原文时保留占位，块级译文保持块级显示；悬停译文可切换回原文并带模糊过渡。
- 逻辑：智能展示原文仅在隐藏原文开启时生效；其它功能保持 0.4.x。

### 0.4.0
- 悬浮球：新增隐藏原文、编辑模式开关；状态色（未译红/已译绿），翻译中防止重复点击并提示。
- UI 词典：未命中当前词典时按列表顺序兜底查询其他词典，减少重复调用；词典文件重命名/删除同步缓存。
- 译文显示：隐藏原文时保留占位，块级译文按原节点块级显示，减少换行被压缩。
- 不翻译预设：默认加入多项 Obsidian 内置区域（侧边栏、编辑器、标签栏、标题等），支持启用开关；最大文本长度可配置。

### 0.3.0
- 不翻译选择器预设：支持多预设（名称、启用开关、增删改），默认预置 Obsidian 侧边栏/编辑器/标签栏/标题等常用排除项；启用的预设自动合并为跳过列表。
- UI 词典管理：悬浮球右键菜单可选择最近、查看/新增/改名/删除词典，当前作用域可快速切换。
- 译文编辑：译文块带编辑/重置，保存写回词典，重置清除缓存后自动重译；持久化条目精简为 key/source/translated/updatedAt。
- 修复多项交互：清除翻译后恢复原文，删除/重命名词典同步文件及缓存，输入框可正常编辑。

### 0.2.0
- 本地词典格式升级（version/scope/entries），优先命中免重复请求；支持 UI 词典作用域切换、最近词典、添加/改名/删除。
- 译文块可编辑与重置，编辑写回词典，重置删除条目后自动重译。
- 悬浮球右键菜单新增词典管理（新增、改名、删除、选择最近）。
- 修复清除翻译后原文不恢复等问题；样式和设置同步更新。

### 0.1.0
- 添加笔记内联翻译/清除/显示隐藏原文命令，支持 OpenAI/LibreTranslate 配置与自定义 prompt。
- 新增全局悬浮球，点击翻译/清除当前界面；支持拖拽位置。
- 设置页文案改为中文，新增“不翻译的选择器”配置并默认屏蔽设置侧边栏。
- 译文样式改为紧凑行内块，减少布局影响；README 更新使用与构建说明。


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