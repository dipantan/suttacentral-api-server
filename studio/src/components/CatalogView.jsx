import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  UploadCloud,
  Clock,
  BookOpen
} from 'lucide-react';

export default function CatalogView({ onOpenReview, showToast }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState(null);

  const fetchReviews = () => {
    setLoading(true);
    fetch('/api/studio/reviews')
      .then((res) => res.json())
      .then((data) => {
        setReviews(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load reviews:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const copyReviewLink = (token) => {
    const link = `${window.location.origin}/studio/?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    showToast('Direct review link copied to clipboard!');
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div className="studio-card-title">
          <FolderOpen size={22} color="var(--saffron-400)" />
          <span>Translation Staging & Catalog ({reviews.length})</span>
        </div>
        <button className="btn btn-secondary" onClick={fetchReviews} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading translations staging catalog...
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <BookOpen size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>No translations in staging yet.</p>
          <p style={{ fontSize: '0.85rem' }}>Upload or align your first sutta from the Ingest tab.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {reviews.map((rev) => (
            <div
              key={rev.token}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                  <span className="brand-badge">{rev.acronym}</span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{rev.root_name}</strong>
                  <span className={`status-pill ${rev.status}`}>{rev.status}</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>{rev.full_breadcrumb}</span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                  Language: <strong style={{ color: 'var(--text-main)' }}>{rev.lang_name}</strong> &bull; Translator:{' '}
                  <strong>{rev.author_name}</strong> &bull; Segments: {rev.segment_count}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => copyReviewLink(rev.token)}
                  style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                >
                  {copiedToken === rev.token ? <Check size={15} color="var(--emerald-400)" /> : <Copy size={15} />}
                  <span>{copiedToken === rev.token ? 'Copied' : 'Share Link'}</span>
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => onOpenReview(rev.token)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <ExternalLink size={15} />
                  <span>Open Review</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
