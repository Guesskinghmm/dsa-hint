# AlgoPush — DSA Hint Assistant

A serverless Chrome Extension that provides AI-powered progressive hints for LeetCode and Codeforces problems. Powered by Google's Gemini 3.5 Flash directly from your browser.

## Features

- **Bring Your Own Key (BYOK)**: Connects directly to the Gemini REST API. **No backend server required.** Your API key is safely stored in `chrome.storage.local`.
- **3-Level Progressive Hints**: Nudge → Approach → Near-solution, each building on the previous.
- **Language Detection**: Automatically detects your programming language on LeetCode/Codeforces and tailors Level 3 code snippets to that language.
- **Similar Problem Discovery**: Automatically finds related problems from LeetCode or Codeforces based on the current problem's algorithmic topics.
- **Native Developer UI**: Clean, professional, flat aesthetic built for developers.

## Quick Start

### 1. Load the Chrome Extension

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the root folder.

### 2. Configure API Key

1. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Click the **AlgoPush** extension icon in your browser.
3. Go to the **Settings** tab.
4. Paste your API key and click **Save**. 
5. Click **Test Key** to ensure your connection is successful.

### 3. Use It

1. Navigate to any [LeetCode](https://leetcode.com/problems/) or [Codeforces](https://codeforces.com/problemset/) problem.
2. Click the AlgoPush extension icon.
3. Click **Get Hint** for a Level 1 nudge.
4. Click **Next Hint** for progressively detailed explanations.
5. Click **Similar** to find related practice problems.

## Architecture & Privacy

AlgoPush runs a **100% frontend-only architecture**. 
There is no middleman backend or proxy server. When you request a hint, the extension makes a direct `fetch()` call to `https://generativelanguage.googleapis.com` using your locally stored API key. Your code, problem data, and API key never touch a 3rd-party server.

## Project Structure

```
DSA_extension-main/
├── manifest.json          # Chrome extension manifest v3
├── popup.html/css/js      # Extension UI & Gemini API interaction logic
├── content.js             # Problem scraper (LeetCode, Codeforces language detection)
├── background.js          # Service worker
└── marked.min.js          # Lightweight markdown renderer
```