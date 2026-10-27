export const dynamic = "force-dynamic";

import Home from "@/components/coach/Home";

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ prefill?: string }> }) {
  const { prefill } = await searchParams;
  return <Home prefill={prefill} />;
}
