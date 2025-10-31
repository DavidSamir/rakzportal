import CopyInstruction from "./CopyInstruction";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }) {
  const code = params?.code || "";
  return {
    title: code ? `Document ${code} · RAKEZ Viewer` : "RAKEZ Document Viewer",
  };
}

export default function DocumentPage({ params }) {
  const code = params?.code || "";
  const viewerSrc = `/api/pdf/${encodeURIComponent(code)}`;

  return (
    <main className="viewer">
      <header className="viewer__header">
        <div>
          <h1>Document preview</h1>
        </div>
        <a className="viewer__link" href="/">
          Search again
        </a>
      </header>
      <CopyInstruction code={code} />
      <section className="viewer__frame-wrapper">
        <iframe
          className="viewer__frame"
          src={viewerSrc}
          title={`RAKEZ document ${code}`}
          allow="fullscreen"
        />
      </section>
    </main>
  );
}
