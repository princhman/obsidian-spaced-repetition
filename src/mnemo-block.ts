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

/**
 * Parses the content inside a ```mnemo code block into structured card data.
 * The input text should NOT include the opening/closing ``` markers.
 *
 * Single card format:
 *   due: 2026-02-28
 *   s: 4.93
 *   ...
 *
 * Multi-card format:
 *   [0]
 *   due: 2026-02-28
 *   s: 4.93
 *   ...
 *   [1]
 *   due: 2026-03-05
 *   ...
 */
export function parseMnemoBlock(text: string): MnemoCardData[] | null {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return null;

    // Check if multi-card format (starts with [N] header)
    const firstNonEmpty = lines.find((l) => l.trim().length > 0);
    const isMultiCard = firstNonEmpty && /^\[\d+\]$/.test(firstNonEmpty.trim());

    if (isMultiCard) {
        return parseMultiCardBlock(lines);
    } else {
        const card = parseSingleCardLines(lines);
        return card ? [card] : null;
    }
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
 * Serializes card data into the content that goes inside a ```mnemo block.
 * Does NOT include the opening/closing ``` markers.
 */
export function serializeMnemoBlock(cards: MnemoCardData[]): string {
    if (cards.length === 1) {
        return serializeSingleCard(cards[0]);
    }

    const sections: string[] = [];
    for (let i = 0; i < cards.length; i++) {
        sections.push(`[${i}]`);
        sections.push(serializeSingleCard(cards[i]));
    }
    return sections.join("\n");
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
export function serializeMnemoCodeBlock(cards: MnemoCardData[]): string {
    return "```mnemo\n" + serializeMnemoBlock(cards) + "\n```";
}

/**
 * Extracts the content of a mnemo code block from the full question text.
 * Returns the text between the ``` markers, or null if not found.
 */
export function extractMnemoBlockFromText(questionText: string): string | null {
    const match = questionText.match(/```mnemo\n([\s\S]*?)```/);
    return match ? match[1] : null;
}
