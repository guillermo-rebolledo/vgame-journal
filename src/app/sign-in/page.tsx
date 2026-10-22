"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();

  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in with email"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "current-password",
        },
      ]}
      onSubmit={async ({ email, password }) => {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/",
        });
        if (error?.status === 403)
          return {
            error: "Verify your email first. We've sent you a new link.",
          };
        if (error) return { error: error.message };
        router.push("/");
        router.refresh();
      }}
    >
      <Button
        variant="outline"
        onClick={() =>
          authClient.signIn.social({ provider: "google", callbackURL: "/" })
        }
      >
        Continue with Google
      </Button>
      <p className="flex justify-between text-muted-foreground text-sm">
        <Link href="/sign-up" className="underline underline-offset-4">
          Create an account
        </Link>
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot password?
        </Link>
      </p>
    </AuthForm>
  );
}
