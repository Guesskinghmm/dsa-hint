/**
 * popup.js — AlgoPush Chrome Extension
 *
 * BYOK architecture: calls Google Gemini REST API directly from the extension.
 * API key is sent via the x-goog-api-key header. No OAuth or Authorization
 * headers are used.
 * No local backend server required. API key stored in chrome.storage.local.
 */

// ── Gemini REST API ──
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── State ──
let currentProblem  = null;
let selectedLevel   = 1;
let completedLevels = new Set();
let sessionHints    = {};

// ── Removed SVG Logos ──

// ── DOM Refs ──
const $ = (id) => document.getElementById(id);
const problemCard     = $("problem-card");
const noProblem       = $("no-problem");
const problemTitle    = $("problem-title-text");
const problemDesc     = $("problem-desc");
const problemPlatform = $("problem-platform");
const levelBadges     = $("level-badges");
const actionBtns      = $("action-btns");
const getHintBtn      = $("get-hint-btn");
const nextHintBtn     = $("next-hint-btn");
const similarBtn      = $("similar-btn");
const loader          = $("loader");
const loaderText      = $("loader-text");
const outputBox       = $("output-box");
const outputText      = $("output-text");
const outputTag       = $("output-tag");
const copyBtn         = $("copy-btn");
const errorBox        = $("error-box");
const errorTitle      = $("error-title");
const errorMessage    = $("error-message");
const similarEmpty    = $("similar-empty");
const requestCounter  = $("request-counter");
const statusDot       = $("status-dot");
const apiKeyInput     = $("api-key-input");
const saveKeyBtn      = $("save-key-btn");
const keyStatus       = $("key-status");
const historyContainer = $("history-container");
const historyEmpty    = $("history-empty");
const apiConnStatus   = $("api-conn-status");

// ── Utilities ──
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
  document.querySelectorAll(".level-badge").forEach((badge) => {
    const level = parseInt(badge.dataset.level);
    badge.classList.remove("active", "completed");
    if (completedLevels.has(level)) badge.classList.add("completed");
    if (level === selectedLevel) badge.classList.add("active");
  });
}

function renderMarkdown(text) {
  if (typeof marked !== "undefined") return marked.parse(text);
  return text.replace(/\n/g, "<br>");
}

function setOutput(html, tag) {
  hideError();
  hideSimilarEmpty();
  if (outputTag) outputTag.textContent = tag;
  if (outputText) outputText.innerHTML = html;
  if (outputBox) outputBox.classList.add("visible");
  hideLoader();
}

function getPreviousHints(currentLevel) {
  const hints = [];
  for (let i = 1; i < currentLevel; i++) {
    if (sessionHints[i]) hints.push(sessionHints[i]);
  }
  return hints;
}

// ── Storage Helpers ──
function getStoredKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get("gemini_api_key", (data) => {
      resolve(data.gemini_api_key || null);
    });
  });
}

// ── Local History Helpers ──
const HISTORY_KEY = "dsa_local_history";
const MAX_HISTORY = 50;

function saveHintToHistory(problem, level, content) {
  chrome.storage.local.get(HISTORY_KEY, (data) => {
    const history = data[HISTORY_KEY] || [];
    history.unshift({
      date: new Date().toISOString(),
      title: problem.title || "Unknown",
      platform: problem.platform || "",
      level,
      content: content.slice(0, 500),
    });
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
    chrome.storage.local.set({ [HISTORY_KEY]: history });
  });
}

