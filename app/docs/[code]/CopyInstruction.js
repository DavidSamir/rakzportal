'use client';

import { useCallback } from "react";

export default function CopyInstruction({ code }) {
  const handleCopy = useCallback(() => {
    if (!code) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(code).catch(() => {});
  }, [code]);

  return (
    <p className="viewer__note">
      For official verification, please{" "}
      <button type="button" className="viewer__note-copy" onClick={handleCopy}>
        click here to copy the code
      </button>{" "}
      and then visit the{" "}
      <a
        href="https://rakez.my.salesforce-sites.com/Auth/VerifyDocument"
        target="_blank"
        rel="noopener noreferrer"
      >
        RAKEZ verification portal
      </a>
      .
    </p>
  );
}
