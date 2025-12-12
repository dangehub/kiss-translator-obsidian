import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Modal,
	getLanguage,
} from "obsidian";
import { TranslationSession } from "./src/translator";
import { FloatingFab } from "./src/fab";
import { DictionaryStore } from "./src/dictionary";
import { fetchCloudDict, fetchRegistry, type CloudDictMeta } from "./src/cloud";
import { formatLangLabel, normalizeLang, t } from "./src/i18n";

export interface KissTranslatorSettings {
	apiType: "openai";
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
	extractOnly: boolean;
	cloudRegistryUrl?: string;
	cloudRegistryLang?: string;
	editMode?: boolean;
	smartOriginal?: boolean;
	maxTextLength?: number;
	fabPosition?: { x: number; y: number };
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
				"body > div.app-container > div.horizontal-main-container > div > div.workspace-split.mod-vertical.mod-root > div > div.workspace-tab-container > div.workspace-leaf.mod-active > div > div.view-content > div.markdown-reading-view > div",
				"body > div.app-container > div.horizontal-main-container > div > div.workspace-split.mod-vertical.mod-root > div > div.workspace-tab-container > div.workspace-leaf.mod-active > div > div.view-content > div.markdown-source-view.cm-s-obsidian.mod-cm6.node-insert-event.is-readable-line-width.is-live-preview.is-folding.show-properties > div > div.cm-scroller",
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
	extractOnly: false,
	cloudRegistryUrl: "https://raw.githubusercontent.com/dangehub/obsidian-translay-translator/refs/heads/main/translations/registry.json",
	cloudRegistryLang: "",
	editMode: false,
	smartOriginal: false,
	maxTextLength: 500,
	fabPosition: undefined,
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
	private uiScrollHandler: (() => void) | null = null;
	private uiResizeHandler: (() => void) | null = null;
	private uiScrollContainer: HTMLElement | null = null;
	private uiCurrentTarget: HTMLElement | null = null;
	private uiTargetPageKey: string | null = null;
	private uiDictionaryPending = false;
	private suppressUiAuto = false;
	private uiDictionaryEnabled = true;
	private fabState: "off" | "empty" | "active" = "off";
	private fabInitialized = false;
	private pickerActive = false;
	private pickerHighlight: HTMLElement | null = null;
	private pickerMoveHandler: ((ev: MouseEvent) => void) | null = null;
	private pickerClickHandler: ((ev: MouseEvent) => void) | null = null;
	private pickerKeyHandler: ((ev: KeyboardEvent) => void) | null = null;
	private pickerCurrentTarget: HTMLElement | null = null;
	cloudRegistry: CloudDictMeta[] = [];
	cloudRegistryLangs: string[] = [];
	cloudRegistryLoading = false;
	cloudRegistryError: string | null = null;
	cloudRegistryQuery = "";

	async onload() {
		await this.loadSettings();
		this.dictStore = new DictionaryStore(this.getTranslationDir(), this.app.vault.adapter);
		await this.dictStore.ensureReady();
		await this.syncUiScopesFromDisk();

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
		this.stopElementPicker();
		this.fab?.unmount();
		this.dictStore?.flush().catch((err) => console.error(err));
		this.closeScopeMenu();
		this.stopUiAutoApply();
	}

	private setFabState(state: "off" | "empty" | "active") {
		this.fabState = state;
		this.fab?.setState(state);
	}

