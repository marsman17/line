"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Something interrupted your visit.</h1>
      <p>Please try again. Your saved queue is safe.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
