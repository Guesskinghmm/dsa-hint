/**
 * popup.js — AlgoPush Chrome Extension
 *
 * BYOK architecture: calls Google Gemini REST API directly from the browser extension.
 * API key is sent securely via the `x-goog-api-key` HTTP header (not in URL query params).
 * No backend server required. API key stored locally in `chrome.storage.local`.
 */

// ── Gemini REST API Configuration ──
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── State ──
let currentProblem  = null;
let selectedLevel   = 1;
let completedLevels = new Set();
let sessionHints    = {};

// ── DOM Refs ──
const $ = (id) => (typeof document !== "undefined" && typeof document.getElementById === "function" ? document.getElementById(id) : null);
const problemCard      = $("problem-card");
const noProblem        = $("no-problem");
const problemTitle     = $("problem-title-text");
const problemDesc      = $("problem-desc");
const problemPlatform  = $("problem-platform");
const levelBadges      = $("level-badges");
const actionBtns       = $("action-btns");
const getHintBtn       = $("get-hint-btn");
const nextHintBtn      = $("next-hint-btn");
const similarBtn       = $("similar-btn");
const loader           = $("loader");
const loaderText       = $("loader-text");
const outputBox        = $("output-box");
const outputText       = $("output-text");
const outputTag        = $("output-tag");
const copyBtn          = $("copy-btn");
const errorBox         = $("error-box");
const errorTitle       = $("error-title");
const errorMessage     = $("error-message");
const similarEmpty     = $("similar-empty");
const statusDot        = $("status-dot");
const apiKeyInput      = $("api-key-input");
const saveKeyBtn       = $("save-key-btn");
const keyStatus        = $("key-status");
const historyContainer = $("history-container");
const historyEmpty     = $("history-empty");
const clearHistoryBtn  = $("clear-history-btn");
const apiConnStatus    = $("api-conn-status");
const testConnBtn      = $("test-conn-btn");

// ── Approved Problem Hosts for Link Safety ──
const ALLOWED_PROBLEM_HOSTS = new Set([
  "leetcode.com",
  "www.leetcode.com",
  "codeforces.com",
  "www.codeforces.com",
  "hackerrank.com",
  "www.hackerrank.com",
  "codechef.com",
  "www.codechef.com"
]);

function isValidProblemUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_PROBLEM_HOSTS.has(hostname);
  } catch (e) {
    return false;
  }
}

// ── Platform Detection Helper ──
function parsePlatformFromUrl(url) {
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (host.includes("leetcode.com")) {
      if (pathname.includes("/problems/")) {
        return { platform: "leetcode", badge: "LC", theme: "leetcode" };
      }
    } else if (host.includes("codeforces.com")) {
      if (
        pathname.includes("/problemset/problem/") ||
        pathname.includes("/problemset/") ||
        pathname.includes("/contest/") ||
        pathname.includes("/gym/")
      ) {
        return { platform: "codeforces", badge: "CF", theme: "codeforces" };
      }
    } else if (host.includes("hackerrank.com")) {
      if (
        pathname.includes("/challenges/") ||
        pathname.includes("/contests/")
      ) {
        return { platform: "hackerrank", badge: "HR", theme: "hackerrank" };
      }
    } else if (host.includes("codechef.com")) {
      if (pathname.includes("/problems/")) {
        return { platform: "codechef", badge: "CC", theme: "codechef" };
      }
    }
  } catch (e) {
    return null;
  }

  return null;
}

