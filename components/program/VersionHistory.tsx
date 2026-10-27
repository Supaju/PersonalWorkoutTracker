type Version = {
  version: number;
  phase: string;
  reason: string;
  startDate: string;
  endDate: string | null;
};

type Props = {
  versions: Version[];
};

export default function VersionHistory({ versions }: Props) {
  if (versions.length === 0) {
    return (
      <div className="card">
        <p className="label mb-2">Version history</p>
        <p className="text-sm text-[var(--color-text-muted)]">No history yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="label mb-4">Version history</p>
      <div className="space-y-4">
        {versions.map((v) => {
          const phasePretty = v.phase.replace(/_/g, " ");
          const endDate = v.endDate ?? "now";

          return (
            <div key={v.version} className="border-b border-[var(--color-border)] pb-4 last:border-b-0">
              <p className="font-semibold text-sm">
                v{v.version} · {phasePretty}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {v.startDate} → {endDate}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2">{v.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
