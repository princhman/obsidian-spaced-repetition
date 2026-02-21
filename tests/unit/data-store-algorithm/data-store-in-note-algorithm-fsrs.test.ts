import moment from "moment";
import { State } from "ts-fsrs";

import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { Card } from "src/card";
import { DataStoreInNoteAlgorithmFsrs } from "src/data-store-algorithm/data-store-in-note-algorithm-fsrs";
import { Question } from "src/question";
import { DEFAULT_SETTINGS, SRSettings } from "src/settings";
import { setupStaticDateProvider20230906 } from "src/utils/dates";

import { UnitTestSRFile } from "../helpers/unit-test-file";

beforeAll(() => {
    setupStaticDateProvider20230906();
});

describe("noteGetSchedule", () => {
    test("Returns FSRS schedule from frontmatter with all fields", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-10
sr-algorithm: fsrs
sr-stability: 5.50
sr-difficulty: 3.20
sr-state: 2
sr-reps: 3
sr-lapses: 1
sr-learning-steps: 0
sr-last-review: 2023-09-06
---
A note to review
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeDefined();
        expect(schedule).not.toBeNull();
        const fsrsSchedule = schedule as RepItemScheduleInfoFsrs;
        expect(fsrsSchedule.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
        expect(fsrsSchedule.stability).toBeCloseTo(5.5);
        expect(fsrsSchedule.difficulty).toBeCloseTo(3.2);
        expect(fsrsSchedule.state).toEqual(State.Review);
        expect(fsrsSchedule.reps).toEqual(3);
        expect(fsrsSchedule.lapses).toEqual(1);
        expect(fsrsSchedule.learningSteps).toEqual(0);
        expect(fsrsSchedule.lastReview.format("YYYY-MM-DD")).toEqual("2023-09-06");
    });

    test("Returns null when no frontmatter exists", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = "A plain note without frontmatter\n";
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeNull();
    });

    test("Returns null when frontmatter has no sr fields", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
created: 2024-01-17
tags: [note]
---
A note with unrelated frontmatter
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeNull();
    });

    test("Returns null when frontmatter has sr-due but algorithm is not fsrs", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-10
sr-algorithm: sm2
sr-stability: 5.50
---
A note with wrong algorithm
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeNull();
    });

    test("Returns null for legacy SM-2 frontmatter (for migration)", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-10
sr-interval: 10
sr-ease: 250
---
A legacy SM-2 note
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeNull();
    });

    test("Returns null when sr-stability is missing", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-10
sr-algorithm: fsrs
sr-difficulty: 3.20
---
A partial FSRS note
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeNull();
    });

    test("Handles missing optional fields with defaults", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-10
sr-algorithm: fsrs
sr-stability: 5.50
sr-difficulty: 3.20
sr-state: 2
---
A note with minimal FSRS fields
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeDefined();
        const fsrsSchedule = schedule as RepItemScheduleInfoFsrs;
        // Missing fields should default to 0
        expect(fsrsSchedule.reps).toEqual(0);
        expect(fsrsSchedule.lapses).toEqual(0);
        expect(fsrsSchedule.learningSteps).toEqual(0);
    });

    test("Handles missing last-review as null", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-10
sr-algorithm: fsrs
sr-stability: 5.50
sr-difficulty: 3.20
sr-state: 0
sr-reps: 0
sr-lapses: 0
sr-learning-steps: 0
---
A new FSRS note
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        expect(schedule).toBeDefined();
        const fsrsSchedule = schedule as RepItemScheduleInfoFsrs;
        expect(fsrsSchedule.lastReview).toBeNull();
    });

    test("Reads State.Learning correctly", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-06
sr-algorithm: fsrs
sr-stability: 1.20
sr-difficulty: 5.00
sr-state: 1
sr-reps: 1
sr-lapses: 0
sr-learning-steps: 1
sr-last-review: 2023-09-06
---
A learning card
`;
        const file = new UnitTestSRFile(noteText);
        const schedule = await instance.noteGetSchedule(file);

        const fsrsSchedule = schedule as RepItemScheduleInfoFsrs;
        expect(fsrsSchedule.state).toEqual(State.Learning);
        expect(fsrsSchedule.learningSteps).toEqual(1);
    });
});

describe("noteSetSchedule", () => {
    test("Adds FSRS frontmatter to file without frontmatter", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = "A note without frontmatter\n";
        const file = new UnitTestSRFile(noteText);
        const scheduleInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            moment("2023-09-06"),
            0,
        );

        await instance.noteSetSchedule(file, scheduleInfo);

        const expectedText = `---
sr-due: 2023-09-10
sr-algorithm: fsrs
sr-stability: 5.50
sr-difficulty: 3.20
sr-state: 2
sr-reps: 3
sr-lapses: 1
sr-learning-steps: 0
sr-last-review: 2023-09-06
---

A note without frontmatter
`;
        expect(file.content).toEqual(expectedText);
    });

    test("Adds FSRS to existing frontmatter (no SR fields)", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
created: 2024-01-17
---
A very interesting note
`;
        const file = new UnitTestSRFile(noteText);
        const scheduleInfo = new RepItemScheduleInfoFsrs(
            moment("2023-10-06"),
            10.0,
            2.5,
            State.Review,
            5,
            25,
            5,
            0,
            0,
            moment("2023-09-06"),
            0,
        );

        await instance.noteSetSchedule(file, scheduleInfo);

        const expectedText = `---
created: 2024-01-17
sr-due: 2023-10-06
sr-algorithm: fsrs
sr-stability: 10.00
sr-difficulty: 2.50
sr-state: 2
sr-reps: 5
sr-lapses: 0
sr-learning-steps: 0
sr-last-review: 2023-09-06
---
A very interesting note
`;
        expect(file.content).toEqual(expectedText);
    });

    test("Updates existing FSRS frontmatter", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
sr-due: 2023-09-06
sr-algorithm: fsrs
sr-stability: 5.00
sr-difficulty: 3.00
sr-state: 2
sr-reps: 2
sr-lapses: 0
sr-learning-steps: 0
sr-last-review: 2023-09-01
---
A reviewed note
`;
        const file = new UnitTestSRFile(noteText);
        const scheduleInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-20"),
            12.5,
            2.8,
            State.Review,
            5,
            14,
            3,
            0,
            0,
            moment("2023-09-06"),
            0,
        );

        await instance.noteSetSchedule(file, scheduleInfo);

        const expectedText = `---
sr-due: 2023-09-20
sr-algorithm: fsrs
sr-stability: 12.50
sr-difficulty: 2.80
sr-state: 2
sr-reps: 3
sr-lapses: 0
sr-learning-steps: 0
sr-last-review: 2023-09-06
---
A reviewed note
`;
        expect(file.content).toEqual(expectedText);
    });

    test("Updates FSRS frontmatter preserving other frontmatter fields before", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = `---
created: 2024-01-17
tags: review
sr-due: 2023-09-06
sr-algorithm: fsrs
sr-stability: 5.00
sr-difficulty: 3.00
sr-state: 2
sr-reps: 2
sr-lapses: 0
sr-learning-steps: 0
sr-last-review: 2023-09-01
---
A note with extra frontmatter
`;
        const file = new UnitTestSRFile(noteText);
        const scheduleInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-15"),
            8.0,
            3.5,
            State.Review,
            5,
            9,
            3,
            0,
            0,
            moment("2023-09-06"),
            0,
        );

        await instance.noteSetSchedule(file, scheduleInfo);

        expect(file.content).toContain("created: 2024-01-17");
        expect(file.content).toContain("tags: review");
        expect(file.content).toContain("sr-due: 2023-09-15");
        expect(file.content).toContain("sr-stability: 8.00");
        expect(file.content).toContain("sr-difficulty: 3.50");
    });

    test("Handles null lastReview by writing empty string", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = "A note\n";
        const file = new UnitTestSRFile(noteText);
        const scheduleInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.New,
            0,
            0,
            0,
            0,
            0,
            null,
            0,
        );

        await instance.noteSetSchedule(file, scheduleInfo);

        expect(file.content).toContain("sr-last-review: \n");
    });
});

describe("questionFormatSchedule", () => {
    test("Formats single card with schedule as mnemo block", () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const scheduleInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            moment("2023-09-06"),
            0,
        );
        const card = new Card({ scheduleInfo });
        const question = new Question({ cards: [card] });

        const result = instance.questionFormatSchedule(question);

        expect(result).toContain("```mnemo");
        expect(result).toContain("due: 2023-09-10");
        expect(result).toContain("s: 5.50");
        expect(result).toContain("d: 3.20");
        expect(result).toContain("state: 2");
        expect(result).toContain("reps: 3");
        expect(result).toContain("lapses: 1");
        expect(result).toContain("steps: 0");
        expect(result).toContain("last: 2023-09-06");
        expect(result).toMatch(/```$/);
    });

    test("Formats single card without schedule (new card)", () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const card = new Card({});
        const question = new Question({ cards: [card] });

        const result = instance.questionFormatSchedule(question);

        expect(result).toContain("```mnemo");
        expect(result).toContain("new: true");
    });

    test("Formats multiple cards with mixed schedules", () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const scheduleInfo1 = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            moment("2023-09-06"),
            0,
        );
        const card1 = new Card({ scheduleInfo: scheduleInfo1 });

        const card2 = new Card({}); // no schedule (new card)

        const scheduleInfo3 = new RepItemScheduleInfoFsrs(
            moment("2023-09-08"),
            2.0,
            5.0,
            State.Learning,
            0,
            2,
            1,
            0,
            1,
            moment("2023-09-06"),
            0,
        );
        const card3 = new Card({ scheduleInfo: scheduleInfo3 });

        const question = new Question({ cards: [card1, card2, card3] });

        const result = instance.questionFormatSchedule(question);

        expect(result).toContain("[0]");
        expect(result).toContain("[1]");
        expect(result).toContain("[2]");
        expect(result).toContain("due: 2023-09-10");
        expect(result).toContain("new: true");
        expect(result).toContain("due: 2023-09-08");
        expect(result).toContain("s: 2.00");
        expect(result).toContain("steps: 1");
    });

    test("Uses mnemo code block format", () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const card = new Card({});
        const question = new Question({ cards: [card] });

        const result = instance.questionFormatSchedule(question);

        expect(result.startsWith("```mnemo\n")).toBe(true);
        expect(result.endsWith("\n```")).toBe(true);
    });
});

