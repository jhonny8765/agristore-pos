-- JSON construction has STABLE volatility in PostgreSQL; keep the helper consistent with its dependencies.
alter function app_private.normalized_purchase_quote(jsonb,jsonb) stable;
