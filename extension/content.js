(() => {
  if (window.__finderExtensionLoaded) return;
  window.__finderExtensionLoaded = true;

  const state = {
    searchText: "",
    replaceText: "",
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    showReplace: false,
    matches: [],
    activeIndex: 0,
    target: null,
    highlightDoc: null,
    lastSelectionText: "",
  };

  const root = document.createElement("div");
  root.id = "finder-ext-root";
  root.className = "finder-hidden";
  root.style.display = "none";

  const panel = document.createElement("div");
  panel.className = "finder-panel";

  const rowFind = document.createElement("div");
  rowFind.className = "finder-row";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "finder-toggle";
  toggleBtn.type = "button";
  toggleBtn.textContent = "▾";
  toggleBtn.addEventListener("click", () => {
    state.showReplace = !state.showReplace;
    toggleBtn.textContent = state.showReplace ? "▾" : "▸";
    rowReplace.classList.toggle("finder-hidden", !state.showReplace);
  });

  const findField = document.createElement("div");
  findField.className = "finder-field";

  const findInput = document.createElement("input");
  findInput.placeholder = "찾기";
  let isComposing = false;
  findInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  findInput.addEventListener("compositionend", () => {
    isComposing = false;
    state.searchText = findInput.value;
    refreshMatches();
  });
  findInput.addEventListener("input", () => {
    if (isComposing) return;
    state.searchText = findInput.value;
    refreshMatches();
  });
  findInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      gotoMatch(-1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      gotoMatch(1);
    }
  });

  const countSpan = document.createElement("span");
  countSpan.className = "finder-count";
  countSpan.textContent = "0/0";

  findField.append(findInput, countSpan);

  const rightGroup = document.createElement("div");
  rightGroup.className = "finder-right";

  const navGroup = document.createElement("div");
  navGroup.className = "finder-actions";

  const prevBtn = document.createElement("button");
  prevBtn.className = "finder-icon-btn";
  prevBtn.type = "button";
  prevBtn.textContent = "↑";
  prevBtn.addEventListener("click", () => gotoMatch(-1));

  const nextBtn = document.createElement("button");
  nextBtn.className = "finder-icon-btn";
  nextBtn.type = "button";
  nextBtn.textContent = "↓";
  nextBtn.addEventListener("click", () => gotoMatch(1));

  navGroup.append(prevBtn, nextBtn);

  const optionGroup = document.createElement("div");
  optionGroup.className = "finder-actions";

  const caseBtn = document.createElement("button");
  caseBtn.className = "finder-chip";
  caseBtn.type = "button";
  caseBtn.textContent = "Aa";
  caseBtn.addEventListener("click", () => {
    state.caseSensitive = !state.caseSensitive;
    caseBtn.classList.toggle("active", state.caseSensitive);
    caseBtn.classList.toggle("blue", state.caseSensitive);
    refreshMatches();
  });

  const wordBtn = document.createElement("button");
  wordBtn.className = "finder-chip";
  wordBtn.type = "button";
  wordBtn.textContent = "AB";
  wordBtn.addEventListener("click", () => {
    state.wholeWord = !state.wholeWord;
    wordBtn.classList.toggle("active", state.wholeWord);
    wordBtn.classList.toggle("green", state.wholeWord);
    refreshMatches();
  });

  const regexBtn = document.createElement("button");
  regexBtn.className = "finder-chip";
  regexBtn.type = "button";
  regexBtn.textContent = ".*";
  regexBtn.addEventListener("click", () => {
    state.useRegex = !state.useRegex;
    regexBtn.classList.toggle("active", state.useRegex);
    regexBtn.classList.toggle("violet", state.useRegex);
    refreshMatches();
  });

  optionGroup.append(caseBtn, wordBtn, regexBtn);
  rightGroup.append(navGroup, optionGroup);

  rowFind.append(toggleBtn, findField, rightGroup);

  const rowReplace = document.createElement("div");
  rowReplace.className = "finder-row replace finder-hidden";

  const spacer = document.createElement("div");

  const replaceField = document.createElement("div");
  replaceField.className = "finder-field";

  const replaceInput = document.createElement("input");
  replaceInput.placeholder = "바꾸기";
  replaceInput.addEventListener("input", () => {
    state.replaceText = replaceInput.value;
  });

  replaceField.append(replaceInput);

  const replaceActions = document.createElement("div");
  replaceActions.className = "finder-actions";

  const replaceBtn = document.createElement("button");
  replaceBtn.className = "finder-mini-btn";
  replaceBtn.type = "button";
  replaceBtn.textContent = "바꾸기";
  replaceBtn.addEventListener("click", () => replaceCurrent());

  const replaceAllBtn = document.createElement("button");
  replaceAllBtn.className = "finder-mini-btn";
  replaceAllBtn.type = "button";
  replaceAllBtn.textContent = "전체";
  replaceAllBtn.addEventListener("click", () => replaceAll());

  replaceActions.append(replaceBtn, replaceAllBtn);
  rowReplace.append(spacer, replaceField, replaceActions);

  panel.append(rowFind, rowReplace);
  root.append(panel);
  document.documentElement.appendChild(root);

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;
  const WORD_ONLY_REGEX = /^[\p{L}\p{N}_]+$/u;

  const getDocWindow = (doc) => doc?.defaultView || window;
  const observedDocs = new WeakSet();
  const collectFrameDocs = (doc, maxDepth = 2) => {
    const results = [];
    const visit = (current, depth) => {
      if (!current || depth < 0) return;
      const frames = Array.from(current.querySelectorAll("iframe"));
      for (const frame of frames) {
        try {
          const frameDoc = frame.contentDocument;
          if (!frameDoc) continue;
          results.push(frameDoc);
          visit(frameDoc, depth - 1);
        } catch {
          // Ignore cross-origin frames.
        }
      }
    };
    visit(doc, maxDepth);
    return results;
  };
  const BLOG_EDITABLE_SELECTORS = [
    "[contenteditable='true']",
    "[contenteditable='plaintext-only']",
    "[role='textbox']",
    ".se-content",
    ".se-canvas",
    ".se-document",
    ".se-main",
    "[data-se-root]",
    "[data-se-canvas]",
    ".se-text-paragraph",
    ".se-component-content",
  ];
  const BLOG_PARAGRAPH_SELECTORS = [
    ".se-title-text p.se-text-paragraph",
    ".se-documentTitle p.se-text-paragraph",
    ".se-section-text p.se-text-paragraph",
    ".se-text-paragraph",
  ];
  const BLOG_ROOT_SELECTORS = [
    ".se-section.se-section-text",
    ".se-module.se-module-text",
    ".se-section-text",
    ".se-documentTitle",
    ".se-title-text",
    ".se-text",
  ];
  const BLOG_FOCUSED_SELECTORS = [
    ".se-section.se-is-focused",
    ".se-section-text.se-is-focused",
    ".se-documentTitle.se-is-focused",
    ".se-title-text.se-is-focused",
  ];

  const getSelectionTextFromDocument = (doc) => {
    if (!doc) return "";
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) return "";
    const text = selection.toString();
    if (text && text.length <= 200) return text;
    return "";
  };

  const getCaretRangeFromPoint = (doc, x, y) => {
    if (!doc) return null;
    if (typeof doc.caretRangeFromPoint === "function") {
      return doc.caretRangeFromPoint(x, y);
    }
    if (typeof doc.caretPositionFromPoint === "function") {
      const position = doc.caretPositionFromPoint(x, y);
      if (!position) return null;
      const range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const parsePx = (value) => {
    if (!value) return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getBlockRect = (doc, block, selectionLayer) => {
    const rect = block.getBoundingClientRect();
    if (rect.width || rect.height) return rect;
    const style = block.style || {};
    const width = parsePx(style.width || block.getAttribute("width"));
    const height = parsePx(style.height || block.getAttribute("height"));
    const left = parsePx(style.left);
    const top = parsePx(style.top);
    const base =
      block.offsetParent?.getBoundingClientRect() ||
      selectionLayer?.getBoundingClientRect() ||
      doc.documentElement.getBoundingClientRect();
    return {
      left: base.left + left,
      top: base.top + top,
      right: base.left + left + width,
      bottom: base.top + top + height,
      width,
      height,
    };
  };

  const isPointInRect = (x, y, rect) =>
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;

  const getTextNodeFromElement = (doc, el) => {
    if (!el) return null;
    if (el.nodeType === Node.TEXT_NODE) return el;
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    return walker.nextNode();
  };

  const getOffsetFromTextNodeAtPoint = (doc, textNode, x, y) => {
    if (!textNode) return null;
    const text = textNode.nodeValue || "";
    if (!text) return null;
    const length = Math.min(text.length, 400);
    const range = doc.createRange();
    for (let i = 0; i < length; i += 1) {
      range.setStart(textNode, i);
      range.setEnd(textNode, Math.min(i + 1, text.length));
      const rects = Array.from(range.getClientRects());
      if (rects.some((rect) => isPointInRect(x, y, rect))) {
        return i;
      }
    }
    return null;
  };

  const getRangePointFromRect = (doc, rect, useEnd) => {
    const x = useEnd ? rect.right - 1 : rect.left + 1;
    const y = useEnd ? rect.bottom - 1 : rect.top + 1;
    const caretRange = getCaretRangeFromPoint(doc, x, y);
    if (caretRange) {
      return {
        node: caretRange.startContainer,
        offset: caretRange.startOffset,
      };
    }
    const element = doc.elementFromPoint(x, y);
    const textNode = getTextNodeFromElement(doc, element);
    if (!textNode) return null;
    const offset =
      getOffsetFromTextNodeAtPoint(doc, textNode, x, y) ??
      (useEnd ? (textNode.nodeValue || "").length : 0);
    return { node: textNode, offset };
  };

  const getRangeFromSelectionBlocks = (doc) => {
    if (!doc) return null;
    const blocks = Array.from(doc.querySelectorAll(".se-selection-block"));
    if (!blocks.length) return null;

    const selectionLayer = doc.querySelector(".se-selection");
    const previousPointerEvents = selectionLayer?.style.pointerEvents ?? "";
    if (selectionLayer) {
      selectionLayer.style.pointerEvents = "none";
    }

    let range = null;
    try {
      const firstRect = getBlockRect(doc, blocks[0], selectionLayer);
      const lastRect = getBlockRect(doc, blocks[blocks.length - 1], selectionLayer);
      const startPoint = getRangePointFromRect(doc, firstRect, false);
      const endPoint = getRangePointFromRect(doc, lastRect, true);
      if (startPoint && endPoint) {
        range = doc.createRange();
        range.setStart(startPoint.node, startPoint.offset);
        range.setEnd(endPoint.node, endPoint.offset);
      }
    } finally {
      if (selectionLayer) {
        selectionLayer.style.pointerEvents = previousPointerEvents;
      }
    }

    return range;
  };

  const getSelectionTextFromSelectionBlocks = (doc) => {
    const range = getRangeFromSelectionBlocks(doc);
    if (!range) return "";
    const text = range.toString();
    if (text && text.length <= 200) return text;
    if (text) return text.slice(0, 200);
    return "";
  };

  function cacheSelectionText(target, doc) {
    const text =
      getSelectionText(target) ||
      getSelectionTextFromDocument(doc) ||
      getSelectionTextFromSelectionBlocks(doc);
    state.lastSelectionText = text || "";
  }

  function ensureDocListeners(doc) {
    if (!doc || observedDocs.has(doc)) return;
    observedDocs.add(doc);
    const keydownHandler = (event) => {
      handleShortcut(event);
    };
    const selectionCaptureHandler = () => {
      const target = getActiveEditableInDocument(doc);
      if (target) {
        state.target = target;
      }
      cacheSelectionText(target, doc);
    };
    doc.addEventListener(
      "selectionchange",
      () => {
        const target = getActiveEditableInDocument(doc);
        if (target) {
          state.target = target;
          cacheSelectionText(target, doc);
          if (root.style.display != "none" && state.searchText) {
            refreshMatches();
          }
        }
        if (!target) {
          cacheSelectionText(null, doc);
        }
      },
      true
    );
    doc.addEventListener(
      "focusin",
      () => {
        const target = getActiveEditableInDocument(doc);
        if (target) {
          state.target = target;
          cacheSelectionText(target, doc);
          if (root.style.display != "none" && state.searchText) {
            refreshMatches();
          }
        }
      },
      true
    );
    doc.addEventListener("mouseup", selectionCaptureHandler, true);
    doc.addEventListener("keyup", selectionCaptureHandler, true);
    doc.addEventListener("keydown", keydownHandler, true);
    doc.addEventListener("keydown", handleCloseShortcut, true);
  }

  function ensureFrameDocListeners() {
    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      ensureDocListeners(frameDoc);
    }
  }

  const getActiveEditableInDocument = (doc) => {
    if (!doc) return null;

    const active = doc.activeElement;
    if (active && isVisibleEditable(active)) {
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
        return active;
      }
      if (active.isContentEditable) {
        return active.closest("[contenteditable]") || active;
      }
    }

    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return isBlogWriteContext()
        ? findEditableFallback(doc) || getBlogContentRoot(doc)
        : null;
    }

    const node = selection.anchorNode;
    if (!node) {
      return isBlogWriteContext()
        ? findEditableFallback(doc) || getBlogContentRoot(doc)
        : null;
    }

    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) {
      return isBlogWriteContext()
        ? findEditableFallback(doc) || getBlogContentRoot(doc)
        : null;
    }

    const editableRoot = element.closest("[contenteditable]");
    if (editableRoot && isVisibleEditable(editableRoot)) return editableRoot;

    return isBlogWriteContext()
      ? findEditableFallback(doc) || getBlogContentRoot(doc)
      : null;
  };

  const getActiveEditable = () => {
    const direct = getActiveEditableInDocument(document);
    if (direct) return direct;

    const active = document.activeElement;
    if (active instanceof HTMLIFrameElement) {
      try {
        const frameDoc = active.contentDocument;
        const fromFrame = getActiveEditableInDocument(frameDoc);
        if (fromFrame) return fromFrame;
      } catch {
        // Ignore cross-origin frames.
      }
    }

    if (isBlogWriteContext()) {
      const blogDocTarget = findBlogEditableInDocument(document);
      if (blogDocTarget) return blogDocTarget;
      const fromFrames = findBlogEditableInFrames();
      if (fromFrames) return fromFrames;
    }

    return null;
  };

  const isEditableElement = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest("#finder-ext-root")) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const type = el.getAttribute("type") || "text";
      return ["text", "search", "url", "email", "tel", "password"].includes(type);
    }
    return false;
  };

  const isVisibleElement = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest("#finder-ext-root")) return false;
    if (el.getAttribute("aria-hidden") == "true") return false;
    const view = getDocWindow(el.ownerDocument);
    const style = view.getComputedStyle(el);
    if (style.display == "none" || style.visibility == "hidden") return false;
    if (style.transform && style.transform.includes("rotateX(90deg)")) return false;
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width < 4 || rect.height < 4) return false;
    if (rect.right < 0 || rect.bottom < 0) return false;
    if (rect.left > view.innerWidth || rect.top > view.innerHeight) return false;
    return true;
  };

  const isVisibleEditable = (el) => {
    if (!isEditableElement(el)) return false;
    return isVisibleElement(el);
  };


  const findEditableFallback = (doc = document) => {
    const candidates = Array.from(
      doc.querySelectorAll(
        "textarea, input[type='text'], input[type='search'], input[type='url'], input[type='email'], input[type='tel'], input[type='password'], [contenteditable]"
      )
    );
    let best = null;
    let bestScore = 0;

    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisibleEditable(el)) continue;

      let textLength = 0;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        textLength = (el.value || "").trim().length;
      } else if (el.isContentEditable) {
        textLength = (el.innerText || "").trim().length;
      }

      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const score = area + textLength * 1000;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  };

  const getBlogContentRoot = (doc = document) =>
    findBlogEditableInDocument(doc);

  const findBlogEditableInDocument = (doc) => {
    if (!doc) return null;
    const selection = doc.getSelection();
    if (selection && selection.anchorNode) {
      const element =
        selection.anchorNode.nodeType === Node.ELEMENT_NODE
          ? selection.anchorNode
          : selection.anchorNode.parentElement;
      if (element instanceof HTMLElement) {
        const rootHit = element.closest(BLOG_ROOT_SELECTORS.join(","));
        if (rootHit) {
          const resolved = resolveBlogTarget(rootHit);
          if (resolved) return resolved;
        }
        const paragraph = element.closest(BLOG_PARAGRAPH_SELECTORS.join(","));
        if (paragraph) {
          const resolved = resolveBlogTarget(paragraph);
          if (resolved) return resolved;
        }
      }
    }

    const paragraphs = Array.from(doc.querySelectorAll(BLOG_PARAGRAPH_SELECTORS.join(",")));
    let best = null;
    let bestScore = 0;

    for (const el of paragraphs) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisibleElement(el)) continue;
      const resolved = resolveBlogTarget(el);
      if (!resolved) continue;
      const textLength = (el.innerText || "").trim().length;
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const score = area + textLength * 1000;
      if (score > bestScore) {
        best = resolved;
        bestScore = score;
      }
    }

    if (best) return best;

    const nodes = Array.from(doc.querySelectorAll(BLOG_EDITABLE_SELECTORS.join(",")));
    let bestEditable = null;
    let bestEditableScore = 0;

    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisibleElement(el)) continue;
      const isEditable = el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "INPUT";
      if (!isEditable) continue;
      const textLength = (el.innerText || el.value || "").trim().length;
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const score = area + textLength * 1000 + (el.isContentEditable ? 5000 : 0);
      if (score > bestEditableScore) {
        bestEditable = el;
        bestEditableScore = score;
      }
    }

    return bestEditable;
  };

  const resolveBlogTarget = (el) => {
    if (!(el instanceof HTMLElement)) return null;
    const root = el.closest(BLOG_ROOT_SELECTORS.join(","));
    if (root instanceof HTMLElement) return root;
    const editable = el.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
    if (editable instanceof HTMLElement) return editable;
    const container = el.closest(BLOG_EDITABLE_SELECTORS.join(","));
    if (container instanceof HTMLElement) return container;
    return el;
  };

  const findEditableInFrames = () => {
    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      const direct = getActiveEditableInDocument(frameDoc);
      if (direct) return direct;
      const fallback = findEditableFallback(frameDoc) || getBlogContentRoot(frameDoc);
      if (fallback) return fallback;
    }
    return null;
  };

  const findBlogEditableInFrames = () => {
    let best = null;
    let bestScore = 0;

    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      const candidate = findBlogEditableInDocument(frameDoc);
      if (!candidate) continue;
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      const textLength = (candidate.innerText || candidate.value || "").trim().length;
      const score = area + textLength * 1000;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  };

  const getBlogFrameDocument = () => {
    const iframe =
      document.querySelector("iframe[name='mainFrame']") ||
      document.querySelector("iframe[src*='PostWriteForm.naver']");
    let baseDoc = null;
    if (iframe instanceof HTMLIFrameElement) {
      try {
        baseDoc = iframe.contentDocument || null;
      } catch {
        baseDoc = null;
      }
    }
    if (baseDoc && isBlogEditorDocument(baseDoc)) return baseDoc;
    if (baseDoc) {
      const nestedDocs = collectFrameDocs(baseDoc, 2);
      const nested = nestedDocs.find((doc) => isBlogEditorDocument(doc));
      if (nested) return nested;
    }
    const fallbackDocs = collectFrameDocs(document, 2);
    const fallback = fallbackDocs.find((doc) => isBlogEditorDocument(doc));
    return fallback || null;
  };

  const getInputBufferBody = (doc) => {
    if (!doc) return null;
    const inputFrame = doc.querySelector("iframe[id^='input_buffer']");
    if (!(inputFrame instanceof HTMLIFrameElement)) return null;
    try {
      const inputDoc = inputFrame.contentDocument;
      if (!inputDoc) return null;
      const body = inputDoc.body;
      if (body && body.isContentEditable) return body;
    } catch {
      return null;
    }
    return null;
  };

  const dispatchInputEvents = (target, text) => {
    if (!target || typeof InputEvent === "undefined") return;
    try {
      const beforeInput = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data: text,
        inputType: "insertText",
      });
      target.dispatchEvent(beforeInput);
    } catch {
      // Ignore event construction errors.
    }
    try {
      const inputEvent = new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertText",
      });
      target.dispatchEvent(inputEvent);
    } catch {
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const getFocusedBlogRoot = (doc) => {
    if (!doc) return null;
    const focused = doc.querySelector(BLOG_FOCUSED_SELECTORS.join(","));
    if (focused instanceof HTMLElement && isVisibleElement(focused)) {
      return focused;
    }
    return null;
  };

  const getBlogSearchRoots = (doc) => {
    if (!doc) return [];
    const componentRoots = Array.from(
      doc.querySelectorAll(".se-components-wrap .se-component")
    ).filter((el) => el instanceof HTMLElement && isVisibleElement(el));
    if (componentRoots.length) {
      return componentRoots.filter((root) => {
        return !componentRoots.some(
          (other) => other !== root && other.contains(root)
        );
      });
    }
    const roots = Array.from(doc.querySelectorAll(BLOG_ROOT_SELECTORS.join(","))).filter(
      (el) => el instanceof HTMLElement && isVisibleElement(el)
    );
    if (roots.length) {
      const normalized = roots.filter((root) => {
        return !roots.some((other) => other !== root && other.contains(root));
      });
      return normalized;
    }
    return Array.from(doc.querySelectorAll(BLOG_PARAGRAPH_SELECTORS.join(","))).filter(
      (el) => el instanceof HTMLElement && isVisibleElement(el)
    );
  };

  const isBlogEditorDocument = (doc = document) =>
    !!doc.querySelector(
      ".se-document, .se-content, .se-main, [data-se-root], .se-text-paragraph, .__se-node"
    );

  const isBlogWriteContext = () => {
    if (isBlogEditorDocument(document)) return true;
    const href = window.location.href || "";
    if (!href.includes("blog.naver.com")) return false;
    return /Redirect=Write|PostWrite|postwrite|smarteditor|se2|write|editor/i.test(href);
  };

  const getSearchRegex = () => {
    if (!state.searchText) return null;
    const boundaryWrap = (source) =>
      `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
    if (state.useRegex) {
      let source = state.searchText;
      if (state.wholeWord) {
        source = WORD_ONLY_REGEX.test(source) ? boundaryWrap(source) : source;
      }
      try {
        return new RegExp(source, state.caseSensitive ? "gu" : "giu");
      } catch {
        return null;
      }
    }

    const escaped = escapeRegExp(state.searchText);
    const source =
      state.wholeWord && WORD_ONLY_REGEX.test(state.searchText)
        ? boundaryWrap(escaped)
        : escaped;
    return new RegExp(source, state.caseSensitive ? "gu" : "giu");
  };

  const isPanelInteractionActive = () => {
    const active = document.activeElement;
    if (!active) return false;
    return root.contains(active);
  };

  const findBlogMatchByIndex = (doc, index) => {
    if (!doc || index < 0) return null;
    const regex = state.useRegex ? getSearchRegex() : null;
    if (state.useRegex && !regex) return null;
    const roots = getBlogSearchRoots(doc);
    if (!roots.length) return null;

    const needle = state.caseSensitive ? state.searchText : state.searchText.toLowerCase();
    const applyWordBoundary =
      state.wholeWord && WORD_ONLY_REGEX.test(state.searchText);
    let count = 0;

    for (const root of roots) {
      if (!(root instanceof HTMLElement)) continue;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (
            parent &&
            (parent.classList.contains("__se_placeholder") ||
              parent.classList.contains("se-placeholder"))
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue || "";
        if (state.useRegex) {
          let match = null;
          const localRegex = new RegExp(regex.source, regex.flags);
          while ((match = localRegex.exec(text))) {
            if (count === index) {
              return {
                node,
                start: match.index,
                end: match.index + match[0].length,
              };
            }
            count += 1;
            if (match[0].length === 0) localRegex.lastIndex += 1;
          }
        } else {
          const haystack = state.caseSensitive ? text : text.toLowerCase();
          const step = Math.max(needle.length, 1);
          let startIndex = 0;
          while (startIndex <= haystack.length - needle.length) {
            const found = haystack.indexOf(needle, startIndex);
            if (found === -1) break;
            const end = found + needle.length;
            if (
              !applyWordBoundary ||
              (!WORD_CHAR_REGEX.test(text[found - 1] || "") &&
                !WORD_CHAR_REGEX.test(text[end] || ""))
            ) {
              if (count === index) {
                return { node, start: found, end };
              }
              count += 1;
            }
            startIndex = found + step;
          }
        }
      }
    }
    return null;
  };

  const refreshMatches = () => {
    const previousActiveIndex = state.activeIndex;
    state.matches = [];
    state.activeIndex = 0;

    let target = state.target;
    if (!target && isBlogWriteContext()) {
      target =
        findBlogEditableInDocument(document) ||
        findBlogEditableInFrames() ||
        findEditableFallback() ||
        getBlogContentRoot() ||
        findEditableInFrames();
      state.target = target;
    }
    if (isBlogWriteContext()) {
      const frameDoc = getBlogFrameDocument();
      const blogDoc = frameDoc || document;
      const focusedRoot = getFocusedBlogRoot(blogDoc);
      const blogTarget = focusedRoot || findBlogEditableInDocument(blogDoc);
      if (blogTarget) {
        state.target = blogTarget;
        target = blogTarget;
      }
    }
    const regex = state.useRegex ? getSearchRegex() : null;
    if (!target || (state.useRegex && !regex)) {
      updateCount();
      clearHighlights();
      return;
    }

    ensureDocListeners(target.ownerDocument || document);

    const seenNodeRanges = new WeakMap();
    const seenRanges = new Set();
    const pushMatch = (match) => {
      if (!match) return;
      if (match.node) {
        const rangeKey = `${match.start}-${match.end}`;
        let ranges = seenNodeRanges.get(match.node);
        if (!ranges) {
          ranges = new Set();
          seenNodeRanges.set(match.node, ranges);
        }
        if (ranges.has(rangeKey)) return;
        ranges.add(rangeKey);
        state.matches.push(match);
        return;
      }
      const rangeKey = `${match.start}-${match.end}`;
      if (seenRanges.has(rangeKey)) return;
      seenRanges.add(rangeKey);
      state.matches.push(match);
    };

    const collectLiteralMatches = (text, node) => {
      if (!text) return;
      const needle = state.caseSensitive ? state.searchText : state.searchText.toLowerCase();
      const haystack = state.caseSensitive ? text : text.toLowerCase();
      if (!needle) return;
      const applyWordBoundary =
        state.wholeWord && WORD_ONLY_REGEX.test(state.searchText);
      const step = Math.max(needle.length, 1);
      let startIndex = 0;
      while (startIndex <= haystack.length - needle.length) {
        const found = haystack.indexOf(needle, startIndex);
        if (found === -1) break;
        const end = found + needle.length;
        if (
          !applyWordBoundary ||
          (!WORD_CHAR_REGEX.test(text[found - 1] || "") &&
            !WORD_CHAR_REGEX.test(text[end] || ""))
        ) {
          pushMatch({ start: found, end, node });
        }
        startIndex = found + step;
      }
    };

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const text = target.value || "";
      if (state.useRegex) {
        let match = null;
        while ((match = regex.exec(text))) {
          pushMatch({
            start: match.index,
            end: match.index + match[0].length,
          });
          if (match[0].length === 0) regex.lastIndex += 1;
        }
      } else {
        collectLiteralMatches(text, null);
      }
    } else if (target instanceof HTMLElement) {
      const doc = target.ownerDocument || document;
      const blogDoc = isBlogWriteContext() ? getBlogFrameDocument() || doc : doc;
      const roots = isBlogWriteContext() ? getBlogSearchRoots(blogDoc) : [];
      const searchRoots = roots.length ? roots : [target];
      if (roots.length && target.ownerDocument !== roots[0].ownerDocument) {
        state.target = roots[0];
        target = roots[0];
        ensureDocListeners(target.ownerDocument || document);
      }

      for (const root of searchRoots) {
        if (!(root instanceof HTMLElement)) continue;
        const walkerDoc = root.ownerDocument || doc;
        const walker = walkerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (
              parent &&
              (parent.classList.contains("__se_placeholder") ||
                parent.classList.contains("se-placeholder"))
            ) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        let node;
        while ((node = walker.nextNode())) {
          const text = node.nodeValue || "";
          if (state.useRegex) {
            let match = null;
            const localRegex = new RegExp(regex.source, regex.flags);
            while ((match = localRegex.exec(text))) {
              pushMatch({
                node,
                start: match.index,
                end: match.index + match[0].length,
              });
              if (match[0].length === 0) localRegex.lastIndex += 1;
            }
          } else {
            collectLiteralMatches(text, node);
          }
        }
      }
    }

    if (state.matches.length) {
      const resolvedIndex = resolveActiveIndex(
        target,
        state.matches,
        previousActiveIndex
      );
      state.activeIndex = resolvedIndex + 1;
    }

    updateCount();
    applyHighlights();
  };

  const resolveActiveIndex = (target, matches, previousActiveIndex) => {
    if (!matches.length) return 0;

    if (isPanelInteractionActive()) {
      const fallback = Math.min(previousActiveIndex - 1, matches.length - 1);
      if (fallback >= 0) return fallback;
      return 0;
    }

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const cursor = target.selectionStart ?? 0;
      let index = matches.findIndex(
        (match) => cursor >= match.start && cursor <= match.end
      );
      if (index === -1) {
        index = matches.findIndex((match) => match.start >= cursor);
      }
      return index === -1 ? matches.length - 1 : index;
    }

    if (target instanceof HTMLElement) {
      const doc = target.ownerDocument || document;
      const selection = doc.getSelection();
      if (!selection || selection.rangeCount === 0) return 0;
      const selectionRange = selection.getRangeAt(0);
      let index = matches.findIndex((match) => {
        if (!match.node) return false;
        const range = doc.createRange();
        range.setStart(match.node, match.start);
        range.setEnd(match.node, match.end);
        const startsBeforeEnd =
          range.compareBoundaryPoints(Range.END_TO_START, selectionRange) < 0;
        const endsAfterStart =
          range.compareBoundaryPoints(Range.START_TO_END, selectionRange) > 0;
        return startsBeforeEnd && endsAfterStart;
      });
      if (index === -1) {
        index = matches.findIndex((match) => {
          if (!match.node) return false;
          const range = doc.createRange();
          range.setStart(match.node, match.start);
          range.setEnd(match.node, match.end);
          return (
            range.compareBoundaryPoints(Range.START_TO_END, selectionRange) >= 0
          );
        });
      }
      return index === -1 ? matches.length - 1 : index;
    }

    return 0;
  };

  const updateCount = () => {
    countSpan.textContent = `${state.activeIndex}/${state.matches.length}`;
  };

  const clearHighlights = () => {
    const doc = state.highlightDoc || document;
    const view = getDocWindow(doc);
    if (!view.CSS || !view.CSS.highlights) return;
    view.CSS.highlights.delete("finder-highlight");
    view.CSS.highlights.delete("finder-highlight-active");
    state.highlightDoc = null;
  };

  const applyHighlights = () => {
    if (!state.target || !(state.target instanceof HTMLElement)) {
      clearHighlights();
      return;
    }
    const doc = state.target.ownerDocument || document;
    const view = getDocWindow(doc);
    if (!view.CSS || !view.CSS.highlights || typeof Highlight === "undefined") return;
    if (state.highlightDoc && state.highlightDoc !== doc) {
      const prevView = getDocWindow(state.highlightDoc);
      if (prevView.CSS && prevView.CSS.highlights) {
        prevView.CSS.highlights.delete("finder-highlight");
      }
    }
    const highlight = new Highlight();
    const activeHighlight = new Highlight();
    const activeIndex = state.activeIndex - 1;
    for (let index = 0; index < state.matches.length; index += 1) {
      const match = state.matches[index];
      if (!match.node) continue;
      const range = doc.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      if (index === activeIndex) {
        activeHighlight.add(range);
      } else {
        highlight.add(range);
      }
    }
    view.CSS.highlights.set("finder-highlight", highlight);
    view.CSS.highlights.set("finder-highlight-active", activeHighlight);
    state.highlightDoc = doc;
  };

  const selectMatch = (match) => {
    if (!match) return;
    const target = state.target;
    if (!target) return;

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      target.focus();
      target.setSelectionRange(match.start, match.end);
    } else if (target instanceof HTMLElement && match.node) {
      const doc = target.ownerDocument || document;
      const range = doc.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      const selection = doc.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
      const element = match.node.parentElement;
      if (element) element.scrollIntoView({ block: "center" });
    }
  };

  const gotoMatch = (direction) => {
    const target = resolveReplaceTarget();
    if (!target) return;
    refreshMatches();
    if (!state.matches.length) return;
    let nextIndex = state.activeIndex - 1 + direction;
    if (nextIndex < 0) nextIndex = state.matches.length - 1;
    if (nextIndex >= state.matches.length) nextIndex = 0;
    state.activeIndex = nextIndex + 1;
    selectMatch(state.matches[nextIndex]);
    updateCount();
    applyHighlights();
  };

  const resolveReplaceTarget = () => {
    let target = state.target;
    if (!target) {
      target = getActiveEditable();
    }
    if (!target && isBlogWriteContext()) {
      const frameDoc = getBlogFrameDocument();
      const blogDoc = frameDoc || document;
      target =
        getFocusedBlogRoot(blogDoc) ||
        findBlogEditableInDocument(blogDoc) ||
        findBlogEditableInFrames() ||
        findEditableFallback() ||
        findEditableInFrames();
    }
    if (!target) return null;
    state.target = target;
    ensureDocListeners(target.ownerDocument || document);
    return target;
  };

  const getTextOffsetInContainer = (container, node, offset) => {
    const doc = container.ownerDocument || document;
    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let total = 0;
    let current;
    while ((current = walker.nextNode())) {
      if (current === node) return total + offset;
      total += (current.nodeValue || "").length;
    }
    return null;
  };

  const setCaretByOffset = (container, offset) => {
    const doc = container.ownerDocument || document;
    const selection = doc.getSelection();
    if (!selection) return false;
    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let current;
    while ((current = walker.nextNode())) {
      const length = (current.nodeValue || "").length;
      if (remaining <= length) {
        const range = doc.createRange();
        range.setStart(current, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
      remaining -= length;
    }
    return false;
  };

  const replaceCurrent = (overrideIndex) => {
    const target = resolveReplaceTarget();
    if (!target) {
      if (isTopFrame) {
        broadcastActionToChildFrames({
          type: "finder-replace-current",
          state: getSearchStatePayload(),
          activeIndex: state.activeIndex,
        });
      }
      return;
    }
    const previousTarget = state.target;
    state.target = target;
    if (isTopFrame && target.ownerDocument !== document) {
      if (
        postMessageToFrameByDoc(target.ownerDocument, {
          type: "finder-replace-current",
          state: getSearchStatePayload(),
          activeIndex: state.activeIndex,
        })
      ) {
        state.target = previousTarget;
        return;
      }
    }
    let resolvedIndex =
      typeof overrideIndex === "number" && overrideIndex > 0
        ? overrideIndex - 1
        : state.activeIndex > 0
          ? state.activeIndex - 1
          : -1;
    refreshMatches();
    if (!state.matches.length) return;
    if (resolvedIndex < 0) resolvedIndex = 0;
    if (resolvedIndex >= state.matches.length) {
      resolvedIndex = state.matches.length - 1;
    }
    const match = state.matches[resolvedIndex];
    if (!match) return;

    const regex = getSearchRegex();
    if (!regex) return;

    const activeTarget = state.target || target;
    if (
      activeTarget instanceof HTMLTextAreaElement ||
      activeTarget instanceof HTMLInputElement
    ) {
      const text = activeTarget.value || "";
      const singleFlags = regex.flags.replace("g", "");
      const singleRegex = new RegExp(regex.source, singleFlags);
      const before = text.slice(0, match.start);
      const targetText = text.slice(match.start, match.end);
      const replacement = targetText.replace(singleRegex, state.replaceText);
      activeTarget.value = before + replacement + text.slice(match.end);
    } else if (activeTarget instanceof HTMLElement && match.node) {
      activeTarget.focus();
      const doc = match.node.ownerDocument || document;
      const selection = doc.getSelection();
      if (!selection) return;
      const range = doc.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      selection.removeAllRanges();
      selection.addRange(range);
      const replaced = doc.execCommand("insertText", false, state.replaceText);
      if (!replaced && match.node) {
        const text = match.node.nodeValue || "";
        match.node.nodeValue =
          text.slice(0, match.start) + state.replaceText + text.slice(match.end);
      }
    }

    refreshMatches();
    state.target = activeTarget;
  };

  const replaceAll = () => {
    const regex = getSearchRegex();
    if (regex && isBlogWriteContext()) {
      const nodes = Array.from(document.querySelectorAll(".__se-node"));
      if (nodes.length) {
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          const text = node.textContent || "";
          node.textContent = text.replace(regex, state.replaceText);
        }
        refreshMatches();
        return;
      }
    }
    if (isTopFrame && isBlogWriteContext()) {
      const frameDoc = getBlogFrameDocument();
      if (frameDoc && regex) {
        const nodes = Array.from(frameDoc.querySelectorAll(".__se-node"));
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          const text = node.textContent || "";
          node.textContent = text.replace(regex, state.replaceText);
        }
        refreshMatches();
        return;
      }
    }
    const target = resolveReplaceTarget();
    if (!target) {
      if (isTopFrame) {
        broadcastActionToChildFrames({
          type: "finder-replace-all",
          state: getSearchStatePayload(),
        });
      }
      return;
    }
    if (isTopFrame && target.ownerDocument !== document) {
      if (
        postMessageToFrameByDoc(target.ownerDocument, {
          type: "finder-replace-all",
          state: getSearchStatePayload(),
        })
      ) {
        return;
      }
    }
    refreshMatches();
    if (!regex) return;

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const text = target.value || "";
      target.value = text.replace(regex, state.replaceText);
    } else if (target instanceof HTMLElement) {
      const matches = state.matches.filter((match) => match.node);
      if (!matches.length) return;
      target.focus();
      const doc = matches[0].node.ownerDocument || document;
      const selection = doc.getSelection();
      if (!selection) return;
      const withRanges = matches.map((match) => {
        const range = doc.createRange();
        range.setStart(match.node, match.start);
        range.setEnd(match.node, match.end);
        return { match, range };
      });
      withRanges.sort((a, b) =>
        b.range.compareBoundaryPoints(Range.START_TO_START, a.range)
      );
      for (const { match, range } of withRanges) {
        selection.removeAllRanges();
        selection.addRange(range);
        const replaced = doc.execCommand("insertText", false, state.replaceText);
        if (!replaced && match.node) {
          const text = match.node.nodeValue || "";
          match.node.nodeValue =
            text.slice(0, match.start) + state.replaceText + text.slice(match.end);
        }
      }
    }

    refreshMatches();
  };

  const openPanel = (showReplace) => {
    state.showReplace = showReplace;
    toggleBtn.textContent = state.showReplace ? "▾" : "▸";
    rowReplace.classList.toggle("finder-hidden", !state.showReplace);
    root.classList.remove("finder-hidden");
    root.style.display = "block";
  };

  const closePanel = () => {
    root.classList.add("finder-hidden");
    root.style.display = "none";
  };

  const isTopFrame = window.top === window;

  const getSearchStatePayload = () => ({
    searchText: state.searchText,
    replaceText: state.replaceText,
    caseSensitive: state.caseSensitive,
    wholeWord: state.wholeWord,
    useRegex: state.useRegex,
  });

  const applySearchStatePayload = (payload) => {
    if (!payload) return;
    if (typeof payload.searchText === "string") {
      state.searchText = payload.searchText;
      findInput.value = payload.searchText;
    }
    if (typeof payload.replaceText === "string") {
      state.replaceText = payload.replaceText;
      replaceInput.value = payload.replaceText;
    }
    if (typeof payload.caseSensitive === "boolean") {
      state.caseSensitive = payload.caseSensitive;
      caseBtn.classList.toggle("active", state.caseSensitive);
      caseBtn.classList.toggle("blue", state.caseSensitive);
    }
    if (typeof payload.wholeWord === "boolean") {
      state.wholeWord = payload.wholeWord;
      wordBtn.classList.toggle("active", state.wholeWord);
      wordBtn.classList.toggle("green", state.wholeWord);
    }
    if (typeof payload.useRegex === "boolean") {
      state.useRegex = payload.useRegex;
      regexBtn.classList.toggle("active", state.useRegex);
      regexBtn.classList.toggle("violet", state.useRegex);
    }
  };

  const broadcastToggle = (force) => {
    if (!isTopFrame) return;
    broadcastToChildFrames(force);
  };

  const broadcastToChildFrames = (force) => {
    const iframes = document.querySelectorAll("iframe");
    for (const frame of iframes) {
      try {
        frame.contentWindow?.postMessage({ type: "finder-toggle", force: !!force }, "*");
      } catch {
        // Ignore cross-origin access errors.
      }
    }
  };

  const broadcastActionToChildFrames = (message) => {
    const iframes = document.querySelectorAll("iframe");
    for (const frame of iframes) {
      try {
        frame.contentWindow?.postMessage(message, "*");
      } catch {
        // Ignore cross-origin access errors.
      }
    }
  };

  const postMessageToFrameByDoc = (doc, message) => {
    if (!doc) return false;
    const iframes = document.querySelectorAll("iframe");
    for (const frame of iframes) {
      try {
        if (frame.contentDocument === doc) {
          frame.contentWindow?.postMessage(message, "*");
          return true;
        }
      } catch {
        // Ignore cross-origin access errors.
      }
    }
    return false;
  };

  const togglePanel = (forceOpen = false, selectionTextOverride = "") => {
    if (root.style.display != "none") {
      closePanel();
      clearHighlights();
      return;
    }

    let target = getActiveEditable();
    if (!target && (forceOpen || isBlogWriteContext())) {
      if (isBlogWriteContext()) {
        const frameDoc = getBlogFrameDocument();
        const blogDoc = frameDoc || document;
        target = getFocusedBlogRoot(blogDoc) || findBlogEditableInDocument(blogDoc);
      }
      if (!target) {
        target = findEditableFallback() || findEditableInFrames();
      }
    }
    if (!target) {
      if (forceOpen || isBlogWriteContext()) {
        broadcastToChildFrames(forceOpen || isBlogWriteContext());
      }
      return;
    }

    state.target = target;
    ensureDocListeners(target.ownerDocument || document);
    openPanel(false);

    const selectionText =
      selectionTextOverride ||
      (target ? getSelectionText(target) : "") ||
      getSelectionTextFromDocument(getBlogFrameDocument()) ||
      getSelectionTextFromSelectionBlocks(getBlogFrameDocument());
    if (selectionText) {
      state.searchText = selectionText;
      findInput.value = selectionText;
    }

    refreshMatches();
    findInput.focus();
    findInput.select();
  };

  const getEditableFromTarget = (target) => {
    if (!(target instanceof HTMLElement)) return null;
    if (target.isContentEditable) {
      return target.closest("[contenteditable]") || target;
    }
    if (target.tagName === "TEXTAREA") return target;
    if (target.tagName === "INPUT") {
      const type = target.getAttribute("type") || "text";
      if (["text", "search", "url", "email", "tel", "password"].includes(type)) {
        return target;
      }
    }
    return null;
  };

  const getShortcutSelectionText = (event) => {
    const target = getEditableFromTarget(event?.target);
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      if (start !== end && end - start <= 200) return target.value.slice(start, end);
    }

    const doc = target?.ownerDocument || document;
    return (
      getSelectionTextFromDocument(doc) ||
      getSelectionTextFromSelectionBlocks(doc) ||
      getSelectionTextFromDocument(getBlogFrameDocument()) ||
      getSelectionTextFromSelectionBlocks(getBlogFrameDocument())
    );
  };

  const openFromShortcut = (event, forceOpen = false) => {
    const shortcutTarget = getEditableFromTarget(event?.target) || getActiveEditable();
    const selectionText =
      getShortcutSelectionText(event) ||
      getSelectionTextFromSelectionBlocks(getBlogFrameDocument()) ||
      state.lastSelectionText;
    if (root.style.display != "none") {
      const target = shortcutTarget || state.target;
      if (target) {
        state.target = target;
        if (selectionText) {
          state.searchText = selectionText;
          findInput.value = selectionText;
        }
        refreshMatches();
      }
      findInput.focus();
      findInput.select();
      return;
    }

    if (shortcutTarget) {
      state.target = shortcutTarget;
    }
    togglePanel(forceOpen, selectionText);
  };

  const handleShortcut = (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return false;
    const key = event.key ? event.key.toLowerCase() : "";
    const isFindKey =
      key === "f" ||
      event.code === "KeyF" ||
      event.keyCode === 70;
    if (!isFindKey) return false;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    openFromShortcut(event);
    return true;
  };

  const handleCloseShortcut = (event) => {
    if (event.key !== "Escape") return false;
    if (root.style.display == "none") return false;
    event.preventDefault();
    closePanel();
    clearHighlights();
    return true;
  };

  const getSelectionText = (target) => {
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      if (start !== end && end - start <= 200) return target.value.slice(start, end);
      return "";
    }

    const doc = target?.ownerDocument || document;
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) return "";
    const text = selection.toString();
    if (text && text.length <= 200) return text;
    return "";
  };

  ensureDocListeners(document);
  ensureFrameDocListeners();

  const frameObserver = new MutationObserver(() => {
    ensureFrameDocListeners();
  });

  frameObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener(
    "message",
    (event) => {
      if (event?.data && event.data.type === "finder-toggle") {
        openFromShortcut({ target: document.activeElement }, !!event.data.force);
      }
      if (event?.data && event.data.type === "finder-replace-current") {
        applySearchStatePayload(event.data.state);
        replaceCurrent(event.data.activeIndex);
      }
      if (event?.data && event.data.type === "finder-replace-all") {
        applySearchStatePayload(event.data.state);
        replaceAll();
      }
    },
    true
  );
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === "finder-toggle") {
        if (!isTopFrame) return;
        if (getActiveEditable()) {
          openFromShortcut({ target: document.activeElement }, false);
          return;
        }
        broadcastToggle(isBlogWriteContext());
      }
    });
  }
})();
