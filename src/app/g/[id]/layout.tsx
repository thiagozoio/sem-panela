import { AppShell } from "@/components/app-shell";
import { BillingBanner } from "@/components/billing-banner";
import { GroupTabs } from "@/components/group-tabs";
import { getGroupContext } from "@/lib/groups";
import { WEEKDAYS } from "@/lib/format";
import { rankingOf } from "@/lib/standings";

export default async function GroupLayout({ children, params }: LayoutProps<"/g/[id]">) {
  const { id } = await params;
  const { group, user, isOrganizer, subscription, trial } = await getGroupContext(id);

  return (
    <AppShell admin={user.isAdmin}>
      <div>
        <h1 className="text-xl font-bold">{group.name}</h1>
        <p className="text-sm text-neutral-600">
          {WEEKDAYS[group.weekday]}, {group.start_time.slice(0, 5)}
          {group.location && ` · ${group.location}`}
        </p>
      </div>
      <BillingBanner
        state={subscription}
        paidUntil={group.paid_until}
        trial={trial}
        organizer={isOrganizer}
        groupId={group.id}
        groupName={group.name}
      />
      <GroupTabs
        groupId={group.id}
        organizer={isOrganizer}
        ranking={rankingOf(group.ranking) !== "off"}
        matches={!!group.matches}
      />
      {children}
    </AppShell>
  );
}
