import { MarkdownView } from "obsidian";
import type { KissTranslatorSettings } from "../main";
import { DictionaryStore } from "./dictionary";

const TRANSLATION_CLASS = "kiss-translated-block";
const HIDE_ORIGINAL_CLASS = "kiss-hide-original";
const EDIT_BTN_CLASS = "kiss-edit-btn";
const EDIT_WRAPPER_CLASS = "kiss-edit-wrapper";

export class TranslationSession {
	view: MarkdownView | null;
	private settings: KissTranslatorSettings;
	private translated = new Map<HTMLElement, HTMLElement>();
	private cache = new Map<string, string>();
	private dict?: DictionaryStore;
	private scopeId: string;
	private promptSig: string;

	constructor(
		view: MarkdownView | null,
		settings: KissTranslatorSettings,
		options?: { dictionary?: DictionaryStore; scopeId?: string }
	) {
		this.view = view;
		this.settings = { ...settings };
		this.dict = options?.dictionary;
		this.scopeId = options?.scopeId || (view?.file?.path ?? "ui-global");
		this.promptSig = (settings.systemPrompt || "") + (settings.userPrompt || "");
	}

	updateSettings(settings: KissTranslatorSettings) {
		this.settings = { ...settings };
		this.promptSig = (settings.systemPrompt || "") + (settings.userPrompt || "");
	}

	async translate(
		rootOverride?: HTMLElement,
		options?: {
			dictionaryOnly?: boolean;
		}
	) {
		const dictionaryOnly = options?.dictionaryOnly ?? false;
		const root = rootOverride ?? this.findPreviewRoot();
		if (!root) {
			throw new Error("未找到可翻译的区域。");
		}

		this.clear();

		const blocks = this.collectBlocks(root, options?.reuseOnly);
		for (const block of blocks) {
			await this.translateBlock(block, dictionaryOnly);
		}

		this.applyOriginalVisibility();
	}

	clear() {
		this.restoreOriginalVisibility();
		this.translated.forEach((el) => el.remove());
		this.translated.clear();
	}

	applyOriginalVisibility() {
		if (this.settings.hideOriginal) {
			this.hideOriginal();
		} else {
			this.restoreOriginalVisibility();
		}
	}

	private hideOriginal() {
		this.translated.forEach((_translation, original) => {
			original.classList.add(HIDE_ORIGINAL_CLASS);
			(original as HTMLElement).style.visibility = "hidden";
		});
	}

	private restoreOriginalVisibility() {
		this.translated.forEach((_translation, original) => {
			original.classList.remove(HIDE_ORIGINAL_CLASS);
			(original as HTMLElement).style.visibility = "";
		});
	}

	private findPreviewRoot(): HTMLElement | null {
		if (this.view) {
			const root =
				this.view.containerEl.querySelector<HTMLElement>(
					".markdown-reading-view .markdown-preview-view"
				) ||
				this.view.containerEl.querySelector<HTMLElement>(
					".markdown-preview-view"
				) ||
				this.view.containerEl.querySelector<HTMLElement>(
					".markdown-reading-view"
				);
			if (root) return root;
		}
		// 兜底：使用整个文档
		return document.body;
	}

