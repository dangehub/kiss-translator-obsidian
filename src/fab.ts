import type KissTranslatorPlugin from "../main";
import { Platform } from "obsidian";

const FAB_ID = "kiss-obsidian-fab";

export class FloatingFab {
	private plugin: KissTranslatorPlugin;
	private el: HTMLDivElement | null = null;
	private dragging = false;
	private moved = false;
	private offsetX = 0;
	private offsetY = 0;
	private state: "off" | "empty" | "active" = "off";
	private longPressTimer: NodeJS.Timeout | null = null;
	private touchStart: { x: number; y: number } | null = null;
	private pos = { x: 0, y: 0 };
	private cleanupFns: Array<() => void> = [];
	private fabSize = { w: 44, h: 44 };

	constructor(plugin: KissTranslatorPlugin) {
		this.plugin = plugin;
	}

	mount() {
		if (this.el) return;

		const isMobile = Platform.isMobileApp || Platform.isMobile;

		const fab = document.createElement("div");
		fab.id = FAB_ID;
		fab.textContent = "译";
		fab.title = isMobile
			? "双击开关词典翻译，长按打开菜单，拖动可移动"
			: "双击开关词典翻译，右键打开菜单，拖动可移动";
		fab.className = "kiss-fab";
		const saved = this.plugin.settings.fabPosition;
		if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
			const clamped = this.clampPosition(saved.x, saved.y);
			this.pos = clamped;
			fab.style.left = `${clamped.x}px`;
			fab.style.top = `${clamped.y}px`;
			fab.style.right = "auto";
			fab.style.bottom = "auto";
		}

		const startDrag = (evt: MouseEvent | TouchEvent) => {
			const { clientX, clientY } = this.getPoint(evt);
			const rect = fab.getBoundingClientRect();
			this.offsetX = clientX - rect.left;
			this.offsetY = clientY - rect.top;
			this.moved = false;
			if (evt instanceof TouchEvent) {
				this.touchStart = { x: clientX, y: clientY };
				this.dragging = false; // 等移动阈值后再开始拖动
			} else {
				this.dragging = true;
			}
			evt.preventDefault();
		};

		const onMove = (evt: MouseEvent | TouchEvent) => {
			const { clientX, clientY } = this.getPoint(evt);
			if (!this.dragging && this.touchStart) {
				const dx = Math.abs(clientX - this.touchStart.x);
				const dy = Math.abs(clientY - this.touchStart.y);
				if (dx > 4 || dy > 4) {
					this.dragging = true;
				}
			}
			if (!this.dragging) return;
			const clamped = this.clampPosition(clientX - this.offsetX, clientY - this.offsetY);
			const { x, y } = clamped;
			this.pos = { x, y };
			fab.style.left = `${x}px`;
			fab.style.top = `${y}px`;
			fab.style.right = "auto";
			fab.style.bottom = "auto";
			this.moved = true;
		};

		const endDrag = () => {
			const wasDragging = this.dragging;
			this.dragging = false;
			this.touchStart = null;
			if (wasDragging && this.moved) {
				this.plugin.saveFabPosition(this.pos);
			}
		};

		fab.addEventListener("mousedown", startDrag);
		this.cleanupFns.push(() => fab.removeEventListener("mousedown", startDrag));

		const onTouchStart = (evt: TouchEvent) => {
			startDrag(evt);
			if (this.longPressTimer) clearTimeout(this.longPressTimer);
			this.longPressTimer = setTimeout(() => {
				this.longPressTimer = null;
				if (!this.dragging) {
					const pt = this.getPoint(evt);
					this.plugin.openScopeMenu(pt.clientX, pt.clientY);
				}
			}, 550);
		};
		fab.addEventListener("touchstart", onTouchStart);
		this.cleanupFns.push(() => fab.removeEventListener("touchstart", onTouchStart));

		window.addEventListener("mousemove", onMove);
		this.cleanupFns.push(() => window.removeEventListener("mousemove", onMove));
		window.addEventListener("touchmove", onMove);
		this.cleanupFns.push(() => window.removeEventListener("touchmove", onMove));
		window.addEventListener("mouseup", endDrag);
		this.cleanupFns.push(() => window.removeEventListener("mouseup", endDrag));
		const onTouchEnd = () => {
			if (this.longPressTimer) {
				clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}
			endDrag();
		};
		window.addEventListener("touchend", onTouchEnd);
		this.cleanupFns.push(() => window.removeEventListener("touchend", onTouchEnd));

		let lastTap = 0;
		const handleActivate = (evt: Event) => {
			if (this.dragging) return;
			evt.preventDefault();
			const now = Date.now();
			if (now - lastTap < 320) {
				lastTap = 0;
				this.plugin.toggleUiDictionaryTranslations();
			} else {
				lastTap = now;
				setTimeout(() => {
					if (lastTap === now) {
						lastTap = 0;
					}
				}, 320);
			}
		};

		const onClick = (evt: MouseEvent) => {
			if (isMobile) return; // 移动端用 touchend 处理双击
			handleActivate(evt);
		};
		fab.addEventListener("click", onClick);
		this.cleanupFns.push(() => fab.removeEventListener("click", onClick));

		const onTouchEndActivate = (evt: TouchEvent) => {
			if (this.longPressTimer) {
				clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}
			if (this.dragging) {
				endDrag();
				return;
			}
			endDrag();
			handleActivate(evt);
		};
		fab.addEventListener("touchend", onTouchEndActivate);
		this.cleanupFns.push(() => fab.removeEventListener("touchend", onTouchEndActivate));

		const onContext = (evt: MouseEvent) => {
			if (isMobile) return;
			evt.preventDefault();
			this.plugin.openScopeMenu(evt.clientX, evt.clientY);
		};
		fab.addEventListener("contextmenu", onContext);
		this.cleanupFns.push(() => fab.removeEventListener("contextmenu", onContext));

		const onResize = () => {
			const clamped = this.clampPosition(this.pos.x, this.pos.y);
			this.pos = clamped;
			if (this.el) {
				this.el.style.left = `${clamped.x}px`;
				this.el.style.top = `${clamped.y}px`;
				this.el.style.right = "auto";
				this.el.style.bottom = "auto";
			}
		};
		window.addEventListener("resize", onResize);
		this.cleanupFns.push(() => window.removeEventListener("resize", onResize));

		document.body.appendChild(fab);
		this.el = fab;
	}

	setState(state: "off" | "empty" | "active") {
		if (!this.el) return;
		this.state = state;
		this.el.classList.remove("kiss-fab-active", "kiss-fab-idle", "kiss-fab-empty");
		if (state === "active") {
			this.el.classList.add("kiss-fab-active");
		} else if (state === "empty") {
			this.el.classList.add("kiss-fab-empty");
		} else {
			this.el.classList.add("kiss-fab-idle");
		}
	}

	unmount() {
		this.el?.remove();
		this.el = null;
		this.cleanupFns.forEach((fn) => fn());
		this.cleanupFns = [];
	}

	private clampPosition(x: number, y: number) {
		const maxX = Math.max(0, window.innerWidth - this.fabSize.w);
		const maxY = Math.max(0, window.innerHeight - this.fabSize.h);
		return {
			x: Math.max(0, Math.min(maxX, x)),
			y: Math.max(0, Math.min(maxY, y)),
		};
	}

	private getPoint(evt: MouseEvent | TouchEvent) {
		if (evt instanceof TouchEvent) {
			const touch = evt.touches[0] || evt.changedTouches[0];
			return { clientX: touch.clientX, clientY: touch.clientY };
		}
		return { clientX: evt.clientX, clientY: evt.clientY };
	}
}
