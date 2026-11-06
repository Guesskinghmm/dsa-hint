/**
 * content.js — Problem statement & metadata extractor for AlgoPush
 * Supports LeetCode, Codeforces, HackerRank, CodeChef, and generic fallbacks.
 */

const PLATFORMS = {
  "leetcode.com":    extractLeetCode,
  "codeforces.com":  extractCodeforces,
  "hackerrank.com":  extractHackerRank,
  "codechef.com":    extractCodeChef,
};

const COMMON_LANGUAGES = [
  "C++", "C++14", "C++17", "C++20", "Java", "Python", "Python3", "PyPy3",
  "C", "C#", "JavaScript", "TypeScript", "PHP", "Swift", "Kotlin", "Dart",
  "Go", "Ruby", "Scala", "Rust", "Racket", "Erlang", "Elixir", "Haskell"
];

function normalizeResult(title = "", description = "", examples = "", language = "") {
  return {
    title: (title || "").trim(),
    description: (description || "").slice(0, 3000).trim(),
    examples: (examples || "").slice(0, 1500).trim(),
    language: (language || "").trim(),
  };
}

function extractProblem() {
  const host = (typeof window !== "undefined" && window.location?.hostname) || "";
  for (const [domain, fn] of Object.entries(PLATFORMS)) {
    if (host.includes(domain)) return fn();
  }
  return extractGeneric();
}

function extractGeneric() {
  const title = extractTitle();
  const { description, examples } = extractMainContent();
  return normalizeResult(title, description, examples, "");
}

function extractTitle() {
  if (typeof document === "undefined") return "";
  return (
    document.querySelector('h1')?.innerText ||
    document.querySelector('h2')?.innerText ||
    document.querySelector('meta[property="og:title"]')?.content ||
    document.title ||
    ""
  ).trim();
}

function extractMainContent() {
  if (typeof document === "undefined") return { description: "", examples: "" };

  const semanticEl =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('section');

  const container = semanticEl || scoreDivs();

  if (!container) return { description: "", examples: "" };

  const description = container.innerText || "";

  const examples = [...container.querySelectorAll('pre, code, blockquote')]
    .map(el => el.innerText ? el.innerText.trim() : "")
    .filter(t => t.length > 0)
    .join('\n---\n');

  return { description, examples };
}

