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
    site: "generic",
    refreshToken: 0,
    refreshRaf: null,
    titleHighlightTimer: null,
    titleMatchOverlay: null,
    lastSearchInputAt: 0,
    lastRefreshKey: "",
    lastAppliedHighlightKey: "",
    suppressTistoryHighlightUntilSearchChange: false,
    active_tistory_target_kind: "",
    last_tistory_body_text_hash: "",
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
    state.lastSearchInputAt = Date.now();
    state.searchText = findInput.value;
    state.suppressTistoryHighlightUntilSearchChange = false;
    refreshMatches();
    scheduleTitleHighlightSync();
  });
  findInput.addEventListener("input", () => {
    if (isComposing) return;
    state.lastSearchInputAt = Date.now();
    state.searchText = findInput.value;
    state.suppressTistoryHighlightUntilSearchChange = false;
    refreshMatches();
    scheduleTitleHighlightSync();
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
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const toOverlayHtml = (value) =>
    escapeHtml(value).replace(/ /g, "&nbsp;").replace(/\n/g, "<br>");
  const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;
  const WORD_ONLY_REGEX = /^[\p{L}\p{N}_]+$/u;
  const SITE_KIND = {
    NAVER: "naver",
    TISTORY: "tistory",
    GENERIC: "generic",
  };
  const isElementNode = (value) =>
    !!value &&
    typeof value === "object" &&
    value.nodeType === Node.ELEMENT_NODE &&
    typeof value.tagName === "string";
  const isTextAreaNode = (value) => isElementNode(value) && value.tagName === "TEXTAREA";
  const isInputNode = (value) => isElementNode(value) && value.tagName === "INPUT";
  const isTextInputNode = (value) => {
    if (!isInputNode(value)) return false;
    const type = (value.getAttribute("type") || "text").toLowerCase();
    return ["text", "search", "url", "email", "tel", "password"].includes(type);
  };
  const isTextControlNode = (value) => isTextAreaNode(value) || isTextInputNode(value);

  const getDocWindow = (doc) => doc?.defaultView || window;
  const getDocHref = (doc) => {
    if (!doc) return "";
    try {
      return String(doc.location?.href || "");
    } catch {
      return "";
    }
  };
  const observedDocs = new WeakSet();
  const observedFrames = new WeakSet();
  const nodeIdMap = new WeakMap();
  let nodeIdSeed = 1;
  const getNodeId = (node) => {
    if (!node || typeof node !== "object") return "none";
    let nodeId = nodeIdMap.get(node);
    if (!nodeId) {
      nodeId = `n${nodeIdSeed++}`;
      nodeIdMap.set(node, nodeId);
    }
    return nodeId;
  };
  const bumpRefreshToken = () => {
    state.refreshToken += 1;
  };
  const hashText = (text) => {
    const value = String(text || "");
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return `${value.length}:${hash}`;
  };
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
  const NAVER_EDITABLE_SELECTORS = [
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
  const NAVER_PARAGRAPH_SELECTORS = [
    ".se-title-text p.se-text-paragraph",
    ".se-documentTitle p.se-text-paragraph",
    ".se-section-text p.se-text-paragraph",
    ".se-text-paragraph",
  ];
  const NAVER_ROOT_SELECTORS = [
    ".se-section.se-section-text",
    ".se-module.se-module-text",
    ".se-section-text",
    ".se-documentTitle",
    ".se-title-text",
    ".se-text",
  ];
  const NAVER_FOCUSED_SELECTORS = [
    ".se-section.se-is-focused",
    ".se-section-text.se-is-focused",
    ".se-documentTitle.se-is-focused",
    ".se-title-text.se-is-focused",
  ];
  const TISTORY_EDITABLE_SELECTORS = [
    "[contenteditable='true']",
    "[contenteditable='plaintext-only']",
    "[role='textbox']",
    "textarea",
    ".ProseMirror",
    ".toastui-editor-contents",
    ".tt-editor-contents",
    ".editor-body [contenteditable='true']",
    "iframe#editor-tistory_ifr",
  ];
  const TISTORY_PARAGRAPH_SELECTORS = [
    ".ProseMirror p",
    ".toastui-editor-contents p",
    ".tt-editor-contents p",
    "[data-ke-editor] p",
  ];
  const TISTORY_ROOT_SELECTORS = [
    ".ProseMirror",
    ".toastui-editor-contents",
    ".tt-editor-contents",
    ".editor-body",
    ".editor-wrap",
    ".contents-wrap",
    "[data-ke-editor]",
    "[contenteditable='true']",
  ];
  // Tistory selector/priority table
  // 1) focused/active root: .ProseMirror, .toastui-editor-contents, .tt-editor-contents, [data-ke-editor]
  // 2) selection anchor -> closest TISTORY_ROOT_SELECTORS
  // 3) fallback editable candidates -> TISTORY_EDITABLE_SELECTORS (highest score wins)
  const TISTORY_FOCUSED_SELECTORS = [
    ".ProseMirror-focused",
    ".ProseMirror",
    ".toastui-editor-contents",
    ".tt-editor-contents",
    "[data-ke-editor]",
    "#kakao-editor-container",
  ];

  const TISTORY_IFRAME_SELECTORS = [
    "iframe#editor-tistory_ifr",
    "#kakao-editor-container iframe",
    "iframe[id*='editor'][id*='ifr']",
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
    const inputHandler = () => {
      if (root.style.display != "none" && state.searchText) {
        refreshMatches();
      }
    };
    doc.addEventListener(
      "selectionchange",
      () => {
        if (root.style.display != "none" && isPanelInteractionActive()) {
          return;
        }
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
        if (root.style.display != "none" && isPanelInteractionActive()) {
          return;
        }
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
    doc.addEventListener("input", inputHandler, true);
    doc.addEventListener("keydown", keydownHandler, true);
    doc.addEventListener("keydown", handleCloseShortcut, true);
  }

  function ensureFrameDocListeners() {
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const frame of frames) {
      if (!(frame instanceof HTMLIFrameElement)) continue;
      if (!observedFrames.has(frame)) {
        observedFrames.add(frame);
        frame.addEventListener(
          "load",
          () => {
            try {
              if (frame.contentDocument) {
                ensureDocListeners(frame.contentDocument);
              }
            } catch {
              // Ignore cross-origin frames.
            }
          },
          true
        );
      }
      try {
        if (frame.contentDocument) {
          ensureDocListeners(frame.contentDocument);
        }
      } catch {
        // Ignore cross-origin frames.
      }
    }
    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      ensureDocListeners(frameDoc);
    }
  }

  const getActiveEditableInDocument = (doc) => {
    if (!doc) return null;
    const site = detectSiteKind(doc, getDocHref(doc));
    const getSiteFallbackTarget = () => {
      if (site === SITE_KIND.TISTORY) {
        return getSiteContentRoot(site, doc) || findEditableFallback(doc);
      }
      return findEditableFallback(doc) || getSiteContentRoot(site, doc);
    };

    const active = doc.activeElement;
    if (
      site === SITE_KIND.TISTORY &&
      active instanceof HTMLBodyElement &&
      active.isContentEditable
    ) {
      return active;
    }
    if (site === SITE_KIND.TISTORY && active instanceof HTMLIFrameElement) {
      try {
        const frameDoc = active.contentDocument;
        const fromFrame = findTistoryBodyEditable(frameDoc || doc);
        if (fromFrame) return fromFrame;
      } catch {
        // Ignore cross-origin access errors.
      }
    }
    if (active && isVisibleEditable(active)) {
      if (isTextControlNode(active)) {
        return active;
      }
      if (active.isContentEditable) {
        return active.closest("[contenteditable]") || active;
      }
    }

    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return isBlogWriteContext() ? getSiteFallbackTarget() : null;
    }

    const node = selection.anchorNode;
    if (!node) {
      return isBlogWriteContext() ? getSiteFallbackTarget() : null;
    }

    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) {
      return isBlogWriteContext() ? getSiteFallbackTarget() : null;
    }

    const editableRoot = element.closest("[contenteditable]");
    if (
      site === SITE_KIND.TISTORY &&
      editableRoot instanceof HTMLBodyElement &&
      editableRoot.isContentEditable
    ) {
      return editableRoot;
    }
    if (editableRoot && isVisibleEditable(editableRoot)) return editableRoot;

    return isBlogWriteContext() ? getSiteFallbackTarget() : null;
  };

  const getActiveEditable = () => {
    const site = getCurrentSiteKind();
    if (site === SITE_KIND.TISTORY) {
      const preferred = getPreferredTistoryTarget(null);
      if (preferred) return preferred;
    }
    const direct = getActiveEditableInDocument(document);
    if (direct) return normalizeTargetForSite(site, direct);

    const active = document.activeElement;
    if (active instanceof HTMLIFrameElement) {
      try {
        const frameDoc = active.contentDocument;
        const fromFrame = getActiveEditableInDocument(frameDoc);
        if (fromFrame) return normalizeTargetForSite(site, fromFrame);
      } catch {
        // Ignore cross-origin frames.
      }
    }

    if (isBlogWriteContext()) {
      const blogDocTarget = findSiteEditableInDocument(site, document);
      if (blogDocTarget) return normalizeTargetForSite(site, blogDocTarget);
      const fromFrames = findSiteEditableInFrames(site);
      if (fromFrames) return normalizeTargetForSite(site, fromFrames);
    }

    return null;
  };

  const isEditableElement = (el) => {
    if (!isElementNode(el)) return false;
    if (el.closest("#finder-ext-root")) return false;
    if (el.isContentEditable) return true;
    if (isTextAreaNode(el)) return true;
    if (isTextInputNode(el)) return true;
    return false;
  };

  const isVisibleElement = (el) => {
    if (!isElementNode(el)) return false;
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
      if (!isElementNode(el)) continue;
      if (!isVisibleEditable(el)) continue;

      let textLength = 0;
      if (isTextControlNode(el)) {
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

  const isNaverEditorDocument = (doc = document) =>
    !!doc.querySelector(
      ".se-document, .se-content, .se-main, [data-se-root], .se-text-paragraph, .__se-node"
    );
  const isTistoryEditorDocument = (doc = document) =>
    !!doc.querySelector(
      ".ProseMirror, .toastui-editor-contents, .tt-editor-contents, [data-ke-editor], .editor-body [contenteditable='true'], iframe#editor-tistory_ifr, body#tinymce, .mce-content-body"
    );
  const isSiteEditorDocument = (site, doc = document) => {
    if (site === SITE_KIND.NAVER) return isNaverEditorDocument(doc);
    if (site === SITE_KIND.TISTORY) return isTistoryEditorDocument(doc);
    return false;
  };

  const detectSiteKind = (doc = document, href = window.location.href || "") => {
    const loweredHref = String(href || "").toLowerCase();
    if (
      isNaverEditorDocument(doc) ||
      (loweredHref.includes("blog.naver.com") &&
        /redirect=write|postwrite|smarteditor|se2|write|editor/i.test(loweredHref))
    ) {
      return SITE_KIND.NAVER;
    }
    if (
      isTistoryEditorDocument(doc) ||
      /\.tistory\.com\/manage\/newpost/i.test(loweredHref) ||
      /\.tistory\.com\/manage(\/|$)/i.test(loweredHref)
    ) {
      return SITE_KIND.TISTORY;
    }
    return SITE_KIND.GENERIC;
  };

  const getCurrentSiteKind = () => {
    const direct = detectSiteKind(document, getDocHref(document));
    if (direct !== SITE_KIND.GENERIC) {
      state.site = direct;
      return direct;
    }
    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      const detected = detectSiteKind(frameDoc, getDocHref(frameDoc));
      if (detected !== SITE_KIND.GENERIC) {
        state.site = detected;
        return detected;
      }
    }
    state.site = SITE_KIND.GENERIC;
    return SITE_KIND.GENERIC;
  };

  const getSiteContentRoot = (site, doc = document) =>
    findSiteEditableInDocument(site, doc);

  const findNaverEditableInDocument = (doc) => {
    if (!doc) return null;
    const selection = doc.getSelection();
    if (selection && selection.anchorNode) {
      const element =
        selection.anchorNode.nodeType === Node.ELEMENT_NODE
          ? selection.anchorNode
          : selection.anchorNode.parentElement;
      if (isElementNode(element)) {
        const rootHit = element.closest(NAVER_ROOT_SELECTORS.join(","));
        if (rootHit) {
          const resolved = resolveNaverTarget(rootHit);
          if (resolved) return resolved;
        }
        const paragraph = element.closest(NAVER_PARAGRAPH_SELECTORS.join(","));
        if (paragraph) {
          const resolved = resolveNaverTarget(paragraph);
          if (resolved) return resolved;
        }
      }
    }

    const paragraphs = Array.from(doc.querySelectorAll(NAVER_PARAGRAPH_SELECTORS.join(",")));
    let best = null;
    let bestScore = 0;

    for (const el of paragraphs) {
      if (!isElementNode(el)) continue;
      if (!isVisibleElement(el)) continue;
      const resolved = resolveNaverTarget(el);
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

    const nodes = Array.from(doc.querySelectorAll(NAVER_EDITABLE_SELECTORS.join(",")));
    let bestEditable = null;
    let bestEditableScore = 0;

    for (const el of nodes) {
      if (!isElementNode(el)) continue;
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

  const resolveNaverTarget = (el) => {
    if (!isElementNode(el)) return null;
    const root = el.closest(NAVER_ROOT_SELECTORS.join(","));
    if (isElementNode(root)) return root;
    const editable = el.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
    if (isElementNode(editable)) return editable;
    const container = el.closest(NAVER_EDITABLE_SELECTORS.join(","));
    if (isElementNode(container)) return container;
    return el;
  };

  const resolveTistoryTarget = (el) => {
    if (!isElementNode(el)) return null;
    if (el instanceof HTMLIFrameElement) {
      try {
        const frameDoc = el.contentDocument;
        const editable = findTistoryBodyEditable(frameDoc || document);
        if (editable) return editable;
      } catch {
        // Ignore cross-origin access errors.
      }
    }
    const root = el.closest(TISTORY_ROOT_SELECTORS.join(","));
    if (isElementNode(root)) return root;
    const editable = el.closest("[contenteditable='true'], [contenteditable='plaintext-only'], textarea");
    if (isElementNode(editable)) return editable;
    const container = el.closest(TISTORY_EDITABLE_SELECTORS.join(","));
    if (isElementNode(container)) return container;
    return el;
  };

  const getTistoryEditorIframeDoc = (doc = document) => {
    if (!doc) return null;
    if (
      doc.body &&
      (doc.body.id === "tinymce" ||
        doc.body.classList?.contains("mce-content-body") ||
        doc.querySelector(".mce-content-body"))
    ) {
      return doc;
    }
    const frames = [];
    for (const selector of TISTORY_IFRAME_SELECTORS) {
      const found = Array.from(doc.querySelectorAll(selector));
      for (const frame of found) {
        if (frame instanceof HTMLIFrameElement) frames.push(frame);
      }
    }
    for (const frame of frames) {
      try {
        const frameDoc = frame.contentDocument;
        if (!frameDoc) continue;
        if (frameDoc.body) return frameDoc;
      } catch {
        // Ignore cross-origin access errors.
      }
    }
    return null;
  };

  const getTistoryTinyMceBody = (doc = document) => {
    const resolveBodyFromTinyMce = (hostWindow) => {
      if (!hostWindow) return null;
      try {
        const tinymce = hostWindow.tinymce;
        if (!tinymce || typeof tinymce.get !== "function") return null;
        const editor =
          tinymce.get("editor-tistory") ||
          tinymce.activeEditor ||
          (Array.isArray(tinymce.editors) ? tinymce.editors[0] : null);
        const body = editor?.getBody?.();
        if (isElementNode(body) && body.isContentEditable) {
          return body;
        }
      } catch {
        // Ignore access/runtime errors.
      }
      return null;
    };

    const ownWindow = getDocWindow(doc);
    const ownBody = resolveBodyFromTinyMce(ownWindow);
    if (ownBody) return ownBody;

    try {
      const topWindow = window.top;
      if (topWindow && topWindow !== ownWindow) {
        const topBody = resolveBodyFromTinyMce(topWindow);
        if (topBody) return topBody;
      }
    } catch {
      // Ignore cross-origin access errors.
    }

    return null;
  };

  const findTistoryBodyEditable = (doc = document) => {
    if (!doc) return null;
    const tinyMceBody = getTistoryTinyMceBody(doc);
    if (tinyMceBody) return tinyMceBody;
    const tinymceBody = doc.querySelector("body#tinymce, body.mce-content-body");
    if (isElementNode(tinymceBody) && tinymceBody.isContentEditable) {
      return tinymceBody;
    }
    if (doc.body && doc.body.isContentEditable) {
      return doc.body;
    }
    const frameDoc = getTistoryEditorIframeDoc(doc);
    if (!frameDoc) return null;
    const candidates = [
      frameDoc.querySelector("#tinymce"),
      frameDoc.querySelector(".mce-content-body"),
      frameDoc.querySelector("[contenteditable='true']"),
      frameDoc.body,
    ];
    for (const candidate of candidates) {
      if (!isElementNode(candidate)) continue;
      if (!candidate.isContentEditable && candidate !== frameDoc.body) continue;
      if (candidate === frameDoc.body && !candidate.isContentEditable) continue;
      return candidate;
    }
    return null;
  };

  const getPreferredTistoryTarget = (currentTarget = null) => {
    const titleInput = document.querySelector("#post-title-inp");
    const titleText = isTextAreaNode(titleInput) ? titleInput.value || "" : "";
    const currentIsTitleTarget =
      isTextAreaNode(currentTarget) && currentTarget.id === "post-title-inp";
    if (
      isTextAreaNode(titleInput) &&
      document.activeElement === titleInput
    ) {
      return titleInput;
    }

    const frameDoc = getSiteFrameDocument(SITE_KIND.TISTORY) || getTistoryEditorIframeDoc(document);
    const bodyEditable = findTistoryBodyEditable(frameDoc || document);
    const bodyText =
      isElementNode(bodyEditable)
        ? bodyEditable.innerText || bodyEditable.textContent || ""
        : "";
    if (currentIsTitleTarget && textContainsCurrentQueryLoosely(titleText)) {
      return currentTarget;
    }
    if (textContainsCurrentQueryLoosely(titleText) && isTextAreaNode(titleInput)) {
      return titleInput;
    }
    if (textContainsCurrentQueryLoosely(bodyText) && bodyEditable) {
      return bodyEditable;
    }

    if (
      currentIsTitleTarget &&
      bodyEditable &&
      state.searchText &&
      !textContainsCurrentQueryLoosely(titleText)
    ) {
      return bodyEditable;
    }

    if (frameDoc) {
      const frameActive = frameDoc.activeElement;
      if (
        frameActive === frameDoc.body ||
        (isElementNode(frameActive) &&
          (frameActive.isContentEditable || frameActive.closest(".mce-content-body")))
      ) {
        return bodyEditable || frameActive;
      }
      const selection = frameDoc.getSelection();
      if (selection && selection.rangeCount > 0) {
        const anchor = selection.anchorNode;
        if (anchor) {
          return bodyEditable || frameDoc.body;
        }
      }
    }

    if (isElementNode(currentTarget)) return currentTarget;
    if (bodyEditable) return bodyEditable;
    if (isTextAreaNode(titleInput)) return titleInput;
    return null;
  };

  const normalizeTargetForSite = (site, target) => {
    if (!isElementNode(target)) return target;
    if (site === SITE_KIND.TISTORY) {
      return resolveTistoryTarget(target) || target;
    }
    return target;
  };

  const findTistoryEditableInDocument = (doc) => {
    if (!doc) return null;
    const bodyEditable = findTistoryBodyEditable(doc);
    if (bodyEditable) return bodyEditable;

    const selection = doc.getSelection();
    if (selection && selection.anchorNode) {
      const anchor =
        selection.anchorNode.nodeType === Node.ELEMENT_NODE
          ? selection.anchorNode
          : selection.anchorNode.parentElement;
      if (isElementNode(anchor)) {
        const fromSelection = resolveTistoryTarget(anchor);
        if (fromSelection && isVisibleElement(fromSelection)) return fromSelection;
      }
    }

    const active = doc.activeElement;
    if (isElementNode(active)) {
      const fromActive = resolveTistoryTarget(active);
      if (fromActive && isVisibleElement(fromActive)) return fromActive;
    }

    const candidates = Array.from(doc.querySelectorAll(TISTORY_EDITABLE_SELECTORS.join(",")));
    let best = null;
    let bestScore = 0;
    for (const el of candidates) {
      if (!isElementNode(el)) continue;
      const resolved = resolveTistoryTarget(el);
      if (!isElementNode(resolved)) continue;
      if (!isVisibleElement(resolved)) continue;
      const textLength = (resolved.innerText || resolved.value || "").trim().length;
      const rect = resolved.getBoundingClientRect();
      const area = rect.width * rect.height;
      const rootBonus = resolved.matches(".ProseMirror, .toastui-editor-contents, .tt-editor-contents")
        ? 10000
        : 0;
      const score = area + textLength * 1000 + rootBonus;
      if (score > bestScore) {
        best = resolved;
        bestScore = score;
      }
    }
    return best;
  };

  const findSiteEditableInDocument = (site, doc) => {
    if (site === SITE_KIND.NAVER) return findNaverEditableInDocument(doc);
    if (site === SITE_KIND.TISTORY) return findTistoryEditableInDocument(doc);
    return null;
  };

  const findEditableInFrames = () => {
    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      const direct = getActiveEditableInDocument(frameDoc);
      if (direct) return direct;
      const site = detectSiteKind(frameDoc, getDocHref(frameDoc));
      const fallback = findEditableFallback(frameDoc) || getSiteContentRoot(site, frameDoc);
      if (fallback) return fallback;
    }
    return null;
  };

  const findSiteEditableInFrames = (site) => {
    if (site === SITE_KIND.GENERIC) return null;
    let best = null;
    let bestScore = 0;

    const frameDocs = collectFrameDocs(document, 2);
    for (const frameDoc of frameDocs) {
      const candidate = findSiteEditableInDocument(site, frameDoc);
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

  const getSiteFrameDocument = (site) => {
    if (site === SITE_KIND.NAVER) {
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
      if (baseDoc && isSiteEditorDocument(site, baseDoc)) return baseDoc;
      if (baseDoc) {
        const nestedDocs = collectFrameDocs(baseDoc, 2);
        const nested = nestedDocs.find((doc) => isSiteEditorDocument(site, doc));
        if (nested) return nested;
      }
    }
    if (site === SITE_KIND.TISTORY) {
      const directIframe = document.querySelector("#editor-tistory_ifr");
      if (directIframe instanceof HTMLIFrameElement) {
        try {
          const directDoc = directIframe.contentDocument;
          if (
            directDoc &&
            directDoc.body &&
            directDoc.body.id === "tinymce" &&
            directDoc.body.isContentEditable
          ) {
            return directDoc;
          }
        } catch {
          // Ignore cross-origin access errors.
        }
      }
      const tistoryDoc = getTistoryEditorIframeDoc(document);
      if (tistoryDoc) return tistoryDoc;
    }
    const fallbackDocs = collectFrameDocs(document, 2);
    const fallback = fallbackDocs.find((doc) => isSiteEditorDocument(site, doc));
    return fallback || null;
  };

  const getContextDocumentForSite = (site) => {
    if (site === SITE_KIND.GENERIC) return document;
    return getSiteFrameDocument(site) || document;
  };

  const getPreferredTargetForSite = (site, target) => {
    if (site === SITE_KIND.TISTORY) {
      return getPreferredTistoryTarget(target) || target;
    }
    return target;
  };

  const getInitialTargetForSite = (site) => {
    if (site === SITE_KIND.GENERIC) {
      return getActiveEditable() || findEditableFallback() || findEditableInFrames();
    }
    const siteDoc = getContextDocumentForSite(site);
    if (site === SITE_KIND.TISTORY) {
      const bodyTarget = findTistoryBodyEditable(siteDoc);
      if (bodyTarget) return bodyTarget;
      return (
        getFocusedSiteRoot(site, siteDoc) ||
        findSiteEditableInDocument(site, siteDoc) ||
        findEditableFallback() ||
        findEditableInFrames()
      );
    }
    return (
      getFocusedSiteRoot(site, siteDoc) ||
      findSiteEditableInDocument(site, siteDoc) ||
      findSiteEditableInFrames(site) ||
      findEditableFallback() ||
      findEditableInFrames()
    );
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

  const dispatchInputEvents = (target, text, options = {}) => {
    if (!target) return;
    if (options.plainInputEvent) {
      target.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (typeof InputEvent === "undefined") return;
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

  const syncInputValue = (target, nextValue, insertedText = "", options = {}) => {
    if (!isTextControlNode(target)) return;
    const proto =
      isTextAreaNode(target)
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(target, nextValue);
    } else {
      target.value = nextValue;
    }
    dispatchInputEvents(target, insertedText, options);
    target.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const getFocusedSiteRoot = (site, doc) => {
    if (!doc) return null;
    if (site === SITE_KIND.NAVER) {
      const focused = doc.querySelector(NAVER_FOCUSED_SELECTORS.join(","));
      if (isElementNode(focused) && isVisibleElement(focused)) {
        return focused;
      }
      return null;
    }
    if (site === SITE_KIND.TISTORY) {
      if (
        doc.body &&
        doc.body.id === "tinymce" &&
        doc.body.isContentEditable
      ) {
        return doc.body;
      }
      const iframeEditable = findTistoryBodyEditable(doc);
      if (iframeEditable) return iframeEditable;
      const focusedBySelector = doc.querySelector(TISTORY_FOCUSED_SELECTORS.join(","));
      if (isElementNode(focusedBySelector) && isVisibleElement(focusedBySelector)) {
        const resolved = resolveTistoryTarget(focusedBySelector);
        if (isElementNode(resolved) && isVisibleElement(resolved)) return resolved;
      }
      const active = doc.activeElement;
      if (isElementNode(active)) {
        const focused = resolveTistoryTarget(active);
        if (isElementNode(focused) && isVisibleElement(focused)) return focused;
      }
    }
    return null;
  };

  const getTistorySearchRoots = (doc, target) => {
    if (!doc) return isElementNode(target) ? [target] : [];
    const tinyMceBody =
      (doc.body &&
      doc.body.id === "tinymce" &&
      doc.body.isContentEditable
        ? doc.body
        : null) || findTistoryBodyEditable(doc);
    if (tinyMceBody) {
      return [tinyMceBody];
    }
    const normalizedTarget = normalizeTargetForSite(SITE_KIND.TISTORY, target);
    const roots = [];
    const pushRoot = (root) => {
      if (!isElementNode(root)) return;
      if (!isVisibleElement(root)) return;
      if (!roots.some((saved) => saved === root || saved.contains(root))) {
        const filtered = roots.filter((saved) => !root.contains(saved));
        roots.length = 0;
        roots.push(...filtered, root);
      }
    };

    const focused = getFocusedSiteRoot(SITE_KIND.TISTORY, doc);
    if (focused) pushRoot(focused);

    if (isElementNode(normalizedTarget) && normalizedTarget.ownerDocument === doc) {
      pushRoot(normalizedTarget);
    }

    const paragraphRoots = Array.from(doc.querySelectorAll(TISTORY_PARAGRAPH_SELECTORS.join(",")));
    for (const paragraph of paragraphRoots) {
      if (!isElementNode(paragraph)) continue;
      if (isElementNode(normalizedTarget) && paragraph.contains(normalizedTarget)) {
        pushRoot(paragraph.closest(TISTORY_ROOT_SELECTORS.join(",")) || paragraph);
      }
    }

    const discoveredRoots = Array.from(doc.querySelectorAll(TISTORY_ROOT_SELECTORS.join(",")));
    for (const root of discoveredRoots) {
      if (!isElementNode(root)) continue;
      if (
        isElementNode(normalizedTarget) &&
        root !== normalizedTarget &&
        !root.contains(normalizedTarget) &&
        !normalizedTarget.contains(root)
      ) {
        continue;
      }
      pushRoot(root);
    }

    if (!roots.length && isElementNode(normalizedTarget)) {
      pushRoot(normalizedTarget);
    }

    return roots;
  };

  const getSearchRootsForSite = (site, doc, target) => {
    if (!doc) return isElementNode(target) ? [target] : [];
    if (site === SITE_KIND.NAVER) {
      const componentRoots = Array.from(
        doc.querySelectorAll(".se-components-wrap .se-component")
      ).filter((el) => isElementNode(el) && isVisibleElement(el));
      if (componentRoots.length) {
        return componentRoots.filter((root) => {
          return !componentRoots.some(
            (other) => other !== root && other.contains(root)
          );
        });
      }
      const roots = Array.from(doc.querySelectorAll(NAVER_ROOT_SELECTORS.join(","))).filter(
        (el) => isElementNode(el) && isVisibleElement(el)
      );
      if (roots.length) {
        return roots.filter((root) => !roots.some((other) => other !== root && other.contains(root)));
      }
      return Array.from(doc.querySelectorAll(NAVER_PARAGRAPH_SELECTORS.join(","))).filter(
        (el) => isElementNode(el) && isVisibleElement(el)
      );
    }
    if (site === SITE_KIND.TISTORY) {
      const roots = getTistorySearchRoots(doc, target);
      if (roots.length) return roots;
    }
    return isElementNode(target) ? [target] : [];
  };

  const isPlaceholderNodeForSite = (site, node) => {
    if (!isElementNode(node)) return false;
    if (site === SITE_KIND.NAVER) {
      return node.classList.contains("__se_placeholder") || node.classList.contains("se-placeholder");
    }
    if (site === SITE_KIND.TISTORY) {
      return (
        node.classList.contains("placeholder") ||
        node.classList.contains("is-empty") ||
        node.getAttribute("data-placeholder") != null
      );
    }
    return false;
  };

  const isBlogWriteContext = () => getCurrentSiteKind() !== SITE_KIND.GENERIC;

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

  const textMatchesCurrentQuery = (text) => {
    if (!state.searchText || typeof text !== "string") return false;
    const regex = getSearchRegex();
    if (!regex) return false;
    const localRegex = new RegExp(regex.source, regex.flags);
    return localRegex.test(text);
  };

  const textContainsCurrentQueryLoosely = (text) => {
    if (!state.searchText || typeof text !== "string") return false;
    if (state.useRegex) {
      return textMatchesCurrentQuery(text);
    }
    const needle = state.caseSensitive ? state.searchText : state.searchText.toLowerCase();
    const haystack = state.caseSensitive ? text : text.toLowerCase();
    return haystack.includes(needle);
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
    const site = getCurrentSiteKind();
    const roots = getSearchRootsForSite(site, doc, state.target);
    if (!roots.length) return null;

    const needle = state.caseSensitive ? state.searchText : state.searchText.toLowerCase();
    const applyWordBoundary =
      state.wholeWord && WORD_ONLY_REGEX.test(state.searchText);
    let count = 0;

    for (const root of roots) {
      if (!isElementNode(root)) continue;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent && isPlaceholderNodeForSite(site, parent)) {
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

  const getRefreshStateKey = (site, target) => {
    const targetId = getNodeId(target);
    const targetDocId =
      target && target.ownerDocument ? getNodeId(target.ownerDocument) : "none";
    let cursorKey = "";
    if (isTextControlNode(target)) {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      cursorKey = `${start}:${end}:${(target.value || "").length}`;
    } else if (isElementNode(target)) {
      const doc = target.ownerDocument || document;
      const selection = doc.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorKey = `${getNodeId(range.startContainer)}:${range.startOffset}:${getNodeId(
          range.endContainer
        )}:${range.endOffset}`;
      }
    }
    return [
      site,
      state.searchText,
      state.caseSensitive,
      state.wholeWord,
      state.useRegex,
      targetId,
      targetDocId,
      cursorKey,
      state.refreshToken,
    ].join("|");
  };

  const performRefreshMatches = () => {
    const previousActiveIndex = state.activeIndex;
    const site = getCurrentSiteKind();
    if (site === SITE_KIND.TISTORY && state.suppressTistoryHighlightUntilSearchChange) {
      state.matches = [];
      state.activeIndex = 0;
      state.lastRefreshKey = "";
      updateCount();
      clearHighlights();
      hideTitleMatchOverlay();
      return;
    }

    let target = state.target;
    if (site === SITE_KIND.TISTORY) {
      const keepTitleTarget =
        isTextAreaNode(target) && target.id === "post-title-inp";
      const directIframe = document.querySelector("#editor-tistory_ifr");
      try {
        const directBody = directIframe?.contentDocument?.body;
        if (
          !keepTitleTarget &&
          isElementNode(directBody) &&
          directBody.id === "tinymce" &&
          directBody.isContentEditable
        ) {
          state.target = directBody;
          target = directBody;
        }
      } catch {
        // Ignore cross-origin access errors.
      }
      const tistoryDoc = getSiteFrameDocument(site) || getTistoryEditorIframeDoc(document);
      const tistoryBody = findTistoryBodyEditable(tistoryDoc || document);
      if (
        !keepTitleTarget &&
        isElementNode(tistoryBody) &&
        tistoryBody.isContentEditable
      ) {
        state.target = tistoryBody;
        target = tistoryBody;
      }
    }
    if (!target) {
      target = getInitialTargetForSite(site);
      state.target = target;
    }
    if (site !== SITE_KIND.GENERIC) {
      const siteDoc = getContextDocumentForSite(site);
      const focusedRoot = getFocusedSiteRoot(site, siteDoc);
      const blogTarget = focusedRoot || findSiteEditableInDocument(site, siteDoc);
      if (blogTarget) {
        state.target = blogTarget;
        target = blogTarget;
      }
    }
    const preferredTarget = getPreferredTargetForSite(site, target);
    if (preferredTarget) {
      state.target = preferredTarget;
      target = preferredTarget;
    }
    target = normalizeTargetForSite(site, target);
    if (target) {
      state.target = target;
    }
    const refreshKey = getRefreshStateKey(site, target);
    if (state.lastRefreshKey === refreshKey) {
      return;
    }
    state.lastRefreshKey = refreshKey;

    state.matches = [];
    state.activeIndex = 0;
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

    if (isTextControlNode(target)) {
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
    } else if (isElementNode(target)) {
      const doc = target.ownerDocument || document;
      const frameDoc = site !== SITE_KIND.GENERIC ? getSiteFrameDocument(site) : null;
      const blogDoc =
        site === SITE_KIND.TISTORY
          ? target.ownerDocument || frameDoc || doc
          : site !== SITE_KIND.GENERIC
            ? frameDoc || doc
            : doc;
      const roots = getSearchRootsForSite(site, blogDoc, target);
      const searchRoots = roots.length ? roots : [target];
      if (roots.length && target.ownerDocument !== roots[0].ownerDocument) {
        state.target = roots[0];
        target = roots[0];
        ensureDocListeners(target.ownerDocument || document);
      }

      for (const root of searchRoots) {
        if (!isElementNode(root)) continue;
        const walkerDoc = root.ownerDocument || doc;
        const walker = walkerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (parent && isPlaceholderNodeForSite(site, parent)) {
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

  const refreshMatches = (options = {}) => {
    if (options.bumpToken !== false) {
      bumpRefreshToken();
    }
    if (state.refreshRaf !== null) {
      cancelAnimationFrame(state.refreshRaf);
    }
    state.refreshRaf = requestAnimationFrame(() => {
      state.refreshRaf = null;
      performRefreshMatches();
    });
  };

  const refreshMatchesNow = (options = {}) => {
    if (options.bumpToken !== false) {
      bumpRefreshToken();
    }
    if (state.refreshRaf !== null) {
      cancelAnimationFrame(state.refreshRaf);
      state.refreshRaf = null;
    }
    performRefreshMatches();
  };

  const resolveActiveIndex = (target, matches, previousActiveIndex) => {
    if (!matches.length) return 0;

    if (isPanelInteractionActive()) {
      const fallback = Math.min(previousActiveIndex - 1, matches.length - 1);
      if (fallback >= 0) return fallback;
      return 0;
    }

    if (isTextControlNode(target)) {
      const cursor = target.selectionStart ?? 0;
      let index = matches.findIndex(
        (match) => cursor >= match.start && cursor <= match.end
      );
      if (index === -1) {
        index = matches.findIndex((match) => match.start >= cursor);
      }
      return index === -1 ? matches.length - 1 : index;
    }

    if (isElementNode(target)) {
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
    state.lastAppliedHighlightKey = "";
  };

  const applyHighlights = () => {
    if (!state.target || !isElementNode(state.target)) {
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
    const activeIndex = state.activeIndex - 1;
    const first = state.matches[0];
    const last = state.matches[state.matches.length - 1];
    const highlightKey = [
      getNodeId(doc),
      activeIndex,
      state.matches.length,
      first ? `${getNodeId(first.node)}:${first.start}:${first.end}` : "none",
      last ? `${getNodeId(last.node)}:${last.start}:${last.end}` : "none",
    ].join("|");
    if (state.lastAppliedHighlightKey === highlightKey && state.highlightDoc === doc) {
      return;
    }
    state.lastAppliedHighlightKey = highlightKey;

    const highlight = new Highlight();
    const activeHighlight = new Highlight();
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

  const applyTextControlActiveMatch = ({ forceFocus = false } = {}) => {
    const target = state.target;
    if (!isTextControlNode(target)) return;
    if (!state.matches.length) return;
    const index = Math.max(0, state.activeIndex - 1);
    const match = state.matches[index] || state.matches[0];
    if (!match) return;
    if (forceFocus && target.id !== "post-title-inp") {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }
    try {
      target.setSelectionRange(match.start, match.end);
    } catch {
      // Ignore selection errors on unsupported controls.
    }
  };

  const getTistoryTitleInput = (doc = document) => {
    if (!doc) return null;
    const titleInput = doc.querySelector("#post-title-inp");
    if (!isTextAreaNode(titleInput)) return null;
    return titleInput;
  };

  const hideTitleMatchOverlay = () => {
    if (!isElementNode(state.titleMatchOverlay)) return;
    state.titleMatchOverlay.style.display = "none";
  };

  const ensureTitleMatchOverlay = (titleInput) => {
    if (!isTextAreaNode(titleInput)) return null;
    const wrapper = titleInput.parentElement;
    if (!isElementNode(wrapper)) return null;
    const wrapperStyle = getDocWindow(wrapper.ownerDocument).getComputedStyle(wrapper);
    if (wrapperStyle.position === "static") {
      wrapper.style.position = "relative";
    }
    let overlay = state.titleMatchOverlay;
    if (!isElementNode(overlay) || overlay.ownerDocument !== titleInput.ownerDocument) {
      overlay = titleInput.ownerDocument.createElement("div");
      overlay.className = "finder-title-match-overlay";
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.whiteSpace = "pre-wrap";
      overlay.style.overflow = "hidden";
      overlay.style.wordBreak = "break-word";
      overlay.style.zIndex = "2147483646";
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      wrapper.appendChild(overlay);
      state.titleMatchOverlay = overlay;
      return overlay;
    }
    if (!overlay.isConnected || overlay.parentElement !== wrapper) {
      wrapper.appendChild(overlay);
    }
    return overlay;
  };

  const getTitleMatches = (value) => {
    if (!state.searchText) return [];
    const regex = getSearchRegex();
    if (!regex) return [];
    const matches = [];
    const localRegex = new RegExp(regex.source, regex.flags);
    let match = null;
    while ((match = localRegex.exec(value))) {
      matches.push({ start: match.index, end: match.index + match[0].length });
      if (match[0].length === 0) localRegex.lastIndex += 1;
    }
    return matches;
  };

  const applyTitleMatchOverlay = () => {
    if (root.style.display == "none") {
      hideTitleMatchOverlay();
      return;
    }
    if (getCurrentSiteKind() !== SITE_KIND.TISTORY) {
      hideTitleMatchOverlay();
      return;
    }
    const titleInput = getTistoryTitleInput(document);
    if (!titleInput) {
      hideTitleMatchOverlay();
      return;
    }
    const value = titleInput.value || "";
    const matches = getTitleMatches(value);
    if (!matches.length) {
      hideTitleMatchOverlay();
      return;
    }
    const overlay = ensureTitleMatchOverlay(titleInput);
    if (!overlay) return;

    const style = getDocWindow(titleInput.ownerDocument).getComputedStyle(titleInput);
    const titleTextColor = style.color || "#111827";
    overlay.style.font = style.font;
    overlay.style.fontFamily = style.fontFamily;
    overlay.style.fontSize = style.fontSize;
    overlay.style.fontWeight = style.fontWeight;
    overlay.style.fontStyle = style.fontStyle;
    overlay.style.lineHeight = style.lineHeight;
    overlay.style.letterSpacing = style.letterSpacing;
    overlay.style.textTransform = style.textTransform;
    overlay.style.textIndent = style.textIndent;
    overlay.style.textAlign = style.textAlign;
    overlay.style.paddingTop = style.paddingTop;
    overlay.style.paddingRight = style.paddingRight;
    overlay.style.paddingBottom = style.paddingBottom;
    overlay.style.paddingLeft = style.paddingLeft;
    overlay.style.borderTopWidth = style.borderTopWidth;
    overlay.style.borderRightWidth = style.borderRightWidth;
    overlay.style.borderBottomWidth = style.borderBottomWidth;
    overlay.style.borderLeftWidth = style.borderLeftWidth;
    overlay.style.borderTopStyle = style.borderTopStyle;
    overlay.style.borderRightStyle = style.borderRightStyle;
    overlay.style.borderBottomStyle = style.borderBottomStyle;
    overlay.style.borderLeftStyle = style.borderLeftStyle;
    overlay.style.borderTopColor = "transparent";
    overlay.style.borderRightColor = "transparent";
    overlay.style.borderBottomColor = "transparent";
    overlay.style.borderLeftColor = "transparent";
    overlay.style.boxSizing = style.boxSizing;
    overlay.style.borderRadius = style.borderRadius;
    overlay.style.color = "transparent";
    overlay.style.background = "transparent";
    overlay.style.top = `${titleInput.offsetTop}px`;
    overlay.style.left = `${titleInput.offsetLeft}px`;
    overlay.style.height = `${Math.max(titleInput.clientHeight, titleInput.scrollHeight)}px`;
    overlay.style.width = `${titleInput.clientWidth}px`;
    overlay.scrollTop = titleInput.scrollTop;
    overlay.scrollLeft = titleInput.scrollLeft;

    const target = state.target;
    const activeIndex =
      isTextAreaNode(target) && target.id === "post-title-inp"
        ? Math.max(0, Math.min(matches.length - 1, state.activeIndex - 1))
        : -1;
    let cursor = 0;
    const htmlParts = [];
    for (let i = 0; i < matches.length; i += 1) {
      const hit = matches[i];
      if (hit.start > cursor) {
        htmlParts.push(toOverlayHtml(value.slice(cursor, hit.start)));
      }
      const hitStyle =
        i === activeIndex
          ? `background:rgba(59,130,246,.7);outline:1px solid rgba(59,130,246,.9);color:${titleTextColor};`
          : `background:rgba(59,130,246,.35);outline:1px solid rgba(59,130,246,.7);color:${titleTextColor};`;
      htmlParts.push(
        `<span style="${hitStyle}">${toOverlayHtml(value.slice(hit.start, hit.end))}</span>`
      );
      cursor = hit.end;
    }
    if (cursor < value.length) {
      htmlParts.push(toOverlayHtml(value.slice(cursor)));
    }
    overlay.innerHTML = htmlParts.join("");
    overlay.style.display = "block";
  };

  function scheduleTitleHighlightSync() {
    if (state.titleHighlightTimer) {
      clearTimeout(state.titleHighlightTimer);
      state.titleHighlightTimer = null;
    }
    state.titleHighlightTimer = setTimeout(() => {
      state.titleHighlightTimer = null;
      if (root.style.display == "none") return;
      if (getCurrentSiteKind() !== SITE_KIND.TISTORY) return;
      applyTitleMatchOverlay();
    }, 220);
  }

  const selectMatch = (match) => {
    if (!match) return;
    const target = state.target;
    if (!target) return;

    if (isTextControlNode(target)) {
      target.focus();
      target.setSelectionRange(match.start, match.end);
    } else if (isElementNode(target) && match.node) {
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
    if (getCurrentSiteKind() === SITE_KIND.TISTORY) {
      state.suppressTistoryHighlightUntilSearchChange = false;
      state.lastRefreshKey = "";
    }
    refreshMatchesNow({ bumpToken: false });
    if (!state.matches.length) return;
    let nextIndex = state.activeIndex - 1 + direction;
    if (nextIndex < 0) nextIndex = state.matches.length - 1;
    if (nextIndex >= state.matches.length) nextIndex = 0;
    state.activeIndex = nextIndex + 1;
    selectMatch(state.matches[nextIndex]);
    updateCount();
    applyHighlights();
    applyTextControlActiveMatch();
  };

  const resolveReplaceTarget = () => {
    let target = state.target;
    const site = getCurrentSiteKind();
    if (!target) {
      target = getInitialTargetForSite(site);
    }
    target = getPreferredTargetForSite(site, target);
    if (!target) return null;
    target = normalizeTargetForSite(site, target);
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

  const replaceTextNodeRange = (node, start, end, replacement) => {
    if (!node) return false;
    const text = node.nodeValue || "";
    if (start < 0 || end < start || end > text.length) return false;
    node.nodeValue = text.slice(0, start) + replacement + text.slice(end);
    return true;
  };

  const replaceCurrent = (overrideIndex) => {
    const site = getCurrentSiteKind();
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
    if (isTopFrame && target.ownerDocument !== document && site !== SITE_KIND.TISTORY) {
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
    refreshMatchesNow();
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
    if (isTextControlNode(activeTarget)) {
      const isTistoryTitleTarget =
        site === SITE_KIND.TISTORY &&
        isTextAreaNode(activeTarget) &&
        activeTarget.id === "post-title-inp";
      const text = activeTarget.value || "";
      const singleFlags = regex.flags.replace("g", "");
      const singleRegex = new RegExp(regex.source, singleFlags);
      const before = text.slice(0, match.start);
      const targetText = text.slice(match.start, match.end);
      const replacement = targetText.replace(singleRegex, state.replaceText);
      const nextValue = before + replacement + text.slice(match.end);
      syncInputValue(activeTarget, nextValue, state.replaceText, {
        plainInputEvent: isTistoryTitleTarget,
      });
      const nextCaret = before.length + replacement.length;
      activeTarget.setSelectionRange(nextCaret, nextCaret);
    } else if (isElementNode(activeTarget) && match.node) {
      activeTarget.focus();
      const doc = match.node.ownerDocument || document;
      const selection = doc.getSelection();
      if (!selection) return;
      const range = doc.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      selection.removeAllRanges();
      selection.addRange(range);
      if (site === SITE_KIND.TISTORY) {
        replaceTextNodeRange(match.node, match.start, match.end, state.replaceText);
      } else {
        const replaced = doc.execCommand("insertText", false, state.replaceText);
        if (!replaced && match.node) {
          replaceTextNodeRange(match.node, match.start, match.end, state.replaceText);
        }
      }
    }

    if (site === SITE_KIND.TISTORY) {
      state.suppressTistoryHighlightUntilSearchChange = false;
      state.lastRefreshKey = "";
      clearHighlights();
      hideTitleMatchOverlay();
      refreshMatchesNow({ bumpToken: false });
      applyTextControlActiveMatch();
      scheduleTitleHighlightSync();
    } else {
      refreshMatchesNow();
    }
    state.target = activeTarget;
  };

  const replaceAll = () => {
    const regex = getSearchRegex();
    const site = getCurrentSiteKind();
    if (regex && site === SITE_KIND.NAVER) {
      const nodes = Array.from(document.querySelectorAll(".__se-node"));
      if (nodes.length) {
        for (const node of nodes) {
          if (!isElementNode(node)) continue;
          const text = node.textContent || "";
          node.textContent = text.replace(regex, state.replaceText);
        }
        refreshMatchesNow();
        return;
      }
    }
    if (isTopFrame && site === SITE_KIND.NAVER) {
      const frameDoc = getSiteFrameDocument(site);
      if (frameDoc && regex) {
        const nodes = Array.from(frameDoc.querySelectorAll(".__se-node"));
        for (const node of nodes) {
          if (!isElementNode(node)) continue;
          const text = node.textContent || "";
          node.textContent = text.replace(regex, state.replaceText);
        }
        refreshMatchesNow();
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
    if (isTopFrame && target.ownerDocument !== document && site !== SITE_KIND.TISTORY) {
      if (
        postMessageToFrameByDoc(target.ownerDocument, {
          type: "finder-replace-all",
          state: getSearchStatePayload(),
        })
      ) {
        return;
      }
    }
    refreshMatchesNow({ bumpToken: false });
    if (!regex) return;

    if (isTextControlNode(target)) {
      const isTistoryTitleTarget =
        site === SITE_KIND.TISTORY &&
        isTextAreaNode(target) &&
        target.id === "post-title-inp";
      const text = target.value || "";
      const nextValue = text.replace(regex, state.replaceText);
      syncInputValue(target, nextValue, state.replaceText, {
        plainInputEvent: isTistoryTitleTarget,
      });
    } else if (isElementNode(target)) {
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
        if (site === SITE_KIND.TISTORY) {
          if (match.node) {
            replaceTextNodeRange(match.node, match.start, match.end, state.replaceText);
          }
        } else {
          selection.removeAllRanges();
          selection.addRange(range);
          const replaced = doc.execCommand("insertText", false, state.replaceText);
          if (!replaced && match.node) {
            replaceTextNodeRange(match.node, match.start, match.end, state.replaceText);
          }
        }
      }
    }

    if (site === SITE_KIND.TISTORY) {
      state.suppressTistoryHighlightUntilSearchChange = true;
      state.matches = [];
      state.activeIndex = 0;
      state.lastRefreshKey = "";
      updateCount();
      clearHighlights();
      hideTitleMatchOverlay();
    } else {
      refreshMatchesNow();
    }
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
    if (state.titleHighlightTimer) {
      clearTimeout(state.titleHighlightTimer);
      state.titleHighlightTimer = null;
    }
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

    const site = getCurrentSiteKind();
    let target = getActiveEditable();
    if (!target && (forceOpen || site !== SITE_KIND.GENERIC)) {
      target = getInitialTargetForSite(site);
    }
    if (!target) {
      if (forceOpen || site !== SITE_KIND.GENERIC) {
        broadcastToChildFrames(forceOpen || site !== SITE_KIND.GENERIC);
      }
      return;
    }
    target = getPreferredTargetForSite(site, target);

    target = normalizeTargetForSite(site, target);
    state.target = target;
    ensureDocListeners(target.ownerDocument || document);
    openPanel(false);

    const selectionText =
      selectionTextOverride ||
      (target ? getSelectionText(target) : "") ||
      getSelectionTextFromDocument(getSiteFrameDocument(site)) ||
      getSelectionTextFromSelectionBlocks(getSiteFrameDocument(site));
    if (selectionText) {
      state.searchText = selectionText;
      findInput.value = selectionText;
    }

    refreshMatchesNow();
    findInput.focus();
    findInput.select();
  };

  const getEditableFromTarget = (target) => {
    if (!isElementNode(target)) return null;
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
    const site = getCurrentSiteKind();
    const target = getEditableFromTarget(event?.target);
    if (isTextControlNode(target)) {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      if (start !== end && end - start <= 200) return target.value.slice(start, end);
    }

    const doc = target?.ownerDocument || document;
    return (
      getSelectionTextFromDocument(doc) ||
      getSelectionTextFromSelectionBlocks(doc) ||
      getSelectionTextFromDocument(getSiteFrameDocument(site)) ||
      getSelectionTextFromSelectionBlocks(getSiteFrameDocument(site))
    );
  };

  const openFromShortcut = (event, forceOpen = false) => {
    const site = getCurrentSiteKind();
    const shortcutTarget = getEditableFromTarget(event?.target) || getActiveEditable();
    const selectionText =
      getShortcutSelectionText(event) ||
      getSelectionTextFromSelectionBlocks(getSiteFrameDocument(site)) ||
      state.lastSelectionText;
    if (root.style.display != "none") {
      const target = shortcutTarget || state.target;
      if (target) {
        state.target = normalizeTargetForSite(site, target);
        if (selectionText) {
          state.searchText = selectionText;
          findInput.value = selectionText;
        }
        refreshMatchesNow();
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
    if (isTextControlNode(target)) {
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
        const site = getCurrentSiteKind();
        const wasOpen = root.style.display != "none";
        openFromShortcut({ target: document.activeElement }, true);
        const isOpen = root.style.display != "none";
        const hasFrameBackedTarget =
          isElementNode(state.target) && state.target.ownerDocument !== document;
        if (site === SITE_KIND.NAVER && (!isOpen || !hasFrameBackedTarget)) {
          broadcastToggle(true);
          return;
        }
        // Some Tistory editor contexts resolve target only inside nested frames.
        if (!wasOpen && !isOpen) {
          broadcastToggle(true);
        }
      }
    });
  }
})();
