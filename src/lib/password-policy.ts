/** Preserve Better Auth's effective bounds in service configuration and new-password forms. */
export const PASSWORD_POLICY = { minLength: 8, maxLength: 128 };

export const PASSWORD_GUIDANCE = `Use ${PASSWORD_POLICY.minLength}–${PASSWORD_POLICY.maxLength} characters.`;

export function passwordErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "PASSWORD_TOO_SHORT")
    return `Password must be at least ${PASSWORD_POLICY.minLength} characters.`;
  if (error.code === "PASSWORD_TOO_LONG")
    return `Password must be no more than ${PASSWORD_POLICY.maxLength} characters.`;
  return error.message;
}
