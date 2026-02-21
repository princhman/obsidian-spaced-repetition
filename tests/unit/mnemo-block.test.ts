import {
    extractMnemoBlockFromText,
    MnemoBlockData,
    parseMnemoBlock,
    serializeMnemoBlock,
    serializeMnemoCodeBlock,
} from "src/mnemo-block";

describe("parseMnemoBlock", () => {
    test("Parses single card", () => {
        const source = `due: 2026-02-28
s: 4.93
d: 5.71
state: 2
reps: 5
lapses: 1
steps: 0
last: 2026-02-21`;
        const result = parseMnemoBlock(source);
        expect(result.cards).toHaveLength(1);
        expect(result.cards[0]).toEqual({
            isNew: false,
            due: "2026-02-28",
            s: 4.93,
            d: 5.71,
            state: 2,
            reps: 5,
            lapses: 1,
            steps: 0,
            last: "2026-02-21",
        });
    });

    test("Parses multi-card block", () => {
        const source = `[0]
due: 2026-02-28
s: 4.93
d: 5.71
state: 2
reps: 5
lapses: 1
steps: 0
last: 2026-02-21
[1]
due: 2026-03-05
s: 6.10
d: 4.20
state: 2
reps: 8
lapses: 0
steps: 0
last: 2026-02-20`;
        const result = parseMnemoBlock(source);
        expect(result.cards).toHaveLength(2);
        expect(result.cards[0].due).toBe("2026-02-28");
        expect(result.cards[0].s).toBe(4.93);
        expect(result.cards[1].due).toBe("2026-03-05");
        expect(result.cards[1].reps).toBe(8);
    });

    test("Parses type field", () => {
        const source = `type: reversed
[0]
due: 2026-02-28
s: 4.93
d: 5.71
state: 2
reps: 5
lapses: 1
steps: 0
last: 2026-02-21
[1]
due: 2026-03-05
s: 6.10
d: 4.20
state: 2
reps: 8
lapses: 0
steps: 0
last: 2026-02-20`;
        const result = parseMnemoBlock(source);
        expect(result.type).toBe("reversed");
        expect(result.cards).toHaveLength(2);
    });

    test("Parses new card marker", () => {
        const source = `[0]
due: 2026-02-28
s: 4.93
d: 5.71
state: 2
reps: 5
lapses: 1
steps: 0
last: 2026-02-21
[1]
new: true`;
        const result = parseMnemoBlock(source);
        expect(result.cards).toHaveLength(2);
        expect(result.cards[0].isNew).toBe(false);
        expect(result.cards[1].isNew).toBe(true);
    });

    test("Returns null for empty input", () => {
        expect(parseMnemoBlock("")).toBeNull();
        expect(parseMnemoBlock("   ")).toBeNull();
    });

    test("Returns null for block with no due date", () => {
        const source = `s: 4.93
d: 5.71`;
        expect(parseMnemoBlock(source)).toBeNull();
    });

    test("Handles missing section indices by filling gaps", () => {
        const source = `[0]
due: 2026-02-28
s: 1.00
d: 1.00
state: 2
reps: 1
lapses: 0
steps: 0
last: 2026-02-20
[2]
due: 2026-03-01
s: 2.00
d: 2.00
state: 2
reps: 2
lapses: 0
steps: 0
last: 2026-02-21`;
        const result = parseMnemoBlock(source);
        expect(result.cards).toHaveLength(3);
        expect(result.cards[0].due).toBe("2026-02-28");
        expect(result.cards[1].isNew).toBe(true); // gap filled
        expect(result.cards[2].due).toBe("2026-03-01");
    });
});

