# Translay Translator


---

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/dangehub/obsidian-translay-translator/total)
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

---

Translay Translator is a plugin designed to translate any text inside Obsidian. It supports one-click translation for both UI and notes.

> Please report bugs in [Issues](https://github.com/dangehub/obsidian-translay-translator/issues) and submit feature requests in [Discussions](https://github.com/dangehub/obsidian-translay-translator/discussions).  
> For instant communication, you may join the QQ group: `1034829731`.

## Features

- Floating translation button
- Editable bilingual display
- User-defined non-translatable areas
- User-defined API Key (BYOK), powered by OpenAI-compatible LLM translation
- Built-in cloud dictionaries with support for self-hosting
- Crowdin integration, allowing community translation via the web without Obsidian
- Full i18n support—automatically adapts to the user interface language (currently Simplified Chinese and English)

## Configuration

### Quick Start

#### Install the plugin

This plugin is not yet on the official Obsidian marketplace. Install via BRAT or manually.

**Manual installation:** Download `main.js`, `manifest.json`, and `styles.css` from the `release` page and copy them to:  
`<Vault>/.obsidian/plugins/aqu-translay-translator/`.

#### Beginners: Using cloud dictionaries only

![](docs/快速上手说明.webp)

1. Open Obsidian Settings  
2. Navigate to **Translay Translator**  
3. Click the refresh button beside **Registry URL** to load cloud dictionaries  
4. Search or browse for the dictionary you want  
5. Click **Download**  
6. After downloading, switch pages and the dictionary will auto-inject  
   (If the floating button is red, double-click it to toggle)

### Advanced Users: Using AI Translation

![](docs/API配置.webp)

Normally you only need to configure:

- API URL: OpenAI-compatible endpoint, e.g. `https://api.openai.com/v1/chat/completions`
- API Key: e.g. `sk-xxx`
- Model: e.g. `gpt-4o-mini`

Then open the page you want to translate, right-click the floating button, and select **Translate current page**.

#### Floating Button Menu Explained

![](docs/悬浮球界面.webp)

1. Trigger a translation. Requires API Key. Translates line-by-line. The active line shows a blue breathing dot. Results are saved to the **active dictionary**.  
2. When enabled, an edit icon appears after each translated entry  
3. Hide original text  
4. Show original text on hover (only available when original text is hidden)  
5. Three recently used dictionaries for quick switching  
6. Create a new dictionary (**Settings must be closed** to input a name)  
7. Dictionary list — double-click to set the **active dictionary**

### Advanced Users: Crowdin Integration

Join the project:  
[Obsidian Plugin Translation Project — Unofficial](https://crowdin.com/project/obsidian-plugin-i18n/invite?h=8898cc9f7e6770a327a4370b9cff861d2632512)

#### Extract original text

Enable **Extract Only** to write only source text into dictionaries, without calling AI. Useful for batch extraction.

#### Upload original text

Two methods:

- **Via GitHub PR (requires review):**  
  Fork this repo → find extracted dictionary in  
  `<Vault>/.obsidian/plugins/aqu-translay-translator/translation`  
  (e.g. `Admonition.json`) → place it into the repo’s `translations/en` → submit PR

- **Via Crowdin (requires permissions):**  
  Upload source files directly into the corresponding Crowdin directory

#### Translating in Crowdin

Crowdin automatically syncs with GitHub every hour (manual sync for high-permission users).  
Once synced, translations can be edited directly in the web UI.

#### Crowdin Batch Translation Workflow

Extract source → upload to Crowdin → AI pre-translation → dictionary auto-sync to GitHub →  
maintainer reviews & approves PR → GitHub Action updates registry →  
users download cloud dictionaries in plugin

![](docs/Crowdin展示.webp)

## Development / Build

- Install dependencies: `npm install`
- Development watch: `npm run dev`
- Build: `npm run build`

## Known Limitations

- Translating text blocks with links may break clickable behavior. Such nodes are skipped by default.
- Only visible areas can be extracted, resulting in imperfect coverage for commands, popups, etc.

## Roadmap

- Publish to the official marketplace
- Visual dictionary import/export  
- Interactive onboarding with animations

## Acknowledgements

- Inspired by [fishjar/kiss-translator](https://github.com/fishjar/kiss-translator).

## Notes

- The immersive translation SDK is no longer public, so a custom implementation is used.
- Previous i18n plugin could not be published due to core modification; this plugin is fully non-intrusive.

## Vibe Coding Disclaimer

Most of the development was completed using AI.

## Changelog

<details>
<summary>Click to expand</summary>

### 0.8.1
- Improved settings page  
- Added i18n support: auto-switch based on user language; cloud dictionary results prioritize user language (fallback to English)

### 0.8.0
- Added cloud dictionary feature: customizable Git repo for dictionary download  
  - This repo provides a default dictionary set (not yet updated)  
  - Generic design allows migration to platforms like Gitee  
  - Crowdin integration for translation optimization

### 0.7.8
- Notes are no longer translated by default; configure “Non-translatable selectors preset” if needed

### 0.7.7
- Added viewport detection/lazy loading to prevent lag in long pages

### 0.7.6
- Minor technical adjustments

### 0.7.5
- Dictionary names may now include `+` (for pdf++)  
- Plugin reload now reads all dictionaries in the `translation` folder for sharing support

### 0.7.2–0.7.4
- Code improvements following Obsidian official guidelines

### 0.7.1
- Fixed “edit” text appearing during translation editing  
- Replaced “edit” text with pencil icon

### 0.7.0
- Translation style: removed extra borders/background; preserved original font size and line height; hidden source text uses `display:none`  
- Interaction compatibility: interactive elements directly replace text while keeping events; inputs inside labels only replace text nodes  
- UI translation target: prioritize common dialogs to avoid affecting workspace  
- Translation progress indicator: breathing dot animation

### 0.6.0
- Auto-apply: monitor UI changes and fill translations using dictionaries only (no API calls)  
- Floating button: double-click toggle; added “Translate current page”  
- Dictionary lookup: searches all dictionaries for matches  
- Fixes: hover original text no longer flickers; improved state synchronization

### 0.5.0
- Floating button: double-click to toggle; improved toggle order  
- Translation display: hidden original text keeps layout; hover reveals original with blur transition  
- Logic: “show original text on hover” works only when original text is hidden

### 0.4.0
- Floating button: added hide-original and edit-mode toggles; debounce  
- UI dictionary: fallback lookup through all dictionaries; renaming/deletion syncs cache  
- Translation display: block-level elements remain block-level; several Obsidian areas skipped by default

### 0.3.0
- Non-translatable selectors: multiple presets, add/edit/delete, common areas excluded by default  
- UI dictionary management: create/rename/delete/recent in right-click menu  
- Editable translations: support reset/write-back; dictionary entries simplified  
- Fixes: restore original after clearing translation; sync cache; editable inputs

### 0.2.0
- Local dictionary upgrade (version/scope/entries); UI dictionary switching/recent/add/edit/delete  
- Editable translation blocks with reset; right-click dictionary management  
- Fixed translation clearing, styles, settings sync

### 0.1.0
- Added inline note translation/clear/show/hide commands; supports OpenAI/LibreTranslate and custom prompts  
- Global floating button with click-translate/clear and draggable position  
- Settings localized; added non-translatable selectors; more compact translation style

</details>

## Sponsorship

![](docs/奶茶表情包.jpg)

---

If you would like to support my work, you may use Ko-fi:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y51PPQXN)

---

For users in Mainland China, you may use WeChat or Alipay:

<table>
  <tr>
    <td align="center"><img src="docs/支付宝收款码.png" alt="Alipay" width="220"></td>
    <td align="center"><img src="docs/微信收款码.png" alt="WeChat" width="220"></td>
  </tr>
</table>

<!-- links -->
[your-project-path]: dangehub/obsidian-translay-translator
[contributors-shield]: https://img.shields.io/github/contributors/dangehub/obsidian-translay-translator.svg?style=flat-square
[contributors-url]: https://github.com/dangehub/obsidian-translay-translator/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/dangehub/obsidian-translay-translator.svg?style=flat-square
[forks-url]: https://github.com/dangehub/obsidian-translay-translator/network/members
[stars-shield]: https://img.shields.io/github/stars/dangehub/obsidian-translay-translator.svg?style=flat-square
[stars-url]: https://github.com/dangehub/obsidian-translay-translator/stargazers
[issues-shield]: https://img.shields.io/github/issues/dangehub/obsidian-translay-translator.svg?style=flat-square
[issues-url]: https://img.shields.io/github/issues/dangehub/obsidian-translay-translator.svg
