import type { LocaleDict } from "..";

export const en: LocaleDict = {
	"section.cloud": "Cloud dictionaries ",
	"section.mode": "Translate / Extract",
	"section.api": "API settings",
	"section.skip": "Skip presets",

	"cloud.registry": "Registry URL",
	"cloud.registry.desc":
		"Provide a JSON registry URL (raw/static file) to list cloud dictionaries.",
	"cloud.refresh": "Refresh",
	"cloud.loading": "Fetching registry…",
	"cloud.error": "Fetch failed: {msg}",
	"cloud.empty": "No registry configured, or the registry is empty.",
	"cloud.selectLang": "Select language",
	"cloud.search": "Search dictionaries",
	"cloud.search.desc": "Filter by name or scope",
	"cloud.search.placeholder": "Enter keyword to filter",
	"cloud.scope": "Scope",
	"cloud.lang": "Language",
	"cloud.updated": "Updated",
	"cloud.entries": "Entries",
	"cloud.download": "Download",
	"cloud.downloading": "Downloading…",
	"cloud.noMatches": "No matching dictionaries.",

	"notice.error": "Translay Translator: {msg}",
	"notice.download.start": "Downloading dictionary: {name}",
	"notice.download.success": "Imported dictionary: {name}",
	"notice.download.fail": "Failed to download: {msg}",
	"notice.translate.busy": "Translay Translator: Translating, please wait…",
	"notice.translate.none": "Translay Translator: No translatable UI found.",
	"notice.readingRequired":
		"Translay Translator: Please open a Markdown pane in reading mode and try again.",

	"mode.extractOnly.name": "Extract only (no online translation)",
	"mode.extractOnly.desc":
		"FAB shows “Extract current page”; it writes UI text into the dictionary with source=translated for later manual translation.",
	"mode.maxTextLength.name": "Max text length",
	"mode.maxTextLength.desc":
		"Skip translation when a single block exceeds this length (default 500 characters).",

	"api.type": "API type",
	"api.type.desc": "OpenAI-compatible API",
	"api.type.tooltip": "OpenAI-compatible",
	"api.url": "API URL",
	"api.url.desc":
		"OpenAI-compatible chat completion endpoint, e.g. https://api.openai.com/v1/chat/completions",
	"api.key": "API Key",
	"api.key.desc": "e.g. sk-xxxxx",
	"api.model": "Model",
	"api.model.desc": "LLM id, e.g. gpt-4o-mini",
	"api.from": "Source language",
	"api.from.desc": "Usually keep auto",
	"api.to": "Target language",
	"api.to.desc": "e.g. zh, en, ja",

	"skip.desc":
		"Create reusable selector presets for different UIs. Matched elements (and their children) will be skipped.",
	"skip.add": "Add preset",
	"skip.name": "Name",
	"skip.selectors": "Selectors (one per line)",
	"skip.enable": "Enable",
	"skip.delete": "Delete",

	"ui.menu.conflict":
		"Translay Translator: Hide Original, Show Original on Hover, and Edit mode cannot be enabled at the same time.",
	"ui.menu.title": "Select UI dictionary",
	"ui.menu.translate": "Translate current page",
	"ui.menu.extract": "Extract current page",
	"ui.menu.pickTranslate": "Element picker (translate)",
	"ui.menu.pickExtract": "Element picker (extract only)",
	"ui.menu.edit": "Edit mode",
	"ui.menu.hide": "Hide original text",
	"ui.menu.smart": "Show original on hover (only when hidden)",
	"ui.menu.recent": "Recent",
	"ui.menu.addPlaceholder": "New dictionary",
	"ui.menu.add": "Add",
	"ui.menu.rename": "Rename",
	"ui.menu.save": "Save",
	"ui.menu.cancel": "Cancel",
	"ui.menu.remove": "Delete",

	"notice.extracting": "Translay Translator: Extracting, please wait…",
	"notice.extract.none": "Translay Translator: No extractable UI found.",

	"prompt.system": "System prompt",
	"prompt.system.desc": "Optional. Placeholders: {from} {to}",
	"prompt.user": "User prompt",
	"prompt.user.desc": "Required. Placeholders: {text} {from} {to}",

	"modal.scope.title": "Set current UI dictionary name",
	"modal.scope.confirm": "OK",
};
