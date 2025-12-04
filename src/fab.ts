import type KissTranslatorPlugin from "../main";

const FAB_ID = "kiss-obsidian-fab";

export class FloatingFab {
	private plugin: KissTranslatorPlugin;
	private el: HTMLDivElement | null = null;
	private dragging = false;
	private offsetX = 0;
	private offsetY = 0;

	constructor(plugin: KissTranslatorPlugin) {
		this.plugin = plugin;
	}

	mount() {
		if (this.el) return;

		const fab = document.createElement("div");
		fab.id = FAB_ID;
		fab.textContent = "译";
		fab.title = "点击翻译当前界面，拖动可移动";
		fab.className = "kiss-fab";

		const startDrag = (evt: MouseEvent | TouchEvent) => {
			this.dragging = true;
			const { clientX, clientY } = this.getPoint(evt);
			const rect = fab.getBoundingClientRect();
			this.offsetX = clientX - rect.left;
			this.offsetY = clientY - rect.top;
			evt.preventDefault();
		};

		const onMove = (evt: MouseEvent | TouchEvent) => {
			if (!this.dragging) return;
			const { clientX, clientY } = this.getPoint(evt);
			const x = clientX - this.offsetX;
			const y = clientY - this.offsetY;
			fab.style.left = `${Math.max(0, Math.min(window.innerWidth - 44, x))}px`;
			fab.style.top = `${Math.max(0, Math.min(window.innerHeight - 44, y))}px`;
		};

		const endDrag = () => {
			this.dragging = false;
		};

		fab.addEventListener("mousedown", startDrag);
		fab.addEventListener("touchstart", startDrag);
		window.addEventListener("mousemove", onMove);
		window.addEventListener("touchmove", onMove);
		window.addEventListener("mouseup", endDrag);
		window.addEventListener("touchend", endDrag);

		fab.addEventListener("click", (evt) => {
			if (this.dragging) return;
			evt.preventDefault();
			this.plugin.translateUIWithFab();
		});

		document.body.appendChild(fab);
		this.el = fab;
	}

	unmount() {
		this.el?.remove();
		this.el = null;
	}

	private getPoint(evt: MouseEvent | TouchEvent) {
		if (evt instanceof TouchEvent) {
			const touch = evt.touches[0] || evt.changedTouches[0];
			return { clientX: touch.clientX, clientY: touch.clientY };
		}
		return { clientX: evt.clientX, clientY: evt.clientY };
	}
}
