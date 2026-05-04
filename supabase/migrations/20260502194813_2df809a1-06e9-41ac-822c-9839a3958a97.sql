-- Desabilita triggers temporariamente para evitar erros de integridade durante a limpeza em massa
SET session_replication_role = 'replica';

-- Truncate all data tables
TRUNCATE TABLE public.automation_runs CASCADE;
TRUNCATE TABLE public.bot_conversations CASCADE;
TRUNCATE TABLE public.sales_orders CASCADE;
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.leads CASCADE;
TRUNCATE TABLE public.automations CASCADE;
TRUNCATE TABLE public.funnel_stages CASCADE;
TRUNCATE TABLE public.finance_transactions CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.import_history CASCADE;
TRUNCATE TABLE public.business_goals CASCADE;
TRUNCATE TABLE public.pipeline_leads CASCADE;
TRUNCATE TABLE public.bot_settings CASCADE;
TRUNCATE TABLE public.app_settings CASCADE;
TRUNCATE TABLE public.crm_pipeline_stages CASCADE;
TRUNCATE TABLE public.crm_pipelines CASCADE;
TRUNCATE TABLE public.calendar_events CASCADE;
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.channels CASCADE;
TRUNCATE TABLE public.services CASCADE;
TRUNCATE TABLE public.tasks CASCADE;
TRUNCATE TABLE public.service_orders CASCADE;
TRUNCATE TABLE public.whatsapp_instances CASCADE;
TRUNCATE TABLE public.chart_of_accounts CASCADE;

-- Reabilita triggers
SET session_replication_role = 'origin';