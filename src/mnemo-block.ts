export interface MnemoCardData {
    isNew: boolean;
    due?: string; // YYYY-MM-DD
    s?: number; // stability
    d?: number; // difficulty
    state?: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
    reps?: number;
    lapses?: number;
    steps?: number; // learning_steps
    last?: string; // YYYY-MM-DD
}

export interface MnemoBlockData {
    type?: string; // "basic", "reversed", "cloze", "occlusion"
    cards: MnemoCardData[];
}

/**
 * Parses the content inside a ```mnemo code block into structured data.
 * The input text should NOT include the opening/closing ``` markers.
 *
 * Single card format:
 *   type: basic
 *   due: 2026-02-28
 *   s: 4.93
 *   ...
 *
 * Multi-card format:
 *   type: reversed
 *   [0]
 *   due: 2026-02-28
 *   s: 4.93
 *   ...
 *   [1]
 *   due: 2026-03-05
 *   ...
 */
export function parseMnemoBlock(text: string): MnemoBlockData | null {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return null;

    // Extract block-level metadata (lines before first [N] header or card data)
    let type: string | undefined;
    const cardLines: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        const typeMatch = trimmed.match(/^type:\s*(.+)$/);
        if (typeMatch && cardLines.length === 0) {
            type = typeMatch[1].trim();
            continue;
        }
        cardLines.push(line);
    }

    // Check if multi-card format (starts with [N] header)
    const firstNonEmpty = cardLines.find((l) => l.trim().length > 0);
    const isMultiCard = firstNonEmpty && /^\[\d+\]$/.test(firstNonEmpty.trim());

    let cards: MnemoCardData[] | null;
    if (isMultiCard) {
        cards = parseMultiCardBlock(cardLines);
    } else {
        const card = parseSingleCardLines(cardLines);
        cards = card ? [card] : null;
    }

    if (!cards) return null;
    return { type, cards };
}

function parseMultiCardBlock(lines: string[]): MnemoCardData[] | null {
    const sections: Map<number, string[]> = new Map();
    let currentIndex = -1;

    for (const line of lines) {
        const trimmed = line.trim();
        const headerMatch = trimmed.match(/^\[(\d+)\]$/);
        if (headerMatch) {
            currentIndex = parseInt(headerMatch[1]);
            sections.set(currentIndex, []);
            continue;
        }
        if (currentIndex >= 0) {
            sections.get(currentIndex).push(line);
        }
    }

    if (sections.size === 0) return null;

    // Find the max index to create a properly sized array
    const maxIndex = Math.max(...sections.keys());
    const result: MnemoCardData[] = [];

    for (let i = 0; i <= maxIndex; i++) {
        const sectionLines = sections.get(i);
        if (!sectionLines) {
            result.push({ isNew: true });
        } else {
            const card = parseSingleCardLines(sectionLines);
            result.push(card || { isNew: true });
        }
    }

    return result;
}

function parseSingleCardLines(lines: string[]): MnemoCardData | null {
    const data: Record<string, string> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;

        const match = trimmed.match(/^(\w+):\s*(.+)$/);
        if (match) {
            data[match[1]] = match[2].trim();
        }
    }

    // Check for "new: true" marker
    if (data["new"] === "true") {
        return { isNew: true };
    }

    // Require at least 'due' to be a valid schedule
    if (!data["due"]) return null;

    return {
        isNew: false,
        due: data["due"],
        s: data["s"] != null ? parseFloat(data["s"]) : undefined,
        d: data["d"] != null ? parseFloat(data["d"]) : undefined,
        state: data["state"] != null ? parseInt(data["state"]) : undefined,
        reps: data["reps"] != null ? parseInt(data["reps"]) : undefined,
        lapses: data["lapses"] != null ? parseInt(data["lapses"]) : undefined,
        steps: data["steps"] != null ? parseInt(data["steps"]) : undefined,
        last: data["last"],
    };
}

