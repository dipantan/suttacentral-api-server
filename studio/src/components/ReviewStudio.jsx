import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Check,
  CheckCircle2,
  UploadCloud,
  Search,
  BookOpen,
  ArrowLeft,
  Share2,
  AlertCircle,
  Columns3,
  Rows3,
  Type,
  ArrowDownToLine,
  ClipboardPaste,
} from 'lucide-react';
import { apiUrl } from '../config';

const STATUS_COLORS = {
  edited: 'var(--amber-400)',
  ai: 'var(--blue-400)',
  draft: 'var(--text-dim)',
  empty: 'transparent',
};

function AutoTextarea({ value, onChange, onBlur, onFocus, onKeyDown, placeholder, fontScale, inputRef, lang }) {
  const ref = useRef(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 56) + 'px';
  }, []);

  useEffect(() => {
    resize();
  }, [value, fontScale, resize]);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        if (inputRef) inputRef(el);
      }}
      className="seg-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      spellCheck={false}
      style={{ fontFamily: lang === 'bn' ? 'var(--font-bengali)' : 'var(--font-sans)' }}
    />
  );
}

export default function ReviewStudio({ token, onBack, showToast }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, edited, ai, empty
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingSegmentId, setSavingSegmentId] = useState(null);
  const [savedSegmentId, setSavedSegmentId] = useState(null);
  const [focusedSegId, setFocusedSegId] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [layout, setLayout] = useState('columns'); // columns | stacked
  const [fontScale, setFontScale] = useState(1);
  const editorRefs = useRef({});

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
      setSavedSegmentId(segId);
      setTimeout(() => setSavedSegmentId((cur) => (cur === segId ? null : cur)), 2000);
    } catch (err) {
      console.error('Failed to autosave segment:', err);
      setSavingSegmentId(null);
    }
  };

  const focusSegment = (segId) => {
    const el = editorRefs.current[segId];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const copyReviewLink = () => {
    const link = `${window.location.origin}/?token=${token}`;
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
  const filledCount = review.rows.length - emptyCount;
  const progressPct = review.rows.length ? Math.round((filledCount / review.rows.length) * 100) : 0;

  const nextEmptySeg = () => {
    const next = filteredRows.find((r) => !r.target || r.target.trim() === '');
    if (next) focusSegment(next.segId);
    else showToast('All segments have translations!');
  };

  const handleEditorKeyDown = (e, segId) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.target.blur();
      const idx = filteredRows.findIndex((r) => r.segId === segId);
      const next = filteredRows[idx + 1];
      if (next) focusSegment(next.segId);
    } else if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const idx = filteredRows.findIndex((r) => r.segId === segId);
      const next = filteredRows[idx + 1];
      if (next) focusSegment(next.segId);
    } else if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const idx = filteredRows.findIndex((r) => r.segId === segId);
      const prev = filteredRows[idx - 1];
      if (prev) focusSegment(prev.segId);
    }
  };

  const insertIntoEditor = (segId, text) => {
    const el = editorRefs.current[segId];
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newVal = el.value.slice(0, start) + text + el.value.slice(end);
    handleSegmentChange(segId, newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', '--seg-font-scale': fontScale }}
    >
      {/* Top Action Bar */}
      <div className="studio-card" style={{ padding: '1.1rem 1.5rem' }}>
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

            {review.status === 'approved' ? (
              <button
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                <UploadCloud size={16} />
                <span>{isPublishing ? 'Publishing...' : 'Publish to Saddhamma'}</span>
              </button>
            ) : review.status === 'published' ? (
              <span className="brand-badge" style={{ background: 'rgba(52, 211, 153, 0.2)', color: 'var(--emerald-400)', borderColor: 'var(--emerald-400)' }}>
                ✓ Published in Bilara
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Sticky Work Toolbar */}
      <div className="review-toolbar">
        <div className="review-toolbar-row">
          <div className="review-search">
            <Search size={16} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Filter by Pāli, English, or translation..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>

          <div className="review-toolbar-group">
            <button className={`chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
              All ({review.rows.length})
            </button>
            <button className={`chip ${statusFilter === 'edited' ? 'active' : ''}`} onClick={() => setStatusFilter('edited')}>
              Edited ({editedCount})
            </button>
            <button className={`chip ${statusFilter === 'ai' ? 'active' : ''}`} onClick={() => setStatusFilter('ai')}>
              AI ({review.rows.filter((r) => r.status === 'ai').length})
            </button>
            <button className={`chip ${statusFilter === 'empty' ? 'active' : ''}`} onClick={() => setStatusFilter('empty')}>
              Empty ({emptyCount})
            </button>
          </div>

          <div className="review-toolbar-group">
            <button className="chip icon-chip" title="Next empty segment" onClick={nextEmptySeg}>
              <ArrowDownToLine size={15} />
              <span>Next empty</span>
            </button>
            <button
              className={`chip icon-chip ${layout === 'columns' ? 'active' : ''}`}
              title="Side-by-side columns"
              onClick={() => setLayout('columns')}
            >
              <Columns3 size={15} />
            </button>
            <button
              className={`chip icon-chip ${layout === 'stacked' ? 'active' : ''}`}
              title="Stacked layout (roomy editor)"
              onClick={() => setLayout('stacked')}
            >
              <Rows3 size={15} />
            </button>
            <button
              className="chip icon-chip"
              title="Smaller text"
              onClick={() => setFontScale((s) => Math.max(0.85, +(s - 0.15).toFixed(2)))}
            >
              <Type size={12} />
            </button>
            <button
              className="chip icon-chip"
              title="Larger text"
              onClick={() => setFontScale((s) => Math.min(1.45, +(s + 0.15).toFixed(2)))}
            >
              <Type size={18} />
            </button>
          </div>
        </div>

        <div className="review-progress-row">
          <div className="progress-bar-container" style={{ margin: 0, flex: 1 }}>
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="review-progress-text">
            {filledCount}/{review.rows.length} translated · {progressPct}%
          </span>
          <span className="review-hint">Ctrl+Enter save &amp; next · Ctrl+↑/↓ navigate</span>
        </div>
      </div>

      {/* Segment List */}
      <div className="seg-list">
        {filteredRows.map((row) => {
          const isEmpty = !row.target || row.target.trim() === '';
          const status = isEmpty ? 'empty' : row.status;
          return (
            <div
              key={row.segId}
              id={`seg-${row.segId}`}
              className={`seg-row ${layout} ${focusedSegId === row.segId ? 'focused' : ''}`}
            >
              <div className="seg-meta">
                <span className="seg-id-badge">{row.segId}</span>
                <span className="status-dot" style={{ background: STATUS_COLORS[status] }} title={status} />
                {savingSegmentId === row.segId && <span className="seg-saving">saving…</span>}
                {savedSegmentId === row.segId && savingSegmentId !== row.segId && (
                  <span className="seg-saved">✓ saved</span>
                )}
              </div>

              <div className="seg-refs">
                <div className="seg-col">
                  <div className="seg-col-label">Pāli</div>
                  <div className="seg-text text-pali">{row.root || <span className="seg-none">—</span>}</div>
                  {row.root && (
                    <button
                      className="seg-copy-btn"
                      title="Insert Pāli at cursor"
                      onClick={() => insertIntoEditor(row.segId, row.root)}
                    >
                      <ClipboardPaste size={12} /> insert
                    </button>
                  )}
                </div>
                <div className="seg-col">
                  <div className="seg-col-label">English (Sujato)</div>
                  <div className="seg-text text-english">{row.ref || <span className="seg-none">—</span>}</div>
                  {row.ref && (
                    <button
                      className="seg-copy-btn"
                      title="Insert English at cursor"
                      onClick={() => insertIntoEditor(row.segId, row.ref)}
                    >
                      <ClipboardPaste size={12} /> insert
                    </button>
                  )}
                </div>
              </div>

              <div className="seg-target">
                <div className="seg-col-label">{review.lang_name} — your translation</div>
                <AutoTextarea
                  value={row.target}
                  placeholder={`Translate ${row.segId}…`}
                  lang={review.lang}
                  fontScale={fontScale}
                  inputRef={(el) => (editorRefs.current[row.segId] = el)}
                  onChange={(text) => handleSegmentChange(row.segId, text)}
                  onFocus={() => setFocusedSegId(row.segId)}
                  onBlur={(text) => {
                    setFocusedSegId(null);
                    handleSegmentBlur(row.segId, text);
                  }}
                  onKeyDown={(e) => handleEditorKeyDown(e, row.segId)}
                />
              </div>
            </div>
          );
        })}

        {filteredRows.length === 0 && (
          <div className="studio-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
            <BookOpen size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <p>No segments match the active filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
