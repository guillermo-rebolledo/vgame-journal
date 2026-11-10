import { coverUrl as productionCoverUrl } from "../../src/lib/game-source";

export * from "../../src/lib/game-source";

/** Only the isolated browser harness can supply a corrupt CDN image. */
export const coverUrl: typeof productionCoverUrl = (imageId, size) =>
  imageId === "review_broken"
    ? `${process.env.E2E_SUPPORT_URL}/broken-cover`
    : productionCoverUrl(imageId, size);
