-- Existing consent does not authorize the new Google processing path.
-- The server records v2 only after the visitor accepts the updated consent.
alter table public.photo_sessions add column consent_version text;
comment on column public.photo_sessions.consent_version is 'photo-ai-v2: explicit visitor consent for Google Gemini analysis, review and generation, OpenAI and configured Qwen editing. Null retains the original provider scope.';
