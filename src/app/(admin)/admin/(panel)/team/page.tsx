import { getAdminI18n } from "@admin/i18n/server";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { TeamManager, type TeamRow } from "@admin/components/TeamManager";
import { getAdminSession } from "@backend/data/admin-session";
import { getTeamMembers } from "@backend/data/admin-team";

/**
 * Staff — who can sign in to this admin, and what they can do once they are
 * in.
 *
 * REPLACES "ASK THE DEVELOPER". Adding a florist, changing what she can
 * reach, suspending someone who has left, and getting a locked-out person
 * back in all previously required opening the Payload CMS. None of those is a
 * developer's decision, and every one of them is urgent on the morning it
 * happens.
 *
 * OWNER-ONLY, AND SAID SO. Staff still reach this screen from the navigation
 * — the question "how do I get back in" is theirs, and hiding the page would
 * leave them nowhere to look. What they get is the answer, not a list.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("team.title") };
}

export default async function AdminTeamPage() {
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, date } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.system") }, { label: t("team.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("team.title")} breadcrumbs={breadcrumbs} />
        <EmptyState icon="staff" title={t("team.ownerOnlyTitle")} body={t("team.ownerOnlyBody")} />
      </>
    );
  }

  const members = await getTeamMembers();

  /*
   * Dates are formatted HERE, on the server, and handed over as strings.
   * TeamManager is a Client Component: it renders once on the server and
   * again in the browser, and Intl would use the server's time zone for the
   * first and the reader's for the second — a hydration mismatch on every
   * row. Formatting once removes the possibility rather than papering over
   * it with suppressHydrationWarning.
   */
  const rows: TeamRow[] = members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    role: member.role,
    accountStatus: member.accountStatus,
    locked: member.locked,
    failedAttempts: member.failedAttempts,
    addedLabel: date(member.createdAt, "long"),
    lockedUntilLabel: member.locked && member.lockedUntil ? date(member.lockedUntil, "time") : null,
    isYou: member.id === session.user.id,
  }));

  return (
    <>
      <PageHeader
        title={t("team.title")}
        breadcrumbs={breadcrumbs}
        description={t("team.description")}
      />

      {rows.length <= 1 ? (
        <EmptyState
          icon="staff"
          title={t("team.empty.title")}
          body={t("team.empty.body")}
          className="mb-6"
        />
      ) : null}

      <TeamManager members={rows} />
    </>
  );
}