// ── HTML Sanitizer for AI-generated Markdown ──
function sanitizeHtml(rawHtml) {
  if (typeof DOMParser === "undefined") return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml || "", "text/html");

  const ALLOWED_TAGS = new Set([
    "P", "BR", "STRONG", "EM", "B", "I", "U", "CODE", "PRE",
    "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
    "BLOCKQUOTE", "HR", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
    "SPAN", "A"
  ]);

  const ALLOWED_ATTRS = {
    "A": ["href", "title", "target", "rel"],
    "CODE": ["class"],
    "SPAN": ["class"],
    "TH": ["align"],
    "TD": ["align"]
  };

  const FORBIDDEN_ELEMENTS = new Set([
    "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH",
    "FORM", "INPUT", "BUTTON", "LINK", "META"
  ]);

  function sanitizeNode(node) {
    if (!node) return;

    if (node.nodeType === 3) {
      // Text node is safe
      return;
    }

    if (node.nodeType === 1) {
      const tag = node.tagName.toUpperCase();

      if (FORBIDDEN_ELEMENTS.has(tag)) {
        node.remove();
        return;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        const textNode = doc.createTextNode(node.textContent || "");
        node.replaceWith(textNode);
        return;
      }

      const allowedForTag = ALLOWED_ATTRS[tag] || [];
      const attrs = Array.from(node.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith("on") || !allowedForTag.includes(attrName)) {
          node.removeAttribute(attr.name);
          continue;
        }

        if (attrName === "href") {
          const val = attr.value.trim().toLowerCase();
          if (!val.startsWith("https://") && !val.startsWith("http://") && !val.startsWith("#")) {
            node.removeAttribute(attr.name);
          }
        }
      }

      if (tag === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }

      const children = Array.from(node.childNodes);
      for (const child of children) {
        sanitizeNode(child);
      }
    } else {
      node.remove();
    }
  }

  Array.from(doc.body.childNodes).forEach(sanitizeNode);
  return doc.body.innerHTML;
}

// ── UI Helpers ──
function showLoader(msg = "Thinking…") {
  if (loaderText) loaderText.textContent = msg;
  if (loader) loader.classList.add("visible");
  hideOutput();
  hideError();
  if (getHintBtn) getHintBtn.disabled = true;
  if (nextHintBtn) nextHintBtn.disabled = true;
  if (similarBtn) similarBtn.disabled = true;
}

function hideLoader() {
  if (loader) loader.classList.remove("visible");
  if (getHintBtn) getHintBtn.disabled = false;
  if (nextHintBtn) nextHintBtn.disabled = false;
  if (similarBtn) similarBtn.disabled = false;
}

function hideOutput() {
  if (outputBox) outputBox.classList.remove("visible");
}

function hideError() {
  if (errorBox) errorBox.style.display = "none";
}

function hideSimilarEmpty() {
  if (similarEmpty) similarEmpty.style.display = "none";
}

function showError(title, message) {
  hideLoader();
  hideOutput();
  if (errorTitle) errorTitle.textContent = title;
  if (errorMessage) errorMessage.textContent = message;
  if (errorBox) errorBox.style.display = "flex";
}

function updateLevelBadges() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".level-badge").forEach((badge) => {
    const level = parseInt(badge.dataset.level, 10);
    badge.classList.remove("active", "completed");
    if (completedLevels.has(level)) badge.classList.add("completed");
    if (level === selectedLevel) badge.classList.add("active");
  });
}

function renderMarkdown(text) {
  if (typeof marked !== "undefined" && typeof marked.parse === "function") {
    const parsed = marked.parse(text || "");
    return sanitizeHtml(parsed);
  }
  const escaped = (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return sanitizeHtml(escaped);
}

function setOutput(htmlOrElement, tag) {
  hideError();
  hideSimilarEmpty();
  if (outputTag) outputTag.textContent = tag;
  if (outputText) {
    if (typeof htmlOrElement === "string") {
      outputText.innerHTML = htmlOrElement;
    } else if (htmlOrElement instanceof Node) {
      outputText.innerHTML = "";
      outputText.appendChild(htmlOrElement);
    }
  }
  if (outputBox) outputBox.classList.add("visible");
  hideLoader();
}

function getPreviousHints(currentLevel, hintsStore = sessionHints) {
  const hints = [];
  for (let i = 1; i < currentLevel; i++) {
    if (hintsStore[i]) hints.push(hintsStore[i]);
  }
  return hints;
}

// ── Storage Helpers ──
function getStoredKey() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get("gemini_api_key", (data) => {
      resolve(data.gemini_api_key || null);
    });
  });
}

// ── Local History ──
const HISTORY_KEY = "dsa_local_history";
const MAX_HISTORY = 50;

function saveHintToHistory(problem, level, content) {
  if (typeof chrome === "undefined" || !chrome.storage?.local || !problem) return;
  chrome.storage.local.get(HISTORY_KEY, (data) => {
    const history = data[HISTORY_KEY] || [];
    history.unshift({
      date: new Date().toISOString(),
      title: problem.title || "Unknown Problem",
      platform: problem.platform || "",
      level,
      content: (content || "").slice(0, 500),
    });
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
    chrome.storage.local.set({ [HISTORY_KEY]: history });
  });
}

