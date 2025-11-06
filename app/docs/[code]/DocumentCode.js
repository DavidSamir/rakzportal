'use client';

import { useState, useEffect } from 'react';

export default function DocumentCode({ code }) {
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const handleCopy = () => {
    if (!code || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(() => {
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }).catch(() => {});
  };

  // Clean up the timeout when component unmounts
  useEffect(() => {
    return () => {
      setShowCopySuccess(false);
    };
  }, []);

  return (
    <div className="document-code" style={{ 
      borderRadius: '14px', 
      padding: '2rem',
      width: '100%',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.75rem'
    }}>
      {/* English Section */}
      <section className="en" style={{ width: '100%' }}>
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2 style={{ color: '#1e3a8a' }}>RAKEZ Document Verification</h2>
            <p style={{ color: '#475569', lineHeight: '1.5', fontSize: '0.875rem', margin: 0 }}>
              This is your unique document verification code issued by Ras Al Khaimah Economic Zone (RAKEZ).
            </p>
          </header>

          <p className="info-line" style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            margin: 0,
            color: '#1f2937',
            fontSize: '0.9rem'
          }}>
            <span className="info-label" style={{ color: '#1e3a8a', fontWeight: 600 }}>
              Document Code:
            </span>
            <code className="code-display code-chip">
              {code}
            </code>
            <button
              onClick={handleCopy}
              className="copy-button copy-chip"
              style={{ 
                border: 'none', 
                cursor: 'pointer',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ strokeWidth: 2 }}>
                <path d="M5.75 4.75H3.75C3.19772 4.75 2.75 5.19772 2.75 5.75V12.25C2.75 12.8023 3.19772 13.25 3.75 13.25H10.25C10.8023 13.25 11.25 12.8023 11.25 12.25V10.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="5.75" y="2.75" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copy
            </button>
            <span className="info-divider" style={{ color: '#cbd5f5', fontWeight: 600 }}>•</span>
            <span className="info-label" style={{ color: '#475569', fontWeight: 600 }}>
              Verification:
            </span>
            <span className="info-hint">
              Use the official portal:
            </span>
            <a
              href="https://rakez.my.salesforce-sites.com/Auth/VerifyDocument"
              target="_blank"
              rel="noopener noreferrer"
              className="verify-link action-pill"
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: '600'
              }}
            >
              RAKEZ Verification Portal
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3.75 8H12.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.75 4.25L12.25 8L8.75 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </p>
        </div>
      </section>

      <div className="divider" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }} />
      
      {/* Arabic Section */}
      <section className="ar" style={{ textAlign: 'right', direction: 'rtl', width: '100%' }}>
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2 style={{ color: '#1e3a8a', margin: 0 }}>التحقق من وثيقة راكز</h2>
            <p style={{ color: '#475569', lineHeight: '1.6', fontSize: '0.875rem', margin: 0 }}>
              هذا هو رمز التحقق الفريد الخاص بوثيقتك الصادرة عن المنطقة الاقتصادية برأس الخيمة (راكز).
            </p>
          </header>

          <p className="info-line" style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            margin: 0,
            color: '#1f2937',
            fontSize: '0.9rem'
          }}>
            <span className="info-label" style={{ 
              color: '#1e3a8a', 
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}>
              رمز الوثيقة:
            </span>
            <code className="code-display code-chip">
              {code}
            </code>
            <button
              onClick={handleCopy}
              className="copy-button copy-chip"
              style={{ 
                border: 'none', 
                cursor: 'pointer',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ strokeWidth: 2 }}>
                <path d="M5.75 4.75H3.75C3.19772 4.75 2.75 5.19772 2.75 5.75V12.25C2.75 12.8023 3.19772 13.25 3.75 13.25H10.25C10.8023 13.25 11.25 12.8023 11.25 12.25V10.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="5.75" y="2.75" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              نسخ
            </button>
            <span className="info-divider" style={{ color: '#cbd5f5', fontWeight: 600 }}>•</span>
            <span className="info-label" style={{ color: '#475569', fontWeight: 600 }}>
              التحقق:
            </span>
            <span className="info-hint">
              استخدم البوابة الرسمية:
            </span>
            <a
              href="https://rakez.my.salesforce-sites.com/Auth/VerifyDocument"
              target="_blank"
              rel="noopener noreferrer"
              className="verify-link action-pill"
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: '600'
              }}
            >
              قم بزيارة بوابة التحقق الخاصة براكز
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transform: 'scaleX(-1)' }}>
                <path d="M3.75 8H12.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.75 4.25L12.25 8L8.75 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </p>
        </div>
      </section>

      {/* Copy Success Toast */}
      {showCopySuccess && (
        <div className="success-toast">
          Code copied successfully! ✓
        </div>
      )}
    </div>
  );
}
