import type { ReactNode, SVGProps } from "react";
import { Link } from "./Link";
import "./styles.css";
import "./landing.css";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function DrumIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="7" rx="8" ry="3" />
      <path d="M4 7v10c0 1.66 3.58 3 8 3s8-1.34 8-3V7" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </IconBase>
  );
}

function WaveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h2l2-6 3 12 3-9 2 5h6" />
    </IconBase>
  );
}

function GaugeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="m13.4 12.6 4.1-4.1" />
      <path d="M20.5 12a8.5 8.5 0 1 1-17 0" />
    </IconBase>
  );
}

function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

function LinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 13a5 5 0 0 0 7.1.1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
    </IconBase>
  );
}

function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 5 5L20 6" />
    </IconBase>
  );
}

function ArrowIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

const WAVEFORM = [
  22, 44, 30, 62, 38, 74, 52, 88, 60, 40, 70, 96, 64, 46, 78, 34, 58, 82, 48,
  66, 28, 54, 90, 42, 72, 36, 60, 80, 50, 68, 32, 56,
];

const FEATURES = [
  {
    icon: DrumIcon,
    title: "Drum separation",
    body: "Two Demucs models strip the drums from any track and keep a clean backing mix for you to play over.",
  },
  {
    icon: GaugeIcon,
    title: "Tempo detection",
    body: "Drumless reads the tempo from the drum stem and remembers the first beat, so the click never drifts.",
  },
  {
    icon: WaveIcon,
    title: "Click that keeps the feel",
    body: "Nudge the BPM and set the click volume, then re-render in place without losing the song's groove.",
  },
  {
    icon: DownloadIcon,
    title: "WAV and MP3",
    body: "Play both mixes in the browser or download the backing and the backing-plus-click at full quality.",
  },
] as const;

const STEPS = [
  {
    title: "Bring a track",
    body: "Drop in a local audio file or paste a YouTube link. If you supply both, the link wins.",
  },
  {
    title: "Separate and detect",
    body: "The backend isolates the drum stem, detects the tempo, and builds a click aligned to the first beat.",
  },
  {
    title: "Practice your way",
    body: "Fine-tune the BPM and click level, then stream or download the result from the studio.",
  },
] as const;

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="brand" aria-label="Drumless home">
          <DrumIcon className="brand-mark" />
          <span>Drumless</span>
        </Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link to="/studio" className="button primary nav-cta">
            Open Studio
          </Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Practice tool for musicians</p>
            <h1>Take the drums out. Keep the groove.</h1>
            <p className="lede">
              Drumless separates the drum stem from any track, detects the tempo,
              and builds a click track that locks to the song&rsquo;s feel &mdash; so
              you can practice on your own terms.
            </p>
            <div className="hero-actions">
              <Link to="/studio" className="button primary large">
                Open Studio
                <ArrowIcon className="button-icon" />
              </Link>
              <a href="#how" className="button subtle large">
                See how it works
              </a>
            </div>
            <ul className="hero-points">
              <li>
                <CheckIcon className="point-icon" /> Editable BPM with a detected
                first beat
              </li>
              <li>
                <CheckIcon className="point-icon" /> WAV and MP3 downloads
              </li>
              <li>
                <CheckIcon className="point-icon" /> YouTube link or local file
              </li>
            </ul>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="studio-card">
              <div className="studio-card-head">
                <span className="studio-card-title">backing + click</span>
                <span className="studio-card-badge">128 BPM</span>
              </div>
              <div className="waveform">
                {WAVEFORM.map((height, index) => (
                  <span
                    key={index}
                    className="waveform-bar"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="studio-card-foot">
                <span className="studio-card-meta">4/4 &middot; first beat 0.42s</span>
                <span className="studio-card-play">
                  <span className="studio-card-play-dot" /> Preview
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="section-head">
            <p className="eyebrow">What it does</p>
            <h2>Everything between the track and your practice room</h2>
          </div>
          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="feature-card">
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="landing-section">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Three steps from song to session</h2>
          </div>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="step">
                <span className="step-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cta-band">
          <div className="cta-copy">
            <h2>Ready to play without the drums?</h2>
            <p>
              Open the studio, bring a track, and get a click that follows the
              song instead of fighting it.
            </p>
          </div>
          <Link to="/studio" className="button primary large">
            Open Studio
            <ArrowIcon className="button-icon" />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="brand" aria-label="Drumless home">
          <DrumIcon className="brand-mark" />
          <span>Drumless</span>
        </Link>
        <p>Separate the drums. Keep the feel.</p>
        <Link to="/studio" className="footer-link">
          <LinkIcon className="footer-link-icon" /> Open Studio
        </Link>
      </footer>
    </div>
  );
}