function loadLocalHistory() {
  if (!historyContainer) return;
  historyContainer.innerHTML = "";
  const loadingTr = document.createElement("tr");
  const loadingTd = document.createElement("td");
  loadingTd.colSpan = 4;
  loadingTd.style.textAlign = "center";
  loadingTd.style.padding = "16px";
  loadingTd.style.color = "var(--text-faint)";
  loadingTd.textContent = "Loading…";
  loadingTr.appendChild(loadingTd);
  historyContainer.appendChild(loadingTr);

  if (historyEmpty) historyEmpty.style.display = "none";

  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    historyContainer.innerHTML = "";
    if (historyEmpty) historyEmpty.style.display = "block";
    return;
  }

  chrome.storage.local.get(HISTORY_KEY, (data) => {
    const history = data[HISTORY_KEY] || [];
    historyContainer.innerHTML = "";

    if (history.length === 0) {
      if (historyEmpty) historyEmpty.style.display = "block";
      return;
    }

    history.forEach((item) => {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.className = "history-date";
      tdDate.textContent = item.date ? new Date(item.date).toLocaleDateString() : "-";
      tr.appendChild(tdDate);

      const tdTitle = document.createElement("td");
      tdTitle.className = "history-prob";
      tdTitle.title = item.title || "Unknown";
      tdTitle.textContent = item.title || "Unknown";
      tr.appendChild(tdTitle);

      const tdLvl = document.createElement("td");
      const lvlSpan = document.createElement("span");
      lvlSpan.className = "history-lvl";
      lvlSpan.textContent = `L${item.level || 1}`;
      tdLvl.appendChild(lvlSpan);
      tr.appendChild(tdLvl);

      const tdSnippet = document.createElement("td");
      const snippetDiv = document.createElement("div");
      snippetDiv.className = "history-snippet";
      const cleanSnippet = (item.content || "").replace(/#/g, "").slice(0, 120);
      snippetDiv.textContent = cleanSnippet ? `${cleanSnippet}…` : "No snippet";
      tdSnippet.appendChild(snippetDiv);
      tr.appendChild(tdSnippet);

      historyContainer.appendChild(tr);
    });
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.remove(HISTORY_KEY, () => {
        loadLocalHistory();
      });
    }
  });
}

// ── Theme Toggle ──
(function () {
  if (typeof document === "undefined" || !document.documentElement) return;
  const root = document.documentElement;
  const toggleBtn = $("theme-toggle");
  const knob = $("theme-knob");
  if (!toggleBtn) return;

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (knob) knob.textContent = theme === "light" ? "☀️" : "🌙";
    try { localStorage.setItem("cma-theme", theme); } catch (e) {}
  }

  let saved = "dark";
  try { saved = localStorage.getItem("cma-theme") || "dark"; } catch (e) {}
  applyTheme(saved);

  toggleBtn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(current);
  });
})();

// ── Tabs ──
if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = $(`tab-${tab.dataset.tab}`);
      if (panel) panel.classList.add("active");
      if (tab.dataset.tab === "history") {
        loadLocalHistory();
      }
    });
  });
}

// ── Save API Key ──
if (saveKeyBtn) {
  saveKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput?.value.trim();
    if (!key) {
      if (keyStatus) keyStatus.textContent = "Enter a key first.";
      return;
    }
    chrome.storage.local.set({ gemini_api_key: key }, () => {
      if (keyStatus) {
        keyStatus.textContent = "✓ Key saved";
        keyStatus.className = "key-status ok";
      }
      if (apiKeyInput) apiKeyInput.value = "";
      setTimeout(() => {
        if (keyStatus) keyStatus.textContent = `Key stored ✓ (${key.slice(0, 6)}…)`;
      }, 1200);
    });
  });
}

async function loadKeyStatus() {
  const key = await getStoredKey();
  if (!keyStatus) return;
  if (key) {
    keyStatus.textContent = `Key stored ✓ (${key.slice(0, 6)}…)`;
    keyStatus.className = "key-status ok";
  } else {
    keyStatus.textContent = "No key stored";
    keyStatus.className = "key-status";
  }
}