	private collectBlocks(root: HTMLElement, reuseOnly?: boolean): HTMLElement[] {
		const selector =
			"p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, pre, button, label, span, div";
		const maxLen = this.settings.maxTextLength ?? 160;
		return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
			(el) => {
				if (this.isInSkipArea(el)) return false;
				if (el.classList.contains(TRANSLATION_CLASS)) return false;
				if (el.closest(`.${TRANSLATION_CLASS}`)) return false;
				if (el.querySelector("input, textarea, select")) return false;
				if (el.children.length > 0) return false;
				const text = this.normalizeText(el.innerText || "");
				if (!text) return false;
				if (text.length < 2) return false;
				if (text.length > maxLen) return false;
				return true;
			}
		);
	}

	private isInSkipArea(el: HTMLElement) {
		const selectors = this.settings.skipSelectors || [];
		for (const sel of selectors) {
			if (!sel) continue;
			try {
				if (el.closest(sel)) return true;
			} catch (_e) {
				// 忽略非法选择器
			}
		}
		return false;
	}

	private normalizeText(text: string) {
		return text.replace(/\s+/g, " ").trim();
	}

	private async translateBlock(block: HTMLElement, dictionaryOnly: boolean) {
		const text = this.normalizeText(block.innerText || "");
		if (!text || text.length < 2) return;

		const translated = await this.translateText(text, dictionaryOnly);
		if (!translated) return;

		const translation = document.createElement(this.isBlockNode(block) ? "div" : "span");
		translation.className = TRANSLATION_CLASS;
		if (this.isBlockNode(block)) {
			translation.style.display = "block";
			translation.style.width = "100%";
		}
		const inner = document.createElement("span");
		inner.textContent = translated;
		inner.setAttribute("data-source", text);
		inner.setAttribute("data-translated", translated);
		inner.setAttribute("data-original", text);
		this.attachHoverSwap(translation, inner);
		translation.appendChild(inner);

		const dictKey = this.dict?.genKey({
			text,
			fromLang: this.settings.fromLang,
			toLang: this.settings.toLang,
			apiType: this.settings.apiType,
			model: this.settings.model,
			promptSig: this.promptSig,
		});
		if (dictKey && this.dict) {
			this.attachEditControls(translation, inner, dictKey, text);
		}

		block.insertAdjacentElement("afterend", translation);
		this.translated.set(block, translation);
	}

	private attachHoverSwap(wrapper: HTMLElement, inner: HTMLElement) {
		const swapText = (next: string) => {
			inner.classList.add("kiss-switching");
			inner.style.opacity = "0";
			inner.style.filter = "blur(2px)";
			setTimeout(() => {
				inner.textContent = next;
				inner.style.opacity = "1";
				inner.style.filter = "blur(0)";
				inner.classList.remove("kiss-switching");
			}, 150);
		};

		wrapper.addEventListener("mouseenter", () => {
			if (!this.settings.hideOriginal || !this.settings.smartOriginal) return;
			const ori = inner.getAttribute("data-original");
			if (ori) {
				wrapper.classList.add("kiss-hovering-original");
				swapText(ori);
			}
		});
		wrapper.addEventListener("mouseleave", () => {
			if (!this.settings.hideOriginal || !this.settings.smartOriginal) return;
			const tr = inner.getAttribute("data-translated");
			if (tr) {
				wrapper.classList.remove("kiss-hovering-original");
				swapText(tr);
			}
		});
	}

	private isBlockNode(el: HTMLElement) {
		const tag = el.tagName.toLowerCase();
		const blockTags = new Set([
			"p",
			"div",
			"li",
			"blockquote",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"td",
			"th",
			"pre",
			"section",
		]);
		if (blockTags.has(tag)) return true;
		const display = getComputedStyle(el).display;
		return display && !display.startsWith("inline");
	}

	private attachEditControls(
		wrapper: HTMLElement,
		inner: HTMLElement,
		dictKey: string,
		source: string
	) {
		if (!this.dict || !this.settings.editMode) return;
		const btn = document.createElement("button");
		btn.className = EDIT_BTN_CLASS;
		btn.textContent = "Edit";
		btn.title = "编辑译文";
		btn.addEventListener("click", (evt) => {
			evt.stopPropagation();
			this.openEditor(wrapper, inner, dictKey, source);
		});
		wrapper.appendChild(btn);
	}

	private openEditor(
		wrapper: HTMLElement,
		inner: HTMLElement,
		dictKey: string,
		source: string
	) {
		const current = inner.textContent || "";
		const host = document.createElement("div");
		host.className = EDIT_WRAPPER_CLASS;

		const textarea = document.createElement("textarea");
		textarea.value = current;

		const saveBtn = document.createElement("button");
		saveBtn.textContent = "保存";

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "取消";

		const resetBtn = document.createElement("button");
		resetBtn.textContent = "重置";

		host.appendChild(textarea);
		host.appendChild(saveBtn);
		host.appendChild(cancelBtn);
		host.appendChild(resetBtn);

		const cleanup = () => host.remove();
		cancelBtn.onclick = cleanup;

		resetBtn.onclick = async () => {
			cleanup();
			await this.dict?.remove(this.scopeId, dictKey);
			this.cache.delete(source);
			inner.textContent = "[...]";
			try {
				const fresh = await this.translateWithFallback(source, false);
				if (fresh) inner.textContent = fresh;
			} catch (err) {
				console.error(err);
			}
		};

		saveBtn.onclick = async () => {
			const val = textarea.value.trim();
			if (!val) return;
			inner.textContent = val;
			inner.setAttribute("data-translated", val);
			this.cache.set(source, val);
			await this.dict?.set(this.scopeId, {
				key: dictKey,
				source,
				translated: val,
				updatedAt: Date.now(),
				edited: true,
			});
			cleanup();
		};

		wrapper.appendChild(host);
		textarea.focus();
	}

	private async translateWithFallback(
		source: string,
		dictionaryOnly = false
	): Promise<string | null> {
		try {
			const text = await this.translateText(source, dictionaryOnly);
			return text;
		} catch (err) {
			console.error(err);
		}
		return null;
	}

	private async translateText(
		text: string,
		dictionaryOnly: boolean
	): Promise<string | null> {
		const cached = this.cache.get(text);
		if (cached) return cached;

		const { apiType } = this.settings;

		const dictKey = this.dict?.genKey({
			text,
			fromLang: this.settings.fromLang,
			toLang: this.settings.toLang,
			apiType,
			model: this.settings.model,
			promptSig: this.promptSig,
		});
		if (dictKey && this.dict) {
			for (const scope of this.getSearchScopes()) {
				const hit = await this.dict.get(scope, dictKey);
				if (hit?.translated) {
					this.cache.set(text, hit.translated);
					return hit.translated;
				}
			}
			if (dictionaryOnly) {
				return null;
			}
		}

		if (reuseOnly) return "";

		const translatedText =
			apiType === "openai"
				? await this.translateWithOpenAI(text)
				: await this.translateWithSimple(text);

		if (!translatedText) return "";

		this.cache.set(text, translatedText);
		if (dictKey && this.dict) {
			await this.dict.set(this.scopeId, {
				key: dictKey,
				source: text,
				translated: translatedText,
				updatedAt: Date.now(),
			});
		}
		return translatedText;
	}

	private async translateWithSimple(text: string): Promise<string> {
		const { apiUrl, apiKey, fromLang, toLang } = this.settings;
		if (!apiUrl) {
			throw new Error("请先在设置中配置翻译接口地址。");
		}

		const payload: Record<string, string> = {
			q: text,
			source: fromLang || "auto",
			target: toLang || "zh",
			format: "text",
		};
		if (apiKey) {
			payload.api_key = apiKey;
		}

		const res = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			throw new Error(`翻译接口返回错误：${res.status}`);
		}

		try {
			const data = await res.json();
			if (typeof data?.translatedText === "string") {
				return data.translatedText;
			}
			if (Array.isArray(data) && data[0]?.translatedText) {
				return data[0].translatedText;
			}
		} catch (err) {
			console.error(err);
			throw new Error("解析翻译接口响应失败");
		}
		return "";
	}

	private fillTemplate(template: string, text: string) {
		const { fromLang, toLang } = this.settings;
		return template
			.replace(/{text}/g, text)
			.replace(/{from}/g, fromLang || "auto")
			.replace(/{to}/g, toLang || "zh");
	}

	private async translateWithOpenAI(text: string): Promise<string> {
		const { apiUrl, apiKey, model, systemPrompt, userPrompt } = this.settings;
		if (!apiUrl) throw new Error("请配置 OpenAI 兼容接口地址。");
		if (!apiKey) throw new Error("请配置 API Key。");
		if (!model) throw new Error("请配置模型名称。");
		if (!userPrompt.trim()) throw new Error("用户提示词不能为空。");

		const messages = [];
		if (systemPrompt?.trim()) {
			messages.push({
				role: "system",
				content: this.fillTemplate(systemPrompt, text),
			});
		}
		messages.push({
			role: "user",
			content: this.fillTemplate(userPrompt, text),
		});

		const body = {
			model,
			messages,
			temperature: 0.2,
			stream: false,
		};

		const res = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const msg = await res.text();
			throw new Error(`接口错误 ${res.status}: ${msg}`);
		}

		try {
			const data = await res.json();
			const content = data?.choices?.[0]?.message?.content;
			if (typeof content === "string") {
				return content.trim();
			}
		} catch (err) {
			console.error(err);
			throw new Error("解析 OpenAI 兼容响应失败");
		}
		return "";
	}

	hasTranslations() {
		return this.translated.size > 0;
	}

	private getSearchScopes(): string[] {
		const scopes = new Set<string>();
		scopes.add(this.scopeId);
		(this.settings.uiScopes || []).forEach((s) => scopes.add(s));
		(this.settings.recentUiScopes || []).forEach((s) => scopes.add(s));
		return Array.from(scopes).filter(Boolean);
	}
}
