/**
 * Sealed administrator password (bcrypt of Samadmin@9870).
 * When locked, any DB drift is restored before login checks so an
 * intruder cannot permanently change the portal password via Neon/SQL.
 */
export const SEALED_ADMIN_EMAIL = "info@tfrcwholesale.com";

/** bcrypt hash for Samadmin@9870 — never store the plaintext in env files. */
export const SEALED_ADMIN_PASSWORD_HASH =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";

export function adminPasswordLocked(): boolean {
  if (process.env.ADMIN_PASSWORD_LOCKED === "false") return false;
  // Default locked in production; opt-in lock elsewhere.
  return (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_PASSWORD_LOCKED === "true"
  );
}
