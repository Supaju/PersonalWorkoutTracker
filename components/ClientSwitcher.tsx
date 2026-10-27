"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface ClientSwitcherProps {
  clients: { id: string; name: string }[];
  currentId: string;
}

export default function ClientSwitcher({
  clients,
  currentId,
}: ClientSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.currentTarget.value;
    startTransition(async () => {
      await fetch("/api/clients/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      router.refresh();
    });
  };

  return (
    <select
      className={`input max-w-[10rem] ${isPending ? "opacity-50" : ""}`}
      value={currentId}
      onChange={handleChange}
      aria-label="Client"
    >
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
        </option>
      ))}
    </select>
  );
}
