"use client";

export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Production builds replace server error messages with boilerplate, so only dev shows the real one.
  const detail = process.env.NODE_ENV === "development"
    ? error.message
    : "Your last change wasn't saved. Try again; if it keeps happening, sign out and back in.";
  return (
    <div className="wrap">
      <div className="card">
        <div className="empty-state">
          <h2>Something didn&apos;t save</h2>
          <p>{detail}</p>
          {error.digest && <p style={{ fontSize: 11 }}>ref {error.digest}</p>}
          <button className="btn" onClick={() => unstable_retry()}>try again</button>
        </div>
      </div>
    </div>
  );
}
