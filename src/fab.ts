import type KissTranslatorPlugin from "../main";

const FAB_ID = "kiss-obsidian-fab";

export class FloatingFab {
	private plugin: KissTranslatorPlugin;
	private el: HTMLDivElement | null = null;
	private dragging = false;
	private offsetX = 0;
	private offsetY = 0;
	private state: "off" | "empty" | "active" = "off";

	constructor(plugin: KissTranslatorPlugin) {
		this.plugin = plugin;
	}

	mount() {
		if (this.el) return;

		const fab = document.createElement("div");
		fab.id = FAB_ID;
		fab.textContent = "译";
		fab.title = "双击开关词典翻译，右键打开菜单，拖动可移动";
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

		let clickTimeout: NodeJS.Timeout | null = null;
		fab.addEventListener("click", (evt) => {
			if (this.dragging) return;
			evt.preventDefault();
			if (clickTimeout) {
				clearTimeout(clickTimeout);
				clickTimeout = null;
				this.plugin.toggleUiDictionaryTranslations();
			} else {
				clickTimeout = setTimeout(() => {
					clickTimeout = null;
				}, 250);
			}
		});

		fab.addEventListener("contextmenu", (evt) => {
			evt.preventDefault();
			this.plugin.openScopeMenu(evt.clientX, evt.clientY);
		});

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
	}

	private getPoint(evt: MouseEvent | TouchEvent) {
		if (evt instanceof TouchEvent) {
			const touch = evt.touches[0] || evt.changedTouches[0];
			return { clientX: touch.clientX, clientY: touch.clientY };
		}
		return { clientX: evt.clientX, clientY: evt.clientY };
	}
}
