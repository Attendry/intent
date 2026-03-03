"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Moon,
  Sun,
  Users,
  Building2,
  FileText,
  Loader2,
  Command,
  LogOut,
} from "lucide-react";

interface SearchResult {
  prospects: { id: string; firstName: string; lastName: string; title: string | null; company: string | null }[];
  companies: { id: string; name: string; industry: string | null }[];
  content: { id: string; title: string; type: string }[];
}

export default function TopBar() {
  const [dark, setDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("intent-theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("intent-theme", next ? "dark" : "light");
      return next;
    });
  };

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setSearchOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const navigateTo = (path: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults(null);
    router.push(path);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }

      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        inputRef.current?.blur();
      }

      if (isInput) return;

      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        const nextKey = (cb: (k: string) => void) => {
          const handler = (e2: KeyboardEvent) => {
            cb(e2.key);
            document.removeEventListener("keydown", handler);
          };
          document.addEventListener("keydown", handler, { once: true });
          setTimeout(() => document.removeEventListener("keydown", handler), 500);
        };
        nextKey((key) => {
          const routes: Record<string, string> = { h: "/", p: "/prospects", c: "/companies", s: "/settings", r: "/review", f: "/fit-overview", m: "/my-company" };
          if (routes[key]) router.push(routes[key]);
        });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, router]);

  const hasResults = searchResults && (searchResults.prospects.length > 0 || searchResults.companies.length > 0 || searchResults.content.length > 0);

  return (
    <header className="fixed left-0 md:left-[60px] right-0 top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/80 pl-14 md:pl-8 pr-8 backdrop-blur-xl">
      <div ref={searchRef} className={`relative flex-1 max-w-lg transition-all duration-200 ${searchOpen ? "max-w-xl" : ""}`}>
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search prospects, companies, content..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          className="h-10 w-full rounded-xl border-0 bg-muted/60 pl-10 pr-20 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all duration-200"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground/60 pointer-events-none">
          <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono">
            <Command className="inline h-2.5 w-2.5" />K
          </kbd>
        </div>

        {searchOpen && searchQuery.length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[400px] overflow-y-auto rounded-xl border border-border/60 bg-card shadow-float animate-scale-in">
            {searchLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : hasResults ? (
              <div className="p-2">
                {searchResults!.prospects.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Prospects</p>
                    {searchResults!.prospects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => navigateTo(`/prospects/${p.id}`)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <Users className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{p.firstName} {p.lastName}</span>
                          {(p.title || p.company) && (
                            <span className="ml-2 text-xs text-muted-foreground">{p.title}{p.title && p.company ? " at " : ""}{p.company}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults!.companies.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Companies</p>
                    {searchResults!.companies.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigateTo(`/companies/${c.id}`)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          {c.industry && <span className="ml-2 text-xs text-muted-foreground">{c.industry}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults!.content.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Content</p>
                    {searchResults!.content.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigateTo("/content")}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{c.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground capitalize">{c.type.replace(/_/g, " ")}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-95"
          title="Toggle theme"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-95"
            title="Sign out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
