import moment from "moment";
import { State } from "ts-fsrs";

import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { SrsAlgorithm } from "src/algorithms/base/srs-algorithm";
import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { SrsAlgorithmFsrs } from "src/algorithms/fsrs/srs-algorithm-fsrs";
import { DataStoreAlgorithm } from "src/data-store-algorithm/data-store-algorithm";
import { DataStoreInNoteAlgorithmFsrs } from "src/data-store-algorithm/data-store-in-note-algorithm-fsrs";
import { DataStore } from "src/data-stores/base/data-store";
import { StoreInNotes } from "src/data-stores/notes/notes";
import { DueDateHistogram } from "src/due-date-histogram";
import { DEFAULT_SETTINGS, SRSettings } from "src/settings";
import { setupStaticDateProvider20230906 } from "src/utils/dates";

function setupFsrsAlgorithm(settings: SRSettings = { ...DEFAULT_SETTINGS, algorithm: "FSRS" }) {
    DataStore.instance = new StoreInNotes(settings);
    SrsAlgorithm.instance = new SrsAlgorithmFsrs(settings);
    DataStoreAlgorithm.instance = new DataStoreInNoteAlgorithmFsrs(settings);
}

beforeAll(() => {
    setupStaticDateProvider20230906();
});

beforeEach(() => {
    setupFsrsAlgorithm();
});

describe("constructor", () => {
    test("Creates FSRS instance with default settings", () => {
        const settings: SRSettings = { ...DEFAULT_SETTINGS, algorithm: "FSRS" };
        const alg = new SrsAlgorithmFsrs(settings);

        // Should not throw
        expect(alg).toBeDefined();
    });

    test("Creates FSRS instance with custom retention", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsRequestRetention: 0.85,
        };
        const alg = new SrsAlgorithmFsrs(settings);

        expect(alg).toBeDefined();
    });

    test("Creates FSRS instance with fuzz disabled", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        // Disable fuzz for deterministic tests
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance() as SrsAlgorithmFsrs;

        expect(alg).toBeDefined();
    });

    test("Creates FSRS instance with custom weights", () => {
        const customWeights = [
            0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26,
            0.29, 2.61,
        ];
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsWeights: customWeights,
        };
        const alg = new SrsAlgorithmFsrs(settings);

        expect(alg).toBeDefined();
    });
});

describe("noteOnLoadedNote", () => {
    test("Stores note ease in noteEaseList", () => {
        const alg = SrsAlgorithm.getInstance() as SrsAlgorithmFsrs;

        alg.noteOnLoadedNote("test/path.md", null, 250);

        const stats = alg.noteStats();
        expect(stats.hasEaseForPath("test/path.md")).toBe(true);
        expect(stats.getEaseByPath("test/path.md")).toEqual(250);
    });

    test("Does not store ease when noteEase is falsy (0)", () => {
        const alg = SrsAlgorithm.getInstance() as SrsAlgorithmFsrs;

        alg.noteOnLoadedNote("test/path.md", null, 0);

        const stats = alg.noteStats();
        expect(stats.hasEaseForPath("test/path.md")).toBe(false);
    });

    test("Does not store ease when noteEase is null", () => {
        const alg = SrsAlgorithm.getInstance() as SrsAlgorithmFsrs;

        alg.noteOnLoadedNote("test/path.md", null, null);

        const stats = alg.noteStats();
        expect(stats.hasEaseForPath("test/path.md")).toBe(false);
    });
});

describe("noteCalcNewSchedule", () => {
    test("Returns a RepItemScheduleInfoFsrs for Easy response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const result = alg.noteCalcNewSchedule(
            "test/note.md",
            null,
            ReviewResponse.Easy,
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.dueDate).toBeDefined();
        expect(fsrsResult.stability).toBeGreaterThan(0);
        expect(fsrsResult.reps).toEqual(1);
        expect(fsrsResult.state).toBeDefined();
    });

    test("Returns a RepItemScheduleInfoFsrs for Good response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const result = alg.noteCalcNewSchedule(
            "test/note.md",
            null,
            ReviewResponse.Good,
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.reps).toEqual(1);
    });

    test("Returns a RepItemScheduleInfoFsrs for Hard response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const result = alg.noteCalcNewSchedule(
            "test/note.md",
            null,
            ReviewResponse.Hard,
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
    });

    test("Returns a RepItemScheduleInfoFsrs for Reset response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const result = alg.noteCalcNewSchedule(
            "test/note.md",
            null,
            ReviewResponse.Reset,
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
    });

    test("Easy response yields longer interval than Good", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const easyResult = alg.noteCalcNewSchedule(
            "test/note.md",
            null,
            ReviewResponse.Easy,
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        const goodResult = alg.noteCalcNewSchedule(
            "test/note.md",
            null,
            ReviewResponse.Good,
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        expect(easyResult.scheduledDays).toBeGreaterThanOrEqual(goodResult.scheduledDays);
    });
});

describe("noteCalcUpdatedSchedule", () => {
    test("Updates existing FSRS schedule with Good response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const existingSchedule = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            5.0,
            3.0,
            State.Review,
            5,
            5,
            2,
            0,
            0,
            moment("2023-09-01"),
            0,
        );

        const result = alg.noteCalcUpdatedSchedule(
            "test/note.md",
            existingSchedule,
            ReviewResponse.Good,
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.reps).toEqual(3);
        expect(fsrsResult.stability).toBeGreaterThan(0);
    });

    test("Reset response increases lapses", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const existingSchedule = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            10.0,
            3.0,
            State.Review,
            10,
            10,
            3,
            0,
            0,
            moment("2023-08-27"),
            0,
        );

        const result = alg.noteCalcUpdatedSchedule(
            "test/note.md",
            existingSchedule,
            ReviewResponse.Reset,
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        expect(result.lapses).toEqual(1);
    });
});

