import type { DataAdapter } from "obsidian";

export interface DictEntry {
	key: string;
	source: string;
	translated: string;
	updatedAt: number;
	edited?: boolean;
}

export interface DictFile {
	version: number;
	scope: string;
	entries: DictEntry[];
}

const FILE_VERSION = 1;
const MAX_ENTRIES = 1000;
const DEBOUNCE_MS = 500;

export class DictionaryStore {
	private baseDir: string;
	private adapter: DataAdapter;
	private cache = new Map<string, DictFile>(); // scope -> file data
	private timers = new Map<string, NodeJS.Timeout>();

	constructor(baseDir: string, adapter: DataAdapter) {
		this.baseDir = baseDir.replace(/\\/g, "/");
		this.adapter = adapter;
	}

	async ensureReady() {
		if (this.isFsAdapter(this.adapter) && this.adapter.mkdir) {
			await this.adapter.mkdir(this.baseDir);
		}
	}

	async ensureScope(scope: string) {
		await this.ensureReady();
		const filePath = this.getFilePath(scope);
		try {
			if (await this.adapter.exists(filePath)) return;
			const empty: DictFile = { version: FILE_VERSION, scope, entries: [] };
			await this.safeWrite(filePath, empty);
			this.cache.set(scope, empty);
		} catch (err) {
			console.error("dict ensure scope failed", err);
		}
	}

	async listScopes(): Promise<string[]> {
		try {
			if (!(await this.adapter.exists(this.baseDir))) return [];
			const listed = await this.adapter.list(this.baseDir);
			const scopes = new Set<string>();
			for (const file of listed.files || []) {
				const base = this.getScopeFromPath(file);
				if (base) scopes.add(base);
			}
			return Array.from(scopes);
		} catch (err) {
			console.error("dict list failed", err);
			return [];
		}
	}

	private getFilePath(scope: string) {
		const safe = scope.replace(/[^a-zA-Z0-9-_.+]/g, "_");
		return `${this.baseDir}/${safe}.json`;
	}

	genKey({
		text,
		fromLang,
		toLang,
		apiType,
		model,
		promptSig,
	}: {
		text: string;
		fromLang: string;
		toLang: string;
		apiType: string;
		model?: string;
		promptSig?: string;
	}) {
		const payload = [
			text || "",
			fromLang || "",
			toLang || "",
			apiType || "",
			model || "",
			promptSig || "",
		].join("|");
		return this.hash(payload).slice(0, 24);
	}

	private async load(scope: string): Promise<DictFile> {
		if (this.cache.has(scope)) return this.cache.get(scope)!;
		await this.ensureReady();
		const filePath = this.getFilePath(scope);
		try {
			if (!(await this.adapter.exists(filePath))) {
				const empty: DictFile = { version: FILE_VERSION, scope, entries: [] };
				this.cache.set(scope, empty);
				await this.safeWrite(filePath, empty);
				return empty;
			}
			const raw = await this.adapter.read(filePath);
			const parsed = JSON.parse(raw) as DictFile;
			if (parsed.version !== FILE_VERSION || !Array.isArray(parsed.entries)) {
				throw new Error("version mismatch");
			}
			this.cache.set(scope, parsed);
			return parsed;
		} catch (err) {
			if (!this.isNotFound(err)) {
				console.error("dict load failed", err);
			}
			const empty: DictFile = { version: FILE_VERSION, scope, entries: [] };
			this.cache.set(scope, empty);
			if (this.isNotFound(err)) {
				await this.safeWrite(filePath, empty);
			}
			return empty;
		}
	}

