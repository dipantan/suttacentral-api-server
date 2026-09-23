import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, FolderOpen, Check, Settings } from 'lucide-react';
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
          <span className="brand-title">Saddhamma Studio</span>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'ingest' ? 'active' : ''}`}
            onClick={() => setActiveTab('ingest')}
          >
            <Sparkles size={15} />
            <span>New Translation</span>
          </button>

          {activeToken && (
            <button
              className={`nav-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              <BookOpen size={15} />
              <span>Review</span>
            </button>
          )}

          <button
            className={`nav-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <FolderOpen size={15} />
            <span>All Translations</span>
          </button>
        </nav>

        <button
          className="nav-tab-btn"
          title="API server URL"
          onClick={() => {
            const current = localStorage.getItem('saddhamma_api_base') || '';
            const newUrl = prompt('Backend API URL (blank = same server):', current);
            if (newUrl !== null) {
              if (newUrl.trim()) {
                localStorage.setItem('saddhamma_api_base', newUrl.trim());
              } else {
                localStorage.removeItem('saddhamma_api_base');
              }
              showToast('API server updated');
              window.location.reload();
            }
          }}
        >
          <Settings size={15} />
        </button>
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
