import {
    decodeIOCardString,
    encodeIOCardString,
    extractOcclusionBlockContent,
    ImageOcclusionData,
    isIOCardString,
    OcclusionMode,
    parseOcclusionBlock,
    serializeOcclusionBlock,
    serializeOcclusionCodeBlock,
} from "src/image-occlusion";
import { parse, ParserOptions } from "src/parser";
import { CardType } from "src/question";
import { CardFrontBackUtil } from "src/question-type";
import { DEFAULT_SETTINGS } from "src/settings";

// ============================================================
// parseOcclusionBlock
// ============================================================

describe("parseOcclusionBlock", () => {
    test("parses a valid block with hideAllRevealOne mode", () => {
        const text = `image: ![[heart.png]]
mode: hideAllRevealOne
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40, label: "Left Ventricle"}
  - {id: 2, x: 50, y: 60, w: 15, h: 10}`;

        const result = parseOcclusionBlock(text);
        expect(result).not.toBeNull();
        expect(result!.imagePath).toBe("![[heart.png]]");
        expect(result!.mode).toBe(OcclusionMode.HideAllRevealOne);
        expect(result!.rects).toHaveLength(2);
        expect(result!.rects[0]).toEqual({
            id: 1,
            x: 10,
            y: 20,
            w: 30,
            h: 40,
            label: "Left Ventricle",
        });
        expect(result!.rects[1]).toEqual({ id: 2, x: 50, y: 60, w: 15, h: 10 });
    });

    test("parses a valid block with stagedReveal mode", () => {
        const text = `image: ![](images/anatomy.png)
mode: stagedReveal
rects:
  - {id: 1, x: 10.5, y: 20.3, w: 15.0, h: 12.0, label: "Part A"}`;

        const result = parseOcclusionBlock(text);
        expect(result).not.toBeNull();
        expect(result!.imagePath).toBe("![](images/anatomy.png)");
        expect(result!.mode).toBe(OcclusionMode.StagedReveal);
        expect(result!.rects).toHaveLength(1);
        expect(result!.rects[0].x).toBeCloseTo(10.5);
    });

    test("defaults to hideAllRevealOne when mode is missing", () => {
        const text = `image: ![[img.png]]
rects:
  - {id: 1, x: 0, y: 0, w: 100, h: 100}`;

        const result = parseOcclusionBlock(text);
        expect(result).not.toBeNull();
        expect(result!.mode).toBe(OcclusionMode.HideAllRevealOne);
    });

    test("returns null when image path is missing", () => {
        const text = `mode: hideAllRevealOne
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}`;

        expect(parseOcclusionBlock(text)).toBeNull();
    });

    test("returns null when rects are missing", () => {
        const text = `image: ![[img.png]]
mode: hideAllRevealOne
rects:`;

        expect(parseOcclusionBlock(text)).toBeNull();
    });

    test("returns null for empty text", () => {
        expect(parseOcclusionBlock("")).toBeNull();
    });

    test("skips malformed rects", () => {
        const text = `image: ![[img.png]]
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
  - {id: 2, x: 50}
  - {id: 3, x: 10, y: 20, w: 30, h: 40, label: "Valid"}`;

        const result = parseOcclusionBlock(text);
        expect(result).not.toBeNull();
        expect(result!.rects).toHaveLength(2);
        expect(result!.rects[0].id).toBe(1);
        expect(result!.rects[1].id).toBe(3);
    });
});

// ============================================================
// serializeOcclusionBlock
// ============================================================

describe("serializeOcclusionBlock", () => {
    test("serializes data correctly", () => {
        const data: ImageOcclusionData = {
            imagePath: "![[heart.png]]",
            mode: OcclusionMode.HideAllRevealOne,
            rects: [
                { id: 1, x: 10, y: 20, w: 30, h: 40, label: "Label A" },
                { id: 2, x: 50, y: 60, w: 15, h: 10 },
            ],
        };

        const result = serializeOcclusionBlock(data);
        expect(result).toContain("image: ![[heart.png]]");
        expect(result).toContain("mode: hideAllRevealOne");
        expect(result).toContain('label: "Label A"');
        expect(result).toContain("id: 2");
    });

    test("round-trip: parse then serialize then parse again yields same data", () => {
        const original = `image: ![[diagram.png]]
mode: stagedReveal
rects:
  - {id: 1, x: 10.5, y: 20.3, w: 15, h: 12, label: "Part A"}
  - {id: 2, x: 45, y: 18.7, w: 14, h: 11.5}`;

        const parsed = parseOcclusionBlock(original);
        expect(parsed).not.toBeNull();

        const serialized = serializeOcclusionBlock(parsed!);
        const reparsed = parseOcclusionBlock(serialized);

        expect(reparsed).not.toBeNull();
        expect(reparsed!.imagePath).toBe(parsed!.imagePath);
        expect(reparsed!.mode).toBe(parsed!.mode);
        expect(reparsed!.rects).toHaveLength(parsed!.rects.length);
        for (let i = 0; i < parsed!.rects.length; i++) {
            expect(reparsed!.rects[i].id).toBe(parsed!.rects[i].id);
            expect(reparsed!.rects[i].x).toBeCloseTo(parsed!.rects[i].x);
            expect(reparsed!.rects[i].y).toBeCloseTo(parsed!.rects[i].y);
            expect(reparsed!.rects[i].w).toBeCloseTo(parsed!.rects[i].w);
            expect(reparsed!.rects[i].h).toBeCloseTo(parsed!.rects[i].h);
            expect(reparsed!.rects[i].label).toBe(parsed!.rects[i].label);
        }
    });
});

