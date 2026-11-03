export const supportUrl = (path: string) =>
  `${process.env.E2E_SUPPORT_URL ?? "http://127.0.0.1:3101"}${path}`;
