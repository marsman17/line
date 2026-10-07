export default function NotFound() {
  return (
    <main className="loading-screen">
      <span className="brand-icon">
        T<span>Q</span>
      </span>
      <h1>This table doesn’t exist.</h1>
      <p>The page you’re looking for could not be found.</p>
      <a className="button primary" href="/">
        Back to TableQ
      </a>
    </main>
  );
}
