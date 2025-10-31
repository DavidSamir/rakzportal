'use client';

import { useCallback, useMemo, useState } from 'react';

export default function CopyCodeButton({ code, label = 'Copy reference code' }) {
  const [copied, setCopied] = useState(false);
  const buttonText = useMemo(() => {
    if (!code) return 'No reference code';
    return copied ? 'Copied!' : label;
  }, [code, copied, label]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setCopied(false);
    }
  }, [code]);

  return (
    <button
      type="button"
      className="viewer__copy"
      onClick={handleCopy}
      disabled={!code}
      title={copied ? "Reference code copied to clipboard" : `${label} and paste it on RAKEZ`}
      aria-live="polite"
    >
      {buttonText}
    </button>
  );
}
