-- Estimation du coût avant une génération massive : le document attend une confirmation
-- si la préparation dépasse le seuil (AI_CONFIRM_THRESHOLD_USD).
alter table public.documents drop constraint documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('uploaded', 'extracting', 'segmenting', 'awaiting_confirmation', 'generating', 'ready', 'error'));
alter table public.documents add column estimated_cost_usd numeric(10, 4);
