-- Remove the Health, Business, Food, and Shopping top-level service
-- categories (and their leaf categories) per product decision — these
-- verticals are not part of the initial launch scope.
--
-- Two active providers still referenced leaf categories under Food and
-- Shopping; the product decision was to remove those provider records
-- along with the categories rather than reassign them. providers.category_id
-- is NOT NULL with ON DELETE RESTRICT, so providers must be deleted first.
-- categories.parent_id is ON DELETE SET NULL (not CASCADE), so leaf
-- categories must be deleted explicitly before their parent groups.

BEGIN;

DELETE FROM public.providers
WHERE id IN (
  'b15816ba-98b0-4490-b4fb-e019128b528e', -- "مياس" (Health > Dentists)
  '5622176e-4154-4dee-9f55-a9305e6fd5a1'  -- "خضرجي" (Food > Restaurants)
);

DELETE FROM public.categories
WHERE id IN (
  -- Health leaves: doctors, dentists, pharmacies, physiotherapy
  'c0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000018',
  'c0000000-0000-4000-8000-000000000019',
  'c0000000-0000-4000-8000-000000000020',
  -- Business leaves: accountant, it-support, printing, marketing-agency
  'c0000000-0000-4000-8000-000000000027',
  'c0000000-0000-4000-8000-000000000028',
  'c0000000-0000-4000-8000-000000000029',
  'c0000000-0000-4000-8000-000000000030',
  -- Food leaves: restaurants, cafes, bakeries
  'c0000000-0000-4000-8000-000000000035',
  'c0000000-0000-4000-8000-000000000036',
  'c0000000-0000-4000-8000-000000000037',
  -- Shopping leaves: electronics, furniture, clothing
  'c0000000-0000-4000-8000-000000000038',
  'c0000000-0000-4000-8000-000000000039',
  'c0000000-0000-4000-8000-000000000040'
);

DELETE FROM public.categories
WHERE id IN (
  'f0000000-0000-4000-8000-000000000003', -- Health
  'f0000000-0000-4000-8000-000000000007', -- Business
  'f0000000-0000-4000-8000-000000000009', -- Food
  'f0000000-0000-4000-8000-000000000010'  -- Shopping
);

COMMIT;
