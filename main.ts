import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { TranslationSession } from "./src/translator";
import { FloatingFab } from "./src/fab";

export interface KissTranslatorSettings {
	apiType: "simple" | "openai";
	apiUrl: string;
	apiKey: string;
	model: string;
	fromLang: string;
	toLang: string;
	systemPrompt: string;
	userPrompt: string;
	skipSelectors: string[];
	hideOriginal: boolean;
	autoTranslateOnOpen: boolean;
}

const DEFAULT_SETTINGS: KissTranslatorSettings = {
	apiType: "openai",
	apiUrl: "https://api.openai.com/v1/chat/completions",
	apiKey: "",
	model: "gpt-4o-mini",
	fromLang: "auto",
	toLang: "zh",
	systemPrompt:
		"You are a translation engine. Preserve meaning, formatting, punctuation, and code blocks. Do not add explanations.",
	userPrompt:
		"Translate the following text from {from} to {to}. Reply with translation only.\n\n{text}",
	skipSelectors: [
		'body > div.modal-container.mod-dim > div.modal.mod-settings.mod-sidebar-layout > div.modal-content.vertical-tabs-container > div.vertical-tab-header',
	],
	hideOriginal: false,
	autoTranslateOnOpen: false,
};

export default class KissTranslatorPlugin extends Plugin {
	settings: KissTranslatorSettings;
	session: TranslationSession | null = null;
	uiSession: TranslationSession | null = null;
	private fab: FloatingFab | null = null;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "kiss-translate-current",
			name: "Translate current note (inline)",
			callback: () => this.translateActive(),
		});

		this.addCommand({
			id: "kiss-clear-translation",
			name: "Clear translations on current note",
			callback: () => this.clearActive(),
		});

		this.addCommand({
			id: "kiss-toggle-original",
			name: "Toggle show original text",
			callback: () => this.toggleOriginal(),
		});

		if (this.settings.autoTranslateOnOpen) {
			this.registerEvent(
				this.app.workspace.on("file-open", () => {
					this.translateActive();
				})
			);
		}

		this.addSettingTab(new KissSettingTab(this.app, this));

		this.fab = new FloatingFab(this);
		this.fab.mount();
	}

	onunload() {
		this.session?.clear();
		this.session = null;
		this.uiSession?.clear();
		this.uiSession = null;
		this.fab?.unmount();
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private ensureSession(view: MarkdownView) {
		if (!this.session || this.session.view !== view) {
			this.session = new TranslationSession(view, this.settings);
		} else {
			this.session.updateSettings(this.settings);
		}
	}

	private translateActive() {
		const view = this.getActiveMarkdownView();
		if (!view) {
			new Notice("KISS Translator: 请在阅读模式下打开一个 Markdown 窗口再试。");
			return;
		}
		this.ensureSession(view);
		this.session?.translate().catch((err) => {
			console.error(err);
			new Notice(`KISS Translator: ${err.message}`);
		});
	}

	translateUIWithFab() {
		const target =
			document.querySelector<HTMLElement>(".modal.mod-settings") ||
			document.querySelector<HTMLElement>(".modal-container .mod-settings") ||
			document.querySelector<HTMLElement>(".workspace-split.mod-vertical") ||
			document.body;

		if (!target) {
			new Notice("KISS Translator: 未找到可翻译的界面。");
			return;
		}

		if (!this.uiSession) {
			this.uiSession = new TranslationSession(null, this.settings);
		} else {
			this.uiSession.updateSettings(this.settings);
		}

		if (this.uiSession.hasTranslations()) {
			this.uiSession.clear();
			new Notice("KISS Translator: 已清除翻译。");
			return;
		}

		this.uiSession.translate(target).catch((err) => {
			console.error(err);
			new Notice(`KISS Translator: ${err.message}`);
		});
	}

	private clearActive() {
		const view = this.getActiveMarkdownView();
		if (!view) return;
		this.ensureSession(view);
		this.session?.clear();
	}

	private toggleOriginal() {
		this.settings.hideOriginal = !this.settings.hideOriginal;
		this.saveSettings();
		if (this.session) {
			this.session.updateSettings(this.settings);
			this.session.applyOriginalVisibility();
		}
		new Notice(
			this.settings.hideOriginal
				? "KISS Translator: 已隐藏原文"
				: "KISS Translator: 显示原文"
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class KissSettingTab extends PluginSettingTab {
	plugin: KissTranslatorPlugin;

	constructor(app: App, plugin: KissTranslatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "KISS Translator (Obsidian)" });

		new Setting(containerEl)
			.setName("API 类型")
			.setDesc("选择简单文本接口或 OpenAI 兼容接口。")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("openai", "OpenAI 兼容 (chat/completions)")
					.addOption("simple", "简单文本接口 (LibreTranslate)")
					.setValue(this.plugin.settings.apiType)
					.onChange(async (value) => {
						this.plugin.settings.apiType =
							value as KissTranslatorSettings["apiType"];
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API URL")
			.setDesc("翻译接口地址，OpenAI 兼容用 /v1/chat/completions，或 LibreTranslate 兼容。")
			.addText((text) =>
				text
					.setPlaceholder("https://api.openai.com/v1/chat/completions")
					.setValue(this.plugin.settings.apiUrl)
					.onChange(async (value) => {
						this.plugin.settings.apiUrl = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("可选，如果接口需要鉴权请填写。")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("模型 (OpenAI)")
			.setDesc("OpenAI 兼容模式下使用的模型，如 gpt-4o-mini。")
			.addText((text) =>
				text
					.setPlaceholder("gpt-4o-mini")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("源语言")
			.setDesc("使用 auto 自动检测。")
			.addText((text) =>
				text
					.setPlaceholder("auto")
					.setValue(this.plugin.settings.fromLang)
					.onChange(async (value) => {
						this.plugin.settings.fromLang = value.trim() || "auto";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("目标语言")
			.setDesc("翻译成的语言，例如 zh、en、ja。")
			.addText((text) =>
				text
					.setPlaceholder("zh")
					.setValue(this.plugin.settings.toLang)
					.onChange(async (value) => {
						this.plugin.settings.toLang = value.trim() || "zh";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("隐藏原文")
			.setDesc("切换后重新翻译时将隐藏原文，仅显示译文。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideOriginal)
					.onChange(async (value) => {
						this.plugin.settings.hideOriginal = value;
						await this.plugin.saveSettings();
						this.plugin.session?.updateSettings(this.plugin.settings);
						this.plugin.session?.applyOriginalVisibility();
					})
			);

		new Setting(containerEl)
			.setName("打开笔记自动翻译")
			.setDesc("打开笔记时自动翻译（阅读模式）。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoTranslateOnOpen)
					.onChange(async (value) => {
						this.plugin.settings.autoTranslateOnOpen = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("不翻译的选择器")
			.setDesc("一行一个 CSS 选择器。匹配到的元素及其子节点不会被翻译。默认包含设置侧边栏。")
			.addTextArea((text) =>
				text
					.setPlaceholder(
						".workspace-ribbon\nbody > ... > .vertical-tab-header"
					)
					.setValue(this.plugin.settings.skipSelectors.join("\n"))
					.onChange(async (value) => {
						const list = value
							.split(/\n|,/)
							.map((s) => s.trim())
							.filter(Boolean);
						this.plugin.settings.skipSelectors = list;
						await this.plugin.saveSettings();
						this.plugin.session?.updateSettings(this.plugin.settings);
						this.plugin.uiSession?.updateSettings(this.plugin.settings);
					})
			);

		new Setting(containerEl)
			.setName("System prompt (OpenAI)")
			.setDesc("可选。可使用占位符 {from} {to}。")
			.addTextArea((text) =>
				text
					.setPlaceholder(
						"You are a translation engine. Preserve meaning and formatting."
					)
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("User prompt (OpenAI)")
			.setDesc("必填。可使用占位符 {text} {from} {to}。")
			.addTextArea((text) =>
				text
					.setPlaceholder(
						"Translate the following text from {from} to {to}. Reply with translation only.\n\n{text}"
					)
					.setValue(this.plugin.settings.userPrompt)
					.onChange(async (value) => {
						this.plugin.settings.userPrompt = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