describe("serializeOcclusionCodeBlock", () => {
    test("wraps content in sr-occlusion fences", () => {
        const data: ImageOcclusionData = {
            imagePath: "![[img.png]]",
            mode: OcclusionMode.HideAllRevealOne,
            rects: [{ id: 1, x: 0, y: 0, w: 100, h: 100 }],
        };

        const result = serializeOcclusionCodeBlock(data);
        expect(result).toMatch(/^```sr-occlusion\n/);
        expect(result).toMatch(/\n```$/);
    });
});

// ============================================================
// extractOcclusionBlockContent
// ============================================================

describe("extractOcclusionBlockContent", () => {
    test("extracts content from a full question text", () => {
        const questionText = `\`\`\`sr-occlusion
image: ![[img.png]]
mode: hideAllRevealOne
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
\`\`\`
<!--SR:!2024-01-15,10,250-->`;

        const content = extractOcclusionBlockContent(questionText);
        expect(content).not.toBeNull();
        expect(content).toContain("image: ![[img.png]]");
        expect(content).not.toContain("```");
        expect(content).not.toContain("<!--SR:");
    });

    test("returns null when no sr-occlusion block found", () => {
        expect(extractOcclusionBlockContent("Some random text")).toBeNull();
        expect(extractOcclusionBlockContent("```python\nprint('hello')\n```")).toBeNull();
    });
});

// ============================================================
// IO card string encoding/decoding
// ============================================================

describe("encodeIOCardString / decodeIOCardString", () => {
    const testData: ImageOcclusionData = {
        imagePath: "![[test.png]]",
        mode: OcclusionMode.HideAllRevealOne,
        rects: [
            { id: 1, x: 10, y: 20, w: 30, h: 40, label: "A" },
            { id: 2, x: 50, y: 60, w: 15, h: 10 },
        ],
    };

    test("encode then decode round-trip", () => {
        const encoded = encodeIOCardString(testData, 0);
        const decoded = decodeIOCardString(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded!.cardIndex).toBe(0);
        expect(decoded!.occlusionData.imagePath).toBe("![[test.png]]");
        expect(decoded!.occlusionData.rects).toHaveLength(2);
    });

    test("encode then decode with staged reveal (cardIndex -1)", () => {
        const encoded = encodeIOCardString(testData, -1);
        const decoded = decodeIOCardString(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded!.cardIndex).toBe(-1);
    });

    test("decodeIOCardString returns null for non-IO strings", () => {
        expect(decodeIOCardString("Regular markdown")).toBeNull();
        expect(decodeIOCardString("<!--SR:!2024-01-15,10,250-->")).toBeNull();
        expect(decodeIOCardString("")).toBeNull();
    });

    test("decodeIOCardString returns null for malformed IO string", () => {
        expect(decodeIOCardString("<!--IO:not json-->")).toBeNull();
    });
});

describe("isIOCardString", () => {
    test("detects IO card strings", () => {
        const data: ImageOcclusionData = {
            imagePath: "![[test.png]]",
            mode: OcclusionMode.HideAllRevealOne,
            rects: [{ id: 1, x: 0, y: 0, w: 100, h: 100 }],
        };
        const encoded = encodeIOCardString(data, 0);
        expect(isIOCardString(encoded)).toBe(true);
    });

    test("rejects non-IO strings", () => {
        expect(isIOCardString("Question::Answer")).toBe(false);
        expect(isIOCardString("")).toBe(false);
        expect(isIOCardString("<!--SR:!2024-01-15,10,250-->")).toBe(false);
    });
});

// ============================================================
// Parser integration
// ============================================================

const parserOptions: ParserOptions = {
    singleLineCardSeparator: "::",
    singleLineReversedCardSeparator: ":::",
    multilineCardSeparator: "?",
    multilineReversedCardSeparator: "??",
    multilineCardEndMarker: "",
    clozePatterns: ["==[123;;]answer[;;hint]=="],
};

