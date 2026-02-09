import moment from "moment";
import { State } from "ts-fsrs";

import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { DEFAULT_SETTINGS } from "src/settings";
import { setupStaticDateProvider20230906 } from "src/utils/dates";

beforeAll(() => {
    setupStaticDateProvider20230906();
});

describe("constructor", () => {
    test("Sets all FSRS-specific fields correctly", () => {
        const dueDate = moment("2023-09-10");
        const lastReview = moment("2023-09-06");
        const info = new RepItemScheduleInfoFsrs(
            dueDate,
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            lastReview,
        );

        expect(info.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
        expect(info.stability).toEqual(5.5);
        expect(info.difficulty).toEqual(3.2);
        expect(info.state).toEqual(State.Review);
        expect(info.elapsedDays).toEqual(4);
        expect(info.scheduledDays).toEqual(10);
        expect(info.reps).toEqual(3);
        expect(info.lapses).toEqual(1);
        expect(info.learningSteps).toEqual(0);
        expect(info.lastReview.format("YYYY-MM-DD")).toEqual("2023-09-06");
    });

    test("Maps interval from scheduledDays (rounded)", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            3.0,
            State.Review,
            0,
            7.6,
            1,
            0,
            0,
            null,
        );

        expect(info.interval).toEqual(8);
    });

    test("Maps latestEase from difficulty using formula (11-difficulty)*30", () => {
        // difficulty = 3.0 => latestEase = (11 - 3.0) * 30 = 240
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
        );

        expect(info.latestEase).toEqual(240);
    });

    test("Maps latestEase correctly for high difficulty", () => {
        // difficulty = 10 => latestEase = (11 - 10) * 30 = 30
        const info = new RepItemScheduleInfoFsrs(
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
        );

        expect(info.latestEase).toEqual(30);
    });

    test("Maps latestEase correctly for low difficulty", () => {
        // difficulty = 1 => latestEase = (11 - 1) * 30 = 300
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            20.0,
            1.0,
            State.Review,
            0,
            30,
            10,
            0,
            0,
            null,
        );

        expect(info.latestEase).toEqual(300);
    });

    test("Rounds latestEase for non-integer difficulty", () => {
        // difficulty = 4.7 => latestEase = round((11 - 4.7) * 30) = round(189) = 189
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            4.7,
            State.Review,
            0,
            5,
            1,
            0,
            0,
            null,
        );

        expect(info.latestEase).toEqual(Math.round((11 - 4.7) * 30));
    });

    test("Handles null dueDate", () => {
        const info = new RepItemScheduleInfoFsrs(
            null,
            0,
            0,
            State.New,
            0,
            0,
            0,
            0,
            0,
            null,
        );

        expect(info.dueDate).toBeNull();
        expect(info.interval).toEqual(0);
    });

    test("Handles null lastReview", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
        );

        expect(info.lastReview).toBeNull();
    });

    test("Computes delayedBeforeReviewTicks when dueDate provided and delayedBeforeReviewTicks is null", () => {
        // Today is 2023-09-06, dueDate is 2023-09-04 => delayed by 2 days worth of ticks
        const dueDate = moment("2023-09-04");
        const info = new RepItemScheduleInfoFsrs(
            dueDate,
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
        );

        // today (2023-09-06 start of day) - dueDate (2023-09-04)
        const expectedTicks = moment("2023-09-06").startOf("day").valueOf() - dueDate.valueOf();
        expect(info.delayedBeforeReviewTicks).toEqual(expectedTicks);
    });

    test("Uses provided delayedBeforeReviewTicks when explicitly passed", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
            12345,
        );

        expect(info.delayedBeforeReviewTicks).toEqual(12345);
    });
});

describe("formatCardScheduleForHtmlComment", () => {
    test("Formats with due date and last review", () => {
        const info = new RepItemScheduleInfoFsrs(
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

        expect(info.formatCardScheduleForHtmlComment()).toEqual(
            "!2023-09-10,5.50,3.20,2,4,10,3,1,0,2023-09-06",
        );
    });

    test("Formats with dummy date when dueDate is null", () => {
        const info = new RepItemScheduleInfoFsrs(
            null,
            0,
            0,
            State.New,
            0,
            0,
            0,
            0,
            0,
            null,
        );

        expect(info.formatCardScheduleForHtmlComment()).toEqual(
            "!2000-01-01,0.00,0.00,0,0,0,0,0,0,2000-01-01",
        );
    });

    test("Uses dummy date for lastReview when null", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            null,
            0,
        );

        expect(info.formatCardScheduleForHtmlComment()).toEqual(
            "!2023-09-10,5.50,3.20,2,4,10,3,1,0,2000-01-01",
        );
    });

    test("Formats stability and difficulty with two decimal places", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            1.0,
            7.0,
            State.Learning,
            0,
            1,
            1,
            0,
            1,
            moment("2023-09-06"),
            0,
        );

        const formatted = info.formatCardScheduleForHtmlComment();
        expect(formatted).toContain("1.00,7.00");
    });

    test("Formats all FSRS states correctly", () => {
        // State.New = 0, State.Learning = 1, State.Review = 2, State.Relearning = 3
        for (const state of [State.New, State.Learning, State.Review, State.Relearning]) {
            const info = new RepItemScheduleInfoFsrs(
                moment("2023-09-10"),
                5.0,
                3.0,
                state,
                0,
                7,
                1,
                0,
                0,
                moment("2023-09-06"),
                0,
            );

            const formatted = info.formatCardScheduleForHtmlComment();
            expect(formatted).toContain(`,${state},`);
        }
    });
});

