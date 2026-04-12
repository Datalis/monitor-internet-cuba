'use client';

import { useState } from 'react';

const BASE_URL = 'https://internet.cubapk.com';

interface ShareButtonsProps {
  text: string;
  url?: string;
  compact?: boolean;
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ShareButtons({ text, url, compact }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || BASE_URL;
  const fullText = `${text}\n${shareUrl}`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;

  const handleCopy = async () => {
    try {
      // Try Web Share API first (mobile - works with Instagram)
      if (navigator.share) {
        await navigator.share({ text, url: shareUrl });
        return;
      }
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User cancelled share or clipboard failed
    }
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: compact ? '6px 10px' : '8px 14px',
    borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: compact ? 11 : 12, fontWeight: 600,
    textDecoration: 'none', transition: 'opacity 0.15s, transform 0.15s',
    color: 'white',
  };

  const handleHover = (e: React.MouseEvent<HTMLElement>, enter: boolean) => {
    e.currentTarget.style.opacity = enter ? '0.85' : '1';
    e.currentTarget.style.transform = enter ? 'scale(1.05)' : 'scale(1)';
  };

  return (
    <>
      <style>{`@media(max-width:480px){.share-btn-label{display:none !important}}`}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 6 : 8, alignItems: 'center' }}>
        {!compact && <span className="share-btn-label" style={{ color: '#64748b', fontSize: 12 }}>Compartir:</span>}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnBase, background: '#000000' }}
          onMouseOver={e => handleHover(e, true)}
          onMouseOut={e => handleHover(e, false)}
        >
          <XIcon /><span className="share-btn-label">X</span>
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnBase, background: '#1877F2' }}
          onMouseOver={e => handleHover(e, true)}
          onMouseOut={e => handleHover(e, false)}
        >
          <FacebookIcon /><span className="share-btn-label">Facebook</span>
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnBase, background: '#25D366' }}
          onMouseOver={e => handleHover(e, true)}
          onMouseOut={e => handleHover(e, false)}
        >
          <WhatsAppIcon /><span className="share-btn-label">WhatsApp</span>
        </a>
        <button
          onClick={handleCopy}
          style={{ ...btnBase, background: copied ? '#22c55e' : '#64748b' }}
          onMouseOver={e => handleHover(e, true)}
          onMouseOut={e => handleHover(e, false)}
          title="Compartir via otras apps"
        >
          {copied ? <CheckIcon /> : <ShareIcon />}
          <span className="share-btn-label">{copied ? 'Copiado' : 'Compartir'}</span>
        </button>
      </div>
    </>
  );
}
