export const DELETION_CALLBACK = "/settings?deletion=verified";
export const DELETION_WINDOW_MS = 5 * 60 * 1000;
export const deletionProofId = (sessionId: string) =>
  `account-deletion:${sessionId}`;