// ── Test API Connection ──
async function testApiConnection() {
  const key = await getStoredKey();
  if (!apiConnStatus) return;

  if (!key) {
    apiConnStatus.textContent = "No API key stored.";
    apiConnStatus.className = "key-status";
    return;
  }

  apiConnStatus.textContent = "Testing…";
  apiConnStatus.className = "key-status";

  try {
    const cleanKey = key.trim().replace(/['"]+/g, '');
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with just: ok" }] }]
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      apiConnStatus.textContent = text
        ? "✓ Connection successful"
        : "✓ Connected (empty response)";
      apiConnStatus.className = "key-status ok";
    } else {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${res.status}`;
      apiConnStatus.textContent = `✗ ${msg}`;
      apiConnStatus.className = "key-status error";
    }
  } catch (e) {
    apiConnStatus.textContent = `✗ ${e.message}`;
    apiConnStatus.className = "key-status error";
  }
}

if (testConnBtn) testConnBtn.addEventListener("click", testApiConnection);

// ── Prompt Builder ──
function buildHintPrompt(problem, level, previousHints) {
  const levelConfig = {
    1: {
      label: "Level 1 — Nudge",
      instruction:
        "Give a very subtle nudge. No code. Just point the user toward the right mental model or data structure in 2-3 sentences. Be Socratic.",
    },
    2: {
      label: "Level 2 — Approach",
      instruction:
        "Describe the algorithmic approach clearly. You may use pseudocode. Explain the time/space complexity. Still don't give away the exact implementation.",
    },
    3: {
      label: "Level 3 — Near-Solution",
      instruction:
        "Provide a near-complete solution. Include working pseudocode or code snippets with key logic. Explain each step.",
    },
  };

  const cfg = levelConfig[level] || levelConfig[1];
  let prompt = `You are a DSA mentor helping a student solve a programming problem.\n\n`;
  prompt += `Problem Title: ${problem.title || "Unknown"}\n`;
  prompt += `Platform: ${problem.platform || "unknown"}\n`;
  if (problem.description) {
    prompt += `\nProblem Statement:\n${problem.description.slice(0, 2000)}\n`;
  }
  if (problem.examples) {
    prompt += `\nExamples:\n${problem.examples.slice(0, 800)}\n`;
  }
  if (problem.language) {
    prompt += `\nCRITICAL: The user is writing code in ${problem.language}. Ensure any code snippets provided are strictly in ${problem.language}.\n`;
  }

  if (previousHints && previousHints.length > 0) {
    prompt += `\nPrevious hints already given to the student in this session (do NOT repeat these):\n`;
    previousHints.forEach((h, i) => {
      prompt += `--- Hint Level ${i + 1} ---\n${h.slice(0, 600)}\n`;
    });
    prompt += `\nNow provide the next level hint that progressively builds upon the previous hints above.\n`;
  }

  prompt += `\nTask: ${cfg.label}\nInstruction: ${cfg.instruction}\n`;
  prompt += `\nCRITICAL FORMATTING RULES:
1. Format your response in clear markdown. Be concise and educational.
2. DO NOT use LaTeX formatting (like $O(N)$ or $\\mathcal{O}(N)$) for mathematical expressions. You MUST use plain text like O(N) or standard markdown code blocks.`;
  return prompt;
}

// ── Gemini Hint Generation ──
async function getHints() {
  if (!currentProblem) return;

  const key = await getStoredKey();
  if (!key) {
    showError(
      "No API Key",
      "Go to Settings → paste your Gemini API key and click Save."
    );
    return;
  }

  showLoader("Generating hint…");

  const previousHints = getPreviousHints(selectedLevel);
  const prompt = buildHintPrompt(currentProblem, selectedLevel, previousHints);

  try {
    const cleanKey = key.trim().replace(/['"]+/g, '');
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${response.status}`;
      if (response.status === 429) {
        showError("Quota Reached", "Gemini API quota exceeded. Wait a moment or check your plan.");
      } else if (response.status === 400 || response.status === 403) {
        showError("Authentication Error", "Your API key may be invalid or unauthorized. Check Settings.");
      } else {
        showError("API Error", msg);
      }
      return;
    }

    const data = await response.json();
    const fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!fullText) {
      showError("Empty Response", "Gemini returned an empty response. Please try again.");
      return;
    }

    // Persist verified hint in progressive context session
    sessionHints[selectedLevel] = fullText;

    // Save to local history
    saveHintToHistory(currentProblem, selectedLevel, fullText);

    // Update Output
    if (outputTag) outputTag.textContent = `HINT · LEVEL ${selectedLevel}`;
    if (outputText) {
      outputText.innerHTML = renderMarkdown(fullText);
    }
    if (outputBox) outputBox.classList.add("visible");
    hideLoader();
    hideError();
    hideSimilarEmpty();

    // Update Badges & Action Buttons
    completedLevels.add(selectedLevel);
    updateLevelBadges();

    if (getHintBtn) getHintBtn.style.display = "none";
    if (nextHintBtn) {
      if (selectedLevel < 3) {
        nextHintBtn.style.display = "flex";
        nextHintBtn.disabled = false;
        nextHintBtn.textContent = `Level ${selectedLevel + 1}`;
      } else {
        nextHintBtn.style.display = "none";
      }
    }
  } catch (err) {
    hideLoader();
    showError("Network Error", `Could not reach Gemini API: ${err.message}`);
  }
}

