import { reviewFixture } from "./flags";
export const yearInReviewNow = async () =>
  new Date((await reviewFixture()).now);
