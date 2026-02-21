import { App, Modal } from "obsidian";

import { ImageOcclusionData, OcclusionMode, OcclusionRect } from "src/image-occlusion";
import { t } from "src/lang/helpers";

const HANDLE_SIZE = 8;

interface DragState {
    type: "draw" | "move" | "resize";
    rectIndex: number;
    startX: number;
    startY: number;
    origRect?: { x: number; y: number; w: number; h: number };
}

export class ImageOcclusionEditorModal extends Modal {
    public waitForClose: Promise<ImageOcclusionData | null>;

    private resolvePromise: (data: ImageOcclusionData | null) => void;
    private didSave = false;
    private savedData: ImageOcclusionData | null = null;

    private imagePath: string;
    private imageUrl: string;
    private mode: OcclusionMode;
    private rects: OcclusionRect[];
    private selectedIndex: number = -1;
    private nextId: number = 1;

    private name: string;

    private canvasContainer: HTMLDivElement;
    private svgEl: SVGSVGElement;
    private imgEl: HTMLImageElement;
    private nameInput: HTMLInputElement;
    private labelInput: HTMLInputElement;
    private modeSelect: HTMLSelectElement;
    private dragState: DragState | null = null;

    public static Prompt(
        app: App,
        imageUrl: string,
        imagePath: string,
        existingData?: ImageOcclusionData,
        defaultMode?: OcclusionMode,
    ): Promise<ImageOcclusionData | null> {
        const modal = new ImageOcclusionEditorModal(
            app,
            imageUrl,
            imagePath,
            existingData,
            defaultMode,
        );
        return modal.waitForClose;
    }

    constructor(
        app: App,
        imageUrl: string,
        imagePath: string,
        existingData?: ImageOcclusionData,
        defaultMode?: OcclusionMode,
    ) {
        super(app);
        this.imageUrl = imageUrl;
        this.imagePath = imagePath;
        this.mode = existingData?.mode ?? defaultMode ?? OcclusionMode.HideAllRevealOne;
        this.name = existingData?.name ?? "";
        this.rects = existingData?.rects ? [...existingData.rects] : [];
        this.nextId = this.rects.length > 0 ? Math.max(...this.rects.map((r) => r.id)) + 1 : 1;

        this.waitForClose = new Promise<ImageOcclusionData | null>((resolve) => {
            this.resolvePromise = resolve;
        });

        this.modalEl.addClasses(["sr-modal", "sr-io-editor-modal"]);
        this._buildUI();
        this.open();
    }

    onClose(): void {
        super.onClose();
        this._removeListeners();
        if (this.didSave) {
            this.resolvePromise(this.savedData);
        } else {
            this.resolvePromise(null);
        }
    }

    private _buildUI(): void {
        this.contentEl.empty();
        this.contentEl.addClass("sr-io-editor-content");

        // Title
        const title = this.contentEl.createDiv({ cls: "sr-title" });
        title.setText(t("IMAGE_OCCLUSION_CREATE"));

        // Name input
        const nameRow = this.contentEl.createDiv({ cls: "sr-io-editor-name-row" });
        const nameLabel = nameRow.createEl("label");
        nameLabel.setText(t("IMAGE_OCCLUSION_NAME") + ":");
        this.nameInput = nameRow.createEl("input", {
            type: "text",
            attr: { placeholder: t("IMAGE_OCCLUSION_NAME_PLACEHOLDER") },
        });
        this.nameInput.value = this.name;
        this.nameInput.addEventListener("input", () => {
            this.name = this.nameInput.value;
        });

        // Canvas area
        this.canvasContainer = this.contentEl.createDiv({ cls: "sr-io-editor-canvas" });

        this.imgEl = this.canvasContainer.createEl("img", {
            attr: { src: this.imageUrl },
        });

        // SVG overlay
        this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgEl.setAttribute("width", "100%");
        this.svgEl.setAttribute("height", "100%");
        this.svgEl.style.position = "absolute";
        this.svgEl.style.top = "0";
        this.svgEl.style.left = "0";
        this.canvasContainer.appendChild(this.svgEl);

        this._addCanvasListeners();

        // Toolbar
        const toolbar = this.contentEl.createDiv({ cls: "sr-io-editor-toolbar" });

        // Mode selector
        const modeLabel = toolbar.createEl("label");
        modeLabel.setText("Mode:");
        this.modeSelect = toolbar.createEl("select");
        const opt1 = this.modeSelect.createEl("option", {
            value: OcclusionMode.HideAllRevealOne,
        });
        opt1.setText(t("IMAGE_OCCLUSION_HIDE_ALL_REVEAL_ONE"));
        const opt2 = this.modeSelect.createEl("option", {
            value: OcclusionMode.StagedReveal,
        });
        opt2.setText(t("IMAGE_OCCLUSION_STAGED_REVEAL"));
        this.modeSelect.value = this.mode;
        this.modeSelect.addEventListener("change", () => {
            this.mode = this.modeSelect.value as OcclusionMode;
        });

        // Delete button
        const deleteBtn = toolbar.createEl("button", { cls: "sr-response-button sr-bg-red" });
        deleteBtn.setText(t("DELETE"));
        deleteBtn.addEventListener("click", () => this._deleteSelected());

        // Label input
        const labelLabel = toolbar.createEl("label");
        labelLabel.setText("Label:");
        this.labelInput = toolbar.createEl("input", {
            type: "text",
            attr: { placeholder: "Optional label..." },
        });
        this.labelInput.addEventListener("input", () => {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.rects.length) {
                this.rects[this.selectedIndex].label = this.labelInput.value || undefined;
            }
        });

