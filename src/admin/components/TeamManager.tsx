"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@admin/i18n/client";
import { Badge } from "@admin/ui/Badge";
import { Button } from "@admin/ui/Button";
import { ConfirmDialog, Dialog } from "@admin/ui/Dialog";
import { Dropdown, type DropdownItem } from "@admin/ui/Dropdown";
import { Field, Input, Select } from "@admin/ui/Field";
import { Notice } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { useAction } from "@admin/ui/useAction";
import {
  inviteTeamMember,
  issueTemporaryPassword,
  removeTeamMember,
  setTeamMemberStatus,
  unlockTeamMember,
  updateTeamMemberRole,
} from "@backend/actions/team";

/**
 * Staff administration, as an owner thinks about it.
 *
 * NOT A USER TABLE. The columns are "who", "what they can do", "can they get
 * in" — not `role`, `accountStatus`, `loginAttempts`. Every action is phrased
 * as the outcome ("Make owner", "Lift the lock"), and the confirmation says
 * what will actually happen to that person rather than asking "are you sure".
 *
 * Dates arrive already formatted. This is a Client Component, so it renders
 * once on the server and again in the browser; formatting a date in both
 * places would use two different time zones and produce a hydration mismatch.
 * The page formats them once, on the server, in the reader's language.
 */

export type TeamRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "staff";
  accountStatus: "active" | "suspended" | "closed";
  locked: boolean;
  failedAttempts: number;
  addedLabel: string;
  lockedUntilLabel: string | null;
  isYou: boolean;
};

type Ask =
  | { kind: "promote" | "demote" | "suspend" | "reset" | "remove"; member: TeamRow }
  | null;

/** What the owner is given to pass on. Held only in memory, never re-fetchable. */
type Credentials = { email: string; password: string };

/**
 * Pulls the one-time password out of an action result.
 *
 * Only two of the six actions return one, and `run()` sees them as one union,
 * so this checks for the fields rather than asserting which branch it got.
 */
function credentialsIn(result: unknown): Credentials | null {
  const value = result as { temporaryPassword?: unknown; email?: unknown };
  return typeof value.temporaryPassword === "string" && typeof value.email === "string"
    ? { email: value.email, password: value.temporaryPassword }
    : null;
}

