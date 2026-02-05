import { NextResponse } from "next/server";
import {
  PASSWORD_POLICY,
  validatePasswordStrength,
} from "@/lib/security/passwordPolicy";
import { rateLimitByRequest } from "@/lib/security/rateLimit";

export async function POST(req) {
  const rate = rateLimitByRequest(req, {
    bucket: "auth-password-policy",
    limit: 25,
    windowMs: 5 * 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json(
      {
        error: "Demasiados intentos. Intenta nuevamente en unos minutos.",
        retryAfterMs: rate.retryAfterMs,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "");

  const result = validatePasswordStrength(password);

  return NextResponse.json(
    {
      valid: result.valid,
      message: result.message,
      checks: result.checks,
      policy: PASSWORD_POLICY,
    },
    { status: result.valid ? 200 : 422 }
  );
}
