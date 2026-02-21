import { ISrsAlgorithm } from "src/algorithms/base/isrs-algorithm";
import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { Card } from "src/card";
import { TICKS_PER_DAY } from "src/constants";
import { DataStore } from "src/data-stores/base/data-store";
import { CardListType, Deck } from "src/deck";
import { IDeckTreeIterator } from "src/deck-tree-iterator";
import { DueDateHistogram } from "src/due-date-histogram";
import { addToMnemoIgnoreBlock, MnemoIgnoreEntry } from "src/mnemo-block";
import { Note } from "src/note";
import { Question, QuestionText } from "src/question";
import { IQuestionPostponementList } from "src/question-postponement-list";
import { CardFrontBackUtil } from "src/question-type";
import { SRSettings } from "src/settings";
import { TopicPath } from "src/topic-path";
import { generateBlockId } from "src/utils/block-id";
import { globalDateProvider } from "src/utils/dates";

export interface IFlashcardReviewSequencer {
    get hasCurrentCard(): boolean;
    get currentCard(): Card;
    get currentQuestion(): Question;
    get currentNote(): Note;
    get currentDeck(): Deck;
    get originalDeckTree(): Deck;
    get remainingDeckTree(): Deck;

    setDeckTree(originalDeckTree: Deck, remainingDeckTree: Deck): void;
    setCurrentDeck(topicPath: TopicPath): void;
    setCurrentDeckFilteredByNote(topicPath: TopicPath, noteFilePath: string): void;
    getDeckStats(topicPath: TopicPath): DeckStats;
    getSubDecksWithCardsInQueue(deck: Deck): Deck[];
    skipCurrentCard(): void;
    disableCurrentCard(): Promise<void>;
    determineCardSchedule(response: ReviewResponse, card: Card): RepItemScheduleInfo;
    processReview(response: ReviewResponse): Promise<void>;
    updateCurrentQuestionText(text: string): Promise<void>;
}

/**
 * Represents statistics for a deck and its subdecks.
 *
 * @property {number} totalCount - Total number of cards in this deck and all subdecks.
 * @property {number} dueCount - Number of due cards in this deck and all subdecks.
 * @property {number} newCount - Number of new cards in this deck and all subdecks.
 * @property {number} cardsInQueueCount - Number of cards in the queue of this deck and all subdecks.
 * @property {number} dueCardsInQueueOfThisDeckCount - Number of due cards just in this deck.
 * @property {number} newCardsInQueueOfThisDeckCount - Number of new cards just in this deck.
 * @property {number} cardsInQueueOfThisDeckCount - Total number of cards in queue just in this deck.
 * @property {number} subDecksInQueueOfThisDeckCount - Number of subdecks in the queue just in this deck.
 * @property {number} decksInQueueOfThisDeckCount - Total number of decks in the queue including this deck and its subdecks.
 *
 * @constructor
 * @param {number} totalCount - Initializes the total count of cards.
 * @param {number} dueCount - Initializes the due count of cards.
 * @param {number} newCount - Initializes the new count of cards.
 * @param {number} cardsInQueueCount - Initializes the count of cards in the queue.
 * @param {number} dueCardsInQueueOfThisDeckCount - Initializes the count of due cards just in this deck.
 * @param {number} newCardsInQueueOfThisDeckCount - Initializes the count of new cards just in this deck.
 * @param {number} cardsInQueueOfThisDeckCount - Initializes the count of all cards in the queue just in this deck.
 * @param {number} subDecksInQueueOfThisDeckCount - Initializes the count of subdecks in the queue just in this deck.
 * @param {number} decksInQueueOfThisDeckCount - Initializes the count of all decks in the queue including this deck and its subdecks.
 */
export class DeckStats {
    totalCount: number;
    dueCount: number;
    newCount: number;
    cardsInQueueCount: number;
    dueCardsInQueueOfThisDeckCount: number;
    newCardsInQueueOfThisDeckCount: number;
    cardsInQueueOfThisDeckCount: number;
    subDecksInQueueOfThisDeckCount: number;
    decksInQueueOfThisDeckCount: number;

