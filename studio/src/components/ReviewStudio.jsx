import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  Save,
  CheckCircle2,
  UploadCloud,
  Search,
  BookOpen,
  Filter,
  ArrowLeft,
  Share2,
  AlertCircle
} from 'lucide-react';
import { apiUrl } from '../config';

export default function ReviewStudio({ token, onBack, showToast }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, edited, ai, empty
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingSegmentId, setSavingSegmentId] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Load review session
  const fetchReview = () => {
    setLoading(true);
    fetch(apiUrl(`/api/studio/reviews/${token}`))
      .then((res) => {
        if (!res.ok) throw new Error('Review session not found');
        return res.json();
      })
      .then((data) => {
        setReview(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load review:', err);
        setLoading(false);
        alert(err.message);
      });
  };

  useEffect(() => {
    if (token) {
      fetchReview();
    }
  }, [token]);

  const handleSegmentChange = (segId, text) => {
    setReview((prev) => {
      if (!prev) return prev;
      const updatedRows = prev.rows.map((r) =>
        r.segId === segId ? { ...r, target: text, status: 'edited' } : r
      );
      return {
        ...prev,
        rows: updatedRows,
        segments: { ...prev.segments, [segId]: text },
        segment_statuses: { ...prev.segment_statuses, [segId]: 'edited' },
      };
    });
  };

  const handleSegmentBlur = async (segId, text) => {
    setSavingSegmentId(segId);
    try {
      await fetch(apiUrl(`/api/studio/reviews/${token}/segment`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segId, text, status: 'edited' }),
      });
      setSavingSegmentId(null);
    } catch (err) {
      console.error('Failed to autosave segment:', err);
      setSavingSegmentId(null);
    }
  };

  const copyReviewLink = () => {
    const link = `${window.location.origin}/studio/?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast('Direct review link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(apiUrl(`/api/studio/reviews/${token}/approve`), {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to approve review');
      setReview((prev) => ({ ...prev, status: 'approved' }));
      showToast('Sutta translation marked as Approved!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publish this translation to the Saddhamma Bilara dataset and update the index?')) {
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch(apiUrl(`/api/studio/reviews/${token}/publish`), {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish');

      setReview((prev) => ({ ...prev, status: 'published' }));
      setIsPublishing(false);
      showToast('✅ Translation published to Saddhamma offline dataset!');
    } catch (err) {
      setIsPublishing(false);
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="studio-card" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading review session...</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="studio-card" style={{ textAlign: 'center', padding: '4rem' }}>
        <AlertCircle size={40} color="var(--rose-400)" style={{ margin: '0 auto 1rem' }} />
        <h3>Review session not found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          This token may have expired or is invalid.
        </p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Ingestion Hub</span>
        </button>
      </div>
    );
  }

  // Filtered rows
  const filteredRows = review.rows.filter((row) => {
    const q = filterQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      row.segId.toLowerCase().includes(q) ||
      (row.root && row.root.toLowerCase().includes(q)) ||
      (row.ref && row.ref.toLowerCase().includes(q)) ||
      (row.target && row.target.toLowerCase().includes(q));

    if (!matchesQuery) return false;

    if (statusFilter === 'edited') return row.status === 'edited';
    if (statusFilter === 'ai') return row.status === 'ai';
    if (statusFilter === 'empty') return !row.target || row.target.trim() === '';
    return true;
  });

  const editedCount = review.rows.filter((r) => r.status === 'edited').length;
  const emptyCount = review.rows.filter((r) => !r.target || r.target.trim() === '').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Bar */}
      <div className="studio-card" style={{ padding: '1.25rem 1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.5rem 0.8rem' }}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className="brand-badge" style={{ background: 'rgba(229, 169, 60, 0.2)' }}>
                  {review.acronym}
                </span>
                <h2 style={{ fontFamily: 'var(--font-canonical)', fontSize: '1.35rem', color: 'var(--text-main)' }}>
                  {review.root_name}
                </h2>
                <span className={`status-pill ${review.status}`}>{review.status}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {review.full_breadcrumb} &bull; Translator: <strong>{review.author_name}</strong> ({review.lang_name})
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={copyReviewLink}>
              {copiedLink ? <Check size={16} color="var(--emerald-400)" /> : <Share2 size={16} />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Review Link'}</span>
            </button>

            {review.status !== 'approved' && review.status !== 'published' && (
              <button className="btn btn-teal" onClick={handleApprove}>
                <CheckCircle2 size={16} />
                <span>Approve Sutta</span>
              </button>
            )}

            {review.status !== 'published' ? (
              <button
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                <UploadCloud size={16} />
                <span>{isPublishing ? 'Publishing...' : 'Publish to Saddhamma'}</span>
              </button>
            ) : (
              <span className="brand-badge" style={{ background: 'rgba(52, 211, 153, 0.2)', color: 'var(--emerald-400)', borderColor: 'var(--emerald-400)' }}>
                ✓ Published in Bilara
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Stats Toolbar */}
      <div className="studio-card" style={{ padding: '1rem 1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, maxWidth: '400px' }}>
            <Search size={18} color="var(--text-dim)" />
            <input
              type="text"
              className="form-input"
              placeholder="Filter segments by Pāli, English, or Bengali..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{ padding: '0.5rem 0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Filter size={16} color="var(--text-dim)" style={{ marginRight: '0.4rem' }} />
            <button
              className={`nav-tab-btn ${statusFilter === 'all' ? 'active tab-saffron' : ''}`}
              onClick={() => setStatusFilter('all')}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              All ({review.rows.length})
            </button>
            <button
              className={`nav-tab-btn ${statusFilter === 'edited' ? 'active tab-saffron' : ''}`}
              onClick={() => setStatusFilter('edited')}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              Edited ({editedCount})
            </button>
            <button
              className={`nav-tab-btn ${statusFilter === 'empty' ? 'active tab-saffron' : ''}`}
              onClick={() => setStatusFilter('empty')}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              Empty ({emptyCount})
            </button>
          </div>
        </div>
      </div>

      {/* 3-Column Side-by-Side Review Grid */}
      <div className="studio-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <div className="review-grid-header">
          <div>Segment</div>
          <div>Pāli Root Text</div>
          <div>English Reference (Sujato)</div>
          <div>{review.lang_name} Translation (Editable)</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredRows.map((row) => (
            <div key={row.segId} className="review-row" id={`seg-${row.segId}`}>
              {/* Segment ID */}
              <div>
                <span className="seg-id-badge">{row.segId}</span>
                <div style={{ marginTop: '0.35rem' }}>
                  <span
                    className={`status-pill ${
                      row.status === 'edited' ? 'in_review' : row.status === 'ai' ? 'aligned' : 'draft'
                    }`}
                    style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}
                  >
                    {row.status}
                  </span>
                </div>
              </div>

              {/* Column 1: Pali Root */}
              <div className="text-pali">{row.root || <span style={{ color: 'var(--text-dim)' }}>—</span>}</div>

              {/* Column 2: English Reference */}
              <div className="text-english">{row.ref || <span style={{ color: 'var(--text-dim)' }}>—</span>}</div>

              {/* Column 3: Vernacular Editor */}
              <div>
                <textarea
                  className="text-target-editor"
                  value={row.target}
                  placeholder={`Enter ${review.lang_name} translation...`}
                  onChange={(e) => handleSegmentChange(row.segId, e.target.value)}
                  onBlur={(e) => handleSegmentBlur(row.segId, e.target.value)}
                />
                {savingSegmentId === row.segId && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--saffron-400)', display: 'block', marginTop: '0.2rem' }}>
                    Autosaving...
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
              No segments match the active filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
