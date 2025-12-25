-- Bảng lưu danh sách API keys
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR NOT NULL DEFAULT 'gemini',
  api_key TEXT NOT NULL,
  name VARCHAR,
  is_active BOOLEAN DEFAULT true,
  is_limited BOOLEAN DEFAULT false,
  limited_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Chỉ admin mới được xem/sửa API keys
CREATE POLICY "Admins can view api_keys"
ON public.api_keys FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert api_keys"
ON public.api_keys FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update api_keys"
ON public.api_keys FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete api_keys"
ON public.api_keys FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger cập nhật updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index để query nhanh
CREATE INDEX idx_api_keys_provider_active ON public.api_keys(provider, is_active, is_limited);