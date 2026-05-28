import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="relative flex min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-noise opacity-50"
      />

      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 px-4 py-8 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-6xl animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
