import { getAdminI18n } from "@admin/i18n/server";
import type { MessageKey } from "@admin/i18n/translate";
import { Badge } from "@admin/ui/Badge";
import type { IconName } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";

/**
 * A section that exists in the navigation but has no working screen yet.
 *
 * Named honestly rather than dressed up as a finished page: a placeholder
 * pretending to be a feature is how a client discovers at launch that it was
 * never built. It offers no link to the developer CMS — the business never
 * needs to know that exists.
 */
export async function ComingSoon({
  title,
  section,
  note,
  icon,
}: {
  title: MessageKey;
  section: MessageKey;
  note: MessageKey;
  icon: IconName;
}) {
  const { t } = await getAdminI18n();
  const area = t(title);

  return (
    <>
      <PageHeader
        title={area}
        breadcrumbs={[{ label: t(section) }, { label: area }]}
        badge={<Badge>{t("common.soon")}</Badge>}
      />
      <EmptyState
        icon={icon}
        title={t("placeholders.title", { area })}
        body={
          <>
            {t(note)}
            <span className="mt-2 block">{t("placeholders.body")}</span>
          </>
        }
      />
    </>
  );
}
