'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = useRef(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const initialCode = searchParams.get('code');
    if (initialCode && !redirected.current) {
      redirected.current = true;
      router.replace(`/docs/${encodeURIComponent(initialCode)}`);
    }
  }, [router, searchParams]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter a document reference code.');
      return;
    }
    setError('');
    router.push(`/docs/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="home">
      <section className="card">
        <h1>RAKEZ Document Viewer</h1>
        <p>
          Paste the RAKEZ reference code to verify the document and preview the PDF directly in
          your browser.
        </p>
        <form onSubmit={handleSubmit} className="form">
          <label htmlFor="code-input">Reference code</label>
          <input
            id="code-input"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (error) {
                setError("");
              }
            }}
            placeholder="e.g. 98765-ABC"
            required
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">View document</button>
        </form>
      </section>
    </main>
  );
}
