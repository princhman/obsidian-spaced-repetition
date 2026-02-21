import { OcclusionRect } from "src/image-occlusion";

export class ImageOcclusionRenderer {
    /**
     * Renders an image with occlusion rectangles overlaid.
     *
     * @param container - The parent element to render into (will be emptied)
     * @param imageUrl - The resolved URL of the image
     * @param rects - Array of occlusion rectangles (percentage coordinates)
     * @param revealedIndices - Set of rect indices that should be revealed (opacity 0)
     * @param maskColor - CSS color for the occlusion mask
     * @param onImageLoad - Optional callback when the image has loaded
     * @returns The container div with the rendered overlay
     */
    static render(
        container: HTMLElement,
        imageUrl: string,
        rects: OcclusionRect[],
        revealedIndices: Set<number>,
        maskColor: string,
        onImageLoad?: () => void,
    ): HTMLElement {
        container.empty();

        const wrapper = container.createDiv({ cls: "sr-io-container" });

        const img = wrapper.createEl("img", {
            cls: "sr-io-image",
            attr: { src: imageUrl },
        });

        img.addEventListener("load", () => {
            onImageLoad?.();
        });

        const overlay = wrapper.createDiv({ cls: "sr-io-overlay" });

        rects.forEach((rect, idx) => {
            const rectEl = overlay.createDiv({ cls: "sr-io-rect" });
            rectEl.style.left = `${rect.x}%`;
            rectEl.style.top = `${rect.y}%`;
            rectEl.style.width = `${rect.w}%`;
            rectEl.style.height = `${rect.h}%`;
            rectEl.style.backgroundColor = maskColor;

            if (revealedIndices.has(idx)) {
                rectEl.addClass("sr-io-revealed");
                // Show label when revealed
                if (rect.label) {
                    const labelEl = rectEl.createDiv({ cls: "sr-io-rect-label" });
                    labelEl.setText(rect.label);
                }
            } else {
                // Show number badge on hidden rects
                const badge = rectEl.createDiv({ cls: "sr-io-rect-badge" });
                badge.setText(String(idx + 1));
            }
        });

        return wrapper;
    }

    /**
     * Reveals a specific rectangle by index (adds sr-io-revealed class).
     */
    static revealRect(container: HTMLElement, index: number, label?: string): void {
        const rects = container.querySelectorAll(".sr-io-rect");
        if (index < rects.length) {
            const rectEl = rects[index] as HTMLElement;
            rectEl.addClass("sr-io-revealed");

            // Remove badge
            const badge = rectEl.querySelector(".sr-io-rect-badge");
            if (badge) badge.remove();

            // Show label
            if (label) {
                const labelEl = rectEl.createDiv({ cls: "sr-io-rect-label" });
                labelEl.setText(label);
            }
        }
    }
}
