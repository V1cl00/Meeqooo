-- Besonders geschuetzte Angaben (Art. 9 DSGVO): "Queer" und "Queerfreundlich" am eigenen Profil nur mit ausdruecklicher Einwilligung.
alter table profiles add column if not exists sensitive_consent_at timestamptz;

-- Bestehende Angaben ohne Einwilligung werden entfernt. Wer sie wieder will, willigt beim Setzen ein.
update profiles set traits = coalesce((
  select jsonb_agg(v)::text from jsonb_array_elements_text(traits::jsonb) v where v not in ('Queer', 'Queerfreundlich')
), '[]')
where sensitive_consent_at is null and traits like '%Queer%';

update profiles set require_traits = coalesce((
  select jsonb_agg(v)::text from jsonb_array_elements_text(require_traits::jsonb) v where v not in ('Queer', 'Queerfreundlich')
), '[]')
where sensitive_consent_at is null and require_traits like '%Queer%';