describe("getDummyScheduleForNewCard", () => {
    test("Returns a schedule with all zeros and null dates", () => {
        const dummy = RepItemScheduleInfoFsrs.getDummyScheduleForNewCard(DEFAULT_SETTINGS);

        expect(dummy.dueDate).toBeNull();
        expect(dummy.stability).toEqual(0);
        expect(dummy.difficulty).toEqual(0);
        expect(dummy.state).toEqual(State.New);
        expect(dummy.elapsedDays).toEqual(0);
        expect(dummy.scheduledDays).toEqual(0);
        expect(dummy.reps).toEqual(0);
        expect(dummy.lapses).toEqual(0);
        expect(dummy.learningSteps).toEqual(0);
        expect(dummy.lastReview).toBeNull();
    });

    test("Returns zero interval for new card", () => {
        const dummy = RepItemScheduleInfoFsrs.getDummyScheduleForNewCard(DEFAULT_SETTINGS);

        expect(dummy.interval).toEqual(0);
    });

    test("Formats correctly for HTML comment", () => {
        const dummy = RepItemScheduleInfoFsrs.getDummyScheduleForNewCard(DEFAULT_SETTINGS);

        expect(dummy.formatCardScheduleForHtmlComment()).toEqual(
            "!2000-01-01,0.00,0.00,0,0,0,0,0,0,2000-01-01",
        );
    });
});

describe("fromDueDateStr", () => {
    test("Creates instance from string parameters", () => {
        const info = RepItemScheduleInfoFsrs.fromDueDateStr(
            "2023-09-10",
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            "2023-09-06",
        );

        expect(info.dueDate.format("YYYY-MM-DD")).toEqual("2023-09-10");
        expect(info.stability).toEqual(5.5);
        expect(info.difficulty).toEqual(3.2);
        expect(info.state).toEqual(State.Review);
        expect(info.elapsedDays).toEqual(4);
        expect(info.scheduledDays).toEqual(10);
        expect(info.reps).toEqual(3);
        expect(info.lapses).toEqual(1);
        expect(info.learningSteps).toEqual(0);
        expect(info.lastReview.format("YYYY-MM-DD")).toEqual("2023-09-06");
    });

    test("Sets lastReview to null when lastReviewStr is the dummy date", () => {
        const info = RepItemScheduleInfoFsrs.fromDueDateStr(
            "2023-09-10",
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            "2000-01-01",
        );

        expect(info.lastReview).toBeNull();
    });

    test("Passes delayedBeforeReviewTicks through", () => {
        const info = RepItemScheduleInfoFsrs.fromDueDateStr(
            "2023-09-10",
            5.5,
            3.2,
            State.Review,
            4,
            10,
            3,
            1,
            0,
            "2023-09-06",
            99999,
        );

        expect(info.delayedBeforeReviewTicks).toEqual(99999);
    });

    test("Handles State.New", () => {
        const info = RepItemScheduleInfoFsrs.fromDueDateStr(
            "2023-09-06",
            0,
            0,
            State.New,
            0,
            0,
            0,
            0,
            0,
            "2000-01-01",
        );

        expect(info.state).toEqual(State.New);
        expect(info.lastReview).toBeNull();
    });

    test("Handles State.Learning", () => {
        const info = RepItemScheduleInfoFsrs.fromDueDateStr(
            "2023-09-06",
            1.2,
            5.0,
            State.Learning,
            0,
            0,
            1,
            0,
            1,
            "2023-09-06",
        );

        expect(info.state).toEqual(State.Learning);
        expect(info.learningSteps).toEqual(1);
    });

    test("Handles State.Relearning", () => {
        const info = RepItemScheduleInfoFsrs.fromDueDateStr(
            "2023-09-06",
            2.0,
            6.0,
            State.Relearning,
            10,
            0,
            5,
            2,
            1,
            "2023-09-05",
        );

        expect(info.state).toEqual(State.Relearning);
        expect(info.lapses).toEqual(2);
    });
});

describe("dummyDueDateForNewCard", () => {
    test("Is 2000-01-01", () => {
        expect(RepItemScheduleInfoFsrs.dummyDueDateForNewCard).toEqual("2000-01-01");
    });
});

describe("base class compatibility", () => {
    test("isDue returns true when dueDate is before today", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-05"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
        );

        expect(info.isDue()).toBe(true);
    });

    test("isDue returns true when dueDate is today", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-06"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
        );

        expect(info.isDue()).toBe(true);
    });

    test("isDue returns false when dueDate is after today", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-07"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
        );

        expect(info.isDue()).toBe(false);
    });

    test("formatDueDate returns YYYY-MM-DD format", () => {
        const info = new RepItemScheduleInfoFsrs(
            moment("2023-09-10"),
            5.0,
            3.0,
            State.Review,
            0,
            7,
            1,
            0,
            0,
            null,
            0,
        );

        expect(info.formatDueDate()).toEqual("2023-09-10");
    });
});
