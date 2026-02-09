import moment, { Moment } from "moment";
import { State } from "ts-fsrs";

import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { RepItemScheduleInfoOsr } from "src/algorithms/osr/rep-item-schedule-info-osr";
import { globalDateProvider } from "src/utils/dates";

/**
 * Convert SM-2 (OSR) schedule info to FSRS schedule info.
 *
 * Heuristic mapping:
 * - OSR ease (130-300+) maps to FSRS difficulty (1-10): difficulty = max(1, min(10, 11 - ease/30))
 *   e.g. ease=250 → difficulty≈2.7 (easy), ease=130 → difficulty≈6.7 (hard)
 * - Stability is approximated as the current interval (at 90% retention, stability ≈ interval)
 * - State: interval <= 1 → Learning, otherwise → Review
 */
export function migrateOsrToFsrs(osrInfo: RepItemScheduleInfoOsr): RepItemScheduleInfoFsrs {
    const difficulty = Math.max(1, Math.min(10, 11 - osrInfo.latestEase / 30));
    const stability = Math.max(0.1, osrInfo.interval);
    const state = osrInfo.interval <= 1 ? State.Learning : State.Review;
    const reps = Math.max(1, Math.floor(Math.log2(Math.max(1, osrInfo.interval)) + 1));
    const lastReview: Moment = osrInfo.dueDate
        ? moment(osrInfo.dueDate).subtract(osrInfo.interval, "days")
        : moment(globalDateProvider.today);

    return new RepItemScheduleInfoFsrs(
        osrInfo.dueDate,
        stability,
        difficulty,
        state,
        osrInfo.interval,
        osrInfo.interval,
        reps,
        0,
        0,
        lastReview,
    );
}

/**
 * Convert FSRS schedule info back to SM-2 (OSR) schedule info.
 *
 * Reverse mapping:
 * - FSRS difficulty (1-10) maps to OSR ease: ease = round((11 - difficulty) * 30)
 * - Interval is taken from scheduledDays
 */
export function migrateFsrsToOsr(fsrsInfo: RepItemScheduleInfoFsrs): RepItemScheduleInfoOsr {
    const ease = Math.max(130, Math.round((11 - fsrsInfo.difficulty) * 30));
    const interval = Math.max(1, fsrsInfo.scheduledDays);

    return new RepItemScheduleInfoOsr(fsrsInfo.dueDate, interval, ease);
}
