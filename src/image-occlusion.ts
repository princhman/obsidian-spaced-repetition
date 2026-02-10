export interface OcclusionRect {
    id: number;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    w: number; // percentage 0-100
    h: number; // percentage 0-100
    label?: string;
}

export enum OcclusionMode {
    HideAllRevealOne = "hideAllRevealOne",
    StagedReveal = "stagedReveal",
}

export interface ImageOcclusionData {
    imagePath: string;
    mode: OcclusionMode;
    rects: OcclusionRect[];
    name?: string;
}

// Marker prefix used in card front/back strings so CardUI can detect IO cards
export const IO_CARD_PREFIX = "<!--IO:";
export const IO_CARD_SUFFIX = "-->";

export interface IOCardData {
    occlusionData: ImageOcclusionData;
    cardIndex: number; // -1 for staged reveal
}

/**
 * Parses the content inside a ```sr-occlusion code block into structured data.
 * The input text should NOT include the opening/closing ``` markers.
 */
export function parseOcclusionBlock(text: string): ImageOcclusionData | null {
    const lines = text.trim().split("\n");

    let imagePath: string | null = null;
    let mode: OcclusionMode = OcclusionMode.HideAllRevealOne;
    let name: string | undefined;
    const rects: OcclusionRect[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Parse image path
        const imageMatch = trimmed.match(/^image:\s*(.+)$/);
        if (imageMatch) {
            imagePath = imageMatch[1].trim();
            continue;
        }

        // Parse name
        const nameMatch = trimmed.match(/^name:\s*(.+)$/);
        if (nameMatch) {
            name = nameMatch[1].trim();
            continue;
        }

        // Parse mode
        const modeMatch = trimmed.match(/^mode:\s*(.+)$/);
        if (modeMatch) {
            const modeStr = modeMatch[1].trim();
            if (modeStr === OcclusionMode.StagedReveal) {
                mode = OcclusionMode.StagedReveal;
            } else {
                mode = OcclusionMode.HideAllRevealOne;
            }
            continue;
        }

        // Parse rect line: - {id: 1, x: 10, y: 20, w: 30, h: 40, label: "text"}
        const rectMatch = trimmed.match(/^-\s*\{(.+)\}$/);
        if (rectMatch) {
            const rect = parseRectString(rectMatch[1]);
            if (rect) {
                rects.push(rect);
            }
            continue;
        }
    }

    if (!imagePath || rects.length === 0) {
        return null;
    }

    return { imagePath, mode, rects, name };
}

function parseRectString(inner: string): OcclusionRect | null {
    const getNum = (key: string): number | null => {
        const m = inner.match(new RegExp(`${key}:\\s*([\\d.]+)`));
        return m ? parseFloat(m[1]) : null;
    };

    const id = getNum("id");
    const x = getNum("x");
    const y = getNum("y");
    const w = getNum("w");
    const h = getNum("h");

    if (id === null || x === null || y === null || w === null || h === null) {
        return null;
    }

    // Parse optional label (quoted string)
    let label: string | undefined;
    const labelMatch = inner.match(/label:\s*"([^"]*)"/);
    if (labelMatch) {
        label = labelMatch[1];
    }

    return { id, x, y, w, h, label };
}

/**
 * Serializes occlusion data back to the content that goes inside a ```sr-occlusion block.
 * Does NOT include the opening/closing ``` markers.
 */
export function serializeOcclusionBlock(data: ImageOcclusionData): string {
    const lines: string[] = [];
    if (data.name) {
        lines.push(`name: ${data.name}`);
    }
    lines.push(`image: ${data.imagePath}`);
    lines.push(`mode: ${data.mode}`);
    lines.push("rects:");
    for (const rect of data.rects) {
        let rectStr = `id: ${rect.id}, x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h}`;
        if (rect.label) {
            rectStr += `, label: "${rect.label}"`;
        }
        lines.push(`  - {${rectStr}}`);
    }
    return lines.join("\n");
}

/**
 * Wraps the occlusion block content in ```sr-occlusion fences.
 */
export function serializeOcclusionCodeBlock(data: ImageOcclusionData): string {
    return "```sr-occlusion\n" + serializeOcclusionBlock(data) + "\n```";
}

/**
 * Extracts the content of an sr-occlusion code block from the full question text.
 * The question text may include the ``` markers and scheduling comments.
 */
export function extractOcclusionBlockContent(questionText: string): string | null {
    const match = questionText.match(/```sr-occlusion\n([\s\S]*?)```/);
    return match ? match[1] : null;
}

/**
 * Encodes IO card data into a string that CardUI can detect as an image occlusion card.
 */
export function encodeIOCardString(data: ImageOcclusionData, cardIndex: number): string {
    const payload: IOCardData = { occlusionData: data, cardIndex };
    return IO_CARD_PREFIX + JSON.stringify(payload) + IO_CARD_SUFFIX;
}

/**
 * Decodes an IO card string back into structured data.
 * Returns null if the string is not an IO card.
 */
export function decodeIOCardString(text: string): IOCardData | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith(IO_CARD_PREFIX) || !trimmed.endsWith(IO_CARD_SUFFIX)) {
        return null;
    }
    const json = trimmed.slice(IO_CARD_PREFIX.length, -IO_CARD_SUFFIX.length);
    try {
        return JSON.parse(json) as IOCardData;
    } catch {
        return null;
    }
}

/**
 * Checks if a card front/back string represents an image occlusion card.
 */
export function isIOCardString(text: string): boolean {
    return text.trim().startsWith(IO_CARD_PREFIX);
}