describe("serializeMnemoBlock", () => {
    test("Serializes single card", () => {
        const block: MnemoBlockData = {
            cards: [
                {
                    isNew: false,
                    due: "2026-02-28",
                    s: 4.93,
                    d: 5.71,
                    state: 2,
                    reps: 5,
                    lapses: 1,
                    steps: 0,
                    last: "2026-02-21",
                },
            ],
        };
        const result = serializeMnemoBlock(block);
        expect(result).toBe(
            "due: 2026-02-28\ns: 4.93\nd: 5.71\nstate: 2\nreps: 5\nlapses: 1\nsteps: 0\nlast: 2026-02-21",
        );
    });

    test("Serializes multi-card block with type", () => {
        const block: MnemoBlockData = {
            type: "reversed",
            cards: [
                {
                    isNew: false,
                    due: "2026-02-28",
                    s: 4.93,
                    d: 5.71,
                    state: 2,
                    reps: 5,
                    lapses: 1,
                    steps: 0,
                    last: "2026-02-21",
                },
                { isNew: true },
            ],
        };
        const result = serializeMnemoBlock(block);
        expect(result).toContain("type: reversed");
        expect(result).toContain("[0]");
        expect(result).toContain("[1]");
        expect(result).toContain("new: true");
        expect(result).toContain("due: 2026-02-28");
    });

    test("Serializes new card", () => {
        const block: MnemoBlockData = { cards: [{ isNew: true }] };
        expect(serializeMnemoBlock(block)).toBe("new: true");
    });
});

describe("serializeMnemoCodeBlock", () => {
    test("Wraps in mnemo fences", () => {
        const block: MnemoBlockData = {
            cards: [
                {
                    isNew: false,
                    due: "2026-02-28",
                    s: 4.93,
                    d: 5.71,
                    state: 2,
                    reps: 5,
                    lapses: 1,
                    steps: 0,
                    last: "2026-02-21",
                },
            ],
        };
        const result = serializeMnemoCodeBlock(block);
        expect(result).toMatch(/^```mnemo\n/);
        expect(result).toMatch(/\n```$/);
    });
});

describe("Round-trip: serialize then parse", () => {
    test("Single card round-trip", () => {
        const original: MnemoBlockData = {
            cards: [
                {
                    isNew: false,
                    due: "2026-02-28",
                    s: 4.93,
                    d: 5.71,
                    state: 2,
                    reps: 5,
                    lapses: 1,
                    steps: 0,
                    last: "2026-02-21",
                },
            ],
        };
        const serialized = serializeMnemoBlock(original);
        const parsed = parseMnemoBlock(serialized);
        expect(parsed.cards).toEqual(original.cards);
    });

    test("Multi-card round-trip with type", () => {
        const original: MnemoBlockData = {
            type: "cloze",
            cards: [
                {
                    isNew: false,
                    due: "2026-02-28",
                    s: 4.93,
                    d: 5.71,
                    state: 2,
                    reps: 5,
                    lapses: 1,
                    steps: 0,
                    last: "2026-02-21",
                },
                { isNew: true },
                {
                    isNew: false,
                    due: "2026-03-05",
                    s: 6.1,
                    d: 4.2,
                    state: 1,
                    reps: 2,
                    lapses: 0,
                    steps: 1,
                    last: "2026-02-20",
                },
            ],
        };
        const serialized = serializeMnemoBlock(original);
        const parsed = parseMnemoBlock(serialized);
        expect(parsed.type).toBe("cloze");
        expect(parsed.cards).toEqual(original.cards);
    });
});

describe("extractMnemoBlockFromText", () => {
    test("Extracts mnemo block from question text", () => {
        const text = `What is the capital of France?
?
Paris
\`\`\`mnemo
due: 2026-02-28
s: 4.93
d: 5.71
state: 2
reps: 5
lapses: 1
steps: 0
last: 2026-02-21
\`\`\``;
        const result = extractMnemoBlockFromText(text);
        expect(result).toBeTruthy();
        expect(result).toContain("due: 2026-02-28");
        expect(result).not.toContain("```");
    });

    test("Returns null when no mnemo block present", () => {
        const text = "What is the capital of France?\n?\nParis";
        expect(extractMnemoBlockFromText(text)).toBeNull();
    });

    test("Returns null for other code blocks", () => {
        const text = "```javascript\nconsole.log('hello');\n```";
        expect(extractMnemoBlockFromText(text)).toBeNull();
    });
});
