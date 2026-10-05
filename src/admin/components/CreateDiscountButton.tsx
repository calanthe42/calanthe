"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { Dialog } from "@admin/ui/Dialog";
import { Icon, type IconName } from "@admin/ui/icons";

/**
 * "Create discount" — and the one question that comes first: which kind.
 *
 * A sale and a code are different things to set up (one is seen on the
 * product, the other is typed at checkout), and the kind cannot be changed
 * afterwards. So it is asked before the form, in plain words, rather than
 * being a dropdown inside it that changes every field beneath.
 */
export function CreateDiscountButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const choices: { href: string; icon: IconName; title: string; body: string }[] = [
    {
      href: "/admin/discounts/new?kind=automatic",
      icon: "tag",
      title: t("discounts.typeDialog.automatic"),
      body: t("discounts.typeDialog.automaticBody"),
    },
    {
      href: "/admin/discounts/new?kind=code",
      icon: "gift",
      title: t("discounts.typeDialog.code"),
      body: t("discounts.typeDialog.codeBody"),
    },
  ];

  return (
    <>
      <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
        {t("discounts.create")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("discounts.typeDialog.title")} variant="sheet">
        <ul className="grid gap-3">
          {choices.map((choice, index) => (
            <li key={choice.href}>
              <Link
                href={choice.href}
                data-autofocus={index === 0 ? "" : undefined}
                className="flex min-h-16 items-start gap-3 rounded-md border border-line-strong bg-surface p-4 transition-colors duration-150 hover:border-ink-3 hover:bg-hover"
              >
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-2"
                >
                  <Icon name={choice.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{choice.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-3">{choice.body}</span>
                </span>
                <Icon name="chevronRight" className="ms-auto mt-2.5 h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