describe("parser: sr-occlusion blocks", () => {
    test("detects a standalone sr-occlusion block", () => {
        const text = `\`\`\`sr-occlusion
image: ![[heart.png]]
mode: hideAllRevealOne
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
\`\`\``;

        const result = parse(text, parserOptions);
        expect(result).toHaveLength(1);
        expect(result[0].cardType).toBe(CardType.ImageOcclusion);
        expect(result[0].text).toContain("```sr-occlusion");
        expect(result[0].text).toContain("![[heart.png]]");
        expect(result[0].firstLineNum).toBe(0);
    });

    test("picks up scheduling comment after the block", () => {
        const text = `\`\`\`sr-occlusion
image: ![[img.png]]
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
\`\`\`
<!--SR:!2024-01-15,10,250-->`;

        const result = parse(text, parserOptions);
        expect(result).toHaveLength(1);
        expect(result[0].text).toContain("<!--SR:!2024-01-15,10,250-->");
    });

    test("picks up FSRS scheduling comment", () => {
        const text = `\`\`\`sr-occlusion
image: ![[img.png]]
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
\`\`\`
<!--SR-FSRS:!2024-01-15,2.5,5.5,1,10,10,5,0,0,2024-01-01-->`;

        const result = parse(text, parserOptions);
        expect(result).toHaveLength(1);
        expect(result[0].text).toContain("<!--SR-FSRS:");
    });

    test("does not interfere with regular code blocks", () => {
        const text = `Question::Answer

\`\`\`python
print("hello")
\`\`\`

Another::Card`;

        const result = parse(text, parserOptions);
        expect(result).toHaveLength(2);
        expect(result[0].cardType).toBe(CardType.SingleLineBasic);
        expect(result[1].cardType).toBe(CardType.SingleLineBasic);
    });

    test("mixed: sr-occlusion block alongside regular cards", () => {
        const text = `Question1::Answer1

\`\`\`sr-occlusion
image: ![[diagram.png]]
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
\`\`\`

Question2::Answer2`;

        const result = parse(text, parserOptions);
        expect(result).toHaveLength(3);
        expect(result[0].cardType).toBe(CardType.SingleLineBasic);
        expect(result[1].cardType).toBe(CardType.ImageOcclusion);
        expect(result[2].cardType).toBe(CardType.SingleLineBasic);
    });
});

// ============================================================
// Card expansion (question-type)
// ============================================================

describe("CardType.ImageOcclusion expansion", () => {
    test("HideAllRevealOne: N rects produce N cards", () => {
        const questionText = `\`\`\`sr-occlusion
image: ![[heart.png]]
mode: hideAllRevealOne
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40, label: "Left Ventricle"}
  - {id: 2, x: 50, y: 60, w: 15, h: 10, label: "Right Atrium"}
  - {id: 3, x: 30, y: 55, w: 20, h: 10, label: "Aorta"}
\`\`\``;

        const result = CardFrontBackUtil.expand(
            CardType.ImageOcclusion,
            questionText,
            DEFAULT_SETTINGS,
        );
        expect(result).toHaveLength(3);

        // Each card's front/back should be an IO-encoded string
        for (let i = 0; i < 3; i++) {
            expect(isIOCardString(result[i].front)).toBe(true);
            expect(isIOCardString(result[i].back)).toBe(true);

            const frontData = decodeIOCardString(result[i].front);
            expect(frontData).not.toBeNull();
            expect(frontData!.cardIndex).toBe(i);
            expect(frontData!.occlusionData.rects).toHaveLength(3);
        }
    });

    test("StagedReveal: N rects produce 1 card", () => {
        const questionText = `\`\`\`sr-occlusion
image: ![[diagram.png]]
mode: stagedReveal
rects:
  - {id: 1, x: 10, y: 20, w: 30, h: 40}
  - {id: 2, x: 50, y: 60, w: 15, h: 10}
\`\`\``;

        const result = CardFrontBackUtil.expand(
            CardType.ImageOcclusion,
            questionText,
            DEFAULT_SETTINGS,
        );
        expect(result).toHaveLength(1);

        const frontData = decodeIOCardString(result[0].front);
        expect(frontData).not.toBeNull();
        expect(frontData!.cardIndex).toBe(-1);
    });

    test("returns empty array for invalid occlusion block", () => {
        const questionText = `\`\`\`sr-occlusion
invalid content
\`\`\``;

        const result = CardFrontBackUtil.expand(
            CardType.ImageOcclusion,
            questionText,
            DEFAULT_SETTINGS,
        );
        expect(result).toHaveLength(0);
    });

    test("returns empty array when no sr-occlusion block found", () => {
        const questionText = "Just some plain text";

        const result = CardFrontBackUtil.expand(
            CardType.ImageOcclusion,
            questionText,
            DEFAULT_SETTINGS,
        );
        expect(result).toHaveLength(0);
    });
});
