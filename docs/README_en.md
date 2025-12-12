# Translay Translator

> [README in English (Updates may not be timely)](docs/README_en.md)

---

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/dangehub/obsidian-translay-translator/total)
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

---

Translay Translator is a plugin designed to translate any text inside Obsidian, supporting one-click translation for both UI and notes.

> Please report bugs in [Issues](https://github.com/dangehub/obsidian-translay-translator/issues) and submit suggestions in [Discussions](https://github.com/dangehub/obsidian-translay-translator/discussions).  
> For instant communication, you may join the QQ group: `1034829731`.

## Features

- Editable bilingual translation view
- User-defined non-translatable selectors
- Bring your own API Key (BYOK), powered by OpenAI-compatible LLMs
- Floating translation button for quick toggling
- Built-in cloud dictionary support and optional self-hosted dictionaries
- Crowdin integration for community translation outside Obsidian
- Full i18n support—automatically adapts to the user’s UI language (Simplified Chinese and English currently supported)
- Mobile-friendly with no feature limitations

## Configuration

### Quick Start

#### Installing the Plugin

This plugin is not yet available on the official Obsidian marketplace. Install via BRAT or manually.

**Manual installation:**  
Download `main.js`, `manifest.json`, and `styles.css` from the `release` page and place them into:  
`<Vault>/.obsidian/plugins/aqu-translay-translator/`.

#### Beginners: Using Only the Cloud Dictionary

![](docs/快速上手说明.webp)

1. Open Obsidian Settings  
2. Navigate to **Translay Translator**  
3. Click the refresh icon next to **Registry URL** to load cloud dictionaries  
4. Search or scroll to find the dictionary you want  
5. Click **Download**  
6. After downloading, switch pages — the dictionary will auto-inject  
   (If the floating button is red, double-click it to toggle its state)

### Advanced Users: Using AI Translation

![](docs/API配置.webp)

Usually you only need to configure:

- API URL: OpenAI-compatible endpoint, e.g. `https://api.openai.com/v1/chat/completions`
- API Key: e.g. `sk-xxx`
- Model: e.g. `gpt-4o-mini`

Open the page you want to translate, right-click the floating button, and choose **Translate Current Page**.

#### Floating Button Menu Explained

![](docs/悬浮球界面.webp)

1. Trigger translation once. Requires a valid API Key. Translates line-by-line.  
   The currently translating entry displays a blue breathing dot.  
   Translations are stored in the **active dictionary**.
2. Editing mode: shows edit icons after each translated line for inline editing.
3. Hide source text: display only translated text.
4. Show source text on hover (only available when “Hide source text” is enabled).
5. Quick access to the three most recently used dictionaries.
6. Create a new dictionary (**Obsidian Settings must be closed** before typing a name).
7. Dictionary list — double-click to set the **active dictionary**.

### Advanced Users: Crowdin Integration

Join the project:  
[Unofficial Obsidian Plugin Translation Project](https://crowdin.com/project/obsidian-plugin-i18n/invite?h=8898cc9f7e6770a327a4370b9cff861d2632512)

#### Extracting Source Text

Enable **Extract Only** in Settings to write source strings into dictionaries without calling AI.  
Useful for bulk extraction.

#### Uploading Source Text

Two methods:

- **Via GitHub PR (review required):**  
  Find the extracted dictionary in  
  `<Vault>/.obsidian/plugins/aqu-translay-translator/translation`  
  (e.g. `Admonition.json`), move it to `translations/en`, and submit a PR.
- **Via Crowdin (requires permissions):**  
  Upload the extracted JSON files directly to Crowdin.

#### Translating on Crowdin

Crowdin syncs with GitHub every hour (or manually for privileged users).  
Once synced, translations can be edited directly online.

#### Fast Batch Translation Workflow (Crowdin)

Extract source → upload to Crowdin → AI pre-translation → auto-sync back to GitHub →  
maintainer reviews & merges PR → GitHub Action updates registry →  
users refresh in plugin and download cloud dictionaries

![](docs/Crowdin展示.webp)

## Development / Build

- Install dependencies: `npm install`
- Development mode: `npm run dev`
- Build: `npm run build`

## Known Limitations

- Translating text blocks with links may break click behavior. These are skipped by default.
- Only visible content can be extracted, so commands, popups, and other UI elements may have incomplete coverage.
- Translating note content often produces errors, so note translation is disabled by default. You may manually change this preset.

## Roadmap

- Publish to the official marketplace
- Visualized dictionary import/export
- Animated onboarding experience

## Acknowledgements

- Inspired by [fishjar/kiss-translator](https://github.com/fishjar/kiss-translator).

## Notes

- The immersive translation SDK is no longer public, so a custom implementation was created.
- The previous i18n plugin modified external code and could not be listed; this plugin uses a fully non-intrusive design.

## Vibe Coding Warning

Most of the development was assisted by AI.

## Changelog

<details>
<summary>Click to Expand</summary>

### 0.8.4
- feat: Added *Element Picker Translation*. When enabled from the floating menu, the element under your cursor is highlighted, and clicking it will translate it.  
  If “Extract Only” mode is enabled, this becomes *Element Picker Extraction*.

### 0.8.3
- Renamed the plugin to **Translay Translator** to reduce misunderstanding.

### 0.8.2
- Fixed an issue preventing text input in the search field.

### 0.8.1
- Improved settings UI  
- Added i18n support: auto-switch languages; cloud dictionary lists now prioritize user language (fallback to English)

### 0.8.0
- Added cloud dictionary feature with customizable Git repositories  
  - The repository includes a default dictionary set (not yet updated)  
  - Framework allows migration to platforms like Gitee  
  - Crowdin integration for translation workflow enhancement

### 0.7.8
- Note translation disabled by default; you may manually modify non-translatable selector presets.

### 0.7.7
- Added viewport detection / lazy loading to avoid lag on long pages.

### 0.7.6
- Minor technical adjustments.

### 0.7.5
- Dictionary names may include `+` (for pdf++)  
- Plugin reload now reads all dictionaries in `translation` for sharing support.

### 0.7.2–0.7.4
- Code refined following Obsidian’s official guidelines.

### 0.7.1
- Fixed appearance of “edit” text during translation editing  
- Replaced with a pencil icon.

### 0.7.0
- Translation style: removed extra borders/background; kept original font size & line height; source text hidden using `display:none`  
- Interaction compatibility: interactive elements replace text only; input labels replace only text nodes  
- UI translation target: focus on common dialogs to avoid accidental workspace translations  
- Added breathing animation to indicate translation progress

### 0.6.0
- Auto-apply translations from dictionary without API calls  
- Floating button double-click toggle; added “Translate Current Page”  
- Cross-dictionary search for better hit rate  
- Fixes: hover-source-text no longer flickers; improved state sync

### 0.5.0
- Double-click floating button to toggle translation; improved toggle behavior  
- Hidden source text now keeps layout; hover shows source with blur transition  
- Logic: hover-to-show-source works only when source is hidden

### 0.4.0
- Added hide-source and edit-mode toggles; added click debounce  
- UI dictionary fallback: query all dictionaries in order; renaming/deleting syncs cache  
- Block-level translations remain block-level; several Obsidian UI areas skipped by default

### 0.3.0
- Non-translatable selector presets: multiple presets, add/edit/delete, default exclusions  
- Dictionary management in floating button (new/rename/delete/recent)  
- Translation editing with reset/write-back; simplified entry structure  
- Fixes: restored original after clearing, cache sync, editable input support

### 0.2.0
- Local dictionary upgrade (version/scope/entries)  
- Support for switching/recent/add/edit/delete dictionaries via UI  
- Editable translation blocks with reset; floating menu dictionary management  
- Fixed translation clearing, style syncing, and settings sync

### 0.1.0
- Added inline note translation/clear/show/hide commands  
- Added global floating button with translation/clear and draggable position  
- Localized settings; added non-translatable selectors; more compact translation styling

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