function scoreDivs() {
  if (typeof document === "undefined") return null;
  const candidates = [...document.querySelectorAll('div, section, td')];
  let best = null, bestScore = 0;

  for (const el of candidates) {
    if (el.offsetWidth < 200 || el.offsetHeight < 100) continue;
    if (/nav|header|footer|sidebar|menu|ad|cookie/i.test(
      (el.className || "") + " " + (el.id || "")
    )) continue;

    const text = el.innerText || "";
    const wordCount = text.trim().split(/\s+/).length;
    const htmlLen = el.innerHTML ? el.innerHTML.length : 0;
    if (htmlLen === 0) continue;

    const density = text.length / htmlLen;
    const score = wordCount * density;

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function findLanguageFromButtons() {
  if (typeof document === "undefined") return "";
  const buttons = [...document.querySelectorAll('button, [role="button"], span')];
  const found = buttons.find(b => {
    const txt = b.innerText ? b.innerText.trim() : "";
    return COMMON_LANGUAGES.includes(txt);
  });
  return found && found.innerText ? found.innerText.trim() : "";
}

function extractLeetCode() {
  if (typeof document === "undefined") return normalizeResult();

  const title =
    document.querySelector('div.text-title-large')?.innerText ||
    document.querySelector('[data-cy="question-title"]')?.innerText ||
    document.querySelector('h1')?.innerText ||
    extractTitle();

  const descEl =
    document.querySelector('[data-track-load="description_content"]') ||
    document.querySelector('.elfjS') ||
    document.querySelector('[class*="description__"]');

  const description = descEl?.innerText || extractMainContent().description;
  const examples = descEl
    ? [...descEl.querySelectorAll('pre')].map(e => e.innerText || "").join('\n---\n')
    : "";

  let language = "";
  const langBtn =
    document.querySelector('button[id^="headlessui-listbox-button"]') ||
    document.querySelector('[data-cy="lang-select"]');

  if (langBtn && langBtn.innerText) {
    language = langBtn.innerText.trim();
  } else {
    language = findLanguageFromButtons();
  }

  return normalizeResult(title, description, examples, language);
}

function extractCodeforces() {
  if (typeof document === "undefined") return normalizeResult();

  const title =
    document.querySelector('.problem-statement .title')?.innerText ||
    document.querySelector('h1')?.innerText ||
    extractTitle();

  const problemEl = document.querySelector('.problem-statement');
  const descEl = problemEl?.children?.[1] || problemEl;
  const description = descEl?.innerText || extractMainContent().description;

  const inputs  = [...document.querySelectorAll('.problem-statement .input pre')].map(e => e.innerText || "");
  const outputs = [...document.querySelectorAll('.problem-statement .output pre')].map(e => e.innerText || "");
  let examples = "";
  for (let counter = 0; counter < inputs.length; counter++) {
    examples += `Example ${counter + 1}:\nInput:\n${inputs[counter]}\nOutput:\n${outputs[counter]}\n\n`;
  }
  if (!examples && problemEl) {
    examples = [...problemEl.querySelectorAll('pre')].map(e => e.innerText || "").join('\n---\n');
  }

  let language = "";
  const select = document.querySelector('select[name="programTypeId"]');
  if (select && select.options && select.selectedIndex >= 0) {
    language = select.options[select.selectedIndex]?.text || "";
  } else {
    language = findLanguageFromButtons();
  }

  return normalizeResult(title, description, examples, language);
}

function extractHackerRank() {
  if (typeof document === "undefined") return normalizeResult();

  const title =
    document.querySelector('.challenge-page-label')?.innerText ||
    document.querySelector('h1.ui-heading')?.innerText ||
    document.querySelector('h1.hr_tour-challenge-name')?.innerText ||
    document.querySelector('h1.challenge-title')?.innerText ||
    document.querySelector('h1')?.innerText ||
    document.querySelector('.breadcrumb-item.active')?.innerText ||
    extractTitle();

  const descEl =
    document.querySelector('.challenge-body-html') ||
    document.querySelector('.challenge-body') ||
    document.querySelector('.problem-statement') ||
    document.querySelector('div[class*="challenge-body"]') ||
    document.querySelector('div[class*="problem-statement"]');

  const description = descEl?.innerText || extractMainContent().description;

  const examples = descEl
    ? [...descEl.querySelectorAll('pre')].map(e => e.innerText || "").filter(t => t.trim().length > 0).join('\n---\n')
    : "";

  let language = "";
  const langSelect =
    document.querySelector('select.select-language') ||
    document.querySelector('select[name="language"]') ||
    document.querySelector('[data-analytics="SelectLanguage"]');

  if (langSelect) {
    if (langSelect.tagName === 'SELECT' && langSelect.options && langSelect.selectedIndex >= 0) {
      language = langSelect.options[langSelect.selectedIndex]?.text || "";
    } else if (langSelect.innerText) {
      language = langSelect.innerText.trim();
    }
  }

  if (!language) {
    const langBtn = document.querySelector('.select-menu button') || document.querySelector('div.select-language');
    if (langBtn && langBtn.innerText) {
      language = langBtn.innerText.trim();
    }
  }

  if (!language) {
    language = findLanguageFromButtons();
  }

  return normalizeResult(title, description, examples, language);
}

function extractCodeChef() {
  if (typeof document === "undefined") return normalizeResult();

  const title =
    document.querySelector('.problem-name')?.innerText ||
    document.querySelector('h1.problem-title')?.innerText ||
    document.querySelector('div[class*="ProblemDescription_title"]')?.innerText ||
    document.querySelector('h1')?.innerText ||
    extractTitle();

  const descEl =
    document.querySelector('#problem-statement') ||
    document.querySelector('.problem-statement') ||
    document.querySelector('div[class*="ProblemDescription_statement"]') ||
    document.querySelector('div[class*="problem-statement"]');

  const description = descEl?.innerText || extractMainContent().description;

  const examples = descEl
    ? [...descEl.querySelectorAll('pre')].map(e => e.innerText || "").filter(t => t.trim().length > 0).join('\n---\n')
    : "";

  let language = "";
  const langElement =
    document.querySelector('button[id*="language-select"]') ||
    document.querySelector('div[class*="custom-select"]') ||
    document.querySelector('select[name="language"]') ||
    document.querySelector('#language-select');

  if (langElement) {
    if (langElement.tagName === 'SELECT' && langElement.options && langElement.selectedIndex >= 0) {
      language = langElement.options[langElement.selectedIndex]?.text || "";
    } else if (langElement.innerText) {
      language = langElement.innerText.trim();
    }
  }

  if (!language) {
    language = findLanguageFromButtons();
  }

  return normalizeResult(title, description, examples, language);
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "getProblem") {
      sendResponse(extractProblem());
    }
    return true;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLATFORMS,
    normalizeResult,
    extractProblem,
    extractGeneric,
    extractTitle,
    extractLeetCode,
    extractCodeforces,
    extractHackerRank,
    extractCodeChef,
    findLanguageFromButtons,
  };
}
