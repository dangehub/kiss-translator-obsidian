import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Modal,
} from "obsidian";
import { TranslationSession } from "./src/translator";
import { FloatingFab } from "./src/fab";
import { DictionaryStore } from "./src/dictionary";
import * as path from "path";

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
	skipPresets?: SkipPreset[];
	uiScope: string;
	uiScopes: string[];
	recentUiScopes: string[];
	hideOriginal: boolean;
	autoTranslateOnOpen: boolean;
	editMode?: boolean;
	smartOriginal?: boolean;
	maxTextLength?: number;
}

interface SkipPreset {
	name: string;
	selectors: string[];
	enabled?: boolean;
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
	skipPresets: [
		{
			name: "设置侧边栏",
			selectors: [
				"body > div.modal-container.mod-dim > div.modal.mod-settings.mod-sidebar-layout > div.modal-content.vertical-tabs-container > div.vertical-tab-header",
			],
			enabled: true,
		},
		{
			name: "编辑器",
			selectors: [
				"body > div.app-container > div.horizontal-main-container > div > div.workspace-split.mod-vertical.mod-root > div > div.workspace-tab-container > div > div > div.view-content > div.markdown-source-view.cm-s-obsidian.mod-cm6.node-insert-event.is-readable-line-width.is-live-preview.is-folding.show-properties > div > div.cm-scroller > div.cm-sizer > div.cm-contentContainer > div",
			],
			enabled: true,
		},
		{
			name: "标签栏",
			selectors: [
				"body > div.app-container > div.horizontal-main-container > div > div.workspace-split.mod-vertical.mod-root > div > div.workspace-tab-header-container",
			],
			enabled: true,
		},
		{
			name: "笔记标题",
			selectors: [
				"body > div.app-container > div.horizontal-main-container > div > div.workspace-split.mod-vertical.mod-root > div > div.workspace-tab-container > div.workspace-leaf.mod-active > div > div.view-content > div.markdown-source-view.cm-s-obsidian.mod-cm6.node-insert-event.is-readable-line-width.is-live-preview.is-folding.show-properties > div > div.cm-scroller > div.cm-sizer > div.inline-title",
			],
			enabled: true,
		},
		{
			name: "标题上方地址栏",
			selectors: [
				"body > div.app-container > div.horizontal-main-container > div > div.workspace-split.mod-vertical.mod-root > div > div.workspace-tab-container > div.workspace-leaf.mod-active > div > div.view-header > div.view-header-title-container.mod-at-start.mod-fade.mod-at-end",
			],
			enabled: true,
		},
	],
	uiScope: "ui-global",
	uiScopes: ["ui-global"],
	recentUiScopes: ["ui-global"],
	hideOriginal: false,
	autoTranslateOnOpen: false,
	editMode: false,
	smartOriginal: false,
	maxTextLength: 160,
};

export default class KissTranslatorPlugin extends Plugin {
	settings: KissTranslatorSettings;
	session: TranslationSession | null = null;
	uiSession: TranslationSession | null = null;
	private fab: FloatingFab | null = null;
	private dictStore: DictionaryStore | null = null;
	private scopeMenuEl: HTMLElement | null = null;
	private scopeMenuHandler: ((ev: MouseEvent) => void) | null = null;
	private uiBusy = false;
	private uiMutationObserver: MutationObserver | null = null;
	private uiMutationTimer: number | null = null;
	private suppressUiAuto = false;
	private uiDictionaryEnabled = true;
	private fabState: "off" | "empty" | "active" = "off";

