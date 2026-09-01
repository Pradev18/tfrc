"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf9f7" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2.5rem", fontWeight: 500, color: "#141414", margin: 0 }}>
            Application error
          </h1>
          <p style={{ marginTop: "1rem", color: "#6b6560", maxWidth: "28rem", lineHeight: 1.6 }}>
            Something critical failed. Refresh the page or restart the development server.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.875rem 2rem",
              borderRadius: "9999px",
              border: "none",
              background: "#141414",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
