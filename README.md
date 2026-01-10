<div align="center">
  <img src="Images/ic_launcher-playstore.png" alt="Music Aura logo" width="200" />
  <h1>Music Aura</h1>
</div>

[![Release](https://img.shields.io/github/v/release/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura/releases) [![License](https://img.shields.io/github/license/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura/blob/main/LICENSE)

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/Ranthu-Sai/Music-Aura/releases)  [![Platform](https://img.shields.io/badge/platform-React_Native-61B21E)](https://github.com/Ranthu-Sai/Music-Aura)  [![Node](https://img.shields.io/badge/node-%3E=_18-brightgreen)](https://nodejs.org/)

[![Stars](https://img.shields.io/github/stars/Ranthu-Sai/Music-Aura?style=social)](https://github.com/Ranthu-Sai/Music-Aura/stargazers)  [![Forks](https://img.shields.io/github/forks/Ranthu-Sai/Music-Aura?style=social)](https://github.com/Ranthu-Sai/Music-Aura/network/members)  [![Issues](https://img.shields.io/github/issues/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura/issues)  [![Contributors](https://img.shields.io/github/contributors/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura/graphs/contributors)

[![Dependabot Status](https://img.shields.io/dependabot/gh/Ranthu-Sai/Music-Aura?path=package.json)](https://github.com/Ranthu-Sai/Music-Aura/security/dependabot)  [![Last Commit](https://img.shields.io/github/last-commit/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura/commits/main)  [![Repo Size](https://img.shields.io/github/repo-size/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura)  [![Top Language](https://img.shields.io/github/languages/top/Ranthu-Sai/Music-Aura)](https://github.com/Ranthu-Sai/Music-Aura)

[![Tests](https://img.shields.io/badge/tests-Jest-blue)](https://github.com/Ranthu-Sai/Music-Aura/actions)  [![Vulnerabilities](https://snyk.io/test/github/Ranthu-Sai/Music-Aura/badge.svg)](https://snyk.io/test/github/Ranthu-Sai/Music-Aura)

A polished, open‑source React Native music player with an emphasis on offline playback, local library integration, and a clean, modern UI.

---

## ✅ Key Highlights

- **Ad‑free music player** with background playback and queue management
- Offline support: download songs, manage local files, and scan device storage
- Multiple sources supported as well as local files
- **Theming & accessibility** with light/dark modes and responsive layout
- **Caching**, **lyrics**, and **recommendations** for a smoother UX
- Built with: **React Native**, **react-native-track-player**, **reanimated**, **Firebase Analytics**

---

## Table of Contents

1. [About](#about)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Getting Started (Dev)](#getting-started-dev)
   - [Prerequisites](#prerequisites)
   - [Install & Run](#install--run)
   - [Build (release)](#build-release)
6. [Testing & Linting](#testing--linting)
7. [Contributing](#contributing)
8. [Roadmap & Issues](#roadmap--issues)
9. [License & Legal](#license--legal)
10. [Maintainers & Contact](#maintainers--contact)

---

<a id="about"></a>
## About

Music Aura is a full‑featured React Native music player focused on providing a smooth listening experience with strong offline capabilities. The app integrates multiple third‑party music sources and maintains a local music library scanner, download manager, and a robust playback queue.

This repository contains the app code (Android / iOS), utilities for caching and downloads, and components for playlists, search, and the player UI.

---

<a id="features"></a>
## Features

- Playback: background audio, play / pause, seek, skip, queue, and repeat modes 🔊
- Download manager: save songs to the device and manage the download path 💾
- Local library scan: automatically detects and indexes music files on the device 📁
- Multi‑source search: Multple sources integrations 🔎
- Playlist support: create, like, and manage playlists ❤️
- Lyrics caching and metadata enhancement for richer UI 🎵
- Theming: **light** and **dark** with adaptive sizes and fonts 🎨
- Analytics: optional Firebase **Analytics** hooks for anonymous usage stats 📈
- Robust caching and prefetch strategies for offline resilience 🗄️

---

<a id="tech-stack"></a>
## Tech Stack

- React Native (>= 0.73)
- react-native-track-player (audio playback)
- react-native-reanimated (animations)
- @react-navigation (routing)
- AsyncStorage + local files (persisted settings & downloads)
- Axios (API requests)
- Firebase (analytics)

See `package.json` for complete dependencies and versions.

---

<a id="project-structure"></a>
## Project structure (short)

- `Api/` – adapters for other service APIs
- `Component/` – UI components (Player, Playlist, Search, Library)
- `Context/` – global app state (player state, theme, queue)
- `Utils/` – helper modules (DownloadHelper, CacheManager, LRU cache)
- `LocalStorage/` – persisted app settings and user data
- `hooks/` – reusable hooks (device library, song details)
- `Route/` – navigation routes and onboarding
- `Images/`, `Layout/`, `Design/` – assets and layout building blocks

---

<a id="getting-started-dev"></a>
## Getting Started (Dev)

### Prerequisites

- Node.js >= 18
- Yarn or npm
- Android Studio + Android SDK (for Android builds)
- Xcode (for iOS builds)
- Java JDK (for Android)

Optional but recommended: watchman and CocoaPods (`brew install cocoapods`) for iOS.

<a name="install--run"></a>
### Install & Run

1. Clone repository

```bash
# Replace <REPO_URL> with your repository URL (public or private)
git clone <REPO_URL>
cd Music-Aura
```

2. Install dependencies

```bash
npm install
# or
# yarn install
```

3. iOS only: install CocoaPods

```bash
cd ios && pod install && cd ..
```

4. Start Metro

```bash
npm run start
```

5. Run on device / emulator

```bash
npm run android    # Android
npm run ios        # iOS (macOS only)
```

Notes:
- For release builds on Android use `npm run build:release` (runs Gradle assembleRelease).
- App settings like download path are stored in AsyncStorage (`LocalStorage/AppSettings.js`).

---

## Build (release)

- Android: `npm run build:release` (or `cd android && ./gradlew assembleRelease`)
- iOS: use Xcode (archive + export) or `xcodebuild` tools

Tip: Use `react-native-bundle-visualizer` (`npm run bundle:visualize`) to inspect bundle size.

---

<a name="testing--linting"></a>
<a id="testing--linting"></a>
## Testing & Linting

- Run unit tests: `npm run test` (uses Jest)
- Lint: `npm run lint` (ESLint config included)

---

<a id="contributing"></a>
## Contributing

Thank you for considering contributing! A few simple guidelines:

1. Fork the repository and create a feature branch: `git checkout -b feature/your-feature`
2. Keep changes focused and add tests for new logic where appropriate
3. Run lint and tests locally before opening a PR
4. Open a pull request describing the change and motivation

We appreciate clear commit messages and single-purpose PRs. See the Issues tab to find beginner-friendly tasks.

---

<a name="roadmap--issues"></a>
<a id="roadmap--issues"></a>
## Roadmap & Issues

Check the repository Issues and Projects for planned items and features. If you want to request a feature or report a bug, please open an issue with clear reproduction steps.

---

<a name="license--legal"></a>
<a id="license--legal"></a>
## License & Legal

Music Aura is distributed under the **MIT License** — see `LICENSE` for details.

Important: This app integrates third‑party streaming sources and is intended for educational and personal use. Music Aura is not affiliated with any music service provider. Refer to the original repository’s legal notice and DMCA policy for more details.

---

<a name="maintainers--contact"></a>
<a id="maintainers--contact"></a>
## Maintainers & Contact

Maintained by the original author and community contributors. For serious issues or inquiries, open an issue or pull request on GitHub.

---

**Made with ❤️ by Sai Ranthu & the Music Aura community.**

Contributions, issues, and feedback are welcome — please open an issue or pull request on GitHub.
