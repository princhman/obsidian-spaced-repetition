const BLOCK_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const BLOCK_ID_LENGTH = 6;
const BLOCK_ID_PREFIX = "sr-";

/**
 * Generates a random Obsidian block ID in the format `^sr-XXXXXX`.
 * Ensures no collision with existing block IDs in the note text.
 */
export function generateBlockId(noteText: string): string {
    let blockId: string;
    do {
        let id = BLOCK_ID_PREFIX;
        for (let i = 0; i < BLOCK_ID_LENGTH; i++) {
            id += BLOCK_ID_CHARS.charAt(Math.floor(Math.random() * BLOCK_ID_CHARS.length));
        }
        blockId = `^${id}`;
    } while (noteText.includes(blockId));
    return blockId;
}
