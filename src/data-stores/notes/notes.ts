import { Moment } from "moment";
import { App } from "obsidian";
import { State } from "ts-fsrs";

import { Algorithm } from "src/algorithms/base/isrs-algorithm";
import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { migrateOsrToFsrs } from "src/algorithms/fsrs/migration";
import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { RepItemScheduleInfoOsr } from "src/algorithms/osr/rep-item-schedule-info-osr";
import {
    LEGACY_SCHEDULING_EXTRACTOR,
    MULTI_SCHEDULING_EXTRACTOR,
    MULTI_SCHEDULING_EXTRACTOR_FSRS,
} from "src/constants";
import { IDataStore } from "src/data-stores/base/data-store";
import { RepItemStorageInfo } from "src/data-stores/base/rep-item-storage-info";
import { Question } from "src/question";
import { SRSettings } from "src/settings";
import { DateUtil, formatDateYYYYMMDD, globalDateProvider } from "src/utils/dates";

export class StoreInNotes implements IDataStore {
    private settings: SRSettings;
    app: App;

    constructor(settings: SRSettings) {
        this.settings = settings;
    }

    questionCreateSchedule(
        originalQuestionText: string,
        _: RepItemStorageInfo,
    ): RepItemScheduleInfo[] {
        const isFsrs = this.settings.algorithm === Algorithm.FSRS;

        // Try FSRS format first if FSRS is active
        if (isFsrs) {
            const fsrsScheduling: RegExpMatchArray[] = [
                ...originalQuestionText.matchAll(MULTI_SCHEDULING_EXTRACTOR_FSRS),
            ];
            if (fsrsScheduling.length > 0) {
                return this.parseFsrsScheduling(fsrsScheduling);
            }
        }

        // Try SM-2 format
        let scheduling: RegExpMatchArray[] = [
            ...originalQuestionText.matchAll(MULTI_SCHEDULING_EXTRACTOR),
        ];
        if (scheduling.length === 0)
            scheduling = [...originalQuestionText.matchAll(LEGACY_SCHEDULING_EXTRACTOR)];

        if (scheduling.length === 0) {
            return [];
        }

        const osrResults = this.parseOsrScheduling(scheduling);

        // If FSRS is active but we found SM-2 data, migrate it
        if (isFsrs) {
            return osrResults.map((info) => {
                if (info == null) return null;
                return migrateOsrToFsrs(info as RepItemScheduleInfoOsr);
            });
        }

        return osrResults;
    }

    private parseOsrScheduling(scheduling: RegExpMatchArray[]): RepItemScheduleInfo[] {
        const result: RepItemScheduleInfo[] = [];
        for (let i = 0; i < scheduling.length; i++) {
            const match: RegExpMatchArray = scheduling[i];
            const dueDateStr = match[1];
            const interval = parseInt(match[2]);
            const ease = parseInt(match[3]);
            const dueDate: Moment = DateUtil.dateStrToMoment(dueDateStr);
            let info: RepItemScheduleInfo;
            if (
                dueDate == null ||
                formatDateYYYYMMDD(dueDate) == RepItemScheduleInfoOsr.dummyDueDateForNewCard
            ) {
                info = null;
            } else {
                const delayBeforeReviewTicks: number =
                    dueDate.valueOf() - globalDateProvider.today.valueOf();

                info = new RepItemScheduleInfoOsr(dueDate, interval, ease, delayBeforeReviewTicks);
            }
            result.push(info);
        }
        return result;
    }

    private parseFsrsScheduling(scheduling: RegExpMatchArray[]): RepItemScheduleInfo[] {
        const result: RepItemScheduleInfo[] = [];
        for (let i = 0; i < scheduling.length; i++) {
            const match: RegExpMatchArray = scheduling[i];
            const dueDateStr = match[1];
            const stability = parseFloat(match[2]);
            const difficulty = parseFloat(match[3]);
            const state = parseInt(match[4]) as State;
            const elapsedDays = parseInt(match[5]);
            const scheduledDays = parseInt(match[6]);
            const reps = parseInt(match[7]);
            const lapses = parseInt(match[8]);
            const learningSteps = parseInt(match[9]);
            const lastReviewStr = match[10];

            const dueDate: Moment = DateUtil.dateStrToMoment(dueDateStr);
            let info: RepItemScheduleInfo;
            if (
                dueDate == null ||
                formatDateYYYYMMDD(dueDate) == RepItemScheduleInfoFsrs.dummyDueDateForNewCard
            ) {
                info = null;
            } else {
                const delayBeforeReviewTicks: number =
                    dueDate.valueOf() - globalDateProvider.today.valueOf();

                info = RepItemScheduleInfoFsrs.fromDueDateStr(
                    dueDateStr,
                    stability,
                    difficulty,
                    state,
                    elapsedDays,
                    scheduledDays,
                    reps,
                    lapses,
                    learningSteps,
                    lastReviewStr,
                    delayBeforeReviewTicks,
                );
            }
            result.push(info);
        }
        return result;
    }

    questionRemoveScheduleInfo(questionText: string): string {
        return questionText.replace(/<!--SR(?:-FSRS)?:.+-->/gm, "");
    }

    async questionWriteSchedule(question: Question): Promise<void> {
        await this.questionWrite(question);
    }

    async questionWrite(question: Question): Promise<void> {
        const fileText: string = await question.note.file.read();

        const newText: string = question.updateQuestionWithinNoteText(fileText, this.settings);
        await question.note.file.write(newText);
        question.hasChanged = false;
    }
}