export function TeamManager({ members }: { members: readonly TeamRow[] }) {
  const { t, plural, label } = useI18n();
  const { state, run } = useAction();
  const [inviting, setInviting] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  /* Bumped after a successful invite so the uncontrolled form starts empty
     the next time it opens, without tracking every field in state. */
  const [formKey, setFormKey] = useState(0);

  const busy = state === "saving";

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(() => inviteTeamMember(data), {
      /* The credentials panel that follows says far more than a toast, and
         two success messages at once is one too many. */
      quiet: true,
      onSuccess: (result) => {
        setInviting(false);
        setFormKey((n) => n + 1);
        setCredentials(credentialsIn(result));
      },
    });
  }

  function confirm() {
    if (!ask) return;
    const { kind, member } = ask;

    const action =
      kind === "promote"
        ? () => updateTeamMemberRole(member.id, "admin")
        : kind === "demote"
          ? () => updateTeamMemberRole(member.id, "staff")
          : kind === "suspend"
            ? () => setTeamMemberStatus(member.id, "suspended")
            : kind === "reset"
              ? () => issueTemporaryPassword(member.id)
              : () => removeTeamMember(member.id);

    void run(action, {
      quiet: kind === "reset",
      onSuccess: (result) => {
        setAsk(null);
        if (kind === "reset") setCredentials(credentialsIn(result));
      },
      onFailure: () => setAsk(null),
    });
  }

  const copy = ask
    ? {
        promote: {
          title: t("team.confirm.promoteTitle", { name: ask.member.name }),
          body: t("team.confirm.promoteBody"),
          confirmLabel: t("team.confirm.promoteConfirm"),
          tone: "default" as const,
        },
        demote: {
          title: t("team.confirm.demoteTitle", { name: ask.member.name }),
          body: t("team.confirm.demoteBody"),
          confirmLabel: t("team.confirm.demoteConfirm"),
          tone: "default" as const,
        },
        suspend: {
          title: t("team.confirm.suspendTitle", { name: ask.member.name }),
          body: t("team.confirm.suspendBody"),
          confirmLabel: t("team.confirm.suspendConfirm"),
          tone: "danger" as const,
        },
        reset: {
          title: t("team.confirm.resetTitle", { name: ask.member.name }),
          body: t("team.confirm.resetBody"),
          confirmLabel: t("team.confirm.resetConfirm"),
          tone: "default" as const,
        },
        remove: {
          title: t("team.confirm.removeTitle", { name: ask.member.name }),
          body: t("team.confirm.removeBody"),
          confirmLabel: t("team.confirm.removeConfirm"),
          tone: "danger" as const,
        },
      }[ask.kind]
    : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" icon="plus" onClick={() => setInviting(true)}>
          {t("team.invite.button")}
        </Button>
      </div>

      <Table
        caption={t("team.title")}
        columns={[
          { key: "person", label: t("team.columns.person") },
          { key: "role", label: t("team.columns.role") },
          { key: "status", label: t("team.columns.status") },
          { key: "added", label: t("team.columns.added") },
          { key: "actions", label: t("common.actions"), hidden: true },
        ]}
      >
        {members.map((member) => (
          <Tr key={member.id}>
            <Td primary>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{member.name}</span>
                {member.isYou ? <Badge tone="info">{t("team.you")}</Badge> : null}
              </span>
              <span className="block truncate text-xs text-ink-3" dir="ltr">
                {[member.email, member.phone].filter(Boolean).join(" · ")}
              </span>
            </Td>

            <Td label={t("team.columns.role")}>
              <Badge tone={member.role === "admin" ? "warning" : "neutral"}>
                {member.role === "admin" ? label("role", "admin") : label("role", "staff")}
              </Badge>
              <span className="mt-1 block max-w-[22rem] text-xs leading-relaxed text-ink-3">
                {member.role === "admin" ? t("team.roleHelp.admin") : t("team.roleHelp.staff")}
              </span>
            </Td>

            <Td label={t("team.columns.status")}>
              <StatusCell member={member} />
            </Td>

            <Td label={t("team.columns.added")} className="text-ink-2">
              {member.addedLabel}
            </Td>

            <Td actions>
              <RowActions
                member={member}
                busy={busy}
                onAsk={(kind) => setAsk({ kind, member })}
                onUnlock={() => void run(() => unlockTeamMember(member.id))}
                onRestore={() => void run(() => setTeamMemberStatus(member.id, "active"))}
              />
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ---------------- Add someone ---------------- */}
      <Dialog
        open={inviting}
        onClose={() => setInviting(false)}
        dismissible={!busy}
        title={t("team.invite.title")}
        description={t("team.invite.description")}
        footer={
          <>
            <Button onClick={() => setInviting(false)} disabled={busy} className="max-sm:flex-1">
              {t("team.invite.cancel")}
            </Button>
            {/* The form lives in the dialog body; `form` connects the two so
                the footer button submits it and Enter in a field still works. */}
            <Button
              type="submit"
              form="team-invite"
              variant="primary"
              loading={busy}
              loadingText={t("common.saving")}
              className="max-sm:flex-1"
            >
              {t("team.invite.submit")}
            </Button>
          </>
        }
      >
        <form id="team-invite" key={formKey} onSubmit={onInvite} noValidate className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="invite-firstName" label={t("team.invite.firstName")} required>
              <Input id="invite-firstName" name="firstName" autoComplete="off" required />
            </Field>
            <Field id="invite-lastName" label={t("team.invite.lastName")}>
              <Input id="invite-lastName" name="lastName" autoComplete="off" />
            </Field>
          </div>

          <Field id="invite-email" label={t("team.invite.email")} hint={t("team.invite.emailHint")} required>
            <Input id="invite-email" name="email" type="email" dir="ltr" autoComplete="off" withHint required />
          </Field>

          <Field id="invite-phone" label={t("team.invite.phone")} hint={t("team.invite.phoneHint")}>
            <Input id="invite-phone" name="phone" type="tel" dir="ltr" autoComplete="off" withHint />
          </Field>

          <Field id="invite-role" label={t("team.invite.role")}>
            <Select
              id="invite-role"
              name="role"
              defaultValue="staff"
              options={[
                { value: "staff", label: `${label("role", "staff")} — ${t("team.roleHelp.staff")}` },
                { value: "admin", label: `${label("role", "admin")} — ${t("team.roleHelp.admin")}` },
              ]}
            />
          </Field>
        </form>
      </Dialog>

      {/* ---------------- The password, once ---------------- */}
      <Dialog
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title={t("team.credentials.title")}
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setCredentials(null)} className="max-sm:flex-1">
            {t("team.credentials.done")}
          </Button>
        }
      >
        {credentials ? (
          <div className="grid gap-4">
            <p className="text-sm leading-relaxed text-ink-2">
              {t("team.credentials.body", { email: credentials.email })}
            </p>
            <PasswordToPassOn password={credentials.password} />
            <Notice tone="warning" className="mb-0">
              {t("team.credentials.warning")}
            </Notice>
            <p className="text-xs leading-relaxed text-ink-3">{t("team.credentials.emailNote")}</p>
          </div>
        ) : null}
      </Dialog>

      {copy ? (
        <ConfirmDialog
          open
          onClose={() => setAsk(null)}
          onConfirm={confirm}
          pending={busy}
          title={copy.title}
          body={copy.body}
          confirmLabel={copy.confirmLabel}
          tone={copy.tone}
        />
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        {plural("team.count", members.length)}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function StatusCell({ member }: { member: TeamRow }) {
  const { t, plural } = useI18n();

  /* Locked is shown ahead of Active because it is the state that explains a
     phone call: she is active, and she still cannot get in. */
  if (member.locked) {
    return (
      <>
        <Badge tone="warning">{t("team.status.locked")}</Badge>
        <span className="mt-1 block max-w-[20rem] text-xs leading-relaxed text-ink-3">
          {member.lockedUntilLabel
            ? t("team.lockedUntil", { time: member.lockedUntilLabel })
            : t("team.lockedBody")}
        </span>
      </>
    );
  }

  if (member.accountStatus === "suspended" || member.accountStatus === "closed") {
    return (
      <Badge tone="danger">
        {member.accountStatus === "suspended" ? t("team.status.suspended") : t("team.status.closed")}
      </Badge>
    );
  }

  return (
    <>
      <Badge tone="success">{t("team.status.active")}</Badge>
      {member.failedAttempts > 0 ? (
        <span className="mt-1 block text-xs text-ink-3">
          {plural("team.attempts", member.failedAttempts)}
        </span>
      ) : null}
    </>
  );
}

function RowActions({
  member,
  busy,
  onAsk,
  onUnlock,
  onRestore,
}: {
  member: TeamRow;
  busy: boolean;
  onAsk: (kind: Exclude<Ask, null>["kind"]) => void;
  onUnlock: () => void;
  onRestore: () => void;
}) {
  const { t } = useI18n();
  const items: DropdownItem[] = [];

  /* Reversible things first; the two that end someone's access are last and
     separated, so neither is ever the item under a stray click. */
  if (member.locked) {
    items.push({ key: "unlock", label: t("team.actions.unlock"), icon: "check", onSelect: onUnlock });
  }
  items.push({
    key: "reset",
    label: t("team.actions.resetPassword"),
    icon: "settings",
    onSelect: () => onAsk("reset"),
  });

  /* Nothing that changes YOUR OWN powers or access appears on your own row.
     The server refuses it too (backend/actions/team.ts); leaving it out of
     the menu means the owner is never offered a way to lock herself out. */
  if (!member.isYou) {
    items.push({
      key: "role",
      label: member.role === "admin" ? t("team.actions.demote") : t("team.actions.promote"),
      icon: "staff",
      separatorBefore: true,
      onSelect: () => onAsk(member.role === "admin" ? "demote" : "promote"),
    });

    if (member.accountStatus === "active") {
      items.push({
        key: "suspend",
        label: t("team.actions.suspend"),
        icon: "close",
        tone: "danger",
        onSelect: () => onAsk("suspend"),
      });
    } else {
      items.push({
        key: "restore",
        label: t("team.actions.restore"),
        icon: "checkCircle",
        onSelect: onRestore,
      });
    }

    items.push({
      key: "remove",
      label: t("team.actions.remove"),
      icon: "trash",
      tone: "danger",
      separatorBefore: true,
      onSelect: () => onAsk("remove"),
    });
  }

  if (busy) return <span className="text-xs text-ink-3">{t("common.working")}</span>;

  return <Dropdown label={t("team.actions.menu", { name: member.name })} items={items} />;
}

/**
 * The password, shown once, with a copy button that tells the truth.
 *
 * `dir="ltr"` and a monospace face because it is a credential read character
 * by character, and an Arabic admin must not render it right to left. The
 * copy state falls back silently: an insecure context or a denied permission
 * leaves the text selectable, which still works.
 */
function PasswordToPassOn({ password }: { password: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* Nothing to say: the password is on screen and can be selected. */
    }
  }

  return (
    <div className="rounded-md border border-line-strong bg-sunken p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
        {t("team.credentials.password")}
      </p>
      <p
        dir="ltr"
        className="mt-2 select-all break-all font-mono text-lg font-medium text-ink"
      >
        {password}
      </p>
      <Button size="sm" icon={copied ? "check" : "edit"} onClick={() => void copy()} className="mt-3">
        {copied ? t("team.credentials.copied") : t("team.credentials.copy")}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? t("team.credentials.copied") : ""}
      </span>
    </div>
  );
}
