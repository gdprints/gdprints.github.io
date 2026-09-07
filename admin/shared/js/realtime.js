/* ============================================================
   realtime.js — shared Supabase Realtime subscription helpers
   Requires shared/js/supabase.js loaded first.
   RLS still applies to Realtime — a manager's subscription will
   only receive events for rows they're allowed to see (their own
   orders), so no extra filtering is needed for the manager pages.
   ============================================================ */

/* Fires cb(payload) on every INSERT/UPDATE to the orders table. */
function subscribeToOrders(cb){
  return supabaseClient
    .channel("orders-changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, cb)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, cb)
    .subscribe();
}

/* Fires cb(payload) on every new internal_messages row. */
function subscribeToInternalMessages(cb){
  return supabaseClient
    .channel("internal-messages-changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, cb)
    .subscribe();
}

/* Fires cb(payload) on every new order_messages row (customer <-> staff). */
function subscribeToOrderMessages(cb){
  return supabaseClient
    .channel("order-messages-changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, cb)
    .subscribe();
}
