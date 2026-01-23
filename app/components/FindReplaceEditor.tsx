"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import {
  SearchQuery,
  findNext,
  findPrevious,
  highlightSelectionMatches,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  setSearchQuery,
} from "@codemirror/search";

const initialDoc = `// Sample content
function greet(name) {
  return "Hello, " + name + "!";
}

const names = ["Ada", "Grace", "Linus", "Ada"];

for (const name of names) {
  console.log(greet(name));
}
`;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

type MatchRange = { from: number; to: number };

const getMatchRanges = (
  doc: string,
  query: string,
  options: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }
) => {
  if (!query) return [] as MatchRange[];

  const { caseSensitive, wholeWord, regex } = options;
  const matches: MatchRange[] = [];

  if (regex) {
    try {
      const flags = caseSensitive ? "g" : "gi";
      const pattern = new RegExp(query, flags);
      let match: RegExpExecArray | null = null;
      while ((match = pattern.exec(doc))) {
        if (match.index === undefined) break;
        const length = Math.max(match[0].length, 1);
        matches.push({ from: match.index, to: match.index + length });
        if (length === 1 && match[0].length === 0) {
          pattern.lastIndex += 1;
        }
      }
      return matches;
    } catch {
      return [];
    }
  }

  if (wholeWord) {
    const escaped = escapeRegExp(query);
    const flags = caseSensitive ? "g" : "gi";
    const pattern = new RegExp(`\\b${escaped}\\b`, flags);
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(doc))) {
      if (match.index === undefined) break;
      const length = Math.max(match[0].length, 1);
      matches.push({ from: match.index, to: match.index + length });
      if (length === 1 && match[0].length === 0) {
        pattern.lastIndex += 1;
      }
    }
    return matches;
  }

  const haystack = caseSensitive ? doc : doc.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const length = Math.max(needle.length, 1);
  let startIndex = 0;
  while (startIndex <= haystack.length) {
    const found = haystack.indexOf(needle, startIndex);
    if (found === -1) break;
    matches.push({ from: found, to: found + length });
    startIndex = found + length;
  }

  return matches;
};

