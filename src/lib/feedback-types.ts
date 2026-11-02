// Shared with the browser: no database or email dependencies.
export const FEEDBACK_TYPES = ["idea", "bug", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export function isFeedbackType(value: unknown): value is FeedbackType {
  return FEEDBACK_TYPES.some((type) => type === value);
}
