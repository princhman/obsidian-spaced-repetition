import moment from "moment";
import { State } from "ts-fsrs";

import { migrateFsrsToOsr, migrateOsrToFsrs } from "src/algorithms/fsrs/migration";
import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { RepItemScheduleInfoOsr } from "src/algorithms/osr/rep-item-schedule-info-osr";
import { setupStaticDateProvider20230906 } from "src/utils/dates";

beforeAll(() => {
    setupStaticDateProvider20230906();
});

describe("migrateOsrToFsrs", () => {
    test("Converts typical SM-2 schedule to FSRS", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 10, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // difficulty = max(1, min(10, 11 - 250/30)) = max(1, min(10, 2.67)) = 2.67
        expect(fsrsInfo.difficulty).toBeCloseTo(11 - 250 / 30, 1);
        // stability = max(0.1, 10) = 10
        expect(fsrsInfo.stability).toEqual(10);
        // state: interval > 1 => Review
        expect(fsrsInfo.state).toEqual(State.Review);
        expect(fsrsInfo.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
        // elapsedDays = interval
        expect(fsrsInfo.elapsedDays).toEqual(10);
        // scheduledDays = interval
        expect(fsrsInfo.scheduledDays).toEqual(10);
        expect(fsrsInfo.lapses).toEqual(0);
        expect(fsrsInfo.learningSteps).toEqual(0);
    });

    test("Difficulty mapping: ease=250 yields moderate difficulty", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 10, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // difficulty = 11 - 250/30 = 2.6667
        expect(fsrsInfo.difficulty).toBeCloseTo(2.67, 1);
    });

    test("Difficulty mapping: ease=130 yields high difficulty", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 5, 130);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // difficulty = 11 - 130/30 = 6.6667
        expect(fsrsInfo.difficulty).toBeCloseTo(6.67, 1);
    });

    test("Difficulty mapping: ease=300 yields low difficulty", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 30, 300);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // difficulty = 11 - 300/30 = 1
        expect(fsrsInfo.difficulty).toEqual(1);
    });

    test("Difficulty is clamped to minimum of 1", () => {
        // ease=330 => 11 - 330/30 = 0 => clamped to 1
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 30, 330);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.difficulty).toEqual(1);
    });

    test("Difficulty is clamped to maximum of 10", () => {
        // ease=10 => 11 - 10/30 = 10.67 => clamped to 10
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 1, 10);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.difficulty).toEqual(10);
    });

    test("Stability equals interval for normal intervals", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 25, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.stability).toEqual(25);
    });

    test("Stability is clamped to minimum of 0.1", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-06", 0, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.stability).toEqual(0.1);
    });

    test("State is Learning when interval <= 1", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-07", 1, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.state).toEqual(State.Learning);
    });

    test("State is Review when interval > 1", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 2, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.state).toEqual(State.Review);
    });

    test("Reps calculated from interval using log2 formula", () => {
        // interval=8 => reps = max(1, floor(log2(8) + 1)) = max(1, floor(4)) = 4
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 8, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.reps).toEqual(4);
    });

    test("Reps is at least 1 for small intervals", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-07", 1, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.reps).toBeGreaterThanOrEqual(1);
    });

    test("LastReview is computed from dueDate minus interval", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 5, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // lastReview = dueDate - interval = 2023-09-10 - 5 = 2023-09-05
        expect(fsrsInfo.lastReview.format("YYYY-MM-DD")).toEqual("2023-09-05");
    });

    test("LastReview defaults to today when dueDate is null", () => {
        const osrInfo = new RepItemScheduleInfoOsr(null, 5, 250, null);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // When dueDate is null, lastReview = globalDateProvider.today = 2023-09-06
        expect(fsrsInfo.lastReview.format("YYYY-MM-DD")).toEqual("2023-09-06");
    });

    test("Preserves dueDate from source", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-10-15", 20, 270);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        expect(fsrsInfo.dueDate.format("YYYY-MM-DD")).toEqual("2023-10-15");
    });

    test("Base class fields are mapped correctly after migration", () => {
        const osrInfo = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 10, 250);
        const fsrsInfo = migrateOsrToFsrs(osrInfo);

        // interval = round(scheduledDays) = round(10) = 10
        expect(fsrsInfo.interval).toEqual(10);
        // latestEase = round((11 - difficulty) * 30)
        // difficulty ≈ 2.67 => latestEase ≈ round(8.33 * 30) = round(250) = 250
        expect(fsrsInfo.latestEase).toEqual(Math.round((11 - fsrsInfo.difficulty) * 30));
    });
});

