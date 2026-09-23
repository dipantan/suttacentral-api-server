import React, { useState, useEffect } from 'react';
import { Upload, Sparkles, CheckCircle2, ArrowRight, Copy, Check, Loader2, BookOpen, ChevronDown } from 'lucide-react';
import { apiUrl } from '../config';

export default function IngestHub({ onOpenReview, showToast }) {
  const [suttas, setSuttas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUid, setSelectedUid] = useState('mn1');
  const [suttaTemplate, setSuttaTemplate] = useState(null);

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
    fetch(apiUrl(`/api/studio/template/${selectedUid}`))
      .then((res) => res.json())
      .then((data) => setSuttaTemplate(data))
      .catch((err) => console.error('Failed to load template:', err));
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
"সাধু, ভান্তে," বলিয়া সেই ভিক্ষুগণ প্রত্যুত্তর করিলেন।`);
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
    <form onSubmit={handleStartAlignment} className="ingest-flow">
      {/* Step 1 — Choose the sutta */}
      <section className="studio-card">
        <div className="step-head">
          <span className="step-num">1</span>
          <h3>Choose the sutta</h3>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input form-input-lg"
            placeholder="Search by name or ID — e.g. mn1, satipaṭṭhāna, dhp…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {filteredSuttas.length > 0 && (
            <div className="sutta-dropdown">
              {filteredSuttas.map((s) => (
                <div key={s.uid} className="sutta-option" onClick={() => handleSelectSutta(s)}>
                  <div>
                    <strong>{s.acronym || s.uid}</strong>
                    <span className="sutta-option-sub"> {s.root_name}</span>
                  </div>
                  <span className="sutta-option-sub">{s.translated_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {suttaTemplate && (
          <div className="sutta-selected">
            <div className="sutta-selected-head">
              <span className="brand-badge">{suttaTemplate.acronym}</span>
              <div>
                <div className="sutta-selected-title">{suttaTemplate.root_name}</div>
                <div className="sutta-selected-sub">
                  {suttaTemplate.translated_name} · {suttaTemplate.segment_count} segments
                </div>
              </div>
            </div>
            <div className="sutta-selected-crumbs">{suttaTemplate.full_breadcrumb}</div>
          </div>
        )}
      </section>

      {/* Step 2 — Translation details */}
      <section className="studio-card">
        <div className="step-head">
          <span className="step-num">2</span>
          <h3>Translation details</h3>
        </div>

        <div className="form-grid-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Language</label>
            <select
              className="form-select"
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                setLangName(
                  e.target.value === 'bn' ? 'Bengali'
                  : e.target.value === 'hi' ? 'Hindi'
                  : e.target.value === 'si' ? 'Sinhala'
                  : e.target.value === 'my' ? 'Burmese'
                  : 'Thai'
                );
              }}
            >
              <option value="bn">Bengali (বাংলা)</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="si">Sinhala (සිංහල)</option>
              <option value="my">Burmese (မြန်မာ)</option>
              <option value="th">Thai (ไทย)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Translator name</label>
            <input
              type="text"
              className="form-input"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. Ven. Shilalankar Mahathero"
            />
          </div>
        </div>

        <details className="advanced-details">
          <summary>
            Advanced options <ChevronDown size={14} />
          </summary>
          <div className="form-grid-2" style={{ marginTop: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Translator UID</label>
              <input
                type="text"
                className="form-input"
                value={authorUid}
                onChange={(e) => setAuthorUid(e.target.value)}
                placeholder="e.g. shilalankar"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">AI model</label>
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
        </details>
      </section>

      {/* Step 3 — Source text */}
      <section className="studio-card">
        <div className="step-head">
          <span className="step-num">3</span>
          <h3>Add the source text</h3>
          <button type="button" className="link-btn" onClick={loadSampleBengaliText}>
            Load sample
          </button>
        </div>

        <label className="upload-zone">
          <Upload size={22} color="var(--text-dim)" />
          <span>{selectedFile ? selectedFile.name : 'Drop a PDF or text file, or click to browse'}</span>
          <input
            type="file"
            accept=".pdf,.txt,.json"
            style={{ display: 'none' }}
            onChange={(e) => setSelectedFile(e.target.files[0] || null)}
          />
        </label>

        <div className="divider-or"><span>or paste text</span></div>

        <textarea
          className="form-textarea"
          placeholder="Paste the translation text here…"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          style={{ fontFamily: lang === 'bn' ? 'var(--font-bengali)' : 'inherit' }}
        />
      </section>

      {/* Submit / progress */}
      {isAligning ? (
        <div className="studio-card align-progress">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
            <span>{currentStep}</span>
            <span style={{ color: 'var(--saffron-500)' }}>{jobProgress}%</span>
          </div>
          <div className="progress-bar-container" style={{ marginBottom: 0 }}>
            <div className="progress-bar-fill" style={{ width: `${jobProgress}%` }} />
          </div>
        </div>
      ) : (
        <button type="submit" className="btn btn-primary btn-cta" disabled={isAligning}>
          <Sparkles size={18} />
          <span>Run AI Alignment</span>
        </button>
      )}

      {/* Completion */}
      {completedJob && (
        <div className="studio-card completion-card">
          <div className="completion-head">
            <CheckCircle2 size={22} color="var(--teal-400)" />
            <div>
              <div style={{ fontWeight: 700 }}>Alignment complete</div>
              <div className="sutta-selected-sub">{completedJob.totalSegments} segments ready for review</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-teal" onClick={() => onOpenReview(completedJob.token)}>
              <span>Open Review Studio</span>
              <ArrowRight size={16} />
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => copyReviewLink(completedJob.token)}>
              {copiedLink ? <Check size={16} color="var(--emerald-400)" /> : <Copy size={16} />}
              <span>Copy Review Link</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
