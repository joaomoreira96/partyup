import type { AuthError } from "@supabase/supabase-js";

export type ForgotPasswordErrorCode = "rateLimit" | "tooSoon" | "invalidEmail" | "generic";

export function mapForgotPasswordError(error: AuthError): ForgotPasswordErrorCode {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (
    error.status === 429 ||
    message.includes("rate limit") ||
    code.includes("rate_limit") ||
    code.includes("over_email")
  ) {
    return "rateLimit";
  }

  if (
    message.includes("only request this after") ||
    message.includes("seconds") ||
    code.includes("over_request")
  ) {
    return "tooSoon";
  }

  if (message.includes("invalid") && message.includes("email")) {
    return "invalidEmail";
  }

  return "generic";
}
