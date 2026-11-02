# In-app feedback

Captured by `e2e/feedback.spec.ts` from the production Next.js build in Chromium
at 320 × 812, using the isolated in-memory PGlite database and synthetic account.
No production account data or live Resend delivery is shown.

- `feedback-mobile-header.png`: icon-only button immediately before the account menu.
- `feedback-mobile-form.png`: Bug selected with a message ready to send.
- `feedback-success.png`: confirmation after persistence and mocked notification delivery.
- `feedback-rate-limit.png`: the sixth submission is rejected and the draft remains.

The same test asserts five persisted rows, the opening pathname, and notification
recipient, content, and reply-to. The test captures screenshots after animations settle.