// ── Similar Problems (Safe DOM Construction) ──
function buildSimilarProblemsDOM(parsed) {
  const container = document.createElement("div");

  if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
    const topicsRow = document.createElement("div");
    topicsRow.style.marginBottom = "8px";

    const label = document.createElement("span");
    label.className = "section-label";
    label.style.margin = "0";
    label.style.display = "inline";
    label.textContent = "Topics: ";
    topicsRow.appendChild(label);

    parsed.topics.forEach((t) => {
      if (typeof t === "string" && t.trim()) {
        const badge = document.createElement("span");
        badge.className = "sim-badge";
        badge.style.marginRight = "3px";
        badge.textContent = t.trim();
        topicsRow.appendChild(badge);
      }
    });

    container.appendChild(topicsRow);
  }

  if (Array.isArray(parsed.problems) && parsed.problems.length > 0) {
    parsed.problems.forEach((p) => {
      const item = document.createElement("div");
      item.className = "similar-item";

      const titleDiv = document.createElement("div");
      titleDiv.className = "similar-title";

      const titleText = (typeof p.title === "string" ? p.title.trim() : "Similar Problem");
      const url = typeof p.url === "string" ? p.url.trim() : "";

      if (isValidProblemUrl(url)) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${titleText} ↗`;
        titleDiv.appendChild(link);
      } else {
        const span = document.createElement("span");
        span.textContent = titleText;
        titleDiv.appendChild(span);
      }
      item.appendChild(titleDiv);

      const metaDiv = document.createElement("div");
      metaDiv.className = "similar-meta";

      if (p.difficulty && typeof p.difficulty === "string") {
        const diffBadge = document.createElement("span");
        let diffClass = "sim-badge";
        const diffLower = p.difficulty.toLowerCase();
        if (diffLower.includes("easy")) diffClass += " easy";
        else if (diffLower.includes("med")) diffClass += " medium";
        else if (diffLower.includes("hard")) diffClass += " hard";
        diffBadge.className = diffClass;
        diffBadge.textContent = p.difficulty.trim();
        metaDiv.appendChild(diffBadge);
      }

      if (Array.isArray(p.tags)) {
        p.tags.slice(0, 3).forEach((tag) => {
          if (typeof tag === "string" && tag.trim()) {
            const tagBadge = document.createElement("span");
            tagBadge.className = "sim-badge";
            tagBadge.textContent = tag.trim();
            metaDiv.appendChild(tagBadge);
          }
        });
      }

      item.appendChild(metaDiv);
      container.appendChild(item);
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No similar problems found.";
    container.appendChild(empty);
  }

  return container;
}

async function getSimilarProblems() {
  if (!currentProblem) return;

  const key = await getStoredKey();
  if (!key) {
    showError("No API Key", "Go to Settings → paste your Gemini API key and click Save.");
    return;
  }

  hideSimilarEmpty();
  showLoader("Finding similar problems…");

  const prompt = `You are a DSA problem recommender.

Problem: "${currentProblem.title}"
Platform: ${currentProblem.platform || "unknown"}
${currentProblem.description ? `Description (partial): ${currentProblem.description.slice(0, 800)}` : ""}

Identify the core algorithmic topics of this problem, then list 5 similar practice problems from LeetCode, Codeforces, HackerRank, or CodeChef.

Respond ONLY with a valid JSON object in this exact format (no markdown fences, no extra text):
{
  "topics": ["topic1", "topic2"],
  "problems": [
    { "title": "Problem Name", "difficulty": "Easy|Medium|Hard", "url": "https://leetcode.com/problems/...", "tags": ["tag1", "tag2"] }
  ]
}`;

  try {
    const cleanKey = key.trim().replace(/['"]+/g, '');
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${res.status}`;
      showError("API Error", msg);
      return;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e2) {
          showError("Parse Error", "Could not parse Gemini's recommendation format. Please try again.");
          return;
        }
      } else {
        showError("Parse Error", "Gemini returned an unexpected format. Try again.");
        return;
      }
    }

    const domOutput = buildSimilarProblemsDOM(parsed);
    setOutput(domOutput, "SIMILAR PROBLEMS");
  } catch (err) {
    showError("Network Error", `Could not reach Gemini API: ${err.message}`);
  }
}

