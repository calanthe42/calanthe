"use client";

import { updateEnquiry, updateEvent } from "@backend/actions/admin";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { ActionForm, Field, Fieldset, Select, TextArea, TextInput } from "@admin/components/Form";

/**
 * The working half of an enquiry or an event: where it has got to, who owns
 * it, when to chase it, what was said.
 *
 * The requester's own words and contact details are not editable here — they
 * are the snapshot of what someone actually sent, and rewriting a customer's
 * enquiry is how a business loses the thread of what was asked.
 */

const ENQUIRY_STATUS = [
  { label: "New", value: "NEW" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Waiting for customer", value: "WAITING_FOR_CUSTOMER" },
  { label: "Quoted", value: "QUOTED" },
  { label: "Converted", value: "CONVERTED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Spam", value: "SPAM" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PRIORITY = [
  { label: "Low", value: "LOW" },
  { label: "Normal", value: "NORMAL" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

const EVENT_STATUS = [
  { label: "New", value: "NEW" },
  { label: "Contacted", value: "CONTACTED" },
  { label: "Quoted", value: "QUOTED" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

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
  /* A calendar day in UAE time — see backend/domain/dates.ts for why this
     is no longer a date-and-time field. */
  const followUpDate = dubaiDateInputValue(followUpAt);

  return (
    <ActionForm action={(form) => updateEnquiry(id, form)} submitLabel="Save changes" inline>
      <Fieldset legend="Working this enquiry">
        <Field label="Status" name="status">
          <Select name="status" options={ENQUIRY_STATUS} defaultValue={status} />
        </Field>
        <Field label="Priority" name="priority">
          <Select name="priority" options={PRIORITY} defaultValue={priority} />
        </Field>
        <Field label="Assigned to" name="assignedStaff">
          <Select
            name="assignedStaff"
            options={staff}
            defaultValue={assignedStaffId ? String(assignedStaffId) : ""}
            placeholder="Nobody yet"
          />
        </Field>
        <Field
          label="Follow up on"
          name="followUpDate"
          hint="The day to get back to them. Leave empty for no reminder."
        >
          <input type="hidden" name="followUpDateOriginal" value={followUpDate} />
          <TextInput name="followUpDate" type="date" defaultValue={followUpDate} />
        </Field>
        <Field label="Internal notes" name="internalNotes" hint="Never shown to the enquirer.">
          <TextArea name="internalNotes" rows={5} defaultValue={internalNotes} />
        </Field>
      </Fieldset>
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
  return (
    <ActionForm action={(form) => updateEvent(id, form)} submitLabel="Save changes" inline>
      <Fieldset legend="Working this event">
        <Field label="Status" name="status">
          <Select name="status" options={EVENT_STATUS} defaultValue={status} />
        </Field>
        <Field label="Assigned to" name="assignedStaff">
          <Select
            name="assignedStaff"
            options={staff}
            defaultValue={assignedStaffId ? String(assignedStaffId) : ""}
            placeholder="Nobody yet"
          />
        </Field>
        {canQuote ? (
          <Field label="Quote (AED)" name="quoteAmountAed" hint="What the business is charging. Owner only.">
            <TextInput name="quoteAmountAed" type="text" inputMode="decimal" defaultValue={quoteAmountAed} />
          </Field>
        ) : null}
        <Field label="Internal notes" name="internalNotes" hint="Never shown to the client.">
          <TextArea name="internalNotes" rows={5} defaultValue={internalNotes} />
        </Field>
      </Fieldset>
    </ActionForm>
  );
}
