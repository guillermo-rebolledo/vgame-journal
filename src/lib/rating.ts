import type { Status } from "@/lib/library";

/** Rating points: whole half stars, 1 (half a star) to 10 (5 stars). */
export type RatingPoints = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const RATING_POINTS: readonly RatingPoints[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];

export const isRatingPoints = (points: unknown): points is RatingPoints =>
  RATING_POINTS.includes(points as RatingPoints);

/** A Rating can only be given (not just kept) in these Statuses. */
export const RATEABLE_STATUSES: readonly Status[] = ["played", "playing"];

export const canRate = (status: Status) => RATEABLE_STATUSES.includes(status);

/** 7 → 3.5. */
export const toStars = (points: number) => points / 2;

/** An average in stars as the nearest half star, for drawing it. */
export const averagePoints = (average: number) => Math.round(average * 2);

/** "0.5 stars", "1 star", "3.5 stars". */
export const starsLabel = (points: number) =>
  `${toStars(points)} ${points === 2 ? "star" : "stars"}`;

/** A Ratings distribution (`distribution[points - 1]`) as labelled rows, highest Rating first. */
export const ratingRows = (distribution: number[]) =>
  distribution
    .map((value, i) => ({ points: i + 1, label: starsLabel(i + 1), value }))
    .reverse();

export const RATING_SAVE_FAILED =
  "Couldn’t save your Rating. Check your connection and try again.";