// ── Platform Detection & Theming ──
async function detectProblem() {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return;

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";

  const detected = parsePlatformFromUrl(url);

  // Apply platform theme to DOM
  const root = document.documentElement;
  if (detected?.theme) {
    root.setAttribute("data-platform", detected.theme);
  } else {
    root.removeAttribute("data-platform");
  }

  if (!detected) {
    if (noProblem) noProblem.style.display = "flex";
    if (problemCard) problemCard.classList.remove("visible");
    if (actionBtns) actionBtns.style.display = "none";
    if (levelBadges) levelBadges.style.display = "none";
    if (similarEmpty) similarEmpty.style.display = "none";
    if (statusDot) {
      statusDot.classList.remove("active", "on-leetcode");
      statusDot.title = "Not on a supported page";
    }
    return;
  }

  if (statusDot) {
    statusDot.classList.add("active", "on-leetcode");
    statusDot.title = `Active on ${detected.platform}`;
  }

  try {
    const problem = await chrome.tabs.sendMessage(tab.id, { action: "getProblem" });
    if (problem?.title || problem?.description) {
      currentProblem = problem;
      currentProblem.platform = detected.platform;
      currentProblem.url = url;

      // Reset session for newly loaded problem
      sessionHints = {};
      completedLevels.clear();
      selectedLevel = 1;

      if (noProblem) noProblem.style.display = "none";
      if (problemCard) problemCard.classList.add("visible");
      if (problemTitle) problemTitle.textContent = problem.title || "Untitled Problem";

      // Platform badge
      if (problemPlatform) {
        problemPlatform.textContent = detected.badge;
      }

      if (problemDesc) {
        problemDesc.textContent =
          (problem.description?.slice(0, 180) || "No description found.") +
          (problem.description?.length > 180 ? "…" : "");
      }

      if (actionBtns) actionBtns.style.display = "flex";
      if (getHintBtn) {
        getHintBtn.style.display = "flex";
        getHintBtn.disabled = false;
      }
      if (nextHintBtn) nextHintBtn.style.display = "none";
      if (levelBadges) levelBadges.style.display = "flex";
      if (similarEmpty) similarEmpty.style.display = "block";
      updateLevelBadges();
    } else {
      if (noProblem) {
        noProblem.style.display = "flex";
        noProblem.querySelector("strong").textContent = "Couldn't extract problem";
        noProblem.querySelector("span").textContent = "Try refreshing the problem page.";
      }
    }
  } catch (e) {
    if (noProblem) {
      noProblem.style.display = "flex";
      noProblem.querySelector("strong").textContent = "Content script not ready";
      noProblem.querySelector("span").textContent = "Refresh the problem page and try again.";
    }
  }
}

// ── Copy Button ──
if (copyBtn) {
  copyBtn.addEventListener("click", () => {
    const text = outputText?.innerText || "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = "Copied";
        setTimeout(() => { if (copyBtn) copyBtn.textContent = "Copy"; }, 1500);
      });
    }
  });
}

// ── Event Listeners ──
if (getHintBtn) {
  getHintBtn.addEventListener("click", () => {
    selectedLevel = 1;
    completedLevels.clear();
    sessionHints = {};
    updateLevelBadges();
    getHints();
  });
}

if (nextHintBtn) {
  nextHintBtn.addEventListener("click", () => {
    if (selectedLevel < 3) {
      selectedLevel++;
      updateLevelBadges();
      getHints();
    }
  });
}

if (similarBtn) similarBtn.addEventListener("click", getSimilarProblems);

// ── Initialization ──
async function init() {
  detectProblem();
  loadKeyStatus();
  updateLevelBadges();
}

if (typeof document !== "undefined" && document.documentElement) {
  init();
}

// ── Export for Automated Unit Testing ──
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GEMINI_MODEL,
    GEMINI_URL,
    ALLOWED_PROBLEM_HOSTS,
    isValidProblemUrl,
    parsePlatformFromUrl,
    sanitizeHtml,
    buildHintPrompt,
    getPreviousHints,
    buildSimilarProblemsDOM,
  };
}