function loadLocalHistory() {
  if (!historyContainer) return;
  historyContainer.innerHTML =
    '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-faint)">Loading…</td></tr>';
  if (historyEmpty) historyEmpty.style.display = "none";

  chrome.storage.local.get(HISTORY_KEY, (data) => {
    const history = data[HISTORY_KEY] || [];
    historyContainer.innerHTML = "";

    if (history.length === 0) {
      if (historyEmpty) historyEmpty.style.display = "block";
      return;
    }

    history.forEach((item) => {
      const dateStr = new Date(item.date).toLocaleDateString();
      const tr = document.createElement("tr");
      const snippet = (item.content || "").replace(/#/g, "").slice(0, 120) + "…";
      tr.innerHTML = `
        <td class="history-date">${dateStr}</td>
        <td class="history-prob" title="${item.title}">${item.title}</td>
        <td><span class="history-lvl">L${item.level}</span></td>
        <td><div class="history-snippet">${snippet}</div></td>
      `;
      historyContainer.appendChild(tr);
    });
  });
}

// ── Theme Toggle ──
(function () {
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
    const res = await fetch(`${GEMINI_URL}?key=${cleanKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with just: ok" }] }]
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      let text = data?.output_text || data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text && data?.steps) {
        try {
          const modelSteps = data.steps.filter(step => step.model_output);
          const lastStep = modelSteps[modelSteps.length - 1];
          text = lastStep.model_output.content.find(c => c.text).text || "";
        } catch (e) {
          text = "";
        }
      }
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

const testConnBtn = $("test-conn-btn");
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

  if (previousHints.length > 0) {
    prompt += `\nPrevious hints already given (do NOT repeat these):\n`;
    previousHints.forEach((h, i) => {
      prompt += `--- Hint ${i + 1} ---\n${h.slice(0, 400)}\n`;
    });
    prompt += `\nNow give the next level hint that builds on the above.\n`;
  }

  prompt += `\nTask: ${cfg.label}\nInstruction: ${cfg.instruction}\n`;
  prompt += `\nCRITICAL FORMATTING RULES:
1. Format your response in clear markdown. Be concise and educational.
2. DO NOT use LaTeX formatting (like $O(N)$ or $\\mathcal{O}(N)$) for mathematical expressions. You MUST use plain text like O(N) or standard markdown code blocks, otherwise the UI will break.`;
  return prompt;
}

// ── Gemini Streaming Hint ──
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

  const prompt = buildHintPrompt(currentProblem, selectedLevel, getPreviousHints(selectedLevel));

  try {
    const cleanKey = key.trim().replace(/['"]+/g, '');
    const response = await fetch(`${GEMINI_URL}?key=${cleanKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
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
      } else if (response.status === 400) {
        showError("Invalid Key", "Your API key may be invalid. Check Settings.");
      } else {
        showError("API Error", msg);
      }
      return;
    }

    // Interactions API: parse output_text directly (no SSE streaming)
    if (outputTag) outputTag.textContent = `HINT · LEVEL ${selectedLevel}`;
    if (outputText) outputText.innerHTML = "";
    if (outputBox) outputBox.classList.add("visible");
    hideLoader();
    hideError();
    hideSimilarEmpty();

    const data = await response.json();
    let fullText = data?.output_text || data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!fullText && data?.steps) {
      try {
        const modelSteps = data.steps.filter(step => step.model_output);
        const lastStep = modelSteps[modelSteps.length - 1];
        fullText = lastStep.model_output.content.find(c => c.text).text || "";
      } catch (e) {
        fullText = "";
      }
    }

    if (!fullText) {
      showError("Empty Response", "Gemini returned an empty response. Please try again.");
      return;
    }

    if (outputText) {
      outputText.innerHTML = renderMarkdown(fullText);
    }


    // Update UI
    completedLevels.add(selectedLevel);
    updateLevelBadges();

    if (getHintBtn) getHintBtn.style.display = "none";
    if (nextHintBtn) {
      if (selectedLevel < 3) {
        nextHintBtn.style.display = "flex";
        nextHintBtn.disabled = false;
        nextHintBtn.innerHTML = `Level ${selectedLevel + 1}`;
      } else {
        nextHintBtn.style.display = "none";
      }
    }
  } catch (err) {
    hideLoader();
    showError("Network Error", `Could not reach Gemini API: ${err.message}`);
  }
}

// ── Similar Problems (non-streaming) ──
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