export default function FindReplaceEditor() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const matchesRef = useRef<MatchRange[]>([]);

  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(true);
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchStateRef = useRef({
    searchText,
    caseSensitive,
    wholeWord,
    useRegex,
  });

  useEffect(() => {
    searchStateRef.current = {
      searchText,
      caseSensitive,
      wholeWord,
      useRegex,
    };
  }, [caseSensitive, searchText, useRegex, wholeWord]);

  const refreshMatches = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const docText = view.state.doc.toString();
    const { searchText, caseSensitive, wholeWord, useRegex } =
      searchStateRef.current;
    const matches = getMatchRanges(docText, searchText, {
      caseSensitive,
      wholeWord,
      regex: useRegex,
    });
    matchesRef.current = matches;

    const selectionFrom = view.state.selection.main.from;
    let currentIndex = matches.findIndex(
      ({ from, to }) => selectionFrom >= from && selectionFrom <= to
    );
    if (currentIndex === -1) {
      currentIndex = matches.findIndex(({ from }) => from >= selectionFrom);
    }
    if (currentIndex === -1 && matches.length > 0) {
      currentIndex = matches.length - 1;
    }

    setMatchCount(matches.length);
    setActiveIndex(matches.length ? currentIndex + 1 : 0);
  }, []);

  const query = useMemo(
    () =>
      new SearchQuery({
        search: searchText,
        replace: replaceText,
        caseSensitive,
        wholeWord,
        regexp: useRegex,
      }),
    [caseSensitive, replaceText, searchText, useRegex, wholeWord]
  );

  useEffect(() => {
    const parent = editorRef.current;
    if (!parent) return;

    const theme = EditorView.theme({
      "&": {
        backgroundColor: "#0f1115",
        color: "#d8dee9",
        borderRadius: "14px",
        height: "100%",
      },
      ".cm-content": {
        fontFamily: "var(--font-geist-mono)",
        fontSize: "14px",
        padding: "20px",
      },
      ".cm-line": {
        padding: "0 4px",
      },
      ".cm-gutters": {
        backgroundColor: "#0f1115",
        color: "#4f586b",
        border: "none",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(148, 163, 184, 0.08)",
      },
      ".cm-selectionBackground": {
        backgroundColor: "rgba(59, 130, 246, 0.3)",
      },
      ".cm-searchMatch": {
        backgroundColor: "rgba(59, 130, 246, 0.35)",
        outline: "1px solid rgba(59, 130, 246, 0.6)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "rgba(234, 179, 8, 0.45)",
        outline: "1px solid rgba(234, 179, 8, 0.8)",
      },
      ".cm-cursor": {
        borderLeftColor: "#f8fafc",
      },
    });

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        javascript({ typescript: true }),
        search({
          top: false,
          createPanel: () => {
            const dom = document.createElement("div");
            dom.style.display = "none";
            return { dom };
          },
        }),
        highlightSelectionMatches(),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            refreshMatches();
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent,
    });

    viewRef.current = view;
    openSearchPanel(view);
    refreshMatches();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [refreshMatches]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setSearchQuery.of(query),
    });
    refreshMatches();
  }, [query, refreshMatches]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isFindShortcut =
        (event.ctrlKey || event.metaKey) && key === "f" && !event.shiftKey;
      const isShiftFindShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && key === "f";
      if (isFindShortcut || isShiftFindShortcut) {
        event.preventDefault();
        setShowReplace(false);
        const view = viewRef.current;
        if (view) {
          const { from, to, empty } = view.state.selection.main;
          if (!empty && to > from && to - from <= 200) {
            setSearchText(view.state.sliceDoc(from, to));
          }
        }
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }
      if ((event.ctrlKey || event.metaKey) && key === "h") {
        event.preventDefault();
        setShowReplace(true);
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFindNext = () => {
    const view = viewRef.current;
    if (!view || !searchText) return;
    findNext(view);
    refreshMatches();
  };

  const handleFindPrevious = () => {
    const view = viewRef.current;
    if (!view || !searchText) return;
    findPrevious(view);
    refreshMatches();
  };

  const handleReplaceNext = () => {
    const view = viewRef.current;
    if (!view || !searchText) return;
    const match = matchesRef.current[activeIndex - 1];
    if (match) {
      view.dispatch({
        selection: { anchor: match.from, head: match.to },
      });
    }
    replaceNext(view);
    refreshMatches();
  };

  const handleReplaceAll = () => {
    const view = viewRef.current;
    if (!view || !searchText) return;
    replaceAll(view);
    refreshMatches();
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="rounded-2xl border border-white/10 bg-[#1b1f25] px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[24px_minmax(0,1fr)_170px] items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReplace((prev) => !prev)}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-[#2a2f36] text-xs text-white/70 hover:text-white"
              aria-label="Toggle replace"
            >
              {showReplace ? "▾" : "▸"}
            </button>

            <div className="flex h-7 flex-1 items-center gap-2 rounded-md border border-white/10 bg-[#12151a] px-2 text-xs text-white">
              <input
                ref={findInputRef}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    handleFindPrevious();
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    handleFindNext();
                  }
                }}
                placeholder="찾기"
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/35"
              />
              <span className="text-[11px] text-white/45">
                {activeIndex}/{matchCount}
              </span>
            </div>

            <div className="flex items-center justify-start gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleFindPrevious}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-[#2a2f36] text-[11px] text-white/60 hover:text-white"
                  aria-label="Find previous"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={handleFindNext}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-[#2a2f36] text-[11px] text-white/60 hover:text-white"
                  aria-label="Find next"
                >
                  ↓
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCaseSensitive((prev) => !prev)}
                  className={`flex h-6 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold transition ${
                    caseSensitive
                      ? "border-blue-400 bg-blue-500/25 text-blue-100"
                      : "border-white/10 bg-[#2a2f36] text-white/55 hover:text-white"
                  }`}
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => setWholeWord((prev) => !prev)}
                  className={`flex h-6 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold transition ${
                    wholeWord
                      ? "border-emerald-400 bg-emerald-500/25 text-emerald-100"
                      : "border-white/10 bg-[#2a2f36] text-white/55 hover:text-white"
                  }`}
                >
                  AB
                </button>
                <button
                  type="button"
                  onClick={() => setUseRegex((prev) => !prev)}
                  className={`flex h-6 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold transition ${
                    useRegex
                      ? "border-violet-400 bg-violet-500/25 text-violet-100"
                      : "border-white/10 bg-[#2a2f36] text-white/55 hover:text-white"
                  }`}
                >
                  .*
                </button>
              </div>
            </div>

          </div>

          {showReplace && (
            <div className="grid grid-cols-[24px_minmax(0,1fr)_170px] items-center gap-2">
              <div aria-hidden="true" />
              <div className="flex h-7 flex-1 items-center gap-2 rounded-md border border-white/10 bg-[#12151a] px-2 text-xs text-white">
                <input
                  value={replaceText}
                  onChange={(event) => setReplaceText(event.target.value)}
                  placeholder="바꾸기"
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/35"
                />
              </div>
              <div className="flex items-center justify-start gap-1">
                <button
                  type="button"
                  onClick={handleReplaceNext}
                  className="flex h-6 items-center justify-center rounded border border-white/10 px-1.5 text-[11px] text-white/60 hover:text-white"
                >
                  바꾸기
                </button>
                <button
                  type="button"
                  onClick={handleReplaceAll}
                  className="flex h-6 items-center justify-center rounded border border-white/10 px-1.5 text-[11px] text-white/60 hover:text-white"
                >
                  전체
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[520px] rounded-3xl border border-white/10 bg-[#0f1115] shadow-[0_25px_60px_rgba(15,23,42,0.45)]">
        <div ref={editorRef} className="h-[520px]" />
      </div>
    </div>
  );
}
