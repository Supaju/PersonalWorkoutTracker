"use client";

import { useState } from "react";
import StatusCard from "./StatusCard";
import Chat from "./Chat";
import CheckInSheet from "./CheckInSheet";

export default function Home({ prefill }: { prefill?: string }) {
  const [sheet, setSheet] = useState(false);
  const [send, setSend] = useState<{ text: string; nonce: number } | null>(null);
  const [version, setVersion] = useState(0); // bump to reload status + thread after a check-in

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold uppercase tracking-wide">Coach</h1>
        <button className="btn-accent text-xs min-h-[44px]" onClick={() => setSheet(true)}>Check in</button>
      </div>
      <StatusCard key={`s${version}`} onAskCoach={(text) => setSend({ text, nonce: Date.now() })} />
      <Chat key={`c${version}`} prefill={prefill} externalSend={send} />
      <CheckInSheet open={sheet} onClose={() => setSheet(false)} onDone={() => setVersion((v) => v + 1)} />
    </div>
  );
}
