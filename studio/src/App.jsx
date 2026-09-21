import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, FolderOpen, Check } from 'lucide-react';
import IngestHub from './components/IngestHub';
import ReviewStudio from './components/ReviewStudio';
import CatalogView from './components/CatalogView';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingest'); // ingest, review, catalog
  const [activeToken, setActiveToken] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Check URL query parameters for direct review token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setActiveToken(token);
      setActiveTab('review');
    }
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleOpenReview = (token) => {
    setActiveToken(token);
    setActiveTab('review');
    // Update browser URL without reload for easy bookmarking/sharing
    const url = new URL(window.location);
    url.searchParams.set('token', token);
    window.history.pushState({}, '', url);
  };

  const handleBackToIngest = () => {
    setActiveTab('ingest');
    const url = new URL(window.location);
    url.searchParams.delete('token');
    window.history.pushState({}, '', url);
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="studio-navbar">
        <div className="studio-brand" onClick={() => setActiveTab('ingest')}>
          <span className="wheel-icon">☸</span>
          <div>
            <div className="brand-title">SADDHAMMA STUDIO</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
              Canonical AI Alignment & Localization
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'ingest' ? 'active tab-saffron' : ''}`}
            onClick={() => setActiveTab('ingest')}
          >
            <Sparkles size={16} />
            <span>Ingest & Align</span>
          </button>

          {activeToken && (
            <button
              className={`nav-tab-btn ${activeTab === 'review' ? 'active tab-saffron' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              <BookOpen size={16} />
              <span>Review Studio</span>
            </button>
          )}

          <button
            className={`nav-tab-btn ${activeTab === 'catalog' ? 'active tab-saffron' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <FolderOpen size={16} />
            <span>Staging Catalog</span>
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="status-pill published">API Online</span>
        </div>
      </header>

      {/* Main Studio Views */}
      <main className="studio-main">
        {activeTab === 'ingest' && (
          <IngestHub onOpenReview={handleOpenReview} showToast={showToast} />
        )}

        {activeTab === 'review' && activeToken && (
          <ReviewStudio token={activeToken} onBack={handleBackToIngest} showToast={showToast} />
        )}

        {activeTab === 'catalog' && (
          <CatalogView onOpenReview={handleOpenReview} showToast={showToast} />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <Check size={18} color="var(--emerald-400)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
