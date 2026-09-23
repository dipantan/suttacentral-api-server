import React, { useState, useEffect } from 'react';
import { Upload, FileText, Sparkles, CheckCircle2, ArrowRight, Copy, Check, Loader2, BookOpen } from 'lucide-react';
import { apiUrl } from '../config';

export default function IngestHub({ onOpenReview, showToast }) {
  const [suttas, setSuttas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUid, setSelectedUid] = useState('mn1');
  const [suttaTemplate, setSuttaTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Form State
  const [lang, setLang] = useState('bn');
  const [langName, setLangName] = useState('Bengali');
  const [authorUid, setAuthorUid] = useState('shilalankar');
  const [authorName, setAuthorName] = useState('Ven. Shilalankar Mahathero');
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [model, setModel] = useState('@cf/meta/llama-3.3-70b-instruct-fp8-fast');

  // Job State
  const [isAligning, setIsAligning] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [completedJob, setCompletedJob] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load catalog on mount
  useEffect(() => {
    fetch(apiUrl('/api/studio/suttas'))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSuttas(data);
      })
      .catch((err) => console.error('Failed to load suttas:', err));
  }, []);

  // Load template when sutta UID changes
  useEffect(() => {
    if (!selectedUid) return;
    setLoadingTemplate(true);
    fetch(apiUrl(`/api/studio/template/${selectedUid}`))
      .then((res) => res.json())
      .then((data) => {
        setSuttaTemplate(data);
        setLoadingTemplate(false);
      })
      .catch((err) => {
        console.error('Failed to load template:', err);
        setLoadingTemplate(false);
      });
  }, [selectedUid]);

  // Autocomplete filtered list
  const filteredSuttas = suttas
    .filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return false;
      return (
        s.uid.toLowerCase().includes(q) ||
        (s.acronym && s.acronym.toLowerCase().includes(q)) ||
        (s.root_name && s.root_name.toLowerCase().includes(q)) ||
        (s.translated_name && s.translated_name.toLowerCase().includes(q))
      );
    })
    .slice(0, 8);

  const handleSelectSutta = (sutta) => {
    setSelectedUid(sutta.uid);
    setSearchQuery('');
  };

  const loadSampleBengaliText = () => {
    if (selectedUid === 'mn1') {
      setRawText(`মঝ্ঝিমনিকায় ১
মূলপরিয়ায় সুত্ত
আমি এইরূপ শুনিয়াছি—
এক সময়ে ভগবান উ Ukkaṭṭhā নগরে সুভগ বনে শালবৃক্ষমূলে বিহার করিতেছিলেন।
তথায় ভগবান ভিক্ষুগণকে সম্বোধন করিলেন:
"হে ভিক্ষুগণ।"
"ভদন্ত," সেই ভিক্ষুগণ ভগবানকে প্রত্যুত্তর করিলেন।
ভগবান এই বলিলেন:
"ভিক্ষুগণ, তোমাদিগকে সর্বধর্মমূলপর্যায় দেশনা করিব।
তাহা শ্রবণ কর, উত্তমরূপে মনসি কর, বলিব।"
"সাধু, ভান্তে," বলিয়া সেই ভিক্ষুগণ প্রত্যুত্তর করিলেন।
ভগবান এই বলিলেন:
"ভিক্ষুগণ, এই জগতে অশ্রুতবান সাধারণ ব্যক্তি যিনি আর্যদিগকে দর্শন করেন নাই, আর্যধর্মে অকোবিদ, আর্যধর্মে অবিনীত—
তিনি পৃথিবীকে পৃথিবী বলিয়া সংজ্ঞান করেন;
পৃথিবীকে পৃথিবী বলিয়া জানিয়া পৃথিবীকে নিজের মনে করেন, পৃথিবীতে আত্মভাব দেখেন, পৃথিবী হইতে স্বতন্ত্র ভাবেন, 'পৃথিবী আমার' ভাবিয়া পৃথিবীর প্রতি প্রমোদিত হন।
তাহার কারণ কি?
'তিনি ইহাকে সম্যকভাবে পরিজ্ঞাত হন নাই' আমি বলি।`);
    } else {
      setRawText(`মন সকল ধর্মের পূর্বগামী। মন তাদের প্রধান, তারা মনোজাত। যদি কেহ দূষিত চিত্তে বাক্য উচ্চারণ করে বা কর্ম করে, তবে দুঃখ তার অনুগমন করে যেমন চাকা গরুর পদচিহ্ন অনুসরণ করে।
মন সকল ধর্মের পূর্বগামী। মন তাদের প্রধান, তারা মনোজাত। যদি কেহ প্রসন্ন চিত্তে বাক্য উচ্চারণ করে বা কর্ম করে, তবে সুখ তার অনুগমন করে যেমন ছায়া কদাপি ত্যাগ করে না।`);
    }
    showToast('Loaded canonical Bengali sample text');
  };

  const handleStartAlignment = async (e) => {
    e.preventDefault();
    if (!rawText.trim() && !selectedFile) {
      alert('Please upload a file or paste text.');
      return;
    }

    setIsAligning(true);
    setJobProgress(0);
    setCurrentStep('Initializing alignment...');
    setCompletedJob(null);

    try {
      const formData = new FormData();
      formData.append('uid', selectedUid);
      formData.append('lang', lang);
      formData.append('lang_name', langName);
      formData.append('author_uid', authorUid);
      formData.append('author_name', authorName);
      formData.append('model', model);

      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('raw_text', rawText);
      }

      const res = await fetch(apiUrl('/api/studio/upload-align'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start alignment');
      }

      const { job_id } = await res.json();

      // Poll job status
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch(apiUrl(`/api/studio/jobs/${job_id}`));
          const job = await pollRes.json();

          setJobProgress(job.progress || 0);
          setCurrentStep(job.currentStep || 'Aligning...');

          if (job.status === 'completed') {
            clearInterval(interval);
            setIsAligning(false);
            setCompletedJob(job);
            showToast('AI Alignment complete!');
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setIsAligning(false);
            alert(`Alignment failed: ${job.error}`);
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 800);
    } catch (err) {
      setIsAligning(false);
      alert(err.message);
    }
  };

  const copyReviewLink = (token) => {
    const link = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast('Direct review link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
      {/* Left Column: Form & Ingestion */}
      <div className="studio-card">
        <div className="studio-card-header">
          <div className="studio-card-title">
            <Sparkles size={22} color="var(--saffron-400)" />
            <span>AI Translation & Segment Aligner</span>
          </div>
          <span className="brand-badge">Gemini Powered</span>
        </div>

        <form onSubmit={handleStartAlignment}>
          {/* Sutta Selector */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">
              <span>Select Canonical Sutta (UID or Name)</span>
              {suttaTemplate && (
                <span style={{ color: 'var(--saffron-400)', fontWeight: 600 }}>
                  {suttaTemplate.segment_count} Pāli Segments
                </span>
              )}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Search e.g. 'mn1', 'mn10', 'satipatthana'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {filteredSuttas.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: '4px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 50,
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {filteredSuttas.map((s) => (
                  <div
                    key={s.uid}
                    onClick={() => handleSelectSutta(s)}
                    style={{
                      padding: '0.7rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <strong style={{ color: 'var(--saffron-400)' }}>{s.acronym || s.uid}</strong>:{' '}
                      <span>{s.root_name}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{s.translated_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sutta Breadcrumb Badge Card */}
          {suttaTemplate && (
            <div className="breadcrumb-trail">
              <BookOpen size={16} color="var(--saffron-400)" />
              <span>{suttaTemplate.full_breadcrumb}</span>
            </div>
          )}

          {/* Localization Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Target Language</label>
              <select
                className="form-select"
                value={lang}
                onChange={(e) => {
                  setLang(e.target.value);
                  setLangName(e.target.value === 'bn' ? 'Bengali' : e.target.value === 'hi' ? 'Hindi' : 'Local');
                }}
              >
                <option value="bn">Bengali (বাংলা)</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="si">Sinhala (සිංහල)</option>
                <option value="my">Burmese (မြန်မာ)</option>
                <option value="th">Thai (ไทย)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Translator UID</label>
              <input
                type="text"
                className="form-input"
                value={authorUid}
                onChange={(e) => setAuthorUid(e.target.value)}
                placeholder="e.g. shilalankar"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Translator Display Name</label>
              <input
                type="text"
                className="form-input"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Ven. Shilalankar Mahathero"
              />
            </div>

            <div className="form-group">
              <label className="form-label">AI Model</label>
              <select
                className="form-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B (Cloudflare · free)</option>
                <option value="@cf/meta/llama-3.1-8b-instruct">Llama 3.1 8B (Cloudflare · free)</option>
                <option value="@cf/google/gemma-3-12b-it">Gemma 3 12B (Cloudflare · free)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (needs API key)</option>
              </select>
            </div>
          </div>

          {/* Document Upload / Text Area */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ margin: 0 }}>
                Vernacular Document / Translation Text
              </label>
              <button
                type="button"
                onClick={loadSampleBengaliText}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--saffron-400)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Load Sample Bengali Text
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              <label
                style={{
                  flex: 1,
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  background: 'var(--bg-input)',
                  transition: 'all 0.2s',
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload size={24} color="var(--text-muted)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {selectedFile ? selectedFile.name : 'Upload PDF or Text file'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,.json,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                />
              </label>
            </div>

            <textarea
              className="form-textarea"
              placeholder="Or paste the vernacular translation text directly here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              style={{ fontFamily: lang === 'bn' ? 'var(--font-bengali)' : 'inherit', fontSize: '1rem' }}
            />
          </div>

          {/* AI Execution Controls */}
          {isAligning ? (
            <div style={{ background: 'var(--bg-input)', padding: '1.2rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600 }}>
                <span>{currentStep}</span>
                <span style={{ color: 'var(--saffron-400)' }}>{jobProgress}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${jobProgress}%` }} />
              </div>
            </div>
          ) : (
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isAligning}>
              <Sparkles size={18} />
              <span>Run AI Alignment & Generate Segments</span>
            </button>
          )}
        </form>

        {/* Completion Card */}
        {completedJob && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              background: 'var(--teal-glow)',
              border: '1px solid var(--teal-500)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--teal-400)', fontWeight: 700, marginBottom: '0.6rem' }}>
              <CheckCircle2 size={20} />
              <span>Alignment Complete! {completedJob.totalSegments} segments aligned.</span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Translation is staged and ready for editorial verification or collaborative sharing.
            </p>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-teal"
                onClick={() => onOpenReview(completedJob.token)}
              >
                <span>Open 3-Column Review Studio</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyReviewLink(completedJob.token)}
              >
                {copiedLink ? <Check size={16} color="var(--emerald-400)" /> : <Copy size={16} />}
                <span>Copy Direct Review Link</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Template & Pāli Anchor Preview */}
      <div className="studio-card" style={{ height: 'fit-content' }}>
        <div className="studio-card-header">
          <div className="studio-card-title">
            <BookOpen size={20} color="var(--saffron-400)" />
            <span>Canonical Reference Anchor</span>
          </div>
          <span className="status-pill published">SuttaCentral Bilara</span>
        </div>

        {suttaTemplate ? (
          <div>
            <h3 style={{ fontFamily: 'var(--font-canonical)', fontSize: '1.3rem', color: 'var(--saffron-400)', marginBottom: '0.3rem' }}>
              {suttaTemplate.acronym}: {suttaTemplate.root_name}
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {suttaTemplate.translated_name}
            </p>

            {suttaTemplate.blurb && (
              <div
                style={{
                  background: 'var(--bg-input)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.6',
                  marginBottom: '1.5rem',
                  borderLeft: '3px solid var(--saffron-500)',
                }}
              >
                {suttaTemplate.blurb}
              </div>
            )}

            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
              Anchor Preview ({suttaTemplate.segment_count} Total Segments)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {suttaTemplate.sample_segments &&
                suttaTemplate.sample_segments.map((seg) => (
                  <div
                    key={seg.key}
                    style={{
                      background: 'var(--bg-input)',
                      padding: '0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <span className="seg-id-badge" style={{ marginBottom: '0.3rem' }}>
                      {seg.key}
                    </span>
                    <div style={{ color: 'var(--text-pali)', fontSize: '0.9rem', marginBottom: '0.2rem', fontFamily: 'Georgia, serif' }}>
                      {seg.root}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {seg.ref}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
            <p>Loading canonical sutta anchor...</p>
          </div>
        )}
      </div>
    </div>
  );
}
