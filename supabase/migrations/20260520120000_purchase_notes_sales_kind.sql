ALTER TABLE public.purchase_notes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'compra',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS sale_ids uuid[] DEFAULT '{}'::uuid[];

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_notes_kind_check') THEN
    ALTER TABLE public.purchase_notes
      ADD CONSTRAINT purchase_notes_kind_check CHECK (kind IN ('compra','venda'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_notes_kind ON public.purchase_notes(organization_id, kind);
