import { DEFAULT_SETTINGS, SRSettings } from "src/settings";

// Maps date string (YYYY-MM-DD) to number of reviews on that day
export type ReviewHistory = Record<string, number>;

export interface PluginData {
    settings: SRSettings;
    buryDate: string;
    // hashes of card texts
    // should work as long as user doesn't modify card's text
    // which covers most of the cases
    buryList: string[];
    historyDeck: string | null;
    reviewHistory: ReviewHistory;
    // Maps deck topic path (e.g. "UNI/Term 2/TOC") to collapsed state (true = collapsed)
    deckCollapseState: Record<string, boolean>;
}

export const DEFAULT_DATA: PluginData = {
    settings: DEFAULT_SETTINGS,
    buryDate: "",
    buryList: [],
    historyDeck: null,
    reviewHistory: {},
    deckCollapseState: {},
};
