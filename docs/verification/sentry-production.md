# Sentry production verification — November 12, 2026

The owner authorized technical verification during the trial, including production
deployment and fixed, protected synthetic errors. Developer/$0 availability remains
unverified until the trial ends on November 26. No billing changes were made.

## Verified production behavior

Production release: `2fc9e69dd3b4df437b24f68faee3927dbcec6148` (#175).
All seven origin groups below have readable source context and no source-map
processing errors. Counts are from the first acceptance run, before additional
server-render diagnostics. Synthetic messages are replaced with the fixed label
`Unexpected application failure`.

| Trigger | Accepted events | Issue |
| --- | ---: | --- |
| Browser handler | 1 | [SHELVE-GAMES-8](https://memoji-inc-9m.sentry.io/issues/7845783858/) |
| Server action | 1 | [SHELVE-GAMES-9](https://memoji-inc-9m.sentry.io/issues/7845783864/) |
| Browser render | 1 | [SHELVE-GAMES-A](https://memoji-inc-9m.sentry.io/issues/7845783865/) |
| Two independent identical errors | 2 | [SHELVE-GAMES-B](https://memoji-inc-9m.sentry.io/issues/7845783913/) |
| Server route | 1 | [SHELVE-GAMES-C](https://memoji-inc-9m.sentry.io/issues/7845783928/) |
| Server render | 1 | [SHELVE-GAMES-D](https://memoji-inc-9m.sentry.io/issues/7845783933/) |
| Same caught Error reported twice | 1 | [SHELVE-GAMES-E](https://memoji-inc-9m.sentry.io/issues/7845783963/) |

The caught route preserved its successful fallback. The action preserved its safe
fallback; browser/server render failures showed the existing recovery screen.
React Compiler can expose transformed function names and line numbers, but the
source context identifies the throwing application code.

Browser ingest used only one error item per envelope, the approved US ingest host,
the production release, fixed labels, bounded tags and sanitized code locations.
The captured requests contained no authorization, cookies, referrer, capability,
request body context, arbitrary exception text, or other product envelope types.
Sampled public compiled chunks had no sourceMappingURL references; corresponding
public `.js.map` requests returned 403, not source content.

The enabled owner workflow fired, and the owner confirmed receipt of the actual
production issue email separately from the earlier test email.

## Final fixes and cleanup

Production React 19.3 forwards server-render failures as minified error 441.
Filtering only its expanded message produced one extra, empty browser report.
The final filter matches both exact framework messages, preserves other React
errors and arbitrary digest-bearing client errors, and applies only in browsers.
A regression test failed before the fix and passed afterward. Applying the same
condition to the production bundle in an isolated browser response override
produced zero browser reports while preserving the server recovery screen.
The override changed only that test browser, not the deployed application.

The temporary production environment capability was removed and production
redeployed; page/API access returned 404. This cleanup deletes the temporary
pages, action, API, authorization helper, proxy branch, and Playwright capability
setup. A regression journey checks the removed endpoints return 404.
Merge/deploy this cleanup to apply the minified-message fix to all browsers.

## Privacy and remaining limits

Project: `memoji-inc-9m/shelve-games`, US region. Default server-side scrubbing and
IP-address scrubbing are enabled. Sentry still derived city/region/country from
transport metadata despite IP scrubbing. A project advanced scrubbing rule removes
all `$user.geo.*` values from new errors. A new sanitized verification event was
accepted, and its stored user and location fields were empty. Historical synthetic
events are unchanged.

Technical delivery during the trial does not prove free-plan source-map upload,
artifact retention, quota/reset behavior or alert availability after the trial.
Browser blocking, offline clients, exhausted quotas and best-effort delivery can
still prevent reports. No claim of complete error coverage is made.

References: [React error 441](https://react.dev/errors/441),
[advanced scrubbing](https://docs.sentry.io/security-legal-pii/scrubbing/advanced-datascrubbing/),
[Sentry GeoIP behavior](https://github.com/getsentry/sentry/issues/92201).