/**
 * Serializes block data into the content that goes inside a ```mnemo block.
 * Does NOT include the opening/closing ``` markers.
 */
export function serializeMnemoBlock(block: MnemoBlockData): string {
    const parts: string[] = [];

    if (block.type) {
        parts.push(`type: ${block.type}`);
    }

    if (block.cards.length === 1) {
        parts.push(serializeSingleCard(block.cards[0]));
    } else {
        for (let i = 0; i < block.cards.length; i++) {
            parts.push(`[${i}]`);
            parts.push(serializeSingleCard(block.cards[i]));
        }
    }
    return parts.join("\n");
}

function serializeSingleCard(card: MnemoCardData): string {
    if (card.isNew) {
        return "new: true";
    }

    const lines: string[] = [];
    if (card.due != null) lines.push(`due: ${card.due}`);
    if (card.s != null) lines.push(`s: ${card.s.toFixed(2)}`);
    if (card.d != null) lines.push(`d: ${card.d.toFixed(2)}`);
    if (card.state != null) lines.push(`state: ${card.state}`);
    if (card.reps != null) lines.push(`reps: ${card.reps}`);
    if (card.lapses != null) lines.push(`lapses: ${card.lapses}`);
    if (card.steps != null) lines.push(`steps: ${card.steps}`);
    if (card.last != null) lines.push(`last: ${card.last}`);
    return lines.join("\n");
}

/**
 * Wraps the mnemo block content in ```mnemo fences.
 */
export function serializeMnemoCodeBlock(block: MnemoBlockData): string {
    return "```mnemo\n" + serializeMnemoBlock(block) + "\n```";
}

/**
 * Extracts the content of a mnemo code block from the full question text.
 * Returns the text between the ``` markers, or null if not found.
 */
export function extractMnemoBlockFromText(questionText: string): string | null {
    const match = questionText.match(/```mnemo\n([\s\S]*?)```/);
    return match ? match[1] : null;
}

// --- mnemo-ignore block support ---

export interface MnemoIgnoreEntry {
    blockId: string; // e.g. "^sr-a1b2c3"
    readableText: string; // human-readable first line of the question
}

/**
 * Parses a ```mnemo-ignore``` block from the full note text.
 * Returns a Set of block IDs that should be ignored/suspended.
 */
export function parseMnemoIgnoreBlock(noteText: string): Set<string> {
    const match = noteText.match(/```mnemo-ignore\n([\s\S]*?)```/);
    if (!match) return new Set();

    const ids = new Set<string>();
    const lines = match[1].split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        // Each line starts with ^blockId followed by optional readable text
        const blockIdMatch = trimmed.match(/^(\^[a-zA-Z0-9-]+)/);
        if (blockIdMatch) {
            ids.add(blockIdMatch[1]);
        }
    }
    return ids;
}

/**
 * Adds an entry to the mnemo-ignore block in the note text.
 * If no mnemo-ignore block exists, creates one after the frontmatter (or at the top).
 */
export function addToMnemoIgnoreBlock(noteText: string, entry: MnemoIgnoreEntry): string {
    const entryLine = `${entry.blockId} ${entry.readableText}`;
    const existingMatch = noteText.match(/```mnemo-ignore\n([\s\S]*?)```/);

    if (existingMatch) {
        // Append to existing block
        const existingContent = existingMatch[1];
        const newContent = existingContent.trimEnd() + "\n" + entryLine + "\n";
        return noteText.replace(existingMatch[0], "```mnemo-ignore\n" + newContent + "```");
    }

    // Create new block - insert after frontmatter or at the top
    const newBlock = "```mnemo-ignore\n" + entryLine + "\n```\n\n";
    const frontmatterMatch = noteText.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (frontmatterMatch) {
        const insertPos = frontmatterMatch[0].length;
        return noteText.slice(0, insertPos) + "\n" + newBlock + noteText.slice(insertPos);
    }

    return newBlock + noteText;
}
