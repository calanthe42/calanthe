"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { ConfirmDialog } from "./Dialog";
import { Dropdown, type DropdownItem } from "./Dropdown";
import type { IconName } from "./icons";
import { useAction, type ActionOutcome } from "./useAction";

/**
 * Buttons and row menus that perform a server action.
 *
 * Anything destructive asks first. Everything in this admin is a real
 * business record; an accidental click must not be able to remove one.
 *
 * `redirectTo` exists for deletes on a record's own page: refreshing a page
 * whose record has just been deleted shows "not found", which reads as though
 * something broke.
 */

export type ConfirmCopy = { title: string; body: string; confirmLabel: string };

export function ActionButton({
  action,
  label,
  variant = "secondary",
  size,
  icon,
  confirm,
  redirectTo,
  className,
  block,
}: {
  action: () => Promise<ActionOutcome>;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  confirm?: ConfirmCopy;
  redirectTo?: string;
  className?: string;
  block?: boolean;
}) {
  const router = useRouter();
  const { state, run } = useAction();
  const [asking, setAsking] = useState(false);

  const execute = () =>
    run(action, {
      onSuccess: () => {
        setAsking(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      },
      onFailure: () => setAsking(false),
    });

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        block={block}
        className={className}
        loading={state === "saving" && !confirm}
        disabled={state === "saving"}
        onClick={() => (confirm ? setAsking(true) : void execute())}
      >
        {label}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={asking}
          onClose={() => setAsking(false)}
          onConfirm={() => void execute()}
          pending={state === "saving"}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          tone={variant === "danger" || variant === "dangerSolid" ? "danger" : "default"}
        />
      ) : null}
    </>
  );
}

export type RowLink = { label: string; href: string; icon?: IconName; external?: boolean };

/**
 * The "⋯" menu on a list row: links, then one destructive action behind a
 * confirmation.
 */
export function RowMenu({
  label,
  links = [],
  destructive,
}: {
  label: string;
  links?: readonly RowLink[];
  destructive?: ConfirmCopy & {
    label: string;
    action: () => Promise<ActionOutcome>;
    redirectTo?: string;
  };
}) {
  const router = useRouter();
  const { state, run } = useAction();
  const [asking, setAsking] = useState(false);

  const items: DropdownItem[] = links.map((link) => ({
    key: link.href,
    label: link.label,
    href: link.href,
    icon: link.icon,
    external: link.external,
  }));
  if (destructive) {
    items.push({
      key: "destructive",
      label: destructive.label,
      icon: "trash",
      tone: "danger",
      separatorBefore: links.length > 0,
      onSelect: () => setAsking(true),
    });
  }

  return (
    <>
      <Dropdown label={label} items={items} />
      {destructive ? (
        <ConfirmDialog
          open={asking}
          onClose={() => setAsking(false)}
          pending={state === "saving"}
          title={destructive.title}
          body={destructive.body}
          confirmLabel={destructive.confirmLabel}
          onConfirm={() =>
            void run(destructive.action, {
              onSuccess: () => {
                setAsking(false);
                if (destructive.redirectTo) router.push(destructive.redirectTo);
                else router.refresh();
              },
              onFailure: () => setAsking(false),
            })
          }
        />
      ) : null}
    </>
  );
}
