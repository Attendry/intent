"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/topbar";
import ChatAssistant from "@/components/chat-assistant";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCapture = pathname === "/capture";

  if (isCapture) {
    return <>{children}</>;
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
