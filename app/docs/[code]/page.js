import DocumentCode from './DocumentCode';

export const dynamic = "force-dynamic";

export function generateMetadata({ params }) {
  const code = params?.code || "";
  return {
    title: code ? `Document ${code} · RAKEZ Viewer` : "RAKEZ Document Viewer",
  };
}

export default function DocumentPage({ params }) {
  const code = params?.code || "";

  return (
    <main className="viewer">
      {/* <header className="viewer__header">
        <div>
          <h1>Document preview</h1>
        </div>
        <a className="viewer__link" href="/">
          Search again
        </a>
      </header> */}
      <section className="viewer__info-wrapper" >
        <DocumentCode code={code} />
      </section>
    </main>
  );
}
