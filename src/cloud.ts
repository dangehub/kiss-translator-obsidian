import { requestUrl } from "obsidian";
import type { DictFile } from "./dictionary";

export interface CloudDictMeta {
	id: string;
	scope: string;
	name?: string;
	description?: string;
	downloadUrl: string;
	updatedAt?: number;
	entryCount?: number;
	version?: number;
	votes?: { up?: number; down?: number };
	size?: number;
}

export async function fetchRegistry(url: string): Promise<CloudDictMeta[]> {
	if (!url) return [];
	const res = await requestUrl({ url, method: "GET" });
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`获取云端清单失败：${res.status}`);
	}
	const data = res.json;
	const items = Array.isArray(data?.dictionaries)
		? data.dictionaries
		: Array.isArray(data)
		? data
		: [];
	return items
		.map((raw: any, idx: number) => normalizeMeta(raw, idx))
		.filter((x: CloudDictMeta | null): x is CloudDictMeta => !!x);
}

export async function fetchCloudDict(meta: CloudDictMeta): Promise<DictFile> {
	if (!meta.downloadUrl) {
		throw new Error("缺少下载地址");
	}
	const res = await requestUrl({ url: meta.downloadUrl, method: "GET" });
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`下载词典失败：${res.status}`);
	}
	const data = res.json as DictFile;
	if (!data || typeof data !== "object" || !Array.isArray(data.entries)) {
		throw new Error("词典格式不正确");
	}
	return {
		version: data.version ?? 1,
		scope: data.scope ?? meta.scope,
		entries: Array.isArray(data.entries) ? data.entries : [],
	};
}

function normalizeMeta(raw: any, idx: number): CloudDictMeta | null {
	const scope = String(raw?.scope || raw?.id || "").trim();
	const downloadUrl = String(raw?.downloadUrl || raw?.url || "").trim();
	if (!scope || !downloadUrl) return null;
	return {
		id: String(raw?.id || scope || idx),
		scope,
		name: String(raw?.name || scope),
		description: raw?.description ? String(raw.description) : undefined,
		downloadUrl,
		updatedAt: raw?.updatedAt ? Number(raw.updatedAt) : undefined,
		entryCount: raw?.entryCount ? Number(raw.entryCount) : undefined,
		version: raw?.version ? Number(raw.version) : undefined,
		votes: raw?.votes,
		size: raw?.size ? Number(raw.size) : undefined,
	};
}
