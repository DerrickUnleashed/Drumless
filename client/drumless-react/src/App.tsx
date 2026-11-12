import React from 'react';
import './pages/LandingPage.css';
import './pages/DashboardPage.css';

const LandingPage: React.FC = () => {
  return (
    <section className="min-h-screen bg-background font-body">
      <header className="header">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Drumless</h1>
          <p className="text-muted-foreground">Drum‑removal + practice tempo tool</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="theme-toggle"
            className="btn btn-secondary"
            aria-label="Toggle dark mode"
          >
            🌙
          </button>
        </div>
      </header>

      <main className="section">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-header">Remove drums from any track</h2>
          <p className="section-desc">
            Upload a YouTube URL or audio file and get a drum‑free backing track with auto‑detected BPM.
          </p>

          <div className="grid gap-6 md:grid-cols-2 mt-8">
            <div>
              <h3 className="font-medium mb-2">YouTube URL</h3>
              <p className="text-muted-foreground">
                Paste a public link — no account needed
              </p>
              <input
                id="url-input"
                type="text"
                placeholder="https://www.youtube.com/watch?v="
                className="input w-full mt-2"
              />
            </div>
            <div>
              <h3 className="font-medium mb-2">Or upload file</h3>
              <p className="text-muted-foreground">
                mp3, wav, m4a, flac, aac, ogg, opus
              </p>
              <input
                id="file-input"
                type="file"
                className="input w-full mt-2"
                accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.opus,.webm"
              />
            </div>
          </div>

          <button id="process-btn" className="btn btn-primary w-full mt-6">
            Process Track
          </button>
        </div>
      </main>

      <footer className="section bg-gray-50 dark:bg-gray-900 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Drumless — Drum‑removal + Practice Tempo Tool
        </p>
      </footer>
    </section>
  );
};

const DashboardPage: React.FC = () => {
  const [darkMode, setDarkMode] = React.useState<boolean>(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('drumless-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (saved === 'dark' || (!saved && prefersDark)) {
      setDarkMode(true);
    }
  }, []);

  React.useEffect(() => {
    const html = document.documentElement;

    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <section className="min-h-screen bg-background font-body">
      <header className="header">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Drumless</h1>
          <p className="text-muted-foreground">Drum‑removal + practice tempo tool</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="theme-toggle"
            className={darkMode ? 'btn btn-secondary' : 'btn btn-secondary'}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="section">
        <div className="max-w-2xl mx-auto">
          <div id="status-card" className="card mb-8 hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2v4l2 8h4l2 -8h-4l-2 8h-2l-2 -8H9l2 -8H5z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Ready</p>
                <p className="text-xs text-muted-foreground">Upload a track to get started</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-h full" aria-label="Progress bar">
              <div id="progress-bar" className="h-2 rounded-lg bg-primary transition-width" style={{ width: '0%' }}></div>
            </div>
          </div>

          <div id="results-card" className="card grid grid-cols-1 gap-6 md:grid-cols-2 hidden">
            <div>
              <h2 className="font-medium mb-3">Detected BPM</h2>
              <p id="bpm-value" className="text-5xl font-bold">120</p>
              <p id="bpm-info" className="text-muted-foreground">(source: auto, env: 120)</p>
            </div>
            <div>
              <h2 className="font-medium mb-3">Tempo Source</h2>
              <p id="tempo-source" className="text-muted-foreground">Auto-detected</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-8">
            <div>
              <h3 className="font-medium mb-3">Backing + Click</h3>
              <div className="relative">
                <audio id="mixed-player" controls preload="metadata" className="w-full"></audio>
                <button id="download-mixed" download className="abs-bottom btn btn-secondary text-sm">
                  Download MP3
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-3">Backing Only</h3>
              <div className="relative">
                <audio id="backing-player" controls preload="metadata" className="w-full"></audio>
                <button id="download-backing" download className="abs-bottom btn btn-secondary text-sm">
                  Download MP3
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t">
            <h2 className="font-medium mb-3">Adjust BPM</h2>
            <div className="grid gap-3 mb-4">
              <button id="half-btn" className="btn btn-secondary" onClick={() => alert('÷2')}>÷2</button>
              <button id="dbl-btn" className="btn btn-secondary" onClick={() => alert('×2')}>×2</button>
            </div>
            <div>
              <label className="text-sm font-medium">BPM: <span id="editable-bpm" className="font-mono">120</span></label>
              <input
                id="bpm-input"
                type="number"
                min="40"
                max="300"
                value="120"
                className="input w-full mt-2"
              />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-medium mb-3">Click Volume</h2>
            <input
              id="click-gain"
              type="range"
              min="-20"
              max="0"
              value="-6"
              className="input w-full mt-2"
            />
            <p id="click-gain-value" className="text-sm text-muted-foreground mt-1">-6 dB</p>
          </div>

          <div className="mt-8 pt-8 border-t">
            <button id="download-mixed-wav" download className="btn btn-primary w-full mb-2">
              Download Mixed (WAV)
            </button>
            <button id="download-backing-wav" download className="btn btn-secondary w-full">
              Download Backing (WAV)
            </button>
          </div>
        </div>
      </main>
    </section>
  );
};

function App() {
  const [page, setPage] = React.useState<'landing' | 'dashboard'>('landing');

  return (
    <div className="min-h-screen bg-background font-body">
      <nav className="border-b border-border pb-4 mb-6">
        <button
          className="btn btn-secondary mr-4"
          onClick={() => setPage('landing')}
        >
          Landing
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setPage('dashboard')}
        >
          Dashboard
        </button>
      </nav>

      {page === 'landing' && <LandingPage />}
      {page === 'dashboard' && <DashboardPage />}
    </div>
  );
}

export default App;
