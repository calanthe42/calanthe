"use client";

import { updateEnquiry, updateEvent } from "@backend/actions/admin";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { useI18n } from "@admin/i18n/client";
import { ActionForm } from "@admin/ui/ActionForm";
import { Card, CardHeader } from "@admin/ui/Card";
import { Field, Input, PrefixInput, Select, Textarea } from "@admin/ui/Field";

/**
 * The working half of an enquiry or an event: where it has got to, who owns
 * it, when to chase it, what the team needs to remember.
 *
 * The requester's own words and contact details are not editable here — they
 * are the snapshot of what someone actually sent, and rewriting a customer's
 * enquiry is how a business loses the thread of what was asked.
 */

const ENQUIRY_STATUS = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER", "QUOTED", "CONVERTED", "RESOLVED", "SPAM", "CANCELLED"];
const PRIORITY = ["LOW", "NORMAL", "HIGH", "URGENT"];
const EVENT_STATUS = ["NEW", "CONTACTED", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export function EnquiryWorkflow({
  id,
  status,
  priority,
  assignedStaffId,
  internalNotes,
  followUpAt,
  staff,
}: {
  id: number;
  status: string;
  priority: string;
  assignedStaffId?: number;
  internalNotes?: string;
  followUpAt?: string;
  staff: { label: string; value: string }[];
}) {
  const { t, label } = useI18n();
  /* A calendar day in UAE time — see backend/domain/dates.ts. */
  const followUpDate = dubaiDateInputValue(followUpAt);

  return (
    <ActionForm variant="card" action={(form) => updateEnquiry(id, form)}>
      <Card>
        <CardHeader title={t("enquiries.workflow.title")} />
        <div className="mt-3 grid gap-5">
          <Field id="status" label={t("enquiries.workflow.status")}>
            <Select id="status" name="status" defaultValue={status} options={ENQUIRY_STATUS.map((s) => ({ value: s, label: label("enquiryStatus", s) }))} />
          </Field>
          <Field id="priority" label={t("enquiries.workflow.priority")}>
            <Select id="priority" name="priority" defaultValue={priority} options={PRIORITY.map((p) => ({ value: p, label: label("priority", p) }))} />
          </Field>
          <Field id="assignedStaff" label={t("enquiries.workflow.assigned")}>
            <Select
              id="assignedStaff"
              name="assignedStaff"
              options={staff}
              defaultValue={assignedStaffId ? String(assignedStaffId) : ""}
              placeholder={t("enquiries.workflow.nobody")}
            />
          </Field>
          <Field id="followUpDate" label={t("enquiries.workflow.followUp")} hint={t("enquiries.workflow.followUpHint")}>
            <input type="hidden" name="followUpDateOriginal" value={followUpDate} />
            <Input id="followUpDate" name="followUpDate" withHint type="date" defaultValue={followUpDate} />
          </Field>
          <Field id="internalNotes" label={t("enquiries.workflow.notes")} hint={t("enquiries.workflow.notesHint")}>
            <Textarea id="internalNotes" name="internalNotes" withHint rows={5} defaultValue={internalNotes} />
          </Field>
        </div>
      </Card>
    </ActionForm>
  );
}

export function EventWorkflow({
  id,
  status,
  assignedStaffId,
  internalNotes,
  quoteAmountAed,
  canQuote,
  staff,
}: {
  id: number;
  status: string;
  assignedStaffId?: number;
  internalNotes?: string;
  quoteAmountAed?: string;
  canQuote: boolean;
  staff: { label: string; value: string }[];
}) {
  const { t, label } = useI18n();

  return (
    <ActionForm variant="card" action={(form) => updateEvent(id, form)}>
      <Card>
        <CardHeader title={t("events.workflow.title")} />
        <div className="mt-3 grid gap-5">
          <Field id="status" label={t("enquiries.workflow.status")}>
            <Select id="status" name="status" defaultValue={status} options={EVENT_STATUS.map((s) => ({ value: s, label: label("eventStatus", s) }))} />
          </Field>
          <Field id="assignedStaff" label={t("enquiries.workflow.assigned")}>
            <Select
              id="assignedStaff"
              name="assignedStaff"
              options={staff}
              defaultValue={assignedStaffId ? String(assignedStaffId) : ""}
              placeholder={t("enquiries.workflow.nobody")}
            />
          </Field>
          {/* The quote is admin-only at field level. Hiding it from staff
              matches what the server would do anyway. */}
          {canQuote ? (
            <Field id="quoteAmountAed" label={t("events.workflow.quote")} hint={t("events.workflow.quoteHint")}>
              <PrefixInput id="quoteAmountAed" name="quoteAmountAed" prefix="AED" withHint inputMode="decimal" defaultValue={quoteAmountAed} className="tabular" />
            </Field>
          ) : null}
          <Field id="internalNotes" label={t("enquiries.workflow.notes")} hint={t("events.workflow.notesHint")}>
            <Textarea id="internalNotes" name="internalNotes" withHint rows={5} defaultValue={internalNotes} />
          </Field>
        </div>
      </Card>
    </ActionForm>
  );
}
