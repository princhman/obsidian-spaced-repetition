import moment, { Moment } from "moment";
import { State } from "ts-fsrs";

import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { RepItemScheduleInfoFsrs } from "src/algorithms/fsrs/rep-item-schedule-info-fsrs";
import { Card } from "src/card";
import { ALLOWED_DATE_FORMATS, YAML_FRONT_MATTER_REGEX } from "src/constants";
import { IDataStoreAlgorithm } from "src/data-store-algorithm/idata-store-algorithm";
import { ISRFile } from "src/file";
import { MnemoCardData, serializeMnemoCodeBlock } from "src/mnemo-block";
import { CardType, Question } from "src/question";
import { SRSettings } from "src/settings";
import { formatDateYYYYMMDD } from "src/utils/dates";

const FSRS_SCHEDULING_INFO_REGEX =
    /^---\r?\n((?:.*\r?\n)*)sr-due: (.+)\r?\nsr-algorithm: fsrs\r?\nsr-stability: ([\d.]+)\r?\nsr-difficulty: ([\d.]+)\r?\nsr-state: (\d+)\r?\nsr-reps: (\d+)\r?\nsr-lapses: (\d+)\r?\nsr-learning-steps: (\d+)\r?\nsr-last-review: (.+)\r?\n((?:.*\r?\n)?)---/;

export class DataStoreInNoteAlgorithmFsrs implements IDataStoreAlgorithm {
    private settings: SRSettings;

    constructor(settings: SRSettings) {
        this.settings = settings;
    }

    async noteGetSchedule(note: ISRFile): Promise<RepItemScheduleInfo> {
        const frontmatter: Map<string, string> = await note.getFrontmatter();

        if (
            frontmatter &&
            frontmatter.has("sr-due") &&
            frontmatter.get("sr-algorithm") === "fsrs" &&
            frontmatter.has("sr-stability")
        ) {
            const dueDate: Moment = moment(frontmatter.get("sr-due"), ALLOWED_DATE_FORMATS);
            const stability = parseFloat(frontmatter.get("sr-stability"));
            const difficulty = parseFloat(frontmatter.get("sr-difficulty"));
            const state = parseInt(frontmatter.get("sr-state")) as State;
            const reps = parseInt(frontmatter.get("sr-reps") || "0");
            const lapses = parseInt(frontmatter.get("sr-lapses") || "0");
            const learningSteps = parseInt(frontmatter.get("sr-learning-steps") || "0");
            const lastReviewStr = frontmatter.get("sr-last-review");
            const lastReview: Moment | null = lastReviewStr
                ? moment(lastReviewStr, ALLOWED_DATE_FORMATS)
                : null;

            return new RepItemScheduleInfoFsrs(
                dueDate,
                stability,
                difficulty,
                state,
                0,
                0,
                reps,
                lapses,
                learningSteps,
                lastReview,
            );
        }

        // Fallback: check for legacy SM-2 format and return null (caller handles migration)
        if (
            frontmatter &&
            frontmatter.has("sr-due") &&
            frontmatter.has("sr-interval") &&
            frontmatter.has("sr-ease")
        ) {
            // Legacy SM-2 data found — return null so the caller can trigger migration
            return null;
        }

        return null;
    }

    async noteSetSchedule(note: ISRFile, repItemScheduleInfo: RepItemScheduleInfo): Promise<void> {
        let fileText: string = await note.read();
        const schedInfo: RepItemScheduleInfoFsrs = repItemScheduleInfo as RepItemScheduleInfoFsrs;

        const dueString: string = formatDateYYYYMMDD(schedInfo.dueDate);
        const lastReviewString: string = schedInfo.lastReview
            ? formatDateYYYYMMDD(schedInfo.lastReview)
            : "";

        const fsrsYaml =
            `sr-due: ${dueString}\n` +
            "sr-algorithm: fsrs\n" +
            `sr-stability: ${schedInfo.stability.toFixed(2)}\n` +
            `sr-difficulty: ${schedInfo.difficulty.toFixed(2)}\n` +
            `sr-state: ${schedInfo.state}\n` +
            `sr-reps: ${schedInfo.reps}\n` +
            `sr-lapses: ${schedInfo.lapses}\n` +
            `sr-learning-steps: ${schedInfo.learningSteps}\n` +
            `sr-last-review: ${lastReviewString}\n`;

        if (FSRS_SCHEDULING_INFO_REGEX.test(fileText)) {
            const match = FSRS_SCHEDULING_INFO_REGEX.exec(fileText);
            fileText = fileText.replace(
                FSRS_SCHEDULING_INFO_REGEX,
                `---\n${match[1]}${fsrsYaml}${match[10]}---`,
            );
        } else if (YAML_FRONT_MATTER_REGEX.test(fileText)) {
            const existingYaml = YAML_FRONT_MATTER_REGEX.exec(fileText);
            fileText = fileText.replace(
                YAML_FRONT_MATTER_REGEX,
                `---\n${existingYaml[1]}${fsrsYaml}---`,
            );
        } else {
            fileText = `---\n${fsrsYaml}---\n\n${fileText}`;
        }

        await note.write(fileText);
    }

    questionFormatSchedule(question: Question): string {
        const cardDataList: MnemoCardData[] = question.cards.map((card: Card) => {
            if (card.hasSchedule) {
                const schedule = card.scheduleInfo as RepItemScheduleInfoFsrs;
                return {
                    isNew: false,
                    due: schedule.dueDate
                        ? formatDateYYYYMMDD(schedule.dueDate)
                        : RepItemScheduleInfoFsrs.dummyDueDateForNewCard,
                    s: schedule.stability,
                    d: schedule.difficulty,
                    state: schedule.state as number,
                    reps: schedule.reps,
                    lapses: schedule.lapses,
                    steps: schedule.learningSteps,
                    last: schedule.lastReview
                        ? formatDateYYYYMMDD(schedule.lastReview)
                        : RepItemScheduleInfoFsrs.dummyDueDateForNewCard,
                };
            } else {
                return { isNew: true };
            }
        });
        return serializeMnemoCodeBlock({
            type: question.parsedQuestionInfo
                ? this.cardTypeToMnemoType(question.questionType)
                : undefined,
            cards: cardDataList,
        });
    }

    private cardTypeToMnemoType(cardType: CardType): string | undefined {
        switch (cardType) {
            case CardType.SingleLineBasic:
            case CardType.MultiLineBasic:
                return "basic";
            case CardType.SingleLineReversed:
            case CardType.MultiLineReversed:
                return "reversed";
            case CardType.Cloze:
                return "cloze";
            case CardType.ImageOcclusion:
                return "occlusion";
            default:
                return undefined;
        }
    }
}
