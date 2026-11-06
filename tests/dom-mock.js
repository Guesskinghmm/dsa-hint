class MockNode {
  constructor(type, name = '', value = '') {
    this.nodeType = type; // 1 = element, 3 = text
    this.tagName = name.toUpperCase();
    this.nodeValue = value;
    this.childNodes = [];
    this.attributes = [];
    this.style = {};
    this.parentNode = null;
  }

  get href() { return this.getAttribute('href'); }
  set href(val) { this.setAttribute('href', val); }
  get target() { return this.getAttribute('target'); }
  set target(val) { this.setAttribute('target', val); }
  get rel() { return this.getAttribute('rel'); }
  set rel(val) { this.setAttribute('rel', val); }
  get className() { return this.getAttribute('class') || ''; }
  set className(val) { this.setAttribute('class', val); }
  get title() { return this.getAttribute('title') || ''; }
  set title(val) { this.setAttribute('title', val); }

  get textContent() {
    if (this.nodeType === 3) return this.nodeValue;
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val) {
    if (this.nodeType === 3) {
      this.nodeValue = val;
    } else {
      const textNode = new MockNode(3, '', String(val));
      textNode.parentNode = this;
      this.childNodes = [textNode];
    }
  }

  get innerHTML() {
    return this.childNodes.map(c => {
      if (c.nodeType === 3) return c.nodeValue;
      const attrs = c.attributes.map(a => ` ${a.name}="${a.value}"`).join('');
      return `<${c.tagName.toLowerCase()}${attrs}>${c.innerHTML}</${c.tagName.toLowerCase()}>`;
    }).join('');
  }

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  setAttribute(name, value) {
    const existing = this.attributes.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.value = String(value);
    } else {
      this.attributes.push({ name: name.toLowerCase(), value: String(value) });
    }
  }

  getAttribute(name) {
    const found = this.attributes.find(a => a.name.toLowerCase() === name.toLowerCase());
    return found ? found.value : null;
  }

  removeAttribute(name) {
    this.attributes = this.attributes.filter(a => a.name.toLowerCase() !== name.toLowerCase());
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.childNodes = this.parentNode.childNodes.filter(c => c !== this);
      this.parentNode = null;
    }
  }

  replaceWith(newNode) {
    if (this.parentNode) {
      const idx = this.parentNode.childNodes.indexOf(this);
      if (idx !== -1) {
        newNode.parentNode = this.parentNode;
        this.parentNode.childNodes.splice(idx, 1, newNode);
        this.parentNode = null;
      }
    }
  }
}

function parseSimpleHTML(html) {
  const root = new MockNode(1, 'BODY');
  // Simple tokenization of tags and text for testing
  const tagRegex = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match;
  let current = root;

  while ((match = tagRegex.exec(html)) !== null) {
    const [full, tagName, attrString, text] = match;
    if (text) {
      const textNode = new MockNode(3, '', text);
      current.appendChild(textNode);
    } else if (tagName) {
      const isClosing = full.startsWith('</');
      const isSelfClosing = full.endsWith('/>') || ['BR', 'HR', 'IMG', 'INPUT'].includes(tagName.toUpperCase());

      if (isClosing) {
        if (current.parentNode) {
          current = current.parentNode;
        }
      } else {
        const el = new MockNode(1, tagName);
        if (attrString) {
          const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(attrString)) !== null) {
            el.setAttribute(attrMatch[1], attrMatch[2] !== undefined ? attrMatch[2] : '');
          }
        }
        current.appendChild(el);
        if (!isSelfClosing) {
          current = el;
        }
      }
    }
  }

  return {
    body: root,
    createTextNode: (txt) => new MockNode(3, '', txt),
    createElement: (tag) => new MockNode(1, tag),
  };
}

class MockDOMParser {
  parseFromString(str, type) {
    return parseSimpleHTML(str);
  }
}

module.exports = {
  MockNode,
  MockDOMParser,
  parseSimpleHTML,
};