    constructor(
        totalCount: number,
        dueCount: number,
        newCount: number,
        cardsInQueueCount: number,
        dueCardsInQueueOfThisDeckCount: number,
        newCardsInQueueOfThisDeckCount: number,
        cardsInQueueOfThisDeckCount: number,
        subDecksInQueueOfThisDeckCount: number,
        decksInQueueOfThisDeckCount: number,
    ) {
        this.dueCount = dueCount;
        this.newCount = newCount;
        this.totalCount = totalCount;
        this.cardsInQueueCount = cardsInQueueCount;
        this.dueCardsInQueueOfThisDeckCount = dueCardsInQueueOfThisDeckCount;
        this.newCardsInQueueOfThisDeckCount = newCardsInQueueOfThisDeckCount;
        this.cardsInQueueOfThisDeckCount = cardsInQueueOfThisDeckCount;
        this.subDecksInQueueOfThisDeckCount = subDecksInQueueOfThisDeckCount;
        this.decksInQueueOfThisDeckCount = decksInQueueOfThisDeckCount;
    }
}

export enum FlashcardReviewMode {
    Cram,
    Review,
}

export class FlashcardReviewSequencer implements IFlashcardReviewSequencer {
    // We need the original deck tree so that we can still provide the total cards in each deck
    private _originalDeckTree: Deck;

    // This is set by the caller, and must have the same deck hierarchy as originalDeckTree.
    private _remainingDeckTree: Deck;

    private reviewMode: FlashcardReviewMode;
    private cardSequencer: IDeckTreeIterator;
    private settings: SRSettings;
    private srsAlgorithm: ISrsAlgorithm;
    private questionPostponementList: IQuestionPostponementList;
    private dueDateFlashcardHistogram: DueDateHistogram;

    constructor(
        reviewMode: FlashcardReviewMode,
        cardSequencer: IDeckTreeIterator,
        settings: SRSettings,
        srsAlgorithm: ISrsAlgorithm,
        questionPostponementList: IQuestionPostponementList,
        dueDateFlashcardHistogram: DueDateHistogram,
    ) {
        this.reviewMode = reviewMode;
        this.cardSequencer = cardSequencer;
        this.settings = settings;
        this.srsAlgorithm = srsAlgorithm;
        this.questionPostponementList = questionPostponementList;
        this.dueDateFlashcardHistogram = dueDateFlashcardHistogram;
    }

    get hasCurrentCard(): boolean {
        return this.cardSequencer.currentCard != null;
    }

    get currentCard(): Card {
        return this.cardSequencer.currentCard;
    }

    get currentQuestion(): Question {
        return this.currentCard?.question;
    }

    get currentDeck(): Deck {
        return this.cardSequencer.currentDeck;
    }

    get currentNote(): Note {
        return this.currentQuestion.note;
    }

    // originalDeckTree isn't modified by the review process
    // Only remainingDeckTree
    setDeckTree(originalDeckTree: Deck, remainingDeckTree: Deck): void {
        this.cardSequencer.setBaseDeck(remainingDeckTree);
        this._originalDeckTree = originalDeckTree;
        this._remainingDeckTree = remainingDeckTree;
        this.setCurrentDeck(TopicPath.emptyPath);
    }

    setCurrentDeck(topicPath: TopicPath): void {
        // Restore any cards that were stashed by setCurrentDeckFilteredByNote
        this._restoreStashedCards();
        this.cardSequencer.setIteratorTopicPath(topicPath);
        this.cardSequencer.nextCard();
    }

    setCurrentDeckFilteredByNote(topicPath: TopicPath, noteFilePath: string): void {
        // Restore any previously stashed cards first
        this._restoreStashedCards();

        // Temporarily remove non-matching cards from the remaining deck
        // so the iterator only sees cards from the specified note.
        // The stashed cards are restored when setCurrentDeck is called.
        const remainingDeck = this._remainingDeckTree.getDeck(topicPath);
        const stashedDue: Card[] = [];
        const stashedNew: Card[] = [];

        for (let i = remainingDeck.dueFlashcards.length - 1; i >= 0; i--) {
            if (remainingDeck.dueFlashcards[i].question.note.file.path !== noteFilePath) {
                stashedDue.push(remainingDeck.dueFlashcards[i]);
                remainingDeck.dueFlashcards.splice(i, 1);
            }
        }
        for (let i = remainingDeck.newFlashcards.length - 1; i >= 0; i--) {
            if (remainingDeck.newFlashcards[i].question.note.file.path !== noteFilePath) {
                stashedNew.push(remainingDeck.newFlashcards[i]);
                remainingDeck.newFlashcards.splice(i, 1);
            }
        }

        this._stashedCards = { deck: remainingDeck, dueCards: stashedDue, newCards: stashedNew };
        this.cardSequencer.setIteratorTopicPath(topicPath);
        this.cardSequencer.nextCard();
    }

