# 2026 Year in Review

The edition is deliberately fixed to 2026. No schema migration, stored snapshot, automatic yearly rollover, or automatic expiry is involved.

## Enable and retire

1. In the connected Vercel project's Flags dashboard, create the boolean flag `year-in-review`, default **false**. The existing `/.well-known/vercel/flags` discovery endpoint includes it. Use the existing Flags connection/environment configuration; no second provider is needed.
2. Target your signed-in user ID first. Only that ID is sent to the provider. Verify `/year-in-review` and prepare/download a PNG, including with a Private profile. Verify another account gets no entry point or review access.
3. Enable for the desired audience for December 1, 2026. The Home invitation runs only during December 2026 UTC. Stats and the direct review destination work whenever the flag is enabled, including targeted testing before December.
4. **Manually disable at the start of January 2027.** Confirm Home and Stats omit links, the direct destination is unavailable, and both GET and HEAD on `/year-in-review/image` return 404. Failures or missing flags default off. Previously open pages and downloaded PNGs cannot be recalled.

Disabling never modifies Journal entries, Playthroughs, Ratings, or Profile visibility. Leave the isolated seasonal implementation dormant while deciding whether to adapt it next year. To remove it later, remove the review routes, seasonal entry points, clock, export font/assets, flag, stories, tests and harness aliases together. Preserve shared components and Journal records. Remove the flag from discovery only with that cleanup. Do not automatically switch the edition to 2027.

## Preview and download

The player chooses whether to include their username (off by default), then prepares an image. The browser displays the actual PNG blob. Download rechecks authentication and the flag with HEAD before saving those same bytes, so an already open page cannot start another authorized download after retirement. Username changes clear the old preview. Refresh preview re-reads current records at the page's original cutoff; reopen the review to advance the cutoff. This is not a frozen annual history.

PNG generation uses the installed `next/og` server renderer and a bundled OFL-licensed Geist font. Nothing is uploaded or publicly hosted. Cover downloads use the fixed IGDB CDN with a four-second timeout and missing-art fallback. Images are bounded at 1080 × 1350, with at most twelve covers. The route emits private/no-store headers and noindex; it accepts no owner identifier. Export code and its font remain server-only and are requested only after Preview PNG.

Browsers normally save through the download action. If a mobile browser opens the image, use its Save Image or Share action. Real iOS/Android save behavior must be checked on hardware before broad enablement.
