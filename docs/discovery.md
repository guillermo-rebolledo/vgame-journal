# Home discovery

## Backloggd comparison

Checked on November 3, 2026. Backloggd's [Recently trending row](https://backloggd.com/)
and [Trending sort](https://backloggd.com/games/lib/trending/) mix upcoming games,
new releases, and older games. Its [changelog](https://backloggd.com/changelog/)
also distinguishes Trending from Popularity (most played). The pages inspected do
not publish an exact game-trending formula. Sharing IGDB metadata does not give us
Backloggd's community activity or rankings.

Previously, our Recently released row required a first release in the past 90
days, a user score of at least 75 from 10 ratings or a critic score of at least 75
from 3 reviews, and positive IGDB Visits. It reserved two of four slots for indies.
That excluded launches waiting for reviews, poorly reviewed but widely discussed
games, and major releases displaced by much less active indies. Among eligible
games, release age made no difference. Popular right now used Visits without any
release adjustment.

## Selection

Both rows still require official standalone games, a valid title and slug, a cover,
and positive finite IGDB Visits. DLC, remasters, ports, editions, fan games, and
adult games remain excluded. Four games are selected per row, with canonical IDs
breaking score ties. There is no review gate or genre quota.

**Recently trending** (the existing `popular` snapshot) includes games of any
release date, including unknown dates and upcoming releases. Score is:

```text
distance = abs(days from first release)
boost = 1 + max(0, 1 - distance / 30)
score = Visits * boost
```

This gives up to 2x weight on release day, 1.5x at 15 days before or after release,
and ordinary Visits weight beyond 30 days. A launch must still have meaningful
activity to beat an older hit. Candidates are paged until even a remaining game's
maximum 2x boost cannot beat the cutoff; taking only the first four unadjusted
ranks would miss launches.

**Recently released** retains the inclusive past-90-days window and excludes
future or unknown first-release dates. Score is `Visits / (1 + ageDays / 30)`.
This gradually makes room for new launches while keeping activity central. A
later port or platform release does not reset an old game's age.

## Freshness and operation

[IGDB PopScore](https://api-docs.igdb.com/#popscore) updates every 24 hours. Our
existing Vercel cron runs daily at 06:00 UTC through
`/api/cron/refresh-release-dates`, using `CRON_SECRET`. Home reads durable database
snapshots without calling IGDB. Refreshes replace selections and their successful
timestamps independently; failures preserve the last successful snapshot.

Deploying the code does not rerank existing snapshots. Invoke the authenticated
cron after deployment, or wait for its next scheduled run. No schema migration is
needed. Check the endpoint's `discovery` result for `failed` values and compare the
visible Updated dates with the last scheduled run when investigating stale picks.
The endpoint currently returns HTTP 200 even for a reported shelf failure.

Visits is an external attention proxy, not measured growth in our own community
or a copy of Backloggd's algorithm. No production cron history or live authenticated
IGDB sample was available in this checkout. A future improvement, if this proxy
still feels too stable, is to retain daily activity history and rank momentum,
then evaluate additional Playing/Want to Play signals. Random rotation would
change the tiles without demonstrating actual trends.
