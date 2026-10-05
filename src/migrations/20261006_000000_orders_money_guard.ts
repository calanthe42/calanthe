import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * THE MONEY GUARD — written by hand; Payload's schema does not change.
 *
 * WHY. Payload's `update` rewrites the WHOLE order row from a copy it read a
 * moment earlier. Two writers a few milliseconds apart — Stripe's webhook
 * marking an order paid and a florist saving a note, or two deliveries of the
 * same webhook — could therefore put a paid order back to unpaid, empty its
 * invoice number or payment time, or count its discount code twice. The
 * application's own guards cannot see it: they compare against the same stale
 * copy.
 *
 * WHAT. One BEFORE UPDATE trigger on "orders" that makes the money columns
 * move forward only. It never raises — an innocent save still succeeds — it
 * simply puts the settled value back:
 *
 *   payment_status          once PAID / REFUNDED / PARTIALLY_REFUNDED, never
 *                           back to PENDING / AUTHORIZED / FAILED
 *   invoice_number, VAT     frozen once the number exists
 *   paid_at                 first value wins
 *   coupon_redeemed_at      first value wins
 *   payment_method / _reference   cannot be emptied once set
 *   stripe_payment_intent_id      cannot be emptied; frozen once settled
 *                                 (an UNPAID order may still have a cancelled
 *                                 intent replaced by a new one)
 *
 * It decides from OLD — the row as committed — never from NEW, so the write
 * that pays an order and sets its intent id in one go still passes. It does
 * not fire on INSERT, and it touches nothing else: fulfilment, notes, the
 * pay-link columns and totals are left alone.
 *
 * Compatible with the code already live, so it is safe to apply before or
 * after a deploy. Probes: scripts/money-guard-probe.mts.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE OR REPLACE FUNCTION orders_keep_money_state() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE
    was_settled boolean := OLD.payment_status::text IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');
    had_invoice boolean := coalesce(OLD.invoice_number, '') <> '';
  BEGIN
    IF was_settled AND NEW.payment_status::text NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED') THEN
      NEW.payment_status := OLD.payment_status;
    END IF;
    IF had_invoice THEN
      NEW.invoice_number := OLD.invoice_number;
      NEW.vat_rate_bps := OLD.vat_rate_bps;
      NEW.vat_included_fils := OLD.vat_included_fils;
    END IF;
    IF OLD.paid_at IS NOT NULL THEN
      NEW.paid_at := OLD.paid_at;
    END IF;
    IF OLD.coupon_redeemed_at IS NOT NULL THEN
      NEW.coupon_redeemed_at := OLD.coupon_redeemed_at;
    END IF;
    IF coalesce(OLD.payment_method, '') <> '' AND coalesce(NEW.payment_method, '') = '' THEN
      NEW.payment_method := OLD.payment_method;
    END IF;
    IF coalesce(OLD.payment_reference, '') <> '' AND coalesce(NEW.payment_reference, '') = '' THEN
      NEW.payment_reference := OLD.payment_reference;
    END IF;
    IF coalesce(OLD.stripe_payment_intent_id, '') <> ''
       AND (coalesce(NEW.stripe_payment_intent_id, '') = '' OR was_settled) THEN
      NEW.stripe_payment_intent_id := OLD.stripe_payment_intent_id;
    END IF;
    RETURN NEW;
  END $$;

  DROP TRIGGER IF EXISTS orders_keep_money_state ON orders;
  CREATE TRIGGER orders_keep_money_state
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION orders_keep_money_state();`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TRIGGER IF EXISTS orders_keep_money_state ON orders;
  DROP FUNCTION IF EXISTS orders_keep_money_state();`)
}
