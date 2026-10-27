import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import { getClientId } from "@/lib/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WorkoutTracker",
  description: "Personalized workout and nutrition assistant",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentId = await getClientId();
  const clients = await db.client.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <html lang="en">
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar clients={clients} currentId={currentId} />
          <main className="flex-1 overflow-y-auto md:pt-0">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 md:py-8 pb-24 md:pb-0">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
