"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Moon, Sun } from "lucide-react";

export default function LandingPage() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Sync with layout script (runs before paint)
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("twobrains-theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-6 md:px-8 md:py-8">
        <Link
          href="/"
          aria-label="Twobrains home"
          className="flex items-center gap-2 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 rounded-lg"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-soft">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Twobrains
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/auth/login">
            <Button variant="outline" size="default" className="min-h-[48px] px-5">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main id="main-content" className="px-4 md:px-8 pb-16 md:pb-24">
        <div className="mx-auto max-w-2xl md:ml-[10%] md:max-w-xl pt-16 md:pt-24">
          <h1
            className="text-[clamp(2.5rem,5vw,3.5rem)] font-normal leading-[1.1] tracking-[-0.02em] text-foreground"
            style={{ fontFamily: "var(--font-instrument), serif" }}
          >
            Know when to reach out.
          </h1>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[48px] px-8"
              >
                Get started
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto min-h-[48px] px-8"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
