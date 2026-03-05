"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/topbar";
import ChatAssistant from "@/components/chat-assistant";
import { createClient } from "@/lib/supabase/client";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isCapture = pathname === "/capture";
  const isAuthPath = pathname.startsWith("/auth");
  const isRoot = pathname === "/";

  // Never show shell on capture or auth pages
  if (isCapture || isAuthPath) {
    return <>{children}</>;
  }

  // On root, show shell only when authenticated
  if (isRoot) {
    if (user === undefined) {
      // Still loading auth; render without shell to avoid navbar flash for unauthenticated users
      return <>{children}</>;
    }
    if (user === null) {
      return <>{children}</>;
    }
  }

  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="ml-0 md:ml-[60px] mt-16 min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-background">
        {children}
      </main>
      <ChatAssistant />
    </>
  );
}