	async onload() {
		await this.loadSettings();
		this.dictStore = new DictionaryStore(this.getTranslationDir());
		await this.dictStore.ensureReady();

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

		this.addCommand({
			id: "kiss-set-ui-scope",
			name: "Set UI dictionary scope",
			callback: () => this.promptUiScope(),
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
		this.setFabState("off");
		this.startUiAutoApply();
	}

	onunload() {
		this.session?.clear();
		this.session = null;
		this.uiSession?.clear();
		this.uiSession = null;
		this.fab?.unmount();
		this.dictStore?.flush().catch((err) => console.error(err));
		this.closeScopeMenu();
		this.stopUiAutoApply();
	}

	private setFabState(state: "off" | "empty" | "active") {
		this.fabState = state;
		this.fab?.setState(state);
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private ensureSession(view: MarkdownView) {
		if (!this.session || this.session.view !== view) {
			this.session = new TranslationSession(view, this.settings, {
				dictionary: this.dictStore || undefined,
				scopeId: view.file?.path || "note-unknown",
			});
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
		if (this.uiBusy) {
			new Notice("KISS Translator: 正在翻译，请稍候…");
			return;
		}
		const target = this.findUiTarget();
		if (!target) {
			new Notice("KISS Translator: 未找到可翻译的界面。");
			return;
		}

		this.prepareUiSession();
		this.uiDictionaryEnabled = true;
		const session = this.uiSession;
		if (!session) return;
		this.suppressUiAuto = true;
		this.uiBusy = true;
		session
			.translate(target, { dictionaryOnly: false })
			.then(() => {
				this.setFabState(session.hasTranslations() ? "active" : "empty");
			})
			.catch((err) => {
				console.error(err);
				this.setFabState("off");
				new Notice(`KISS Translator: ${err.message}`);
			})
			.finally(() => {
				this.uiBusy = false;
				this.resumeUiAutoSoon();
			});
	}

	private applyUiDictionaryTranslations() {
		if (this.uiBusy || !this.uiDictionaryEnabled) return;
		const target = this.findUiTarget();
		if (!target) return;
		this.prepareUiSession();
		const session = this.uiSession;
		if (!session) return;
		this.suppressUiAuto = true;
		this.uiBusy = true;
		session
			.translate(target, { dictionaryOnly: true })
			.then(() => {
				this.setFabState(session.hasTranslations() ? "active" : "empty");
			})
			.catch((err) => {
				console.error(err);
			})
			.finally(() => {
				this.uiBusy = false;
				this.resumeUiAutoSoon();
			});
	}

	toggleUiDictionaryTranslations() {
		if (this.uiBusy) {
			new Notice("KISS Translator: 正在翻译，请稍候…");
			return;
		}
		if (this.uiSession && this.uiSession.hasTranslations()) {
			this.suppressUiAuto = true;
			this.uiSession.clear();
			this.setFabState("off");
			this.uiDictionaryEnabled = false;
			this.resumeUiAutoSoon();
			return;
		}
		this.uiDictionaryEnabled = true;
		this.applyUiDictionaryTranslations();
	}

	private findUiTarget(): HTMLElement | null {
		return (
			document.querySelector<HTMLElement>(".modal.mod-settings") ||
			document.querySelector<HTMLElement>(".modal-container .mod-settings") ||
			document.querySelector<HTMLElement>(".workspace-split.mod-vertical") ||
			document.body ||
			null
		);
	}

	private prepareUiSession() {
		if (!this.uiSession) {
			this.uiSession = new TranslationSession(null, this.settings, {
				dictionary: this.dictStore || undefined,
				scopeId: this.settings.uiScope || "ui-global",
			});
		} else {
			this.uiSession.updateSettings(this.settings);
		}
	}

	private resumeUiAutoSoon() {
		window.setTimeout(() => {
			this.suppressUiAuto = false;
		}, 80);
	}

	private scheduleUiDictionaryApply() {
		if (this.suppressUiAuto || this.uiBusy || !this.uiDictionaryEnabled) return;
		if (this.uiMutationTimer) {
			window.clearTimeout(this.uiMutationTimer);
		}
		this.uiMutationTimer = window.setTimeout(() => {
			this.uiMutationTimer = null;
			this.applyUiDictionaryTranslations();
		}, 200);
	}

	private startUiAutoApply() {
		if (this.uiMutationObserver || !document?.body) return;
		this.uiMutationObserver = new MutationObserver((records) => {
			if (this.suppressUiAuto) return;
			// 忽略仅发生在已有翻译块内部的变动，避免悬停切换时反复重绘导致闪烁
			const meaningful = records.some((m) => {
				const target = m.target as HTMLElement;
				return !target?.closest?.(".kiss-translated-block");
			});
			if (!meaningful) return;
			this.scheduleUiDictionaryApply();
		});
		this.uiMutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		this.scheduleUiDictionaryApply();
	}

	private stopUiAutoApply() {
		if (this.uiMutationObserver) {
			this.uiMutationObserver.disconnect();
			this.uiMutationObserver = null;
		}
		if (this.uiMutationTimer) {
			window.clearTimeout(this.uiMutationTimer);
			this.uiMutationTimer = null;
		}
	}

	private getUiTarget(): HTMLElement | null {
		return (
			document.querySelector<HTMLElement>(".modal.mod-settings") ||
			document.querySelector<HTMLElement>(".modal-container .mod-settings") ||
			document.querySelector<HTMLElement>(".workspace-split.mod-vertical") ||
			document.body
		);
	}

	private startUiObserver() {
		if (this.uiObserver) return;
		let timer: NodeJS.Timeout | null = null;
		this.uiObserver = new MutationObserver(() => {
			if (this.uiBusy || !this.uiSession?.hasTranslations()) return;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => this.retranslateUI(), 300);
		});
		this.uiObserver.observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true,
		});
	}

	private stopUiObserver() {
		if (this.uiObserver) {
			this.uiObserver.disconnect();
			this.uiObserver = null;
		}
	}

	private async retranslateUI() {
		if (this.uiBusy) return;
		const target = this.getUiTarget();
		if (!target) return;
		this.uiTarget = target;
		if (!this.uiSession) {
			this.uiSession = new TranslationSession(null, this.settings, {
				dictionary: this.dictStore || undefined,
				scopeId: this.settings.uiScope || "ui-global",
			});
		} else {
			this.uiSession.updateSettings(this.settings);
			this.uiSession.clear();
		}
		this.uiBusy = true;
		this.uiSession
			.translate(target, { reuseOnly: this.autoReuseOnly })
			.then(() => this.fab?.setActive(true))
			.catch((err) => {
				console.error(err);
				this.fab?.setActive(false);
			})
			.finally(() => {
				this.uiBusy = false;
				this.autoReuseOnly = true; // 自动重译只用词典
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
	}

	private promptUiScope() {
		const modal = new UIScopeModal(this.app, this.settings.uiScope, async (val) => {
			await this.setUiScope(val);
		});
		modal.open();
	}

	async setUiScope(val: string) {
		const scope = val.trim() || "ui-global";
		this.settings.uiScope = scope;
		const list = [scope, ...this.settings.recentUiScopes];
		this.settings.recentUiScopes = Array.from(new Set(list)).slice(0, 5);
		if (!this.settings.uiScopes.includes(scope)) {
			this.settings.uiScopes.push(scope);
		}
		await this.saveSettings();
		this.uiSession = null; // 重置以清空缓存
	}

	private async renameScope(oldName: string, newName: string) {
		if (!newName) return;
		await this.dictStore?.renameScope(oldName, newName);
		this.settings.uiScopes = this.settings.uiScopes.map((s) =>
			s === oldName ? newName : s
		);
		this.settings.recentUiScopes = this.settings.recentUiScopes.map((s) =>
			s === oldName ? newName : s
		);
		if (this.settings.uiScope === oldName) {
			this.settings.uiScope = newName;
		}
		await this.saveSettings();
		this.uiSession = null;
	}

	private async deleteScope(name: string) {
		if (name === "ui-global") return; // 保留默认
		await this.dictStore?.removeScope(name);
		this.settings.uiScopes = this.settings.uiScopes.filter((s) => s !== name);
		this.settings.recentUiScopes = this.settings.recentUiScopes.filter(
			(s) => s !== name
		);
		if (this.settings.uiScope === name) {
			this.settings.uiScope = "ui-global";
		}
		await this.saveSettings();
		this.uiSession = null;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		// 迁移：旧的 skipSelectors -> 单个预设
		if (!this.settings.skipPresets || this.settings.skipPresets.length === 0) {
			this.settings.skipPresets = [
				{
					name: "custom",
					selectors: [...(this.settings.skipSelectors || [])],
					enabled: true,
				},
			];
		}
		this.settings.skipPresets = this.settings.skipPresets.map((p) => ({
			enabled: true,
			...p,
		}));
		// 确保 skipSelectors 与 presets 同步
		this.settings.skipSelectors = this.flattenSkipSelectors(this.settings.skipPresets);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private getTranslationDir() {
		const adapter = this.app.vault.adapter as any;
		const basePath: string | undefined = adapter?.basePath;
		if (basePath) {
			return path.join(
				basePath,
				".obsidian",
				"plugins",
				this.manifest.id,
				"translation"
			);
		}
		return path.join(process.cwd(), "translation");
	}

	public flattenSkipSelectors(presets: SkipPreset[]) {
		return Array.from(
			new Set(
				presets
					.filter((p) => p.enabled !== false)
					.map((p) => p.selectors || [])
					.flat()
					.map((s) => s.trim())
					.filter(Boolean)
			)
		);
	}

	openScopeMenu(x: number, y: number) {
		this.closeScopeMenu();
		const menu = document.createElement("div");
		menu.className = "kiss-scope-menu";
		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;

		const title = document.createElement("div");
		title.textContent = "选择 UI 词典";
		title.className = "kiss-scope-menu-title";
		menu.appendChild(title);

		const actions = document.createElement("div");
		actions.className = "kiss-scope-actions";
		const translateBtn = document.createElement("button");
		translateBtn.textContent = "翻译当前页面";
		translateBtn.onclick = (e) => {
			e.stopPropagation();
			this.translateUIWithFab();
			this.closeScopeMenu();
		};
		actions.appendChild(translateBtn);
		menu.appendChild(actions);

		const switches = document.createElement("div");
		switches.className = "kiss-scope-switches";

		// 编辑模式开关
		const editRow = document.createElement("label");
		editRow.className = "kiss-switch-row";
		const editInput = document.createElement("input");
		editInput.type = "checkbox";
		editInput.checked = !!this.settings.editMode;
		editInput.onchange = async () => {
			this.settings.editMode = editInput.checked;
			await this.saveSettings();
			this.session?.updateSettings(this.settings);
			this.uiSession?.updateSettings(this.settings);
		};
		const editText = document.createElement("span");
		editText.textContent = "编辑模式";
		editRow.appendChild(editInput);
		editRow.appendChild(editText);
		switches.appendChild(editRow);

		// 手动触发翻译按钮
		const manualBtn = document.createElement("button");
		manualBtn.textContent = "手动触发翻译";
		manualBtn.className = "kiss-manual-btn";
		manualBtn.onclick = async (e) => {
			e.stopPropagation();
			this.autoReuseOnly = false;
			this.translateUIWithFab();
			this.closeScopeMenu();
		};
		switches.appendChild(manualBtn);

		// 隐藏原文开关
		const hideRow = document.createElement("label");
		hideRow.className = "kiss-switch-row";
		const hideInput = document.createElement("input");
		hideInput.type = "checkbox";
		hideInput.checked = this.settings.hideOriginal;
		hideInput.onchange = async () => {
			this.settings.hideOriginal = hideInput.checked;
			await this.saveSettings();
			if (this.session) {
				this.session.updateSettings(this.settings);
				this.session.applyOriginalVisibility();
			}
			// 同步悬停展示原文的可用状态
			if (!this.settings.hideOriginal) {
				this.settings.smartOriginal = false;
				smartInput.checked = false;
				smartInput.disabled = true;
				await this.saveSettings();
			} else {
				smartInput.disabled = false;
				smartInput.checked = !!this.settings.smartOriginal;
			}
		};
		const hideText = document.createElement("span");
		hideText.textContent = "隐藏原文";
		hideRow.appendChild(hideInput);
		hideRow.appendChild(hideText);
		switches.appendChild(hideRow);

		// 悬停展示原文（需隐藏原文开启，缩进显示）
		const smartRow = document.createElement("label");
		smartRow.className = "kiss-switch-row";
		smartRow.style.marginLeft = "16px";
		const smartInput = document.createElement("input");
		smartInput.type = "checkbox";
		smartInput.checked = !!this.settings.smartOriginal;
		smartInput.disabled = !this.settings.hideOriginal;
		smartInput.onchange = async () => {
			this.settings.smartOriginal = !!smartInput.checked;
			await this.saveSettings();
		};
		const smartText = document.createElement("span");
		smartText.textContent = "悬停时展示原文（只在隐藏原文时生效）";
		smartRow.appendChild(smartInput);
		smartRow.appendChild(smartText);
		switches.appendChild(smartRow);

		menu.appendChild(switches);

		const recentWrapper = document.createElement("div");
		recentWrapper.className = "kiss-scope-recent";
		recentWrapper.textContent = "最近";
		menu.appendChild(recentWrapper);

		const recentList = document.createElement("div");
		recentList.className = "kiss-scope-menu-list";
		(this.settings.recentUiScopes || []).slice(0, 3).forEach((scope) => {
			const item = document.createElement("div");
			item.textContent = scope;
			item.className = "kiss-scope-menu-item";
			item.onclick = async () => {
				await this.setUiScope(scope);
				this.closeScopeMenu();
			};
			recentList.appendChild(item);
		});
		menu.appendChild(recentList);

		const listWrap = document.createElement("div");
		listWrap.className = "kiss-scope-list-wrap";

		const addRow = document.createElement("div");
		addRow.className = "kiss-scope-add-row";
		const addInput = document.createElement("input");
		addInput.placeholder = "新增词典";
		const addBtn = document.createElement("button");
		addBtn.textContent = "添加";
		addInput.onclick = (e) => e.stopPropagation();
		addBtn.onclick = async (e) => {
			e.stopPropagation();
			await this.setUiScope(addInput.value);
			this.closeScopeMenu();
		};
		addRow.appendChild(addInput);
		addRow.appendChild(addBtn);
		listWrap.appendChild(addRow);

		const fullList = document.createElement("div");
		fullList.className = "kiss-scope-full-list";
		(this.settings.uiScopes || []).forEach((scope) => {
			const row = document.createElement("div");
			row.className = "kiss-scope-row";

			const name = document.createElement("span");
			name.textContent = scope === this.settings.uiScope ? `* ${scope}` : scope;
			name.className = "kiss-scope-name";
			name.onclick = async () => {
				await this.setUiScope(scope);
				this.closeScopeMenu();
			};

			const renameBtn = document.createElement("button");
			renameBtn.textContent = "改名";
			renameBtn.onclick = async (e) => {
				e.stopPropagation();
				row.replaceChildren();
				const input = document.createElement("input");
				input.value = scope;
				const ok = document.createElement("button");
				ok.textContent = "保存";
				const cancel = document.createElement("button");
				cancel.textContent = "取消";
				ok.onclick = async (ev) => {
					ev.stopPropagation();
					const val = input.value.trim();
					if (!val) return;
					await this.renameScope(scope, val);
					this.closeScopeMenu();
				};
				cancel.onclick = (ev) => {
					ev.stopPropagation();
					this.closeScopeMenu();
					this.openScopeMenu(x, y);
				};
				row.appendChild(input);
				row.appendChild(ok);
				row.appendChild(cancel);
				input.focus();
			};

			const delBtn = document.createElement("button");
			delBtn.textContent = "删除";
			delBtn.onclick = async (e) => {
				e.stopPropagation();
				await this.deleteScope(scope);
				this.closeScopeMenu();
			};

			row.appendChild(name);
			row.appendChild(renameBtn);
			row.appendChild(delBtn);
			fullList.appendChild(row);
		});

		listWrap.appendChild(fullList);
		menu.appendChild(listWrap);

		document.body.appendChild(menu);
		this.scopeMenuEl = menu;

		this.scopeMenuHandler = (evt: MouseEvent) => {
			if (!menu.contains(evt.target as Node)) {
				this.closeScopeMenu();
			}
		};
		setTimeout(() => {
			if (this.scopeMenuHandler) {
				document.addEventListener("click", this.scopeMenuHandler);
			}
		}, 0);
	}

	closeScopeMenu() {
		if (this.scopeMenuEl) {
			this.scopeMenuEl.remove();
			this.scopeMenuEl = null;
		}
		if (this.scopeMenuHandler) {
			document.removeEventListener("click", this.scopeMenuHandler);
			this.scopeMenuHandler = null;
		}
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
			.setName("最大文本长度")
			.setDesc("单块文本超过此长度则不翻译（默认 160 字符）。")
			.addText((text) =>
				text
					.setPlaceholder("160")
					.setValue(String(this.plugin.settings.maxTextLength ?? 160))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						this.plugin.settings.maxTextLength = Number.isFinite(num)
							? Math.max(1, num)
							: 160;
						await this.plugin.saveSettings();
					})
			);

		const presetsHeader = new Setting(containerEl)
			.setName("不翻译的选择器预设")
			.setDesc("为不同界面创建可重用的选择器预设，匹配的元素及其子节点不会被翻译。");
		presetsHeader.addButton((btn) =>
			btn.setButtonText("新增预设").onClick(async () => {
				this.plugin.settings.skipPresets?.push({
					name: "preset_" + (this.plugin.settings.skipPresets?.length || 0),
					selectors: [],
					enabled: true,
				});
				this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
					this.plugin.settings.skipPresets || []
				);
				await this.plugin.saveSettings();
				this.display();
			})
		);

		const presetsContainer = containerEl.createDiv({ cls: "skip-presets-container" });
		(this.plugin.settings.skipPresets || []).forEach((preset, index) => {
			const row = presetsContainer.createDiv({ cls: "skip-preset-row" });
			// 名称
			const nameLabel = row.createEl("div", { text: "名称", cls: "skip-preset-label" });
			const nameInput = row.createEl("input", { value: preset.name });
			nameInput.oninput = async (e: any) => {
				preset.name = (e.target.value || "").trim();
				await this.plugin.saveSettings();
			};

			// 选择器
			const selLabel = row.createEl("div", { text: "选择器（每行一个）", cls: "skip-preset-label" });
			const selArea = row.createEl("textarea");
			selArea.value = preset.selectors.join("\n");
			selArea.oninput = async (e: any) => {
				preset.selectors = (e.target.value || "")
					.split(/\n|,/)
					.map((s: string) => s.trim())
					.filter(Boolean);
				this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
					this.plugin.settings.skipPresets || []
				);
				await this.plugin.saveSettings();
				this.plugin.session?.updateSettings(this.plugin.settings);
				this.plugin.uiSession?.updateSettings(this.plugin.settings);
			};

			// 开关 + 删除
			const actionRow = row.createDiv({ cls: "skip-preset-actions" });
			const toggleLabel = actionRow.createEl("span", { text: "启用" });
			const toggle = actionRow.createEl("input", { attr: { type: "checkbox" } });
			toggle.checked = preset.enabled !== false;
			toggle.onchange = async (e: any) => {
				preset.enabled = !!e.target.checked;
				this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
					this.plugin.settings.skipPresets || []
				);
				await this.plugin.saveSettings();
			};

			const delBtn = actionRow.createEl("button", { text: "删除" });
			delBtn.onclick = async () => {
				this.plugin.settings.skipPresets?.splice(index, 1);
				this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
					this.plugin.settings.skipPresets || []
				);
				await this.plugin.saveSettings();
				this.display();
			};

			// 缩进
			row.style.marginLeft = "16px";
			nameLabel.style.display = "block";
			selLabel.style.display = "block";
			nameInput.style.width = "100%";
			selArea.style.width = "100%";
			selArea.style.minHeight = "60px";
		});

		new Setting(containerEl)
			.setName("UI 词典名")
			.setDesc("悬浮球翻译 UI 时使用的词典作用域，例如 ui-global 或具体插件名。")
			.addText((text) =>
				text
					.setPlaceholder("ui-global")
					.setValue(this.plugin.settings.uiScope)
					.onChange(async (value) => {
						await this.plugin.setUiScope(value);
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

class UIScopeModal extends Modal {
	private value: string;
	private onSubmit: (val: string) => void;

	constructor(app: App, current: string, onSubmit: (val: string) => void) {
		super(app);
		this.value = current || "ui-global";
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "设置当前 UI 词典名" });
		const input = contentEl.createEl("input", { value: this.value });
		input.style.width = "100%";
		input.focus();

		const btn = contentEl.createEl("button", { text: "确定" });
		btn.onclick = () => {
			this.onSubmit(input.value.trim());
			this.close();
		};
	}
}
