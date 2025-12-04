import { MarkdownView } from "obsidian";
import type { KissTranslatorSettings } from "../main";

const TRANSLATION_CLASS = "kiss-translated-block";
const HIDE_ORIGINAL_CLASS = "kiss-hide-original";

export class TranslationSession {
	view: MarkdownView | null;
	private settings: KissTranslatorSettings;
	private translated = new Map<HTMLElement, HTMLElement>();
	private cache = new Map<string, string>();

	constructor(view: MarkdownView | null, settings: KissTranslatorSettings) {
		this.view = view;
		this.settings = { ...settings };
	}

	updateSettings(settings: KissTranslatorSettings) {
		this.settings = { ...settings };
	}

	async translate(rootOverride?: HTMLElement) {
		const root = rootOverride ?? this.findPreviewRoot();
		if (!root) {
			throw new Error("未找到可翻译的区域。");
		}

		this.clear();

		const blocks = this.collectBlocks(root);
		for (const block of blocks) {
			await this.translateBlock(block);
		}

		this.applyOriginalVisibility();
	}

	clear() {
		this.translated.forEach((el) => el.remove());
		this.translated.clear();
		this.restoreOriginalVisibility();
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
		});
	}

	private restoreOriginalVisibility() {
		this.translated.forEach((_translation, original) => {
			original.classList.remove(HIDE_ORIGINAL_CLASS);
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

		// 兜底：直接使用应用根节点（用于设置/插件 UI）
		return document.body;
	}

	private collectBlocks(root: HTMLElement): HTMLElement[] {
		const selector =
			"p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, pre, button, label, span, div";
		return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
			(el) => {
				if (this.isInSkipArea(el)) return false;
				if (el.classList.contains(TRANSLATION_CLASS)) return false;
				if (el.closest(`.${TRANSLATION_CLASS}`)) return false;
				if (el.querySelector("input, textarea, select")) return false;
				// 避免处理包含多个子节点的大块容器，优先叶子节点
				if (el.children.length > 0) return false;
				const text = this.normalizeText(el.innerText || "");
				if (!text) return false;
				if (text.length < 2) return false;
				// 避免长段落打乱布局
				if (text.length > 160) return false;
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
				// ignore invalid selector
			}
		}
		return false;
	}

	private normalizeText(text: string) {
		return text.replace(/\s+/g, " ").trim();
	}

	private async translateBlock(block: HTMLElement) {
		const text = this.normalizeText(block.innerText || "");
		if (!text || text.length < 2) return;

		const translated = await this.translateText(text);
		if (!translated) return;

		const translation = document.createElement("div");
		translation.className = TRANSLATION_CLASS;
		translation.textContent = translated;

		block.insertAdjacentElement("afterend", translation);
		this.translated.set(block, translation);
	}

	private async translateText(text: string): Promise<string> {
		const cached = this.cache.get(text);
		if (cached) return cached;

		const { apiType } = this.settings;
		const translatedText =
			apiType === "openai"
				? await this.translateWithOpenAI(text)
				: await this.translateWithSimple(text);

		if (!translatedText) {
			throw new Error("翻译结果为空，请检查接口响应格式或提示词。");
		}

		this.cache.set(text, translatedText);
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
}
