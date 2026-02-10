import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { osrSchedule, textInterval } from "src/algorithms/osr/note-scheduling";
import { DueDateHistogram } from "src/due-date-histogram";
import { DEFAULT_SETTINGS } from "src/settings";

const emptyHistogram = new DueDateHistogram();

test("Test reviewing with default settings", () => {
    expect(
        osrSchedule(
            ReviewResponse.Easy,
            1,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            emptyHistogram,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase + 20,
        interval: 4,
    });

    expect(
        osrSchedule(
            ReviewResponse.Good,
            1,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            emptyHistogram,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 3,
    });

    expect(
        osrSchedule(
            ReviewResponse.Hard,
            1,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            emptyHistogram,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase - 20,
        interval: 1,
    });
});

test("Test reviewing with default settings & delay", () => {
    const delay = 2 * 24 * 3600 * 1000; // two day delay
    expect(
        osrSchedule(
            ReviewResponse.Easy,
            10,
            DEFAULT_SETTINGS.baseEase,
            delay,
            DEFAULT_SETTINGS,
            emptyHistogram,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase + 20,
        interval: 42,
    });

    expect(
        osrSchedule(
            ReviewResponse.Good,
            10,
            DEFAULT_SETTINGS.baseEase,
            delay,
            DEFAULT_SETTINGS,
            emptyHistogram,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 28,
    });

    expect(
        osrSchedule(
            ReviewResponse.Hard,
            10,
            DEFAULT_SETTINGS.baseEase,
            delay,
            DEFAULT_SETTINGS,
            emptyHistogram,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase - 20,
        interval: 5,
    });
});

test("Test load balancing, small interval (load balancing disabled)", () => {
    const originalInterval: number = 1;
    const newInterval: number = 3;
    const dueDates = new DueDateHistogram({
        0: 1,
        1: 1,
        2: 1,
        3: 4,
    });
    expect(
        osrSchedule(
            ReviewResponse.Good,
            1,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            dueDates,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: newInterval,
    });
    dueDates.decrement(originalInterval);
    dueDates.increment(newInterval);
    expect(dueDates).toEqual(
        new DueDateHistogram({
            0: 1,
            1: 0,
            2: 1,
            3: 5,
        }),
    );
});

test("Test load balancing", () => {
    // interval <= 7
    let dueDates = new DueDateHistogram({
        5: 2,
    });
    expect(
        osrSchedule(
            ReviewResponse.Good,
            2,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            dueDates,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 5,
    });

    // 7 < interval <= 21
    dueDates = new DueDateHistogram({
        17: 4,
        18: 5,
        19: 3,
    });
    expect(
        osrSchedule(
            ReviewResponse.Good,
            7,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            dueDates,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 19,
    });

    // 21 < interval <= 180
    dueDates = new DueDateHistogram({
        23: 5,
        26: 1,
    });
    expect(
        osrSchedule(
            ReviewResponse.Good,
            10,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            dueDates,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 25,
    });

    dueDates = new DueDateHistogram({
        2: 5,
        59: 8,
        60: 9,
        61: 3,
        62: 5,
        63: 4,
        64: 4,
        65: 8,
        66: 2,
        67: 10,
    });
    expect(
        osrSchedule(
            ReviewResponse.Good,
            25,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            dueDates,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 66,
    });

    // interval > 180
    dueDates = new DueDateHistogram({
        1245: 7,
        1246: 4,
        1247: 2,
        1248: 9,
        1249: 5,
        1250: 4,
        1251: 1,
        1252: 1,
        1254: 1,
    });
    expect(
        osrSchedule(
            ReviewResponse.Good,
            500,
            DEFAULT_SETTINGS.baseEase,
            0,
            DEFAULT_SETTINGS,
            dueDates,
        ),
    ).toEqual({
        ease: DEFAULT_SETTINGS.baseEase,
        interval: 1253,
    });
});

test("Test textInterval - desktop", () => {
    expect(textInterval(1, false)).toEqual("1 day(s)");
    expect(textInterval(41, false)).toEqual("1.3 month(s)");
    expect(textInterval(366, false)).toEqual("1 year(s)");
    expect(textInterval(1000, false)).toEqual("2.7 year(s)");
});

test("Test textInterval - mobile", () => {
    expect(textInterval(1, true)).toEqual("1d");
    expect(textInterval(41, true)).toEqual("1.3m");
    expect(textInterval(366, true)).toEqual("1y");
    expect(textInterval(1000, true)).toEqual("2.7y");
});

test("Test textInterval - sub-day intervals (FSRS learning steps) - desktop", () => {
    // 1 minute = 1/(24*60) days ≈ 0.000694
    expect(textInterval(1 / (24 * 60), false)).toEqual("1 min(s)");
    // 6 minutes
    expect(textInterval(6 / (24 * 60), false)).toEqual("6 min(s)");
    // 10 minutes
    expect(textInterval(10 / (24 * 60), false)).toEqual("10 min(s)");
    // 30 minutes
    expect(textInterval(30 / (24 * 60), false)).toEqual("30 min(s)");
    // 1 hour
    expect(textInterval(1 / 24, false)).toEqual("1 hour(s)");
    // 4 hours
    expect(textInterval(4 / 24, false)).toEqual("4 hour(s)");
    // 12 hours
    expect(textInterval(12 / 24, false)).toEqual("12 hour(s)");
});

test("Test textInterval - sub-day intervals (FSRS learning steps) - mobile", () => {
    expect(textInterval(1 / (24 * 60), true)).toEqual("1min");
    expect(textInterval(6 / (24 * 60), true)).toEqual("6min");
    expect(textInterval(10 / (24 * 60), true)).toEqual("10min");
    expect(textInterval(1 / 24, true)).toEqual("1h");
    expect(textInterval(4 / 24, true)).toEqual("4h");
    expect(textInterval(12 / 24, true)).toEqual("12h");
});

test("Test new cards", () => {
    expect(textInterval(undefined, false)).toEqual("New");
});
