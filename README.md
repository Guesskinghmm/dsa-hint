# AlgoPush — DSA Hint Assistant

A Manifest V3 Chrome Extension providing AI-powered progressive hints and similar practice problems for competitive programming and data structure problems across **LeetCode**, **Codeforces**, **HackerRank**, and **CodeChef**. Powered directly by Google Gemini via a Bring Your Own Key (BYOK) architecture.

---

## Features

- **Multi-Platform Support**: Works on LeetCode (`LC`), Codeforces (`CF`), HackerRank (`HR`), and CodeChef (`CC`) problem pages.
- **3-Level Progressive Hints**:
  - **Level 1 (Nudge)**: Subtle conceptual nudge; points you in the right direction without spoilers.
  - **Level 2 (Approach)**: Algorithmic explanation, pseudocode, and time/space complexity analysis, building on Level 1.
  - **Level 3 (Near-Solution)**: Near-complete solution with key logic and syntax tailored to your chosen language, building on Levels 1 and 2.
- **Language Detection**: Automatically detects your programming language from the platform's editor/UI and customizes hints and snippets to match.
- **Similar Problem Discovery**: Recommends related practice problems across supported platforms based on algorithmic topics.
- **Local History**: Saves unlocked hints locally with timestamps, problem names, platforms, and snippet previews for offline review.
- **Bring Your Own Key (BYOK)**: Direct communication with the official Google Gemini API using the secure `x-goog-api-key` header. No third-party proxy server.

---

## Supported URL Patterns

AlgoPush restricts permissions strictly to problem statement pages:

| Platform | Supported URL Patterns | Badge |
| :--- | :--- | :---: |
| **LeetCode** | `https://leetcode.com/problems/*` | `LC` |
| **Codeforces** | `https://codeforces.com/problemset/problem/*`<br>`https://codeforces.com/contest/*/problem/*`<br>`https://codeforces.com/gym/*/problem/*` | `CF` |
| **HackerRank** | `https://www.hackerrank.com/challenges/*`<br>`https://www.hackerrank.com/contests/*/challenges/*` | `HR` |
| **CodeChef** | `https://www.codechef.com/problems/*`<br>`https://www.codechef.com/*/problems/*` | `CC` |

---

## Architecture, Privacy & Data Flow

### What "Frontend-Only" Means
AlgoPush runs completely within your browser without an intermediary application server or middleman proxy. 

**Data Flow Disclosure**:
"Frontend-only" does **not** mean data never leaves your computer. When you request a hint or ask for similar problems:
1. The extension extracts the problem title, problem statement snippet (bounded to 3,000 characters), sample test cases (bounded to 1,500 characters), and detected programming language from your active browser tab.
2. The extension sends this prompt directly over HTTPS to Google's official Gemini REST API (`https://generativelanguage.googleapis.com`).
3. Google processes the prompt according to the terms of your Google AI Studio account.

### Local API Key Storage & Limitations
- Your Gemini API key is stored locally in `chrome.storage.local`.
- The key is sent to Google's API strictly via the `x-goog-api-key` HTTP header, preventing credentials from leaking into URLs, browser history, or network proxy query-string logs.
- **Security Note**: Data in `chrome.storage.local` is stored unencrypted on your local file system within your Chrome profile. Anyone with physical or administrator access to your machine or browser profile can view this storage. Always configure usage limits and quotas on your key at [Google AI Studio](https://aistudio.google.com/apikey).

### Rendering Security & Protection Against Prompt Injection
Because AI-generated responses are untrusted input, AlgoPush implements defensive rendering safeguards:
- **Markdown Sanitization**: Markdown rendered with `marked` is processed through a strict DOM-based HTML sanitizer (`sanitizeHtml()`). This sanitizer whitelists safe tags (`<p>`, `<code>`, `<pre>`, `<strong>`, etc.) and strips scripts, stylesheets, iframes, objects, SVGs, and inline event handlers (`onclick`, `onerror`).
- **Safe DOM Construction for Recommendations**: Similar-problem recommendation lists are created exclusively using DOM APIs (`document.createElement`, `textContent`) without dynamic `innerHTML` string interpolation.
- **Strict URL Whitelisting**: Problem recommendation links are validated using `isValidProblemUrl()`. Only HTTPS links to approved hostnames (`leetcode.com`, `codeforces.com`, `hackerrank.com`, `codechef.com`) are rendered as clickable links, and are always assigned `rel="noopener noreferrer"` and `target="_blank"`. Non-whitelisted or malformed URLs render as plain text.

---

## Quick Start

### 1. Load the Chrome Extension

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the upper right corner.
4. Click **Load unpacked** and select the `dsa-hint-main` folder.

### 2. Configure Your Gemini API Key

1. Generate a free API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Click the **AlgoPush** extension icon in your browser toolbar.
3. Open the **Settings** tab.
4. Paste your API key and click **Save**.
5. Click **Test Key** to verify connectivity with Gemini.

### 3. Usage

1. Open any supported problem on LeetCode, Codeforces, HackerRank, or CodeChef.
2. Click the **AlgoPush** extension icon.
3. Click **Get Hint** to unlock a Level 1 nudge.
4. Click **Level 2** and **Level 3** as needed for progressive hints that build on earlier context.
5. Click **Similar** to discover related practice problems.
6. Open the **History** tab to review previous hints anytime.

---

## Project Structure

```
dsa-hint-main/
├── manifest.json              # Chrome extension manifest v3
├── popup.html                 # Extension popup markup (Hints, History, Settings)
├── popup.css                  # Extension styling & platform themes (LC, CF, HR, CC)
├── popup.js                   # UI controller, Gemini API calls, sanitizer & history
├── content.js                 # DOM scraper for LeetCode, Codeforces, HackerRank, CodeChef
├── background.js              # Service worker lifecycle handler
├── marked.min.js              # Markdown parser
├── package.json               # Development test scripts
├── tests/                     # Automated unit test suite (Node test runner)
│   ├── platform-detection.test.js
│   ├── url-validation.test.js
│   ├── hints-context.test.js
│   ├── sanitizer.test.js
│   ├── scraper-normalization.test.js
│   └── similar-problems-dom.test.js
└── .gitignore                 # Secrets and build artifact exclusions
```

---

## Development & Quality Checks

Run the automated test suite and manifest/syntax validation checks:

```bash
# Run syntax checks and manifest validation
npm run check

# Run all automated unit tests
npm test
```