    private _stashedCards: {
        deck: Deck;
        dueCards: Card[];
        newCards: Card[];
    } | null = null;

    private _restoreStashedCards(): void {
        if (this._stashedCards) {
            this._stashedCards.deck.dueFlashcards.push(...this._stashedCards.dueCards);
            this._stashedCards.deck.newFlashcards.push(...this._stashedCards.newCards);
            this._stashedCards = null;
        }
    }

    get originalDeckTree(): Deck {
        return this._originalDeckTree;
    }

    get remainingDeckTree(): Deck {
        return this._remainingDeckTree;
    }

    getDeckStats(topicPath: TopicPath): DeckStats {
        const totalCount: number = this._originalDeckTree
            .getDeck(topicPath)
            .getDistinctCardCount(CardListType.All, true);
        const remainingDeck: Deck = this._remainingDeckTree.getDeck(topicPath);
        const newCount: number = remainingDeck.getDistinctCardCount(CardListType.NewCard, true);
        const dueCount: number = remainingDeck.getDistinctCardCount(CardListType.DueCard, true);

        // Sry for the long variable names, but I needed all these distinct counts in the UI
        const newCardsInQueueOfThisDeckCount = remainingDeck.getDistinctCardCount(
            CardListType.NewCard,
            false,
        );
        const dueCardsInQueueOfThisDeckCount = remainingDeck.getDistinctCardCount(
            CardListType.DueCard,
            false,
        );
        const cardsInQueueOfThisDeckCount =
            newCardsInQueueOfThisDeckCount + dueCardsInQueueOfThisDeckCount;

        const subDecksInQueueOfThisDeckCount =
            this.getSubDecksWithCardsInQueue(remainingDeck).length;
        const decksInQueueOfThisDeckCount =
            cardsInQueueOfThisDeckCount > 0
                ? subDecksInQueueOfThisDeckCount + 1
                : subDecksInQueueOfThisDeckCount;

        return new DeckStats(
            totalCount,
            dueCount,
            newCount,
            dueCount + newCount,
            dueCardsInQueueOfThisDeckCount,
            newCardsInQueueOfThisDeckCount,
            cardsInQueueOfThisDeckCount,
            subDecksInQueueOfThisDeckCount,
            decksInQueueOfThisDeckCount,
        );
    }

    getSubDecksWithCardsInQueue(deck: Deck): Deck[] {
        let subDecksWithCardsInQueue: Deck[] = [];

        deck.subdecks.forEach((subDeck) => {
            subDecksWithCardsInQueue = subDecksWithCardsInQueue.concat(
                this.getSubDecksWithCardsInQueue(subDeck),
            );

            const newCount: number = subDeck.getDistinctCardCount(CardListType.NewCard, false);
            const dueCount: number = subDeck.getDistinctCardCount(CardListType.DueCard, false);
            if (newCount + dueCount > 0) subDecksWithCardsInQueue.push(subDeck);
        });

        return subDecksWithCardsInQueue;
    }

    skipCurrentCard(): void {
        this.cardSequencer.deleteCurrentQuestionFromAllDecks();
    }

    async disableCurrentCard(): Promise<void> {
        const question = this.currentQuestion;
        const noteFile = question.note.file;
        let noteText = await noteFile.read();

        // Ensure the question has a block ID (generate one if missing)
        let blockId = question.questionText.obsidianBlockId;
        if (!blockId) {
            blockId = generateBlockId(noteText);
            // Write the block ID onto the question line in the file
            const originalText = question.questionText.original;
            const questionLine = question.questionText.actualQuestion;
            // Insert block ID at the end of the first line of the question
            const firstLine = questionLine.split("\n")[0];
            const updatedOriginal = originalText.replace(firstLine, firstLine + " " + blockId);
            noteText = noteText.replace(originalText, updatedOriginal);
            question.questionText.obsidianBlockId = blockId;
        }

        // Add entry to mnemo-ignore block
        const firstLine = question.questionText.actualQuestion.split("\n")[0];
        const entry: MnemoIgnoreEntry = {
            blockId,
            readableText: firstLine,
        };
        noteText = addToMnemoIgnoreBlock(noteText, entry);

        // Write the updated note
        await noteFile.write(noteText);

        // Remove the card from the current review session
        this.cardSequencer.deleteCurrentQuestionFromAllDecks();
    }

