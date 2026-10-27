export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import type { ClientSettings } from "@/components/coach/types";
import ProfileForm from "@/components/settings/ProfileForm";
import ScheduleForm from "@/components/settings/ScheduleForm";
import Considerations from "@/components/settings/Considerations";
import Preferences from "@/components/settings/Preferences";
import EquipmentEditor from "@/components/settings/EquipmentEditor";
import NewClientForm from "@/components/settings/NewClientForm";

export default async function SettingsPage() {
  const c = await db.client.findUniqueOrThrow({ where: { id: await getClientId() } });
  let trainingDays: number[] = [];
  try { trainingDays = JSON.parse(c.trainingDays); } catch { /* none */ }
  const client: ClientSettings = {
    id: c.id, name: c.name, persona: c.persona, trainingDays, defaultMinutes: c.defaultMinutes,
    hardCapMinutes: c.hardCapMinutes, layoffDays: c.layoffDays, reviewEveryWeeks: c.reviewEveryWeeks, webResearch: c.webResearch,
  };
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold uppercase tracking-wide">Settings · {c.name}</h1>
      <ProfileForm key={`p${c.id}`} />
      <ScheduleForm key={`s${c.id}`} client={client} />
      <Considerations key={`c${c.id}`} />
      <Preferences key={`x${c.id}`} />
      <EquipmentEditor key={`e${c.id}`} />
      <NewClientForm />
    </div>
  );
}
