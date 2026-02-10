import moment, { Moment } from "moment";
import { Card as FsrsCard, createEmptyCard, FSRS, fsrs, Grade, Rating, State } from "ts-fsrs";

import { ISrsAlgorithm } from "src/algorithms/base/isrs-algorithm";
import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { OsrNoteGraph } from "src/algorithms/osr/osr-note-graph";
import { DueDateHistogram } from "src/due-date-histogram";
import { Note } from "src/note";
import { INoteEaseList, NoteEaseList } from "src/note-ease-list";
import { SRSettings } from "src/settings";
import { globalDateProvider } from "src/utils/dates";

function mapReviewResponseToFsrsRating(response: ReviewResponse): Grade {
    switch (response) {
        case ReviewResponse.Easy:
            return Rating.Easy;
        case ReviewResponse.Good:
            return Rating.Good;
        case ReviewResponse.Hard:
            return Rating.Hard;
        case ReviewResponse.Reset:
            return Rating.Again;
    }
}

export class SrsAlgorithmFsrs implements ISrsAlgorithm {
    private settings: SRSettings;
    private f: FSRS;
    private noteEaseList: INoteEaseList;

    constructor(settings: SRSettings) {
        this.settings = settings;
        this.noteEaseList = new NoteEaseList(settings);
        /* eslint-disable camelcase */
        this.f = fsrs({
            request_retention: settings.fsrsRequestRetention ?? 0.9,
            maximum_interval: settings.maximumInterval,
            w: settings.fsrsWeights?.length > 0 ? settings.fsrsWeights : undefined,
            enable_fuzz: settings.fsrsEnableFuzz ?? true,
        });
        /* eslint-enable camelcase */
    }

    noteOnLoadedNote(path: string, _note: Note, noteEase: number): void {
        if (noteEase) {
            this.noteEaseList.setEaseForPath(path, noteEase);
        }
    }

    noteCalcNewSchedule(
        _notePath: string,
        _osrNoteGraph: OsrNoteGraph,
        response: ReviewResponse,
        _dueDateNoteHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        const emptyCard = createEmptyCard();
        const rating = mapReviewResponseToFsrsRating(response);
        const now = new Date();
        const result = this.f.next(emptyCard, now, rating);
        return this.fsrsCardToScheduleInfo(result.card);
    }

    noteCalcUpdatedSchedule(
        _notePath: string,
        noteSchedule: RepItemScheduleInfo,
        response: ReviewResponse,
        _dueDateNoteHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        const fsrsCard = this.scheduleInfoToFsrsCard(noteSchedule as RepItemScheduleInfoFsrs);
        const rating = mapReviewResponseToFsrsRating(response);
        const now = new Date();
        const result = this.f.next(fsrsCard, now, rating);
        return this.fsrsCardToScheduleInfo(result.card);
    }

    isResetAsReview(): boolean {
        return true;
    }

    cardGetResetSchedule(): RepItemScheduleInfo {
        const emptyCard = createEmptyCard();
        const dueDate: Moment = moment(globalDateProvider.today);
        return new RepItemScheduleInfoFsrs(
            dueDate,
            emptyCard.stability,
            emptyCard.difficulty,
            State.New,
            0,
            0,
            0,
            0,
            0,
            null,
        );
    }

    cardGetNewSchedule(
        response: ReviewResponse,
        _notePath: string,
        _dueDateFlashcardHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        const emptyCard = createEmptyCard();
        const rating = mapReviewResponseToFsrsRating(response);
        const now = new Date();
        const result = this.f.next(emptyCard, now, rating);
        return this.fsrsCardToScheduleInfo(result.card);
    }

    cardCalcUpdatedSchedule(
        response: ReviewResponse,
        schedule: RepItemScheduleInfo,
        _dueDateFlashcardHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        const fsrsCard = this.scheduleInfoToFsrsCard(schedule as RepItemScheduleInfoFsrs);
        const rating = mapReviewResponseToFsrsRating(response);
        const now = new Date();
        const result = this.f.next(fsrsCard, now, rating);
        return this.fsrsCardToScheduleInfo(result.card);
    }

    noteStats(): INoteEaseList {
        return this.noteEaseList;
    }

    private fsrsCardToScheduleInfo(card: FsrsCard): RepItemScheduleInfoFsrs {
        const dueDate: Moment = moment(card.due);
        const lastReview: Moment | null = card.last_review ? moment(card.last_review) : null;

        return new RepItemScheduleInfoFsrs(
            dueDate,
            card.stability,
            card.difficulty,
            card.state,
            card.elapsed_days,
            card.scheduled_days,
            card.reps,
            card.lapses,
            card.learning_steps,
            lastReview,
            0,
        );
    }

    private scheduleInfoToFsrsCard(info: RepItemScheduleInfoFsrs): FsrsCard {
        /* eslint-disable camelcase */
        return {
            due: info.dueDate ? info.dueDate.toDate() : new Date(),
            stability: info.stability,
            difficulty: info.difficulty,
            elapsed_days: info.elapsedDays,
            scheduled_days: info.scheduledDays,
            reps: info.reps,
            lapses: info.lapses,
            state: info.state,
            learning_steps: info.learningSteps,
            last_review: info.lastReview ? info.lastReview.toDate() : undefined,
        };
        /* eslint-enable camelcase */
    }
}