        // Actions
        const actions = this.contentEl.createDiv({ cls: "sr-io-editor-actions" });
        const cancelBtn = actions.createEl("button", { cls: "sr-response-button sr-bg-red" });
        cancelBtn.setText(t("CANCEL"));
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = actions.createEl("button", { cls: "sr-response-button sr-bg-green" });
        saveBtn.setText(t("SAVE"));
        saveBtn.addEventListener("click", () => this._save());

        // Render existing rects
        this._renderAllRects();
    }

    private _save(): void {
        if (this.rects.length === 0) {
            return;
        }
        this.didSave = true;
        this.savedData = {
            imagePath: this.imagePath,
            mode: this.mode,
            rects: [...this.rects],
            name: this.name || undefined,
        };
        this.close();
    }

    private _deleteSelected(): void {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.rects.length) {
            this.rects.splice(this.selectedIndex, 1);
            this.selectedIndex = -1;
            this.labelInput.value = "";
            this._renderAllRects();
        }
    }

    // =====================
    // SVG rendering
    // =====================

    private _renderAllRects(): void {
        // Clear SVG
        while (this.svgEl.firstChild) {
            this.svgEl.removeChild(this.svgEl.firstChild);
        }

        this.rects.forEach((rect, idx) => {
            this._renderSvgRect(rect, idx);
        });

        // Render handles for selected rect
        if (this.selectedIndex >= 0 && this.selectedIndex < this.rects.length) {
            this._renderResizeHandle(this.rects[this.selectedIndex]);
        }
    }

    private _renderSvgRect(rect: OcclusionRect, idx: number): void {
        const svgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        svgRect.setAttribute("x", `${rect.x}%`);
        svgRect.setAttribute("y", `${rect.y}%`);
        svgRect.setAttribute("width", `${rect.w}%`);
        svgRect.setAttribute("height", `${rect.h}%`);
        svgRect.classList.add("sr-io-draw-rect");
        if (idx === this.selectedIndex) {
            svgRect.classList.add("sr-io-selected");
        }
        svgRect.dataset.index = String(idx);

        // Number label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", `${rect.x + rect.w / 2}%`);
        text.setAttribute("y", `${rect.y + rect.h / 2}%`);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("fill", "white");
        text.setAttribute("font-size", "14");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("pointer-events", "none");
        text.textContent = String(idx + 1);

        this.svgEl.appendChild(svgRect);
        this.svgEl.appendChild(text);
    }

    private _renderResizeHandle(rect: OcclusionRect): void {
        // Bottom-right corner handle
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const canvasW = this.canvasContainer.clientWidth;
        const canvasH = this.canvasContainer.clientHeight;
        const handleX = ((rect.x + rect.w) / 100) * canvasW - HANDLE_SIZE / 2;
        const handleY = ((rect.y + rect.h) / 100) * canvasH - HANDLE_SIZE / 2;

        handle.setAttribute("x", String(handleX));
        handle.setAttribute("y", String(handleY));
        handle.setAttribute("width", String(HANDLE_SIZE));
        handle.setAttribute("height", String(HANDLE_SIZE));
        handle.classList.add("sr-io-resize-handle");
        handle.dataset.handleType = "resize";

        this.svgEl.appendChild(handle);
    }

    // =====================
    // Mouse/Touch interaction
    // =====================

    private _addCanvasListeners(): void {
        this.svgEl.addEventListener("mousedown", this._onPointerDown);
        this.svgEl.addEventListener("touchstart", this._onTouchStart, { passive: false });
        document.addEventListener("mousemove", this._onPointerMove);
        document.addEventListener("mouseup", this._onPointerUp);
        document.addEventListener("touchmove", this._onTouchMove, { passive: false });
        document.addEventListener("touchend", this._onTouchEnd);
    }

    private _removeListeners(): void {
        this.svgEl.removeEventListener("mousedown", this._onPointerDown);
        this.svgEl.removeEventListener("touchstart", this._onTouchStart);
        document.removeEventListener("mousemove", this._onPointerMove);
        document.removeEventListener("mouseup", this._onPointerUp);
        document.removeEventListener("touchmove", this._onTouchMove);
        document.removeEventListener("touchend", this._onTouchEnd);
    }

    private _getPercentCoords(clientX: number, clientY: number): { px: number; py: number } {
        const canvasRect = this.canvasContainer.getBoundingClientRect();
        const px = ((clientX - canvasRect.left) / canvasRect.width) * 100;
        const py = ((clientY - canvasRect.top) / canvasRect.height) * 100;
        return { px: Math.max(0, Math.min(100, px)), py: Math.max(0, Math.min(100, py)) };
    }

    private _onPointerDown = (e: MouseEvent): void => {
        e.preventDefault();
        const { px, py } = this._getPercentCoords(e.clientX, e.clientY);
        this._handleDown(px, py, e.target as Element);
    };

    private _onTouchStart = (e: TouchEvent): void => {
        e.preventDefault();
        const touch = e.touches[0];
        const { px, py } = this._getPercentCoords(touch.clientX, touch.clientY);
        this._handleDown(px, py, e.target as Element);
    };

    private _handleDown(px: number, py: number, target: Element): void {
        // Check if clicking resize handle
        if (target.classList.contains("sr-io-resize-handle")) {
            if (this.selectedIndex >= 0) {
                const rect = this.rects[this.selectedIndex];
                this.dragState = {
                    type: "resize",
                    rectIndex: this.selectedIndex,
                    startX: px,
                    startY: py,
                    origRect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
                };
            }
            return;
        }

        // Check if clicking an existing rect
        const rectTarget = target.closest(".sr-io-draw-rect") as SVGElement | null;
        if (rectTarget && rectTarget.dataset.index !== undefined) {
            const idx = parseInt(rectTarget.dataset.index);
            this.selectedIndex = idx;
            this.labelInput.value = this.rects[idx].label || "";
            const rect = this.rects[idx];
            this.dragState = {
                type: "move",
                rectIndex: idx,
                startX: px,
                startY: py,
                origRect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
            };
            this._renderAllRects();
            return;
        }

        // Drawing a new rect
        this.selectedIndex = -1;
        this.labelInput.value = "";
        const newRect: OcclusionRect = {
            id: this.nextId++,
            x: px,
            y: py,
            w: 0,
            h: 0,
        };
        this.rects.push(newRect);
        this.selectedIndex = this.rects.length - 1;
        this.dragState = {
            type: "draw",
            rectIndex: this.selectedIndex,
            startX: px,
            startY: py,
        };
        this._renderAllRects();
    }

    private _onPointerMove = (e: MouseEvent): void => {
        if (!this.dragState) return;
        const { px, py } = this._getPercentCoords(e.clientX, e.clientY);
        this._handleMove(px, py);
    };

    private _onTouchMove = (e: TouchEvent): void => {
        if (!this.dragState) return;
        e.preventDefault();
        const touch = e.touches[0];
        const { px, py } = this._getPercentCoords(touch.clientX, touch.clientY);
        this._handleMove(px, py);
    };

    private _handleMove(px: number, py: number): void {
        if (!this.dragState) return;
        const rect = this.rects[this.dragState.rectIndex];
        if (!rect) return;

        switch (this.dragState.type) {
            case "draw": {
                const x = Math.min(px, this.dragState.startX);
                const y = Math.min(py, this.dragState.startY);
                const w = Math.abs(px - this.dragState.startX);
                const h = Math.abs(py - this.dragState.startY);
                rect.x = Math.round(x * 10) / 10;
                rect.y = Math.round(y * 10) / 10;
                rect.w = Math.round(w * 10) / 10;
                rect.h = Math.round(h * 10) / 10;
                break;
            }
            case "move": {
                const dx = px - this.dragState.startX;
                const dy = py - this.dragState.startY;
                const orig = this.dragState.origRect!;
                rect.x = Math.round(Math.max(0, Math.min(100 - orig.w, orig.x + dx)) * 10) / 10;
                rect.y = Math.round(Math.max(0, Math.min(100 - orig.h, orig.y + dy)) * 10) / 10;
                break;
            }
            case "resize": {
                const orig = this.dragState.origRect!;
                const newW = orig.w + (px - this.dragState.startX);
                const newH = orig.h + (py - this.dragState.startY);
                rect.w = Math.round(Math.max(2, Math.min(100 - rect.x, newW)) * 10) / 10;
                rect.h = Math.round(Math.max(2, Math.min(100 - rect.y, newH)) * 10) / 10;
                break;
            }
        }

        this._renderAllRects();
    }

    private _onPointerUp = (): void => {
        if (this.dragState?.type === "draw") {
            const rect = this.rects[this.dragState.rectIndex];
            // Remove rects that are too small (accidental clicks)
            if (rect && rect.w < 1 && rect.h < 1) {
                this.rects.splice(this.dragState.rectIndex, 1);
                this.selectedIndex = -1;
                this._renderAllRects();
            }
        }
        this.dragState = null;
    };

    private _onTouchEnd = (): void => {
        this._onPointerUp();
    };
}