describe("noteGetSchedule and noteSetSchedule round-trip", () => {
    test("Schedule written can be read back correctly", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = "A note to test round-trip\n";
        const file = new UnitTestSRFile(noteText);
        const originalSchedule = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            moment("2023-09-06"),
            0,
        );

        await instance.noteSetSchedule(file, originalSchedule);
        const readSchedule = await instance.noteGetSchedule(file);

        expect(readSchedule).not.toBeNull();
        const fsrsSchedule = readSchedule as RepItemScheduleInfoFsrs;
        expect(fsrsSchedule.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
        expect(fsrsSchedule.stability).toBeCloseTo(5.5);
        expect(fsrsSchedule.difficulty).toBeCloseTo(3.2);
        expect(fsrsSchedule.state).toEqual(State.Review);
        expect(fsrsSchedule.reps).toEqual(3);
        expect(fsrsSchedule.lapses).toEqual(1);
        expect(fsrsSchedule.learningSteps).toEqual(0);
        expect(fsrsSchedule.lastReview.format("YYYY-MM-DD")).toEqual("2023-09-06");
    });

    test("Schedule can be updated and re-read", async () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS };
        const instance = new DataStoreInNoteAlgorithmFsrs(settings);

        const noteText = "A note to test updates\n";
        const file = new UnitTestSRFile(noteText);

        // First write
        const schedule1 = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            moment("2023-09-06"),
            0,
        );
        await instance.noteSetSchedule(file, schedule1);

        // Second write (update)
        const schedule2 = new RepItemScheduleInfoFsrs(
            moment("2023-09-25"),
            12.0,
            2.8,
            State.Review,
            10,
            15,
            4,
            1,
            0,
            moment("2023-09-10"),
            0,
        );
        await instance.noteSetSchedule(file, schedule2);

        const readSchedule = await instance.noteGetSchedule(file);
        const fsrsSchedule = readSchedule as RepItemScheduleInfoFsrs;
        expect(fsrsSchedule.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-25");
        expect(fsrsSchedule.stability).toBeCloseTo(12.0);
        expect(fsrsSchedule.difficulty).toBeCloseTo(2.8);
        expect(fsrsSchedule.reps).toEqual(4);
    });
});
