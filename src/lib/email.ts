import { Resend } from "resend";
import { SITE_NAME } from "@/config/site";

export type Email = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

// RESEND_EMAIL_DOMAIN comes from the Marketplace integration; without it, Resend's sandbox sender.
const SENDER = process.env.RESEND_EMAIL_DOMAIN
  ? `noreply@${process.env.RESEND_EMAIL_DOMAIN}`
  : "onboarding@resend.dev";

export async function sendWithResend(email: Email) {
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `${SITE_NAME} <${SENDER}>`,
      ...email,
    });
    if (!error) return;
  } catch {
    // Provider/network errors can contain recipients, message bodies and auth links.
  }
  throw new Error("Email delivery failed");
}
