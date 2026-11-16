# Contributing to Drumless

Thank you for considering contributing! Here are the guidelines:

## Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/Drumless.git`
3. Install dependencies: `pip install -r server/requirements.txt` and `cd frontend && npm install`
4. Run the backend: `./run.sh`
5. Run the frontend: `cd frontend && npm run dev`

## Coding Standards
- Follow existing code style in each language (Kotlin, Python, TypeScript)
- Write tests for new features when applicable
- Keep the Android UI matching the web app's visual design
- Update `server/requirements.txt` if adding new Python dependencies (no `audioop-lts` — use stdlib instead)

## Pull Request Process
1. Create a new branch from `main`
2. Make your changes
3. Run `npm run build` (frontend) and `./gradlew assembleDebug` (Android)
4. Ensure all tests pass
5. Submit PR with a clear description of changes

## Reporting Bugs
- Use the issue template below
- Include Drumless version, OS, and steps to reproduce
- Mention if using YouTube URL or local file

## License
This project is licensed under the MIT License.