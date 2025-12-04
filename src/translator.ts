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

		const blocks = this.collectBlocks(root);
		for (const block of blocks) {
			await this.translateBlock(block, dictionaryOnly);
		}

		this.applyOriginalVisibility();
	}

	clear() {
		this.restoreOriginalVisibility();
		this.translated.forEach((el, original) => {
			if (el === original) {
				const oriText = el.getAttribute("data-original");
				if (oriText) {
					el.textContent = oriText;
				}
				el.classList.remove(TRANSLATION_CLASS);
			} else {
				el.remove();
			}
		});
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
		this.translated.forEach((translation, original) => {
			if (translation === original) return; // 交互元素直接改文本，不隐藏
			original.classList.add(HIDE_ORIGINAL_CLASS);
			(original as HTMLElement).style.display = "none";
		});
	}

	private restoreOriginalVisibility() {
		this.translated.forEach((translation, original) => {
			if (translation === original) return;
			original.classList.remove(HIDE_ORIGINAL_CLASS);
			(original as HTMLElement).style.display = "";
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

	private collectBlocks(root: HTMLElement): HTMLElement[] {
		const selector =
			"p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, pre, button, label, span, div, option";
		const maxLen = this.settings.maxTextLength ?? 160;
		return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
			(el) => {
				if (this.isInSkipArea(el)) return false;
				if (el.classList.contains(TRANSLATION_CLASS)) return false;
				if (el.closest(`.${TRANSLATION_CLASS}`)) return false;
				const tag = el.tagName.toLowerCase();
				if (tag !== "label" && tag !== "option" && el.querySelector("input, textarea, select")) return false;
				if (tag !== "label" && tag !== "option" && el.children.length > 0) return false;
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

		const interactive = this.isInteractive(block);
		const removeLoading = this.showLoading(block, interactive);

		const translated = await this.translateText(text, dictionaryOnly);
		if (!translated) {
			removeLoading();
			return;
		}
		// 基于原节点浅拷贝，尽可能继承标签与样式，避免丢失原有字体/字号/加粗等
		const translation = interactive
			? block
			: (block.cloneNode(false) as HTMLElement);
		translation.classList.add(TRANSLATION_CLASS);
		translation.removeAttribute("id");
		if (!interactive) {
			this.copyInlineStyles(block, translation);
		}
		this.setElementText(translation, translated);
		translation.setAttribute("data-source", text);
		translation.setAttribute("data-translated", translated);
		translation.setAttribute("data-original", text);
		if (!interactive) {
			this.attachHoverSwap(translation);
		}

		const dictKey = this.dict?.genKey({
			text,
			fromLang: this.settings.fromLang,
			toLang: this.settings.toLang,
			apiType: this.settings.apiType,
			model: this.settings.model,
			promptSig: this.promptSig,
		});
		if (dictKey && this.dict && !interactive) {
			this.attachEditControls(translation, translation, dictKey, text);
		}

		if (!interactive) {
			block.insertAdjacentElement("afterend", translation);
		}
		this.translated.set(block, translation);
		removeLoading();
	}

	private attachHoverSwap(wrapper: HTMLElement) {
		const swapText = (next: string) => {
			wrapper.classList.add("kiss-switching");
			wrapper.style.opacity = "0";
			wrapper.style.filter = "blur(2px)";
			setTimeout(() => {
				wrapper.textContent = next;
				wrapper.style.opacity = "1";
				wrapper.style.filter = "blur(0)";
				wrapper.classList.remove("kiss-switching");
			}, 150);
		};

		wrapper.addEventListener("mouseenter", () => {
			if (!this.settings.hideOriginal || !this.settings.smartOriginal) return;
			const ori = wrapper.getAttribute("data-original");
			if (ori) {
				wrapper.classList.add("kiss-hovering-original");
				swapText(ori);
			}
		});
		wrapper.addEventListener("mouseleave", () => {
			if (!this.settings.hideOriginal || !this.settings.smartOriginal) return;
			const tr = wrapper.getAttribute("data-translated");
			if (tr) {
				wrapper.classList.remove("kiss-hovering-original");
				swapText(tr);
			}
		});
	}

	private setElementText(el: HTMLElement, text: string) {
		const tag = el.tagName.toLowerCase();
		const hasInputChild = !!el.querySelector("input, textarea, select");
		if (tag === "label" && hasInputChild) {
			// 保留子元素（如复选框），仅替换文本节点
			Array.from(el.childNodes).forEach((node) => {
				if (node.nodeType === Node.TEXT_NODE) {
					el.removeChild(node);
				}
			});
			const span = document.createElement("span");
			span.textContent = text;
			el.appendChild(span);
			return;
		}
		if (tag === "option") {
			el.textContent = text;
			return;
		}
		el.textContent = text;
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
		btn.type = "button";
		btn.title = "编辑译文";
		btn.setAttribute("aria-label", "编辑译文");
		btn.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kiss-edit-icon"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>';
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
		const current =
			inner.getAttribute("data-translated") ||
			inner.textContent ||
			"";
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
			this.setElementText(inner, val);
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

		const translatedText =
			apiType === "openai"
				? await this.translateWithOpenAI(text)
				: await this.translateWithSimple(text);

		if (!translatedText) {
			throw new Error("翻译结果为空，请检查接口响应格式或提示词。");
		}

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

	private copyInlineStyles(from: HTMLElement, to: HTMLElement) {
		// 将原元素的常用计算样式内联到译文节点，保留字体、字号、行高、颜色等
		const computed = getComputedStyle(from);
		const props = [
			"font-family",
			"font-size",
			"font-weight",
			"font-style",
			"font-variant",
			"line-height",
			"letter-spacing",
			"color",
			"background-color",
			"text-decoration",
			"text-transform",
			"white-space",
		];
		for (const key of props) {
			const val = computed.getPropertyValue(key);
			if (val) {
				to.style.setProperty(key, val, computed.getPropertyPriority(key));
			}
		}
		// 保留原类名（不覆盖翻译标记）
		from.classList.forEach((cls) => {
			if (cls !== TRANSLATION_CLASS) {
				to.classList.add(cls);
			}
		});
	}

	private isInteractive(el: HTMLElement) {
		const tag = el.tagName.toLowerCase();
		if (
			tag === "button" ||
			tag === "select" ||
			tag === "textarea" ||
			tag === "option" || // option 也视为交互，防止克隆丢失所属 select
			tag === "input" ||
			tag === "label" ||
			(tag === "a" && (el as HTMLAnchorElement).href)
		) {
			return true;
		}
		const role = el.getAttribute("role");
		if (role && /^(button|link|checkbox|radio|switch|tab|menuitem)$/i.test(role)) {
			return true;
		}
		const tabindex = el.getAttribute("tabindex");
		if (tabindex !== null && Number(tabindex) >= 0) {
			return true;
		}
		if (el.isContentEditable) return true;
		if ((el as any).onclick) return true;
		const pe = getComputedStyle(el).pointerEvents;
		if (pe === "none") return false;
		return false;
	}

	private showLoading(block: HTMLElement, interactive: boolean) {
		const indicator = document.createElement("span");
		indicator.className = "kiss-translating-loading";
		if (interactive) {
			block.appendChild(indicator);
		} else {
			block.insertAdjacentElement("afterend", indicator);
		}
		return () => indicator.remove();
	}
}
