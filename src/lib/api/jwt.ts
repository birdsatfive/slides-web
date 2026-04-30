import jwt from "jsonwebtoken";

export interface SlidesApiClaims {
  sub: string;       // Supabase auth user id
  org_id?: string;   // current org
  email?: string;
}

/**
 * Sign a short-lived HS256 JWT for slides-api. Server-only — uses
 * SLIDES_API_JWT_SECRET which must be kept off the client. The audience
 * matches the API's expected value (`slides-api`).
 */
export function signSlidesApiToken(claims: SlidesApiClaims, ttlSeconds = 600): string {
  const secret = process.env.SLIDES_API_JWT_SECRET;
  if (!secret) throw new Error("SLIDES_API_JWT_SECRET not configured");
  return jwt.sign(claims, secret, {
    algorithm: "HS256",
    audience: process.env.SLIDES_API_JWT_AUDIENCE || "slides-api",
    expiresIn: ttlSeconds,
  });
}