describe("cardGetResetSchedule", () => {
    test("Returns a new-state schedule with today as due date", () => {
        const alg = SrsAlgorithm.getInstance();

        const result = alg.cardGetResetSchedule();

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-06");
        expect(fsrsResult.state).toEqual(State.New);
        expect(fsrsResult.stability).toEqual(0);
        expect(fsrsResult.difficulty).toEqual(0);
        expect(fsrsResult.elapsedDays).toEqual(0);
        expect(fsrsResult.scheduledDays).toEqual(0);
        expect(fsrsResult.reps).toEqual(0);
        expect(fsrsResult.lapses).toEqual(0);
        expect(fsrsResult.learningSteps).toEqual(0);
        expect(fsrsResult.lastReview).toBeNull();
    });
});

describe("cardGetNewSchedule", () => {
    test("Returns a schedule for a new card with Easy response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const result = alg.cardGetNewSchedule(
            ReviewResponse.Easy,
            "test/note.md",
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.reps).toEqual(1);
        expect(fsrsResult.stability).toBeGreaterThan(0);
    });

    test("Returns a schedule for a new card with Good response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const result = alg.cardGetNewSchedule(
            ReviewResponse.Good,
            "test/note.md",
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.reps).toEqual(1);
    });

    test("Easy response on new card yields longer or equal interval than Good", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const easyResult = alg.cardGetNewSchedule(
            ReviewResponse.Easy,
            "test/note.md",
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        const goodResult = alg.cardGetNewSchedule(
            ReviewResponse.Good,
            "test/note.md",
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        expect(easyResult.scheduledDays).toBeGreaterThanOrEqual(goodResult.scheduledDays);
    });
});

describe("cardCalcUpdatedSchedule", () => {
    test("Updates existing card schedule with Good response", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const existingSchedule = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            5.0,
            3.0,
            State.Review,
            5,
            5,
            2,
            0,
            0,
            moment("2023-09-01"),
            0,
        );

        const result = alg.cardCalcUpdatedSchedule(
            ReviewResponse.Good,
            existingSchedule,
            new DueDateHistogram(),
        );

        expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
        const fsrsResult = result as RepItemScheduleInfoFsrs;
        expect(fsrsResult.reps).toEqual(3);
    });

    test("Hard response yields shorter interval than Good", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const existingSchedule = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            10.0,
            3.0,
            State.Review,
            10,
            10,
            3,
            0,
            0,
            moment("2023-08-27"),
            0,
        );

        const hardResult = alg.cardCalcUpdatedSchedule(
            ReviewResponse.Hard,
            existingSchedule,
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        const goodResult = alg.cardCalcUpdatedSchedule(
            ReviewResponse.Good,
            existingSchedule,
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        expect(hardResult.scheduledDays).toBeLessThanOrEqual(goodResult.scheduledDays);
    });

    test("Reset response on review card triggers relearning", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const existingSchedule = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            15.0,
            3.0,
            State.Review,
            15,
            15,
            5,
            0,
            0,
            moment("2023-08-22"),
            0,
        );

        const result = alg.cardCalcUpdatedSchedule(
            ReviewResponse.Reset,
            existingSchedule,
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        expect(result.lapses).toEqual(1);
        expect(result.state).toEqual(State.Relearning);
    });
});

describe("noteStats", () => {
    test("Returns empty noteEaseList initially", () => {
        const alg = SrsAlgorithm.getInstance();

        const stats = alg.noteStats();

        expect(stats.dict).toEqual({});
    });

    test("Returns noteEaseList with loaded notes", () => {
        const alg = SrsAlgorithm.getInstance() as SrsAlgorithmFsrs;

        alg.noteOnLoadedNote("note1.md", null, 250);
        alg.noteOnLoadedNote("note2.md", null, 300);

        const stats = alg.noteStats();
        expect(stats.getEaseByPath("note1.md")).toEqual(250);
        expect(stats.getEaseByPath("note2.md")).toEqual(300);
    });
});

describe("ReviewResponse to FSRS Rating mapping", () => {
    test("All four review responses produce valid results", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        const responses = [
            ReviewResponse.Easy,
            ReviewResponse.Good,
            ReviewResponse.Hard,
            ReviewResponse.Reset,
        ];

        for (const response of responses) {
            const result = alg.cardGetNewSchedule(response, "test/note.md", new DueDateHistogram());

            expect(result).toBeInstanceOf(RepItemScheduleInfoFsrs);
            expect((result as RepItemScheduleInfoFsrs).stability).toBeGreaterThanOrEqual(0);
        }
    });
});

describe("maximumInterval setting", () => {
    test("Respects maximum interval from settings", () => {
        const settings: SRSettings = {
            ...DEFAULT_SETTINGS,
            algorithm: "FSRS",
            fsrsEnableFuzz: false,
            maximumInterval: 30,
        };
        setupFsrsAlgorithm(settings);
        const alg = SrsAlgorithm.getInstance();

        // Review a card multiple times to build up interval
        let schedule = alg.cardGetNewSchedule(
            ReviewResponse.Easy,
            "test/note.md",
            new DueDateHistogram(),
        ) as RepItemScheduleInfoFsrs;

        for (let i = 0; i < 10; i++) {
            schedule = alg.cardCalcUpdatedSchedule(
                ReviewResponse.Easy,
                schedule,
                new DueDateHistogram(),
            ) as RepItemScheduleInfoFsrs;
        }

        expect(schedule.scheduledDays).toBeLessThanOrEqual(30);
    });
});
