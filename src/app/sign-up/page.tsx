"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/components/analytics";
import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";
import { passwordErrorMessage } from "@/lib/password-policy";

export default function SignUpPage() {
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));
  return (
    <AuthForm
      title="Create an account"
      submitLabel="Sign up"
      fields={[
        { name: "name", label: "Name", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
      onSubmit={async ({ name, email, password }) => {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: returnTo,
        });
        if (error) return { error: passwordErrorMessage(error) };
        trackEvent("sign_up_completed", { method: "email" });
        return { message: `Check ${email} for a link to verify your email.` };
      }}
    >
      <p className="text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link
          href={authPageHref("/sign-in", returnTo)}
          className="underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </AuthForm>
  );
}
