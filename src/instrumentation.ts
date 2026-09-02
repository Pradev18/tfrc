export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { execFileSync } = await import("child_process");
    const { join } = await import("path");
    execFileSync(process.execPath, [join(process.cwd(), "scripts", "ensure-prod-db.mjs")], {
      stdio: "inherit",
      env: process.env,
    });
  } catch (error) {
    console.error("[instrumentation] DB ensure failed:", error);
  }
}
