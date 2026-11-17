-- ============================================================================
-- Migration: 20260101000027_orders_write_privileges.sql
-- Description: Members could rewrite money and integrity fields of an order directly
--   (total_amount, tracking_token, order_number, guest_id, business_id, status_history,
--   idempotency_key...) and update or delete order lines. Every legitimate write now goes
--   through SECURITY DEFINER functions (20260101000024-26): place_order, transition_order_status,
--   cancel_order, record_order_payment, mark_order_unpaid, record_order_refund,
--   replace_order_items.
--
--   Chosen over column grants: no column of orders or order_items is a "genuinely free" field
--   that any screen edits directly (notes, delivery address and schedule have no edit flow), so
--   the whole table-level write privilege is revoked instead of leaving a column list to
--   maintain. Add a function (or a column grant) when a flow needs one.
--
--   * orders: INSERT and UPDATE revoked from anon and authenticated; the update policy is
--     dropped. DELETE stays for authenticated but only through the owner-only policy
--     (20260101000028); anon loses it.
--   * order_items: INSERT, UPDATE and DELETE revoked from anon and authenticated, policies
--     dropped (lines change only through place_order / replace_order_items; deleting an order
--     still cascades because foreign-key actions do not need the caller's privileges).
--   SELECT is untouched (manager screens, realtime).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   grant insert, update on public.orders to authenticated;
--   grant insert, update, delete on public.order_items to authenticated;
--   create policy orders_update_authenticated on public.orders for update to authenticated
--     using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
--   create policy order_items_update_authenticated on public.order_items for update to authenticated
--     using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
--   create policy order_items_delete_authenticated on public.order_items for delete to authenticated
--     using (public.is_business_member(business_id));
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

revoke insert, update on public.orders from anon, authenticated;
revoke delete on public.orders from anon;
revoke insert, update, delete on public.order_items from anon, authenticated;

drop policy if exists orders_update_authenticated on public.orders;
drop policy if exists order_items_update_authenticated on public.order_items;
drop policy if exists order_items_delete_authenticated on public.order_items;

reset lock_timeout;
