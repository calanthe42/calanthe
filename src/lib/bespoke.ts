import { CONTACT, formatAed } from "@/lib/data";

/**
 * A Build Your Own request, as the customer chose it.
 *
 * WHY WHATSAPP. There is no bespoke-order backend yet, and the form used to
 * end on "Your arrangement is in our hands" while sending nothing anywhere —
 * a customer would wait for a florist who never heard of them. The atelier
 * already confirms every order on WhatsApp (video approval), so the request
 * goes to the same number, pre-written, and the customer presses send. Nothing
 * is claimed until they do. When an enquiry endpoint exists, this becomes its
 * payload instead.
 */
export type BespokeRequest = {
  budgetAed: number;
  colours: readonly string[];
  floristChoosesColours: boolean;
  vase: boolean | null;
  vasePriceAed: number;
  occasion: string;
  cardMessage: string;
  leaveCardBlank: boolean;
  notes: string;
};

export function bespokeTotalAed(request: BespokeRequest): number {
  return request.budgetAed + (request.vase ? request.vasePriceAed : 0);
}

/** The message text, one fact per line so a florist can read it at a glance. */
export function bespokeMessage(request: BespokeRequest): string {
  const colours = [
    ...request.colours,
    ...(request.floristChoosesColours ? ["florist's choice"] : []),
  ];

  const lines = [
    "Hello Calanthe, I would like a bespoke arrangement.",
    "",
    `Occasion: ${request.occasion}`,
    `Budget: ${formatAed(request.budgetAed)}`,
    `Colours: ${colours.length > 0 ? colours.join(", ") : "florist's choice"}`,
    `Vase: ${
      request.vase === true
        ? `yes (+${formatAed(request.vasePriceAed)})`
        : request.vase === false
          ? "no, hand-tied"
          : "not decided"
    }`,
    `Card: ${
      request.leaveCardBlank
        ? "leave blank"
        : request.cardMessage.trim()
          ? `"${request.cardMessage.trim()}"`
          : "no message yet"
    }`,
  ];

  if (request.notes.trim()) lines.push(`Notes: ${request.notes.trim()}`);
  lines.push("", `Estimated total: ${formatAed(bespokeTotalAed(request))}`);

  return lines.join("\n");
}

/** A wa.me link that opens the chat with the message already written. */
export function bespokeWhatsAppHref(request: BespokeRequest): string {
  return `${CONTACT.whatsappHref}?text=${encodeURIComponent(bespokeMessage(request))}`;
}