Identify the core algorithmic topics of this problem, then list 5 similar practice problems from LeetCode or Codeforces.

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text, no LaTeX):
{
  "topics": ["topic1", "topic2"],
  "problems": [
    { "title": "Problem Name", "difficulty": "Easy|Medium|Hard or Rating (e.g. 1200)", "url": "https://leetcode.com/problems/...", "tags": ["tag1", "tag2"] }
  ]
}`;

  try {
    const cleanKey = key.trim().replace(/['"]+/g, '');
    const res = await fetch(`${GEMINI_URL}?key=${cleanKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${res.status}`;
      showError("API Error", msg);
      return;
    }

    const data = await res.json();
    let rawText = data?.output_text || data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!rawText && data?.steps) {
      try {
        const modelSteps = data.steps.filter(step => step.model_output);
        const lastStep = modelSteps[modelSteps.length - 1];
        rawText = lastStep.model_output.content.find(c => c.text).text || "";
      } catch (e) {
        rawText = "";
      }
    }

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: try to find JSON object in the text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (e2) {
          showError("Parse Error", "Could not parse Gemini's response. Please try again.");
          return;
        }
      } else {
        showError("Parse Error", "Gemini returned an unexpected format. Try again.");
        return;
      }
    }

    if (parsed.problems && parsed.problems.length > 0) {
      let html = "";

      if (parsed.topics?.length) {
        html += `<div style="margin-bottom:8px;">`;
        html += `<span class="section-label" style="margin:0;display:inline;">Topics: </span>`;
        parsed.topics.forEach((t) => {
          html += `<span class="sim-badge" style="margin-right:3px;">${t}</span>`;
        });
        html += `</div>`;
      }

      parsed.problems.forEach((p) => {
        let diffClass = "sim-badge";
        if (p.difficulty === "Easy") diffClass += " easy";
        else if (p.difficulty === "Medium") diffClass += " medium";
        else if (p.difficulty === "Hard") diffClass += " hard";

        html += `
          <div class="similar-item">
            <div class="similar-title">
              <a href="${p.url}" target="_blank">${p.title} ↗</a>
            </div>
            <div class="similar-meta">
              ${p.difficulty ? `<span class="${diffClass}">${p.difficulty}</span>` : ""}
              ${(p.tags || []).slice(0, 3).map((t) => `<span class="sim-badge">${t}</span>`).join("")}
            </div>
          </div>
        `;
      });

      setOutput(html, "SIMILAR PROBLEMS");
    } else {
      setOutput('<div class="empty-state">No similar problems found.</div>', "SIMILAR PROBLEMS");
    }
  } catch (err) {
    showError("Network Error", `Could not reach Gemini API: ${err.message}`);
  }
}

// ── Platform Detection & Theming ──
async function detectProblem() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";

  const isLeetCode = url.includes("leetcode.com/problems/");
  const isCodeforces =
    url.includes("codeforces.com/problemset/") ||
    url.includes("codeforces.com/contest/") ||
    url.includes("codeforces.com/gym/");

  // Apply platform theme
  const root = document.documentElement;
  if (isLeetCode) {
    root.setAttribute("data-platform", "leetcode");
  } else if (isCodeforces) {
    root.setAttribute("data-platform", "codeforces");
  } else {
    root.removeAttribute("data-platform");
  }

  if (!isLeetCode && !isCodeforces) {
    if (noProblem) noProblem.style.display = "flex";
    if (problemCard) problemCard.classList.remove("visible");
    if (actionBtns) actionBtns.style.display = "none";
    if (levelBadges) levelBadges.style.display = "none";
    if (similarEmpty) similarEmpty.style.display = "none";
    return;
  }

  if (statusDot) {
    statusDot.classList.add("on-leetcode");
    statusDot.title = "Active on supported page";
  }

  try {
    const problem = await chrome.tabs.sendMessage(tab.id, { action: "getProblem" });
    if (problem?.title || problem?.description) {
      currentProblem = problem;
      currentProblem.platform = isLeetCode ? "leetcode" : "codeforces";
      currentProblem.url = url;

      // Reset session for new problem
      sessionHints = {};
      completedLevels.clear();
      selectedLevel = 1;

      if (noProblem) noProblem.style.display = "none";
      if (problemCard) problemCard.classList.add("visible");
      if (problemTitle) problemTitle.textContent = problem.title || "Untitled Problem";

      // Inject platform text badge
      if (problemPlatform) {
        problemPlatform.textContent = isLeetCode ? "LC" : "CF";
      }

      if (problemDesc) {
        problemDesc.textContent =
          (problem.description?.slice(0, 180) || "No description found.") +
          (problem.description?.length > 180 ? "…" : "");
      }

      if (actionBtns) actionBtns.style.display = "flex";
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
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied";
      setTimeout(() => { if (copyBtn) copyBtn.textContent = "Copy"; }, 1500);
    });
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

// ── Init ──
async function init() {
  detectProblem();
  loadKeyStatus();
  updateLevelBadges();
}

init();