    private deleteCurrentCard(): void {
        this.cardSequencer.deleteCurrentCardFromAllDecks();
    }

    async processReview(response: ReviewResponse): Promise<void> {
        switch (this.reviewMode) {
            case FlashcardReviewMode.Review:
                await this.processReviewReviewMode(response);
                break;

            case FlashcardReviewMode.Cram:
                await this.processReviewCramMode(response);
                break;
        }
    }

    async processReviewReviewMode(response: ReviewResponse): Promise<void> {
        const isResetAsReview = this.srsAlgorithm.isResetAsReview();
        if (response != ReviewResponse.Reset || this.currentCard.hasSchedule || isResetAsReview) {
            const oldSchedule = this.currentCard.scheduleInfo;

            // We need to update the schedule if:
            //  (1) the user reviewed with easy/good/hard (either a new or due card),
            //  (2) or reset a due card (SM-2)
            //  (3) or the algorithm treats reset as a review (FSRS "Again")
            // Nothing to do if a user resets a new card in SM-2 mode
            this.currentCard.scheduleInfo = this.determineCardSchedule(response, this.currentCard);

            // Update the source file with the updated schedule
            await DataStore.getInstance().questionWriteSchedule(this.currentQuestion);

            if (oldSchedule) {
                const today: number = globalDateProvider.today.valueOf();
                const nDays: number = Math.ceil(
                    (oldSchedule.dueDateAsUnix - today) / TICKS_PER_DAY,
                );

                this.dueDateFlashcardHistogram.decrement(nDays);
            }
            this.dueDateFlashcardHistogram.increment(this.currentCard.scheduleInfo.interval);
        }

        // Move/delete the card
        if (response == ReviewResponse.Reset) {
            this.cardSequencer.moveCurrentCardToEndOfList();
            this.cardSequencer.nextCard();
        } else {
            if (this.settings.burySiblingCards) {
                await this.burySiblingCards();
                this.cardSequencer.deleteCurrentQuestionFromAllDecks();
            } else {
                this.deleteCurrentCard();
            }
        }
    }

    private async burySiblingCards(): Promise<void> {
        // We check if there are any sibling cards still in the deck,
        // We do this because otherwise we would be adding every reviewed card to the postponement list, even for a
        // question with a single card. That isn't consistent with the 1.10.1 behavior
        const remaining = this.currentDeck.getQuestionCardCount(this.currentQuestion);
        if (remaining > 1) {
            this.questionPostponementList.add(this.currentQuestion);
            await this.questionPostponementList.write();
        }
    }

    async processReviewCramMode(response: ReviewResponse): Promise<void> {
        if (response == ReviewResponse.Easy) this.deleteCurrentCard();
        else {
            this.cardSequencer.moveCurrentCardToEndOfList();
            this.cardSequencer.nextCard();
        }
    }

    determineCardSchedule(response: ReviewResponse, card: Card): RepItemScheduleInfo {
        let result: RepItemScheduleInfo;

        if (response == ReviewResponse.Reset && !this.srsAlgorithm.isResetAsReview()) {
            // SM-2: Resetting the card schedule to a blank state
            result = this.srsAlgorithm.cardGetResetSchedule();
        } else {
            // Normal review (Easy/Good/Hard), or FSRS "Again" which is treated as a review
            if (card.hasSchedule) {
                result = this.srsAlgorithm.cardCalcUpdatedSchedule(
                    response,
                    card.scheduleInfo,
                    this.dueDateFlashcardHistogram,
                );
            } else {
                const currentNote: Note = card.question.note;
                result = this.srsAlgorithm.cardGetNewSchedule(
                    response,
                    currentNote.filePath,
                    this.dueDateFlashcardHistogram,
                );
            }
        }
        return result;
    }

    async updateCurrentQuestionText(text: string): Promise<void> {
        const q: QuestionText = this.currentQuestion.questionText;

        q.actualQuestion = text;

        // Re-derive card front/back from the updated question text
        const cardFrontBackList = CardFrontBackUtil.expand(
            this.currentQuestion.questionType,
            text,
            this.settings,
        );
        const cards = this.currentQuestion.cards;
        for (let i = 0; i < cards.length && i < cardFrontBackList.length; i++) {
            cards[i].front = cardFrontBackList[i].front;
            cards[i].back = cardFrontBackList[i].back;
        }

        await DataStore.getInstance().questionWrite(this.currentQuestion);
    }
}
