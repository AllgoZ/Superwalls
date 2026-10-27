import { PageHeader } from "@/components/admin/page-header";
import { TeamManager } from "@/components/admin/team-manager";
import { listTeam } from "@/lib/server/admin/queries/team";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin("team.manage");
  const members = await listTeam(admin);
  return (
    <>
      <PageHeader title="Team" description="Who can sign in to this admin panel, and what they can do. Super admins only." />
      <TeamManager members={members} />
    </>
  );
}
