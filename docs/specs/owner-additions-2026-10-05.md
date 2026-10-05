# Owner additions — 5 October 2026

These are the owner's own words turned into requirements. Where they differ
from `dashboard-invoices.md` or `manual-orders.md`, **this file wins**.

## 1. Create an invoice by hand

The Invoices area is not only a list of paid sales. The owner must be able to
press **Create invoice**, fill it in, and then share it or download it as a PDF.

- **Create invoice** = the same form as *Create order* (customer, lines from the
  catalogue and/or custom lines, delivery if any, discount, notes), reached from
  the Invoices area. One form, one code path — not a second system.
- An invoice created by hand gets its **number when it is issued**, not when it
  is paid, because it is shared with the customer before payment. It then shows
  as **Unpaid** until it is paid (by the pay button or recorded as paid outside
  the website), and **Paid** afterwards.
- Orders paid through the website keep getting their number at the moment of
  payment. **One series for everything**, so the list sorts in order.
- An issued invoice is never deleted and its number is never reused. A wrong or
  abandoned unpaid invoice is **voided**: it stays in the list, marked Void,
  with who voided it and why.
- Nothing on an issued invoice can be edited. To correct one: void it and issue
  a new one.

## 2. Numbering

- Strictly sequential, no gaps, no duplicates, allocated atomically in the
  database (the existing counter).
- The list sorts by number, newest first by default; searchable by number,
  customer name, phone and email.
- Format stays `CAL-INV-2026-00001` (sequential and sortable). If the owner
  prefers a shorter form such as `INV-0001`, it is one constant to change —
  ask before launch, never after the first real invoice.

## 3. "I don't want to see any mistake on the invoice"

- Every figure comes from the order snapshot and is re-checked before the
  invoice renders (lines add up to the subtotal; subtotal − discount + delivery
  = total). If a check fails the invoice is not shown: the page says so and the
  health page lists it. Never a wrong number on paper.
- Money is formatted in one place. Dates are Dubai dates.
- Unit tests cover: line arithmetic, discounts, zero-delivery, long names,
  Arabic names, 1 line and 20 lines (page break), paid / unpaid / void states.

## 4. Invoice design — Calanthe brand

The invoice is a brand document, not a default table.

- A4, print-first, also readable on a phone.
- Header: the Calanthe stacked logo (vector), business details on the opposite
  side; a thin terracotta hairline under it.
- Ground: warm cream paper with the client's orchid print as a faint
  tone-on-tone texture (`/brand/print/orchid-cream.webp`), kept light enough
  that every number stays fully legible and it prints without banding.
- Type: Cinzel for the word INVOICE and labels, Cormorant Garamond for the
  customer's name and the total, Instrument Sans for lines and figures
  (tabular, lining numerals).
- Colours only from the brand tokens: olive text, sage labels, terracotta for
  the hairline and the PAID / UNPAID / VOID mark; burgundy is not used.
- Clear blocks: invoice number and dates · billed to · lines (description,
  quantity, unit price, amount) · subtotal, discount (with its code or label),
  delivery, total · how it was paid · a short thank-you line and the contact
  details. An Arabic version mirrors the layout (RTL) with the same figures.
- Unpaid invoices carry a **Pay now** button on screen (hidden in print).

## 5. Download as PDF

- Version 1: a **Download PDF** button that opens the print-ready A4 page with
  the browser's "Save as PDF". The print stylesheet must produce a clean
  one-page (or cleanly paginated) document with the texture and logo.
- Version 2 (later): a server-generated PDF file attached to the email. It must
  render Arabic correctly, so it should be produced from the same HTML, not
  from a separate PDF layout.

## 6. Paying from the email — a button, never a long link

- Every payment email (payment request, hand-made invoice, WhatsApp order with
  an email address) shows the bill — items and total — and one **Pay now —
  AED X** button. The raw address is not printed in the body (a plain-text
  fallback keeps it for mail apps that block buttons).
- In the admin, after creating the order or invoice, two ways to share:
  **Send by email** (customer's address; they get the invoice and the button)
  and **Copy link** (to paste into WhatsApp). Both lead to the same page.
- The pay page shows the invoice and the amount and takes Apple Pay, Google
  Pay or card.

## 7. Shop products stay direct

Normal catalogue products are bought straight through the website checkout
(card, Apple Pay, Google Pay) with no confirmation step. Payment requests and
hand-made invoices are only for bespoke, event, WhatsApp and phone sales.
