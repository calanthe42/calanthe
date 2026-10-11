"use client";

import { useState, useTransition } from "react";
import { setSiteFlag } from "@backend/actions/site-settings";
import { useI18n } from "@admin/i18n/client";
import { Card } from "@admin/ui/Card";
import { Switch } from "@admin/ui/Field";
import { useToast } from "@admin/ui/Toast";

/**
 * The owner's switches for parts of the website. Each change is saved the
 * moment it is made (no Save button to forget) and the storefront follows on
 * its next page load. Guest favours live inside the Events page, so their
 * switch is greyed out while Events are off.
 */
export function WebsiteSwitches({ initial }: { initial: { eventsLive: boolean; guestFavorsLive: boolean } }) {
  const { t, resolve } = useI18n();
  const toast = useToast();
  const [flags, setFlags] = useState(initial);
  const [pending, start] = useTransition();

  const flip = (key: "eventsLive" | "guestFavorsLive", on: boolean) => {
    const before = flags;
    setFlags({ ...flags, [key]: on });
    start(async () => {
      const result = await setSiteFlag(key, on);
      if (result.ok) {
        toast.success(resolve(result.code, undefined, result.message));
      } else {
        setFlags(before);
        toast.error(resolve(result.code, undefined, result.message));
      }
    });
  };

  return (
    <Card className="max-w-2xl divide-y divide-line">
      <Switch
        label={t("website.events.label")}
        hint={t("website.events.hint")}
        checked={flags.eventsLive}
        disabled={pending}
        onChange={(e) => flip("eventsLive", e.currentTarget.checked)}
      />
      <Switch
        className="pt-4"
        label={t("website.favors.label")}
        hint={flags.eventsLive ? t("website.favors.hint") : t("website.favors.needsEvents")}
        hintTone={flags.eventsLive ? "muted" : "warning"}
        checked={flags.guestFavorsLive}
        disabled={pending || !flags.eventsLive}
        onChange={(e) => flip("guestFavorsLive", e.currentTarget.checked)}
      />
    </Card>
  );
}
