## [1.0.0] - 2026-11-16

### Added
- Initial release with drum separation via Demucs AI model, Auto BPM detection, Click track, YouTube URL and local audio file input, WAV & MP3 download options, Backing + Mixed tracks, BPM halve/double adjustment, Click volume control

### Changed
- GitHub Actions workflow: fixed YAML syntax error in release step (`github.compare()` → static text)

### Fixed
- Release workflow: resolved unexpected symbol error in `.github/workflows/release.yml`