	private scheduleSave(scope: string) {
		const existing = this.timers.get(scope);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			this.flush(scope).catch((err) => console.error("dict flush", err));
		}, DEBOUNCE_MS);
		this.timers.set(scope, timer);
	}

	async flush(scope?: string) {
		await this.ensureReady();
		const scopes = scope ? [scope] : Array.from(this.cache.keys());
		for (const s of scopes) {
			const data = this.cache.get(s);
			if (!data) continue;
			const filePath = this.getFilePath(s);
			try {
				await this.adapter.write(filePath, JSON.stringify(data, null, 2));
			} catch (err) {
				console.error("dict write failed", err);
			}
		}
	}

	private touch(file: DictFile, entry: DictEntry) {
		file.entries = file.entries.filter((e) => e.key !== entry.key);
		file.entries.push(entry);
		if (file.entries.length > MAX_ENTRIES) {
			file.entries = file.entries.slice(file.entries.length - MAX_ENTRIES);
		}
	}

	async get(scope: string, key: string): Promise<DictEntry | undefined> {
		const file = await this.load(scope);
		return file.entries.find((e) => e.key === key);
	}

	async set(scope: string, entry: DictEntry) {
		const file = await this.load(scope);
		this.touch(file, entry);
		this.scheduleSave(scope);
	}

	async remove(scope: string, key: string) {
		const file = await this.load(scope);
		const before = file.entries.length;
		file.entries = file.entries.filter((e) => e.key !== key);
		if (file.entries.length !== before) {
			this.scheduleSave(scope);
		}
	}

	async export(scope: string): Promise<DictFile> {
		return await this.load(scope);
	}

	async import(scope: string, incoming: DictFile) {
		if (!Array.isArray(incoming.entries)) return;
		const file = await this.load(scope);
		const map = new Map<string, DictEntry>();
		for (const e of file.entries) {
			map.set(e.key, e);
		}
		for (const e of incoming.entries) {
			const prev = map.get(e.key);
			if (!prev || (e.updatedAt ?? 0) > (prev.updatedAt ?? 0)) {
				map.set(e.key, e);
			}
		}
		file.entries = Array.from(map.values()).slice(-MAX_ENTRIES);
		this.scheduleSave(scope);
	}

	async removeScope(scope: string) {
		this.cache.delete(scope);
		const filePath = this.getFilePath(scope);
		if (this.isFsAdapter(this.adapter) && this.adapter.remove) {
			try {
				await this.adapter.remove(filePath);
			} catch (err) {
				if (!this.isNotFound(err)) {
					console.error("dict remove failed", err);
				}
			}
		} else {
			await this.adapter.write(filePath, JSON.stringify({ version: FILE_VERSION, scope, entries: [] }));
		}
	}

	async renameScope(oldName: string, newName: string) {
		if (oldName === newName) return;
		const data = await this.load(oldName);
		const newData: DictFile = {
			...data,
			scope: newName,
		};
		this.cache.set(newName, newData);
		this.cache.delete(oldName);
		await this.flush(newName);
		await this.removeScope(oldName);
	}

	private hash(input: string) {
		let h = 5381;
		for (let i = 0; i < input.length; i++) {
			h = (h * 33) ^ input.charCodeAt(i);
		}
		return (h >>> 0).toString(16).padStart(8, "0").repeat(3).slice(0, 24);
	}

	private async safeWrite(filePath: string, data: DictFile) {
		try {
			await this.adapter.write(filePath, JSON.stringify(data, null, 2));
		} catch (err) {
			console.error("dict write failed", err);
		}
	}

	private getScopeFromPath(filePath: string) {
		const name = filePath.split("/").pop() || filePath.split("\\").pop() || "";
		if (!name.toLowerCase().endsWith(".json")) return null;
		return name.replace(/\.json$/i, "");
	}

	private isNotFound(err: unknown) {
		if (!err) return false;
		const code = (err as any).code;
		return code === "ENOENT" || String(err).includes("ENOENT");
	}

	private isFsAdapter(
		adapter: DataAdapter
	): adapter is DataAdapter & { mkdir?: (path: string) => Promise<void>; remove?: (path: string) => Promise<void> } {
		return typeof (adapter as any).write === "function";
	}
}
