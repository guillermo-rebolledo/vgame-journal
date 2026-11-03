# Backloggd social features and custom lists

Researched November 3, 2026. This note distinguishes first-party descriptions and indexed public pages from recommendations for Shelve Games.

## Findings

**Lists connect personal organization with public identity.** Backloggd presents game tracking, reviews, friend activity, and custom lists as connected experiences. Its homepage describes progress tracking, optional rankings, and public/private lists; it also says friends' games, reviews, and lists appear in the home feed. The homepage has a popular-lists section with titles, creators, and game counts. [Backloggd homepage](https://backloggd.com/)

**Lists have their own shareable pages.** Indexed first-party list pages show creator attribution, title, description, game count, update time, game covers, a Share control, and optional numbered rankings. One example exposes a grid display, “User Order” sorting, likes, and comments. These are public-page observations, not confirmation of the editor's behavior. [Ranked-list example](https://backloggd.com/u/KibaByte/list/1983-ranked/), [list with description and discussion](https://backloggd.com/u/GuruminGal/list/vn-ranked/)

**A creator's profile is a discovery surface.** The indexed Lists page for an example profile exposes list titles and game counts, sorting by recent updates, creation, likes, or name, plus ranked/unranked filters and folders. Global search offers Games, Users, and Lists categories. These examples establish navigation patterns; they do not establish that every current account uses the same layout. [Profile lists](https://backloggd.com/u/demo/lists/), [list search](https://backloggd.com/search/lists/)

**Visibility has evolved beyond two choices.** Backloggd's original custom-list release described ordered lists, different views, rankings, and public/private visibility. In April 2026 it added Personal (public with narrower discovery) and an Unlisted option whose exact official description is: “Unlisted, list is hidden but accessible to people you follow via a direct url”. This unusual follow-direction rule is quoted as documentation, not verified enforcement. [Original release](https://backloggd.com/changelog/1_1_0), [v1.17.0](https://backloggd.com/changelog/1_17_0)

**Engagement is layered onto lists.** Official release notes describe list likes as a way to revisit saved content, list comments with audience controls, and a first-publication timestamp used for activity. Another release introduced short sharing links for profiles, reviews, and lists. These are described platform capabilities, not actions performed during this research. [List engagement release notes](https://backloggd.com/changelog/1_7_0), [short-link release](https://backloggd.com/changelog/1_13_3)

**Social interaction brings audience and moderation rules.** The FAQ describes follows feeding activity and friend-specific views; comment mentions can notify recipients. Blocking affects follows, likes, comments, mentions, and content visibility. Reports receive manual moderation. These features explain why adding a full social network is substantially broader than creating shareable lists. [Official FAQ](https://backloggd.com/about/)

**Privacy must cover secondary surfaces.** Backloggd's February and April 2024 release notes both record fixes for private lists appearing on likes pages. The April release also describes list reporting/removal. This is historical evidence of cross-surface leakage, not a claim of a current vulnerability. [v1.11.0](https://backloggd.com/changelog/1_11_0), [v1.12.0](https://backloggd.com/changelog/1_12_0)

## Recommended first slice for Shelve Games

These are proposed product choices, not claims about Backloggd:

- Treat a custom list as an owned collection of Catalog games, independent of Journal statuses, Wishlist, and Playthroughs. Adding a game should not assert that the creator owns or has played it.
- Start with exactly Public and Private. Default new lists to Private, make publishing deliberate, and explain that Public means anyone can view the page without signing in. Defer Personal, Unlisted, and follower-based audiences.
- Give each list a durable identity and URL, a creator, title, optional description, ordered entries, visibility, and creation/update times. Keep links working when the title changes.
- Let creators create, rename, describe, add/remove games, reorder, change visibility, and delete lists. Reuse game search and existing game presentations. Empty lists should remain valid.
- Expose public lists through existing public profiles and direct links. Keep a signed-in owner area for all their lists. No global discovery feed is necessary for this first release.
- Centralize audience checks on server reads and owner checks on writes. Apply them to list pages, profile summaries, counts, metadata, share previews, pagination, and any future discovery or engagement surfaces. A private list must remain inaccessible even when someone knows its URL.
- Avoid persistent public caches of revocable list content. A public-to-private transition must stop new anonymous/non-owner reads; externally saved screenshots or third-party previews cannot be recalled.
- Build no follows, feed, likes, comments, notifications, ranking algorithm, folders, collaborative editing, or moderation platform in this slice. Stable list identities and explicit audience rules provide useful extension points without speculative social infrastructure.

## Research limits

No Backloggd account was created and no content was changed. Signed-in creation/editing and private-list enforcement were not tested. Some direct pages returned bot protection or a 404; first-party indexed text was used where available and may lag the live site. A separate T3 browser tab opened a public list, but both snapshot attempts returned `Preview automation snapshot timed out after 15000ms.` Consequently this note is not a visual or authenticated UX audit. Backloggd's schema, internal API, and authorization implementation are unknown.