describe("migrateFsrsToOsr", () => {
    test("Converts typical FSRS schedule to SM-2", () => {
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            10.0,
            3.0,
            State.Review,
            5,
            10,
            3,
            0,
            0,
            moment("2023-09-05"),
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        // ease = max(130, round((11 - 3.0) * 30)) = max(130, 240) = 240
        expect(osrInfo.latestEase).toEqual(240);
        // interval = max(1, scheduledDays) = max(1, 10) = 10
        expect(osrInfo.interval).toEqual(10);
        expect(osrInfo.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
    });

    test("Ease is clamped to minimum of 130", () => {
        // difficulty = 10 => ease = round((11 - 10) * 30) = 30 => clamped to 130
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            1.0,
            10.0,
            State.Review,
            0,
            1,
            1,
            0,
            0,
            null,
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        expect(osrInfo.latestEase).toEqual(130);
    });

    test("Ease mapping: difficulty=1 yields ease=300", () => {
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            30.0,
            1.0,
            State.Review,
            0,
            30,
            10,
            0,
            0,
            moment("2023-08-11"),
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        expect(osrInfo.latestEase).toEqual(300);
    });

    test("Ease mapping: difficulty=5.67 yields ease=160", () => {
        // ease = round((11 - 5.67) * 30) = round(160) = 160
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            10.0,
            5.67,
            State.Review,
            0,
            10,
            3,
            0,
            0,
            null,
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        expect(osrInfo.latestEase).toEqual(Math.max(130, Math.round((11 - 5.67) * 30)));
    });

    test("Interval is clamped to minimum of 1", () => {
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            1.0,
            5.0,
            State.Learning,
            0,
            0,
            1,
            0,
            1,
            null,
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        expect(osrInfo.interval).toEqual(1);
    });

    test("Interval equals scheduledDays when above 1", () => {
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            2,
            0,
            0,
            null,
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        expect(osrInfo.interval).toEqual(7);
    });

    test("Preserves dueDate from source", () => {
        const fsrsInfo = new RepItemScheduleInfoFsrs(
            moment("2023-10-15"),
            20.0,
            2.5,
            State.Review,
            0,
            20,
            5,
            0,
            0,
            null,
            0,
        );
        const osrInfo = migrateFsrsToOsr(fsrsInfo);

        expect(osrInfo.dueDate.format("YYYY-MM-DD")).toEqual("2023-10-15");
    });
});

describe("round-trip migration", () => {
    test("OSR -> FSRS -> OSR preserves ease and interval approximately", () => {
        const originalOsr = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 10, 250);
        const fsrsInfo = migrateOsrToFsrs(originalOsr);
        const roundTripOsr = migrateFsrsToOsr(fsrsInfo);

        // The ease should be close to original (may lose precision due to rounding)
        expect(roundTripOsr.latestEase).toBeCloseTo(250, -1);
        // The interval should match (scheduledDays = interval in migrateOsrToFsrs)
        expect(roundTripOsr.interval).toEqual(10);
        expect(roundTripOsr.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
    });

    test("OSR -> FSRS -> OSR with low ease preserves minimum ease", () => {
        const originalOsr = RepItemScheduleInfoOsr.fromDueDateStr("2023-09-10", 5, 130);
        const fsrsInfo = migrateOsrToFsrs(originalOsr);
        const roundTripOsr = migrateFsrsToOsr(fsrsInfo);

        expect(roundTripOsr.latestEase).toBeGreaterThanOrEqual(130);
        expect(roundTripOsr.interval).toEqual(5);
    });
});