	async saveFabPosition(pos: { x: number; y: number }) {
		this.settings.fabPosition = pos;
		await this.saveSettings();
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
			new Notice(this.tr("notice.readingRequired"));
			return;
		}
		this.ensureSession(view);
		this.session?.translate().catch((err) => {
			console.error(err);
			new Notice(this.tr("notice.error", { msg: err.message }));
		});
	}

	extractUIWithFab(targetOverride?: HTMLElement) {
		if (this.uiBusy) {
			new Notice(this.tr("notice.extracting"));
			return;
		}
		const target = targetOverride ?? this.findUiTarget();
		if (!target) {
			new Notice(this.tr("notice.extract.none"));
			return;
		}

		this.prepareUiSession();
		this.uiDictionaryEnabled = true;
		const session = this.uiSession;
		if (!session) return;
		this.suppressUiAuto = true;
		this.uiBusy = true;
		session
			.extractOnly(target)
			.then(() => {
				this.setFabState("active");
			})
			.catch((err) => {
				console.error(err);
				this.setFabState("off");
				new Notice(this.tr("notice.error", { msg: err.message }));
			})
			.finally(() => {
				this.uiBusy = false;
				this.resumeUiAutoSoon();
			});
	}

	translateUIWithFab(targetOverride?: HTMLElement) {
		if (this.uiBusy) {
			new Notice(this.tr("notice.translate.busy"));
			return;
		}
		const target = targetOverride ?? this.findUiTarget();
		if (!target) {
			new Notice(this.tr("notice.translate.none"));
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
				new Notice(this.tr("notice.error", { msg: err.message }));
			})
			.finally(() => {
				this.uiBusy = false;
				this.resumeUiAutoSoon();
			});
	}

	private handlePickedElement(target: HTMLElement) {
		if (this.settings.extractOnly) {
			this.extractPickedElement(target);
		} else {
			this.translatePickedElement(target);
		}
	}

	private startElementPicker() {
		if (this.pickerActive) {
			this.stopElementPicker();
			return;
		}
		this.pickerActive = true;
		document.body.classList.add("kiss-picker-active");

		const highlight = document.createElement("div");
		highlight.className = "kiss-picker-highlight";
		document.body.appendChild(highlight);
		this.pickerHighlight = highlight;

		this.pickerMoveHandler = (ev: MouseEvent) => {
			const target = this.getPickTarget(ev.clientX, ev.clientY);
			this.pickerCurrentTarget = target;
			this.updatePickerHighlight(target);
		};
		this.pickerClickHandler = (ev: MouseEvent) => {
			ev.preventDefault();
			ev.stopPropagation();
			const target = this.getPickTarget(ev.clientX, ev.clientY) || this.pickerCurrentTarget;
			this.stopElementPicker();
			if (target) {
				this.handlePickedElement(target);
			}
		};
		this.pickerKeyHandler = (ev: KeyboardEvent) => {
			if (ev.key === "Escape") {
				this.stopElementPicker();
			}
		};

		document.addEventListener("mousemove", this.pickerMoveHandler, true);
		document.addEventListener("click", this.pickerClickHandler, true);
		document.addEventListener("keydown", this.pickerKeyHandler, true);
	}

	private stopElementPicker() {
		if (!this.pickerActive) return;
		this.pickerActive = false;
		document.body.classList.remove("kiss-picker-active");
		if (this.pickerHighlight) {
			this.pickerHighlight.remove();
			this.pickerHighlight = null;
		}
		if (this.pickerMoveHandler) {
			document.removeEventListener("mousemove", this.pickerMoveHandler, true);
			this.pickerMoveHandler = null;
		}
		if (this.pickerClickHandler) {
			document.removeEventListener("click", this.pickerClickHandler, true);
			this.pickerClickHandler = null;
		}
		if (this.pickerKeyHandler) {
			document.removeEventListener("keydown", this.pickerKeyHandler, true);
			this.pickerKeyHandler = null;
		}
		this.pickerCurrentTarget = null;
	}

	private translatePickedElement(target: HTMLElement) {
		if (this.uiBusy) {
			new Notice(this.tr("notice.translate.busy"));
			return;
		}
		this.prepareUiSession();
		this.uiDictionaryEnabled = true;
		const session = this.uiSession;
		if (!session) return;
		this.suppressUiAuto = true;
		this.uiBusy = true;
		session
			.translateElement(target, false)
			.then(() => {
				this.setFabState(session.hasTranslations() ? "active" : "empty");
			})
			.catch((err) => {
				console.error(err);
				this.setFabState("off");
				new Notice(this.tr("notice.error", { msg: err.message }));
			})
			.finally(() => {
				this.uiBusy = false;
				this.resumeUiAutoSoon();
			});
	}

	private extractPickedElement(target: HTMLElement) {
		if (this.uiBusy) {
			new Notice(this.tr("notice.extracting"));
			return;
		}
		this.prepareUiSession();
		this.uiDictionaryEnabled = true;
		const session = this.uiSession;
		if (!session) return;
		this.suppressUiAuto = true;
		this.uiBusy = true;
		session
			.extractElement(target)
			.then(() => {
				this.setFabState("active");
			})
			.catch((err) => {
				console.error(err);
				this.setFabState("off");
				new Notice(this.tr("notice.error", { msg: err.message }));
			})
			.finally(() => {
				this.uiBusy = false;
				this.resumeUiAutoSoon();
			});
	}

	private getPickTarget(x: number, y: number): HTMLElement | null {
		let el = document.elementFromPoint(x, y) as HTMLElement | null;
		while (el) {
			if (this.isPickerUi(el)) {
				el = el.parentElement;
				continue;
			}
			if (this.isElementSkippedForPicker(el)) {
				el = el.parentElement;
				continue;
			}
			return el;
		}
		return null;
	}

	private isPickerUi(el: HTMLElement) {
		if (!el) return false;
		if (el === this.pickerHighlight) return true;
		if (el.closest(".kiss-scope-menu")) return true;
		if (el.closest("#kiss-obsidian-fab")) return true;
		return false;
	}

	private isElementSkippedForPicker(el: HTMLElement) {
		const selectors = this.settings.skipSelectors || [];
		for (const sel of selectors) {
			if (!sel) continue;
			try {
				if (el.closest(sel)) return true;
			} catch (_e) {
				// ignore invalid selector
			}
		}
		return false;
	}

	private updatePickerHighlight(target: HTMLElement | null) {
		if (!this.pickerHighlight) return;
		if (!target) {
			this.pickerHighlight.style.display = "none";
			return;
		}
		const rect = target.getBoundingClientRect();
		this.pickerHighlight.style.display = "block";
		this.pickerHighlight.style.left = `${rect.left + window.scrollX}px`;
		this.pickerHighlight.style.top = `${rect.top + window.scrollY}px`;
		this.pickerHighlight.style.width = `${rect.width}px`;
		this.pickerHighlight.style.height = `${rect.height}px`;
	}

	private applyUiDictionaryTranslations() {
		if (this.uiBusy) {
			this.uiDictionaryPending = true;
			return;
		}
		if (!this.uiDictionaryEnabled) return;
		const target = this.findUiTarget();
		if (!target) return;
		this.attachUiScrollHandlers(target);
		this.prepareUiSession();
		const session = this.uiSession;
		if (!session) return;
		const pageKey = this.getTargetPageKey(target);
		if (this.uiCurrentTarget !== target || this.uiTargetPageKey !== pageKey) {
			session.clear();
			this.uiCurrentTarget = target;
			this.uiTargetPageKey = pageKey;
		}
		session.setVisibleContainer(this.uiScrollContainer);
		this.suppressUiAuto = true;
		this.uiBusy = true;
		session
			.translate(target, { dictionaryOnly: true, visibleOnly: true })
			.then(() => {
				this.setFabState(session.hasTranslations() ? "active" : "empty");
			})
			.catch((err) => {
				console.error(err);
			})
			.finally(() => {
				this.uiBusy = false;
				if (this.uiDictionaryPending) {
					this.uiDictionaryPending = false;
					this.scheduleUiDictionaryApply();
				}
				this.resumeUiAutoSoon();
			});
	}

	toggleUiDictionaryTranslations() {
		if (this.uiBusy) {
			new Notice(this.tr("notice.translate.busy"));
			return;
		}
		// 如果当前已经开启（无论有无译文），则关闭
		if (this.fabState !== "off") {
			this.suppressUiAuto = true;
			this.uiSession?.clear();
			this.setFabState("off");
			this.uiDictionaryEnabled = false;
			this.resumeUiAutoSoon();
			return;
		}
		this.uiDictionaryEnabled = true;
		this.applyUiDictionaryTranslations();
	}

	private findUiTarget(): HTMLElement | null {
		// 优先翻译最上层弹窗（非设置页也包含），否则退到工作区
		const modal =
			document.querySelector<HTMLElement>(".modal-container .modal:not(.mod-sidebar-layout)") ||
			document.querySelector<HTMLElement>(".modal.mod-settings") ||
			document.querySelector<HTMLElement>(".modal-container .mod-settings");
		if (modal) return modal;
		return (
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
		}, 120);
	}

	private startUiAutoApply() {
		if (this.uiMutationObserver || !document?.body) return;
		this.uiMutationObserver = new MutationObserver((records) => {
			if (this.suppressUiAuto) return;
			// 编辑浮层存在时不触发自动应用，避免输入时被刷掉
			if (document.querySelector(".kiss-edit-wrapper")) return;
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

		const onScroll = () => {
			if (this.suppressUiAuto) return;
			this.scheduleUiDictionaryApply();
		};
		const onResize = () => {
			if (this.suppressUiAuto) return;
			this.scheduleUiDictionaryApply();
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);
		this.uiScrollHandler = () => window.removeEventListener("scroll", onScroll);
		this.uiResizeHandler = () => window.removeEventListener("resize", onResize);

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
		if (this.uiScrollHandler) {
			this.uiScrollHandler();
			this.uiScrollHandler = null;
		}
		if (this.uiResizeHandler) {
			this.uiResizeHandler();
			this.uiResizeHandler = null;
		}
		if (this.uiScrollContainer) {
			this.uiScrollContainer = null;
		}
		this.uiCurrentTarget = null;
		this.uiTargetPageKey = null;
	}

	private attachUiScrollHandlers(target: HTMLElement) {
		const container = this.findScrollContainer(target);
		if (container === this.uiScrollContainer) return;
		// no specific container found, rely on window scroll
		if (this.uiScrollContainer && this.uiScrollHandler) {
			// previous container cleanup handled by handler
			this.uiScrollHandler();
			this.uiScrollHandler = null;
		}
		this.uiScrollContainer = container;
		if (!container) return;
		const onScroll = () => {
			if (this.suppressUiAuto) return;
			this.scheduleUiDictionaryApply();
		};
		container.addEventListener("scroll", onScroll, { passive: true });
		this.uiScrollHandler = () => container.removeEventListener("scroll", onScroll);
	}

	private findScrollContainer(target: HTMLElement): HTMLElement | null {
		// 针对设置页优先定位可能的滚动容器
		const settingsModal = target.closest(".modal.mod-settings");
		if (settingsModal) {
			const preferredSelectors = [
				"body > div.modal-container.mod-dim > div.modal.mod-settings.mod-sidebar-layout > div.modal-content.vertical-tabs-container > div.vertical-tab-content-container > div",
				".modal.mod-settings .vertical-tab-content",
				".modal.mod-settings .vertical-tab-content-container",
			];
			for (const sel of preferredSelectors) {
				const candidate = settingsModal.querySelector<HTMLElement>(sel);
				if (candidate && candidate.scrollHeight > candidate.clientHeight + 8) {
					return candidate;
				}
			}
		}
		let el: HTMLElement | null = target;
		while (el) {
			const style = getComputedStyle(el);
			const canScrollY =
				el.scrollHeight > el.clientHeight + 8 &&
				(style.overflowY === "auto" || style.overflowY === "scroll");
			if (canScrollY) return el;
			el = el.parentElement;
		}
		return null;
	}

	private getTargetPageKey(target: HTMLElement): string {
		// 针对设置页，使用当前激活 tab 作为页面标识
		const settingsModal = target.closest(".modal.mod-settings");
		if (settingsModal) {
			const activeTab =
				settingsModal.querySelector<HTMLElement>(".vertical-tab-header .is-active") ||
				settingsModal.querySelector<HTMLElement>(".vertical-tab-header .nav-action.is-active");
			const text = activeTab?.textContent?.trim();
			if (text) return `settings:${text}`;
		}
		// 通用兜底：使用 target 的 tag + class + 可见标题
		const title =
			target.getAttribute("aria-label") ||
			target.querySelector<HTMLElement>(".view-header-title")?.textContent ||
			target.querySelector<HTMLElement>(".modal-title")?.textContent ||
			target.querySelector<HTMLElement>("h1,h2,h3")?.textContent ||
			"";
		const cls = Array.from(target.classList).join(".");
		return `${target.tagName.toLowerCase()}.${cls}:${(title || "").trim()}`;
	}

	private clearActive() {
		const view = this.getActiveMarkdownView();
		if (!view) return;
		this.ensureSession(view);
		this.session?.clear();
	}

	private toggleOriginal() {
		this.settings.hideOriginal = !this.settings.hideOriginal;
		void this.saveSettings();
		if (this.session) {
			this.session.updateSettings(this.settings);
			this.session.applyOriginalVisibility();
		}
	}

	private promptUiScope() {
		const modal = new UIScopeModal(this, this.settings.uiScope, async (val) => {
			await this.setUiScope(val);
		});
		modal.open();
	}

	async setUiScope(val: string) {
		const scope = val.trim() || "ui-global";
		this.settings.uiScope = scope;
		const list = [scope, ...this.settings.recentUiScopes];
		this.settings.recentUiScopes = Array.from(new Set(list)).slice(0, 5);
		this.settings.uiScopes = Array.from(new Set([...(this.settings.uiScopes || []), scope]));
		await this.dictStore?.ensureScope(scope);
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
	// 使用 vault 相对路径，兼容移动端
	return `.obsidian/plugins/${this.manifest.id}/translation`;
}

	get uiLang() {
		return normalizeLang(getLanguage?.() || "en");
	}

	tr(key: string, params?: Record<string, string | number>) {
		return t(this.uiLang, key, params);
	}

	async refreshCloudRegistry() {
		if (!this.settings.cloudRegistryUrl) {
			this.cloudRegistry = [];
			this.cloudRegistryError = null;
			this.cloudRegistryLangs = [];
			return;
		}
		this.cloudRegistryLoading = true;
		this.cloudRegistryError = null;
		try {
			const list = await fetchRegistry(this.settings.cloudRegistryUrl);
			this.cloudRegistry = list;
			const langs = Array.from(
				new Set(
					list
						.map((i) => i.lang || "")
						.map((s) => s.trim())
				)
			);
			this.cloudRegistryLangs = langs;
			if (!this.settings.cloudRegistryLang || !langs.includes(this.settings.cloudRegistryLang)) {
				const userLang = this.uiLang;
				const matchExact = langs.find((l) => l.toLowerCase() === userLang);
				const matchPrimary = langs.find(
					(l) => l.toLowerCase().split("-")[0] === userLang.split("-")[0]
				);
				const matchEn = langs.find((l) => l.toLowerCase() === "en");
				this.settings.cloudRegistryLang =
					matchExact || matchPrimary || matchEn || langs[0] || "";
				await this.saveSettings();
			}
		} catch (err) {
			console.error(err);
			this.cloudRegistryError = (err as any)?.message || String(err);
		} finally {
			this.cloudRegistryLoading = false;
		}
	}

	async downloadCloudDict(meta: CloudDictMeta) {
		if (!this.dictStore) return;
		const notice = new Notice(this.tr("notice.download.start", { name: meta.name || meta.scope }));
		try {
			const file = await fetchCloudDict(meta);
			await this.dictStore.ensureScope(file.scope);
			await this.dictStore.import(file.scope, file);
			if (!this.settings.uiScopes.includes(file.scope)) {
				this.settings.uiScopes.push(file.scope);
			}
			this.settings.recentUiScopes = Array.from(
				new Set([file.scope, ...this.settings.recentUiScopes])
			).slice(0, 5);
			await this.saveSettings();
			this.uiSession = null;
			notice.setMessage(this.tr("notice.download.success", { name: meta.name || meta.scope }));
		} catch (err) {
			console.error(err);
			new Notice(
				this.tr("notice.download.fail", { msg: (err as any)?.message || String(err) })
			);
		}
	}

	private async syncUiScopesFromDisk() {
		if (!this.dictStore) return;
		const diskScopes = await this.dictStore.listScopes();
		const merged = new Set<string>([
			"ui-global",
			...(this.settings.uiScopes || []),
			...diskScopes,
		]);
		this.settings.uiScopes = Array.from(merged);
		this.settings.recentUiScopes = (this.settings.recentUiScopes || []).filter((s) =>
			merged.has(s)
		);
		if (!merged.has(this.settings.uiScope)) {
			this.settings.uiScope = "ui-global";
		}
		await this.saveSettings();
	}

	private applyCss(el: HTMLElement, props: Record<string, string>) {
		const target = el as any;
		if (typeof target.setCssProps === "function") {
			target.setCssProps(props);
		} else {
			Object.entries(props).forEach(([k, v]) => el.style.setProperty(k, v));
		}
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
		this.applyCss(menu, { left: `${x}px`, top: `${y}px` });
		const conflictMsg = this.tr("ui.menu.conflict");
		if (this.settings.hideOriginal && this.settings.smartOriginal && this.settings.editMode) {
			this.settings.smartOriginal = false;
			void this.saveSettings();
		}

		const title = document.createElement("div");
		title.textContent = this.tr("ui.menu.title");
		title.className = "kiss-scope-menu-title";
		menu.appendChild(title);

		const actions = document.createElement("div");
		actions.className = "kiss-scope-actions";
		const translateBtn = document.createElement("button");
		translateBtn.textContent = this.settings.extractOnly
			? this.tr("ui.menu.extract")
			: this.tr("ui.menu.translate");
		translateBtn.onclick = (e) => {
			e.stopPropagation();
			if (this.settings.extractOnly) {
				this.extractUIWithFab();
			} else {
				this.translateUIWithFab();
			}
			this.closeScopeMenu();
		};
		actions.appendChild(translateBtn);
		const pickBtn = document.createElement("button");
		pickBtn.textContent = this.settings.extractOnly
			? this.tr("ui.menu.pickExtract")
			: this.tr("ui.menu.pickTranslate");
		pickBtn.onclick = (e) => {
			e.stopPropagation();
			this.startElementPicker();
			this.closeScopeMenu();
		};
		actions.appendChild(pickBtn);
		menu.appendChild(actions);

		const switches = document.createElement("div");
		switches.className = "kiss-scope-switches";

		// 编辑模式开关
		const editRow = document.createElement("label");
		editRow.className = "kiss-switch-row";
		const editInput = document.createElement("input");
		editInput.type = "checkbox";
		editInput.checked = !!this.settings.editMode;
		editInput.onchange = () => {
			const next = !!editInput.checked;
			if (next && this.settings.hideOriginal && this.settings.smartOriginal) {
				editInput.checked = false;
				new Notice(conflictMsg);
				return;
			}
			this.settings.editMode = next;
			void this.saveSettings();
			this.session?.updateSettings(this.settings);
			this.uiSession?.updateSettings(this.settings);
		};
		const editText = document.createElement("span");
		editText.textContent = this.tr("ui.menu.edit");
		editRow.appendChild(editInput);
		editRow.appendChild(editText);
		switches.appendChild(editRow);

		// 隐藏原文开关
		const hideRow = document.createElement("label");
		hideRow.className = "kiss-switch-row";
		const hideInput = document.createElement("input");
		hideInput.type = "checkbox";
		hideInput.checked = this.settings.hideOriginal;
		hideInput.onchange = () => {
			const next = !!hideInput.checked;
			if (next && this.settings.smartOriginal && this.settings.editMode) {
				hideInput.checked = false;
				new Notice(conflictMsg);
				return;
			}
			this.settings.hideOriginal = next;
			void this.saveSettings();
			if (this.session) {
				this.session.updateSettings(this.settings);
				this.session.applyOriginalVisibility();
			}
			// 同步悬停展示原文的可用状态
			if (!this.settings.hideOriginal) {
				this.settings.smartOriginal = false;
				smartInput.checked = false;
				smartInput.disabled = true;
				void this.saveSettings();
			} else {
				smartInput.disabled = false;
				smartInput.checked = !!this.settings.smartOriginal;
			}
		};
		const hideText = document.createElement("span");
		hideText.textContent = this.tr("ui.menu.hide");
		hideRow.appendChild(hideInput);
		hideRow.appendChild(hideText);
		switches.appendChild(hideRow);

		// 悬停展示原文（需隐藏原文开启，缩进显示）
		const smartRow = document.createElement("label");
		smartRow.className = "kiss-switch-row kiss-smart-row-indent";
		const smartInput = document.createElement("input");
		smartInput.type = "checkbox";
		smartInput.checked = !!this.settings.smartOriginal;
		smartInput.disabled = !this.settings.hideOriginal;
		smartInput.onchange = () => {
			const next = !!smartInput.checked;
			if (next && this.settings.hideOriginal && this.settings.editMode) {
				smartInput.checked = false;
				this.settings.smartOriginal = false;
				new Notice(conflictMsg);
				return;
			}
			this.settings.smartOriginal = next;
			void this.saveSettings();
		};
		const smartText = document.createElement("span");
		smartText.textContent = this.tr("ui.menu.smart");
		smartRow.appendChild(smartInput);
		smartRow.appendChild(smartText);
		switches.appendChild(smartRow);

		menu.appendChild(switches);

		const recentWrapper = document.createElement("div");
		recentWrapper.className = "kiss-scope-recent";
		recentWrapper.textContent = this.tr("ui.menu.recent");
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
		addInput.placeholder = this.tr("ui.menu.addPlaceholder");
		const addBtn = document.createElement("button");
		addBtn.textContent = this.tr("ui.menu.add");
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
			renameBtn.textContent = this.tr("ui.menu.rename");
			renameBtn.onclick = async (e) => {
				e.stopPropagation();
				row.replaceChildren();
				const input = document.createElement("input");
				input.value = scope;
				const ok = document.createElement("button");
				ok.textContent = this.tr("ui.menu.save");
				const cancel = document.createElement("button");
				cancel.textContent = this.tr("ui.menu.cancel");
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
			delBtn.textContent = this.tr("ui.menu.remove");
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
		const tr = (key: string, params?: Record<string, string | number>) =>
			this.plugin.tr(key, params);

		// 按指南避免额外顶级 heading，直接列出设置项

		const cloudSection = containerEl.createDiv({ cls: "kiss-cloud-section" });
		cloudSection.createEl("h3", { text: tr("section.cloud") });
		new Setting(cloudSection)
			.setName(tr("cloud.registry"))
			.setDesc(tr("cloud.registry.desc"))
			.addText((text) =>
				text
					.setPlaceholder("https://example.com/registry.json")
					.setValue(this.plugin.settings.cloudRegistryUrl || "")
					.onChange(async (value) => {
						this.plugin.settings.cloudRegistryUrl = value.trim();
						await this.plugin.saveSettings();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("refresh-ccw")
					.setTooltip(tr("cloud.refresh"))
					.onClick(async () => {
						await this.plugin.refreshCloudRegistry();
						this.display();
					})
			);

		if (this.plugin.cloudRegistryLoading) {
			cloudSection.createEl("div", { text: tr("cloud.loading") });
		} else if (this.plugin.cloudRegistryError) {
			cloudSection.createEl("div", {
				text: tr("cloud.error", { msg: this.plugin.cloudRegistryError }),
				cls: "mod-warning",
			});
		} else if (this.plugin.cloudRegistry.length > 0) {
			let listContainer: HTMLDivElement | null = null;
			const renderList = () => {
				if (!listContainer) return;
				listContainer.empty();
				const langFilter = (this.plugin.settings.cloudRegistryLang || "").trim();
				const query = (this.plugin.cloudRegistryQuery || "").trim().toLowerCase();
				const filtered = this.plugin.cloudRegistry
					.filter((item) => {
						if (langFilter && (item.lang || "").trim() !== langFilter) return false;
						if (!query) return true;
						const name = (item.name || "").toLowerCase();
						const scope = (item.scope || "").toLowerCase();
						return name.includes(query) || scope.includes(query);
					})
					.slice()
					.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

				if (filtered.length === 0) {
					listContainer.createEl("div", { text: tr("cloud.noMatches") });
					return;
				}

				filtered.forEach((item) => {
					const row = listContainer!.createEl("div", { cls: "kiss-cloud-row" });
					const title = row.createEl("div", {
						text: item.name || item.scope,
						cls: "kiss-cloud-title",
					});
					title.setAttr("title", item.description || "");
					row.createEl("div", {
						text: `${tr("cloud.scope")}: ${item.scope}`,
						cls: "kiss-cloud-scope",
					});
					if (item.lang) {
						row.createEl("div", {
							text: `${tr("cloud.lang")}: ${formatLangLabel(item.lang)}`,
							cls: "kiss-cloud-lang",
						});
					}
					const metaLine: string[] = [];
					if (item.updatedAt)
						metaLine.push(`${tr("cloud.updated")}: ${new Date(item.updatedAt).toLocaleString()}`);
					if (item.entryCount) metaLine.push(`${tr("cloud.entries")}: ${item.entryCount}`);
					if (metaLine.length > 0) {
						row.createEl("div", { text: metaLine.join(" · "), cls: "kiss-cloud-meta" });
					}
					const actions = row.createEl("div", { cls: "kiss-cloud-actions" });
					const btn = actions.createEl("button", { text: tr("cloud.download") });
					btn.onclick = async () => {
						btn.setText(tr("cloud.downloading"));
						btn.toggleAttribute("disabled", true);
						await this.plugin.downloadCloudDict(item);
						btn.setText(tr("cloud.download"));
						btn.toggleAttribute("disabled", false);
					};
				});
			};

			if (this.plugin.cloudRegistryLangs.length > 1) {
				new Setting(cloudSection)
					.setName(tr("cloud.selectLang"))
					.addDropdown((dd) => {
						this.plugin.cloudRegistryLangs.forEach((lang) => {
							dd.addOption(lang || "default", formatLangLabel(lang));
						});
						dd.setValue(this.plugin.settings.cloudRegistryLang || "");
						dd.onChange(async (value) => {
							this.plugin.settings.cloudRegistryLang = value;
							await this.plugin.saveSettings();
							renderList();
						});
					});
			}

			new Setting(cloudSection)
				.setName(tr("cloud.search"))
				.setDesc(tr("cloud.search.desc"))
				.addText((text) =>
					text
						.setPlaceholder(tr("cloud.search.placeholder"))
						.setValue(this.plugin.cloudRegistryQuery)
						.onChange((value) => {
							this.plugin.cloudRegistryQuery = value;
							renderList();
						})
				);

			listContainer = cloudSection.createEl("div", { cls: "kiss-cloud-list" });
			renderList();
		} else {
			cloudSection.createEl("div", { text: tr("cloud.empty") });
		}

		const modeSection = containerEl.createDiv();
		modeSection.createEl("h3", { text: tr("section.mode") });

		new Setting(modeSection)
			.setName(tr("mode.extractOnly.name"))
			.setDesc(tr("mode.extractOnly.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.extractOnly).onChange(async (value) => {
					this.plugin.settings.extractOnly = value;
					await this.plugin.saveSettings();
					this.plugin.session?.updateSettings(this.plugin.settings);
					this.plugin.uiSession?.updateSettings(this.plugin.settings);
					this.display();
				})
			);

		new Setting(modeSection)
			.setName(tr("mode.maxTextLength.name"))
			.setDesc(tr("mode.maxTextLength.desc"))
			.addText((text) =>
				text
					.setPlaceholder("500")
					.setValue(String(this.plugin.settings.maxTextLength ?? 500))
					.onChange((value) => {
						const num = parseInt(value, 10);
						this.plugin.settings.maxTextLength = Number.isFinite(num)
							? Math.max(1, num)
							: 500;
						void this.plugin.saveSettings();
					})
			);

		const apiSection = containerEl.createDiv();
		apiSection.createEl("h3", { text: tr("section.api") });

		new Setting(apiSection)
			.setName(tr("api.url"))
			.setDesc(tr("api.url.desc"))
			.addText((text) =>
				text
					.setPlaceholder("https://api.openai.com/v1/chat/completions")
					.setValue(this.plugin.settings.apiUrl)
					.onChange((value) => {
						this.plugin.settings.apiUrl = value.trim();
						void this.plugin.saveSettings();
					})
			);

		new Setting(apiSection)
			.setName(tr("api.key"))
			.setDesc(tr("api.key.desc"))
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange((value) => {
						this.plugin.settings.apiKey = value.trim();
						void this.plugin.saveSettings();
					})
			);

		new Setting(apiSection)
			.setName(tr("api.model"))
			.setDesc(tr("api.model.desc"))
			.addText((text) =>
				text
					.setPlaceholder("gpt-4o-mini")
					.setValue(this.plugin.settings.model)
					.onChange((value) => {
						this.plugin.settings.model = value.trim();
						void this.plugin.saveSettings();
					})
			);

		new Setting(apiSection)
			.setName(tr("api.from"))
			.setDesc(tr("api.from.desc"))
			.addText((text) =>
				text
					.setPlaceholder("auto")
					.setValue(this.plugin.settings.fromLang)
					.onChange((value) => {
						this.plugin.settings.fromLang = value.trim() || "auto";
						void this.plugin.saveSettings();
					})
			);

		new Setting(apiSection)
			.setName(tr("api.to"))
			.setDesc(tr("api.to.desc"))
			.addText((text) =>
				text
					.setPlaceholder("zh")
					.setValue(this.plugin.settings.toLang)
					.onChange((value) => {
						this.plugin.settings.toLang = value.trim() || "zh";
						void this.plugin.saveSettings();
					})
			);

		new Setting(apiSection)
			.setName(tr("prompt.system"))
			.setDesc(tr("prompt.system.desc"))
			.addTextArea((text) =>
				text
					.setPlaceholder("You are a translation engine. Preserve meaning and formatting.")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange((value) => {
						this.plugin.settings.systemPrompt = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(apiSection)
			.setName(tr("prompt.user"))
			.setDesc(tr("prompt.user.desc"))
			.addTextArea((text) =>
				text
					.setPlaceholder(
						"Translate the following text from {from} to {to}. Reply with translation only.\n\n{text}"
					)
					.setValue(this.plugin.settings.userPrompt)
					.onChange((value) => {
						this.plugin.settings.userPrompt = value;
						void this.plugin.saveSettings();
					})
			);

		const skipSection = containerEl.createDiv();
		skipSection.createEl("h3", { text: tr("section.skip") });

		const presetsHeader = new Setting(skipSection)
			.setName(tr("section.skip"))
			.setDesc(tr("skip.desc"));
		presetsHeader.addButton((btn) =>
			btn.setButtonText(tr("skip.add")).onClick(() => {
				void (async () => {
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
				})();
			})
		);

		const presetsContainer = containerEl.createDiv({ cls: "skip-presets-container" });
		(this.plugin.settings.skipPresets || []).forEach((preset, index) => {
			const row = presetsContainer.createDiv({ cls: "skip-preset-row" });
			// 名称
			const nameLabel = row.createEl("div", { text: tr("skip.name"), cls: "skip-preset-label" });
			const nameInput = row.createEl("input", { value: preset.name });
			nameInput.oninput = (e: any) => {
				preset.name = (e.target.value || "").trim();
				void this.plugin.saveSettings();
			};

			// 选择器
			const selLabel = row.createEl("div", { text: tr("skip.selectors"), cls: "skip-preset-label" });
			const selArea = row.createEl("textarea");
			selArea.value = preset.selectors.join("\n");
			selArea.oninput = (e: any) => {
				preset.selectors = (e.target.value || "")
					.split(/\n|,/)
					.map((s: string) => s.trim())
					.filter(Boolean);
				this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
					this.plugin.settings.skipPresets || []
				);
				void this.plugin.saveSettings();
				this.plugin.session?.updateSettings(this.plugin.settings);
				this.plugin.uiSession?.updateSettings(this.plugin.settings);
			};

			// 开关 + 删除
			const actionRow = row.createDiv({ cls: "skip-preset-actions" });
			actionRow.createEl("span", { text: tr("skip.enable") });
			const toggle = actionRow.createEl("input", { attr: { type: "checkbox" } });
			toggle.checked = preset.enabled !== false;
			toggle.onchange = (e: any) => {
				preset.enabled = !!e.target.checked;
				this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
					this.plugin.settings.skipPresets || []
				);
				void this.plugin.saveSettings();
			};

			const delBtn = actionRow.createEl("button", { text: tr("skip.delete") });
			delBtn.onclick = () => {
				void (async () => {
					this.plugin.settings.skipPresets?.splice(index, 1);
					this.plugin.settings.skipSelectors = this.plugin.flattenSkipSelectors(
						this.plugin.settings.skipPresets || []
					);
					await this.plugin.saveSettings();
					this.display();
				})();
			};

			// 样式类
			row.addClass("skip-preset-row-indented");
			nameLabel.addClass("skip-preset-block");
			selLabel.addClass("skip-preset-block");
			nameInput.addClass("skip-preset-input");
			selArea.addClass("skip-preset-textarea");
		});

	}
}

class UIScopeModal extends Modal {
	private value: string;
	private onSubmit: (val: string) => void;
	private plugin: KissTranslatorPlugin;

	constructor(plugin: KissTranslatorPlugin, current: string, onSubmit: (val: string) => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.value = current || "ui-global";
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: this.plugin.tr("modal.scope.title") });
		const input = contentEl.createEl("input", { value: this.value, cls: "kiss-modal-input" });
		input.focus();

		const btn = contentEl.createEl("button", { text: this.plugin.tr("modal.scope.confirm") });
		btn.onclick = () => {
			this.onSubmit(input.value.trim());
			this.close();
		};
	}
}
