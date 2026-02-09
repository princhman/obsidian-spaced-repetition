import { Moment } from "moment";
import { State } from "ts-fsrs";

import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { SRSettings } from "src/settings";
import { DateUtil, formatDateYYYYMMDD, globalDateProvider } from "src/utils/dates";

export class RepItemScheduleInfoFsrs extends RepItemScheduleInfo {
    public static dummyDueDateForNewCard: string = "2000-01-01";

    stability: number;
    difficulty: number;
    state: State;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    learningSteps: number;
    lastReview: Moment | null;

    constructor(
        dueDate: Moment | null,
        stability: number,
        difficulty: number,
        state: State,
        elapsedDays: number,
        scheduledDays: number,
        reps: number,
        lapses: number,
        learningSteps: number,
        lastReview: Moment | null,
        delayedBeforeReviewTicks: number | null = null,
    ) {
        super();
        this.dueDate = dueDate;
        this.stability = stability;
        this.difficulty = difficulty;
        this.state = state;
        this.elapsedDays = elapsedDays;
        this.scheduledDays = scheduledDays;
        this.reps = reps;
        this.lapses = lapses;
        this.learningSteps = learningSteps;
        this.lastReview = lastReview;

        // Map to base class fields for backward compatibility
        this.interval = Math.round(scheduledDays);
        this.latestEase = Math.round((11 - difficulty) * 30);

        this.delayedBeforeReviewTicks = delayedBeforeReviewTicks;
        if (dueDate && delayedBeforeReviewTicks == null) {
            this.delayedBeforeReviewTicks = globalDateProvider.today.valueOf() - dueDate.valueOf();
        }
    }

    formatCardScheduleForHtmlComment(): string {
        const dateStr: string = this.dueDate
            ? this.formatDueDate()
            : RepItemScheduleInfoFsrs.dummyDueDateForNewCard;
        const lastReviewStr: string = this.lastReview
            ? formatDateYYYYMMDD(this.lastReview)
            : RepItemScheduleInfoFsrs.dummyDueDateForNewCard;
        return `!${dateStr},${this.stability.toFixed(2)},${this.difficulty.toFixed(2)},${this.state},${this.elapsedDays},${this.scheduledDays},${this.reps},${this.lapses},${this.learningSteps},${lastReviewStr}`;
    }

    static getDummyScheduleForNewCard(_settings: SRSettings): RepItemScheduleInfoFsrs {
        return new RepItemScheduleInfoFsrs(null, 0, 0, State.New, 0, 0, 0, 0, 0, null);
    }

    static fromDueDateStr(
        dueDateStr: string,
        stability: number,
        difficulty: number,
        state: State,
        elapsedDays: number,
        scheduledDays: number,
        reps: number,
        lapses: number,
        learningSteps: number,
        lastReviewStr: string,
        delayedBeforeReviewTicks: number | null = null,
    ): RepItemScheduleInfoFsrs {
        const dueDate: Moment = DateUtil.dateStrToMoment(dueDateStr);
        const lastReview: Moment | null =
            lastReviewStr === RepItemScheduleInfoFsrs.dummyDueDateForNewCard
                ? null
                : DateUtil.dateStrToMoment(lastReviewStr);
        return new RepItemScheduleInfoFsrs(
            dueDate,
            stability,
            difficulty,
            state,
            elapsedDays,
            scheduledDays,
            reps,
            lapses,
            learningSteps,
            lastReview,
            delayedBeforeReviewTicks,
        );
    }
}
