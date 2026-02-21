import {
    extractMnemoBlockFromText,
    MnemoCardData,
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
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
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
        expect(result).toHaveLength(2);
        expect(result[0].due).toBe("2026-02-28");
        expect(result[0].s).toBe(4.93);
        expect(result[1].due).toBe("2026-03-05");
        expect(result[1].reps).toBe(8);
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
        expect(result).toHaveLength(2);
        expect(result[0].isNew).toBe(false);
        expect(result[1].isNew).toBe(true);
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
        expect(result).toHaveLength(3);
        expect(result[0].due).toBe("2026-02-28");
        expect(result[1].isNew).toBe(true); // gap filled
        expect(result[2].due).toBe("2026-03-01");
    });
});

describe("serializeMnemoBlock", () => {
    test("Serializes single card", () => {
        const cards: MnemoCardData[] = [
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
        ];
        const result = serializeMnemoBlock(cards);
        expect(result).toBe(
            "due: 2026-02-28\ns: 4.93\nd: 5.71\nstate: 2\nreps: 5\nlapses: 1\nsteps: 0\nlast: 2026-02-21",
        );
    });

    test("Serializes multi-card block", () => {
        const cards: MnemoCardData[] = [
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
        ];
        const result = serializeMnemoBlock(cards);
        expect(result).toContain("[0]");
        expect(result).toContain("[1]");
        expect(result).toContain("new: true");
        expect(result).toContain("due: 2026-02-28");
    });

    test("Serializes new card", () => {
        const cards: MnemoCardData[] = [{ isNew: true }];
        expect(serializeMnemoBlock(cards)).toBe("new: true");
    });
});

describe("serializeMnemoCodeBlock", () => {
    test("Wraps in mnemo fences", () => {
        const cards: MnemoCardData[] = [
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
        ];
        const result = serializeMnemoCodeBlock(cards);
        expect(result).toMatch(/^```mnemo\n/);
        expect(result).toMatch(/\n```$/);
    });
});

describe("Round-trip: serialize then parse", () => {
    test("Single card round-trip", () => {
        const original: MnemoCardData[] = [
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
        ];
        const serialized = serializeMnemoBlock(original);
        const parsed = parseMnemoBlock(serialized);
        expect(parsed).toEqual(original);
    });

    test("Multi-card round-trip", () => {
        const original: MnemoCardData[] = [
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
        ];
        const serialized = serializeMnemoBlock(original);
        const parsed = parseMnemoBlock(serialized);
        expect(parsed).toEqual(original);
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
