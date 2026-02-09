// eslint-disable-next-line @typescript-eslint/no-unused-vars
import h from "vhtml";

import { OsrCore } from "src/core";
import { CardListType } from "src/deck";
import { ReviewHistory } from "src/plugin-data";

export class StatisticsView {
    private containerEl: HTMLElement;
    private osrCore: OsrCore;
    private reviewHistory: ReviewHistory;

    constructor(containerEl: HTMLElement, osrCore: OsrCore, reviewHistory?: ReviewHistory) {
        this.containerEl = containerEl;
        this.osrCore = osrCore;
        this.reviewHistory = reviewHistory || {};
    }

    render(): void {
        this.containerEl.empty();
        this.containerEl.addClass("sr-statistics");

        // Summary cards row
        this.renderSummaryCards();

        // Heatmap
        this.renderHeatmap();
    }

    private renderSummaryCards(): void {
        const cardStats: Stats = this.osrCore.cardStats;
        const totalCards = this.osrCore.reviewableDeckTree.getDistinctCardCount(
            CardListType.All,
            true,
        );

        // Calculate streak
        const { currentStreak, longestStreak } = this.calculateStreaks();

        // Total reviews from history
        const totalReviews = Object.values(this.reviewHistory).reduce((a, b) => a + b, 0);

        // Reviews today
        const today = window.moment().format("YYYY-MM-DD");
        const reviewsToday = this.reviewHistory[today] || 0;

        const summaryEl = this.containerEl.createDiv("sr-stats-summary");

        this.createSummaryCard(summaryEl, reviewsToday.toString(), "Today");
        this.createSummaryCard(summaryEl, totalReviews.toString(), "Total Reviews");
        this.createSummaryCard(summaryEl, `${currentStreak}d`, "Current Streak");
        this.createSummaryCard(summaryEl, `${longestStreak}d`, "Best Streak");
        this.createSummaryCard(summaryEl, totalCards.toString(), "Total Cards");
        this.createSummaryCard(
            summaryEl,
            `${cardStats.newCount} / ${cardStats.youngCount} / ${cardStats.matureCount}`,
            "New / Young / Mature",
        );
    }

    private createSummaryCard(parent: HTMLElement, value: string, label: string): void {
        const card = parent.createDiv("sr-stats-card");
        const valueEl = card.createDiv("sr-stats-card-value");
        valueEl.setText(value);
        const labelEl = card.createDiv("sr-stats-card-label");
        labelEl.setText(label);
    }

    private renderHeatmap(): void {
        const heatmapContainer = this.containerEl.createDiv("sr-heatmap-container");

        const titleEl = heatmapContainer.createDiv("sr-heatmap-title");
        titleEl.setText("Review Activity");

        const heatmapWrapper = heatmapContainer.createDiv("sr-heatmap-wrapper");

        // Day labels column
        const dayLabels = heatmapWrapper.createDiv("sr-heatmap-day-labels");
        const dayNames = ["", "Mon", "", "Wed", "", "Fri", ""];
        for (const day of dayNames) {
            const label = dayLabels.createDiv("sr-heatmap-day-label");
            label.setText(day);
        }

        // Scrollable heatmap grid area
        const scrollContainer = heatmapWrapper.createDiv("sr-heatmap-scroll");
        const gridArea = scrollContainer.createDiv("sr-heatmap-grid-area");

        // Month labels
        const monthLabels = gridArea.createDiv("sr-heatmap-month-labels");

        // The grid
        const grid = gridArea.createDiv("sr-heatmap-grid");

        // Calculate date range: last 365 days
        const today = window.moment();
        const startDate = window.moment().subtract(364, "days");

        // Adjust start to a Sunday for clean columns
        while (startDate.day() !== 0) {
            startDate.subtract(1, "day");
        }

        // Find max review count for color scaling
        const maxReviews = Math.max(1, ...Object.values(this.reviewHistory));

        // Track months for labels
        let currentMonth = -1;
        let weekIndex = 0;

        const cursor = startDate.clone();
        while (cursor.isSameOrBefore(today)) {
            // Check if we're starting a new week (Sunday)
            if (cursor.day() === 0) {
                // Check for new month
                if (cursor.month() !== currentMonth) {
                    currentMonth = cursor.month();
                    const monthLabel = monthLabels.createDiv("sr-heatmap-month-label");
                    monthLabel.setText(cursor.format("MMM"));
                    monthLabel.style.gridColumnStart = (weekIndex + 1).toString();
                }
                weekIndex++;
            }

            const dateStr = cursor.format("YYYY-MM-DD");
            const count = this.reviewHistory[dateStr] || 0;
            const level = this.getHeatmapLevel(count, maxReviews);

            const cell = grid.createDiv("sr-heatmap-cell");
            cell.addClass(`sr-heatmap-level-${level}`);
            cell.setAttribute(
                "aria-label",
                `${count} review${count !== 1 ? "s" : ""} on ${cursor.format("MMM D, YYYY")}`,
            );
            cell.setAttribute("aria-label-position", "top");

            cursor.add(1, "day");
        }

        // Legend
        const legendContainer = heatmapContainer.createDiv("sr-heatmap-legend");
        const lessLabel = legendContainer.createDiv("sr-heatmap-legend-label");
        lessLabel.setText("Less");
        for (let i = 0; i <= 4; i++) {
            const cell = legendContainer.createDiv("sr-heatmap-cell");
            cell.addClass(`sr-heatmap-level-${i}`);
        }
        const moreLabel = legendContainer.createDiv("sr-heatmap-legend-label");
        moreLabel.setText("More");

        // Scroll to the right (most recent) after render
        setTimeout(() => {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
        }, 0);
    }

    private getHeatmapLevel(count: number, maxReviews: number): number {
        if (count === 0) return 0;
        if (maxReviews <= 4) return count; // When max is small, direct mapping
        const ratio = count / maxReviews;
        if (ratio <= 0.25) return 1;
        if (ratio <= 0.5) return 2;
        if (ratio <= 0.75) return 3;
        return 4;
    }

    private calculateStreaks(): { currentStreak: number; longestStreak: number } {
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = window.moment();
        const cursor = today.clone();

        // Check if today has reviews; if not, start from yesterday
        const todayStr = cursor.format("YYYY-MM-DD");
        if (!this.reviewHistory[todayStr] || this.reviewHistory[todayStr] === 0) {
            cursor.subtract(1, "day");
        }

        // Count current streak backwards
        while (true) {
            const dateStr = cursor.format("YYYY-MM-DD");
            if (this.reviewHistory[dateStr] && this.reviewHistory[dateStr] > 0) {
                currentStreak++;
                cursor.subtract(1, "day");
            } else {
                break;
            }
        }

        // Calculate longest streak with gap detection
        const dates = Object.keys(this.reviewHistory)
            .filter((d) => this.reviewHistory[d] > 0)
            .sort();

        if (dates.length > 0) {
            let prevDate = window.moment(dates[0]);
            tempStreak = 1;
            longestStreak = 1;

            for (let i = 1; i < dates.length; i++) {
                const currDate = window.moment(dates[i]);
                const diff = currDate.diff(prevDate, "days");
                if (diff === 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
                longestStreak = Math.max(longestStreak, tempStreak);
                prevDate = currDate;
            }
        }

        return { currentStreak, longestStreak };
    }

    destroy(): void {
        // No chart instances to destroy anymore
    }
}
