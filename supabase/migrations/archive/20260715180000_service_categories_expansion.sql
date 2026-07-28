-- Sprint 9: Service Categories Expansion
-- Hierarchical groups (depth 0) + leaf categories (depth 1) for unlimited local services.

-- =============================================================================
-- ADMIN RLS — category management
-- =============================================================================

CREATE POLICY "categories_admin_manage" ON public.categories
  FOR ALL
  USING (public.has_role('admin') OR public.has_role('moderator'))
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));

-- =============================================================================
-- CATEGORY GROUPS (depth 0)
-- =============================================================================

INSERT INTO public.categories (id, module_id, parent_id, slug, name, description, icon, depth, sort_order, is_active)
VALUES
  (
    'f0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'home-services',
    '{"en":"Home","ar":"المنزل"}',
    '{"en":"Home repair, maintenance, and improvement","ar":"إصلاح وصيانة وتحسين المنزل"}',
    'home',
    0,
    1,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'automotive',
    '{"en":"Automotive","ar":"السيارات"}',
    '{"en":"Auto repair, tires, towing, and car care","ar":"إصلاح السيارات والإطارات والسحب والعناية بالمركبات"}',
    'car',
    0,
    2,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'health',
    '{"en":"Health","ar":"الصحة"}',
    '{"en":"Doctors, dentists, pharmacies, and therapy","ar":"الأطباء وأطباء الأسنان والصيدليات والعلاج"}',
    'heart-pulse',
    0,
    3,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'legal',
    '{"en":"Legal","ar":"القانون"}',
    '{"en":"Lawyers and notary services","ar":"المحامون وخدمات التوثيق"}',
    'scale',
    0,
    4,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'education',
    '{"en":"Education","ar":"التعليم"}',
    '{"en":"Tutors and language teachers","ar":"المعلمون الخصوصيون ومعلمو اللغات"}',
    'graduation-cap',
    0,
    5,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'beauty',
    '{"en":"Beauty","ar":"الجمال"}',
    '{"en":"Barbers, hair salons, and beauty services","ar":"الحلاقة وصالونات الشعر وخدمات التجميل"}',
    'sparkles',
    0,
    6,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000007',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'business-services',
    '{"en":"Business","ar":"الأعمال"}',
    '{"en":"Accounting, IT, printing, and marketing","ar":"المحاسبة وتقنية المعلومات والطباعة والتسويق"}',
    'briefcase',
    0,
    7,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000008',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'events',
    '{"en":"Events","ar":"الفعاليات"}',
    '{"en":"Photography, video, planning, and catering","ar":"التصوير والفيديو والتخطيط والضيافة"}',
    'camera',
    0,
    8,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'food',
    '{"en":"Food","ar":"الطعام"}',
    '{"en":"Restaurants, cafes, and bakeries","ar":"المطاعم والمقاهي والمخابز"}',
    'utensils',
    0,
    9,
    true
  ),
  (
    'f0000000-0000-4000-8000-000000000010',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'shopping',
    '{"en":"Shopping","ar":"التسوق"}',
    '{"en":"Electronics, furniture, and clothing stores","ar":"متاجر الإلكترونيات والأثاث والملابس"}',
    'shopping-bag',
    0,
    10,
    true
  )
ON CONFLICT (module_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  depth = EXCLUDED.depth,
  sort_order = EXCLUDED.sort_order,
  parent_id = EXCLUDED.parent_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =============================================================================
-- MIGRATE EXISTING 6 FLAT CATEGORIES → LEAVES UNDER GROUPS
-- =============================================================================

UPDATE public.categories SET
  parent_id = 'f0000000-0000-4000-8000-000000000001',
  slug = 'plumbing',
  name = '{"en":"Plumbing","ar":"سباكة"}',
  description = '{"en":"Pipes, leaks, fixtures, and water systems","ar":"المواسير والتسريبات والتركيبات وأنظمة المياه"}',
  icon = 'droplets',
  depth = 1,
  sort_order = 1,
  is_active = true,
  updated_at = now()
WHERE id = 'c0000000-0000-4000-8000-000000000001';

UPDATE public.categories SET
  parent_id = 'f0000000-0000-4000-8000-000000000001',
  slug = 'electrical',
  name = '{"en":"Electrical","ar":"كهرباء"}',
  description = '{"en":"Wiring, power outages, and electrical repairs","ar":"التمديدات الكهربائية وانقطاع التيار والإصلاحات"}',
  icon = 'zap',
  depth = 1,
  sort_order = 2,
  is_active = true,
  updated_at = now()
WHERE id = 'c0000000-0000-4000-8000-000000000002';

UPDATE public.categories SET
  parent_id = 'f0000000-0000-4000-8000-000000000003',
  slug = 'doctors',
  name = '{"en":"Doctors","ar":"أطباء"}',
  description = '{"en":"General practitioners and medical clinics","ar":"الأطباء العامون والعيادات الطبية"}',
  icon = 'stethoscope',
  depth = 1,
  sort_order = 1,
  is_active = true,
  updated_at = now()
WHERE id = 'c0000000-0000-4000-8000-000000000003';

UPDATE public.categories SET
  parent_id = 'f0000000-0000-4000-8000-000000000004',
  slug = 'lawyers',
  name = '{"en":"Lawyers","ar":"محامون"}',
  description = '{"en":"Legal advice and representation","ar":"الاستشارات القانونية والتمثيل"}',
  icon = 'scale',
  depth = 1,
  sort_order = 1,
  is_active = true,
  updated_at = now()
WHERE id = 'c0000000-0000-4000-8000-000000000004';

UPDATE public.categories SET
  parent_id = 'f0000000-0000-4000-8000-000000000002',
  slug = 'auto-repair',
  name = '{"en":"Auto Repair","ar":"إصلاح السيارات"}',
  description = '{"en":"Mechanics, engine repair, and garage services","ar":"الميكانيكيون وإصلاح المحركات وخدمات الورش"}',
  icon = 'wrench',
  depth = 1,
  sort_order = 1,
  is_active = true,
  updated_at = now()
WHERE id = 'c0000000-0000-4000-8000-000000000005';

UPDATE public.categories SET
  parent_id = 'f0000000-0000-4000-8000-000000000001',
  slug = 'cleaning',
  name = '{"en":"Cleaning","ar":"تنظيف"}',
  description = '{"en":"Home and office cleaning services","ar":"خدمات تنظيف المنازل والمكاتب"}',
  icon = 'sparkles',
  depth = 1,
  sort_order = 6,
  is_active = true,
  updated_at = now()
WHERE id = 'c0000000-0000-4000-8000-000000000006';

-- =============================================================================
-- NEW LEAF CATEGORIES
-- =============================================================================

INSERT INTO public.categories (id, module_id, parent_id, slug, name, description, icon, depth, sort_order, is_active)
VALUES
  -- Home Services
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'hvac', '{"en":"HVAC","ar":"تكييف وتدفئة"}', '{"en":"Air conditioning, heating, and ventilation","ar":"التكييف والتدفئة والتهوية"}', 'wind', 1, 3, true),
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'locksmith', '{"en":"Locksmith","ar":"أقفال"}', '{"en":"Lock installation, repair, and emergency access","ar":"تركيب وإصلاح الأقفال وفتح الطوارئ"}', 'key-round', 1, 4, true),
  ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'appliance-repair', '{"en":"Appliance Repair","ar":"إصلاح الأجهزة"}', '{"en":"Washing machines, refrigerators, and home appliances","ar":"الغسالات والثلاجات والأجهزة المنزلية"}', 'washing-machine', 1, 5, true),
  ('c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'painting', '{"en":"Painting","ar":"دهان"}', '{"en":"Interior and exterior painting services","ar":"خدمات الدهان الداخلي والخارجي"}', 'paintbrush', 1, 7, true),
  ('c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'carpentry', '{"en":"Carpentry","ar":"نجارة"}', '{"en":"Woodwork, furniture, and custom carpentry","ar":"الأعمال الخشبية والأثاث والنجارة المخصصة"}', 'hammer', 1, 8, true),
  ('c0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'pest-control', '{"en":"Pest Control","ar":"مكافحة الآفات"}', '{"en":"Pest inspection and extermination","ar":"فحص ومكافحة الآفات"}', 'bug', 1, 9, true),
  ('c0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'roofing', '{"en":"Roofing","ar":"أسقف"}', '{"en":"Roof repair, installation, and waterproofing","ar":"إصلاح وتركيب الأسقف والعزل المائي"}', 'house', 1, 10, true),
  -- Automotive
  ('c0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'tire-service', '{"en":"Tire Service","ar":"إطارات"}', '{"en":"Tire repair, replacement, and balancing","ar":"إصلاح واستبدال وموازنة الإطارات"}', 'circle-dot', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'car-wash', '{"en":"Car Wash","ar":"غسيل سيارات"}', '{"en":"Exterior and interior car cleaning","ar":"تنظيف السيارات من الداخل والخارج"}', 'car-front', 1, 3, true),
  ('c0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'towing', '{"en":"Towing","ar":"سحب سيارات"}', '{"en":"Emergency towing and roadside assistance","ar":"سحب الطوارئ والمساعدة على الطريق"}', 'truck', 1, 4, true),
  ('c0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'battery-service', '{"en":"Battery Service","ar":"بطاريات"}', '{"en":"Car battery replacement and jump-start","ar":"استبدال بطاريات السيارات والتشغيل"}', 'battery', 1, 5, true),
  -- Health
  ('c0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'dentists', '{"en":"Dentists","ar":"أطباء أسنان"}', '{"en":"Dental care and oral health","ar":"العناية بالأسنان وصحة الفم"}', 'smile', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'pharmacies', '{"en":"Pharmacies","ar":"صيدليات"}', '{"en":"Prescription and over-the-counter medicines","ar":"الأدوية بوصفة طبية وبدون وصفة"}', 'pill', 1, 3, true),
  ('c0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'physiotherapy', '{"en":"Physiotherapy","ar":"علاج طبيعي"}', '{"en":"Physical therapy and rehabilitation","ar":"العلاج الطبيعي وإعادة التأهيل"}', 'accessibility', 1, 4, true),
  -- Legal
  ('c0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 'notary', '{"en":"Notary","ar":"موثق"}', '{"en":"Document notarization and certification","ar":"توثيق وتصديق المستندات"}', 'file-badge', 1, 2, true),
  -- Education
  ('c0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', 'tutors', '{"en":"Tutors","ar":"مدرسون خصوصيون"}', '{"en":"Private tutoring for school subjects","ar":"دروس خصوصية للمواد الدراسية"}', 'book-open', 1, 1, true),
  ('c0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', 'language-teachers', '{"en":"Language Teachers","ar":"معلمو لغات"}', '{"en":"Language lessons and conversation practice","ar":"دروس اللغات وممارسة المحادثة"}', 'languages', 1, 2, true),
  -- Beauty
  ('c0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', 'barber', '{"en":"Barber","ar":"حلاق"}', '{"en":"Men''s haircuts and grooming","ar":"قص الشعر والعناية للرجال"}', 'scissors', 1, 1, true),
  ('c0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', 'hair-salon', '{"en":"Hair Salon","ar":"صالون شعر"}', '{"en":"Hair styling, coloring, and treatments","ar":"تصفيف الشعر والصبغ والعلاجات"}', 'brush', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000026', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', 'beauty-salon', '{"en":"Beauty Salon","ar":"صالون تجميل"}', '{"en":"Skincare, makeup, and beauty treatments","ar":"العناية بالبشرة والمكياج وعلاجات التجميل"}', 'flower-2', 1, 3, true),
  -- Business Services
  ('c0000000-0000-4000-8000-000000000027', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', 'accountant', '{"en":"Accountant","ar":"محاسب"}', '{"en":"Bookkeeping, tax, and financial services","ar":"مسك الدفاتر والضرائب والخدمات المالية"}', 'calculator', 1, 1, true),
  ('c0000000-0000-4000-8000-000000000028', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', 'it-support', '{"en":"IT Support","ar":"دعم تقني"}', '{"en":"Computer repair and IT help desk","ar":"إصلاح الحاسوب ودعم تقنية المعلومات"}', 'laptop', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000029', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', 'printing', '{"en":"Printing","ar":"طباعة"}', '{"en":"Print shops and document services","ar":"مطابع وخدمات الطباعة"}', 'printer', 1, 3, true),
  ('c0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', 'marketing-agency', '{"en":"Marketing Agency","ar":"وكالة تسويق"}', '{"en":"Digital and traditional marketing services","ar":"خدمات التسويق الرقمي والتقليدي"}', 'megaphone', 1, 4, true),
  -- Events
  ('c0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000008', 'photographer', '{"en":"Photographer","ar":"مصور"}', '{"en":"Event and portrait photography","ar":"تصوير الفعاليات والصور الشخصية"}', 'camera', 1, 1, true),
  ('c0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000008', 'videographer', '{"en":"Videographer","ar":"مصور فيديو"}', '{"en":"Video production and event filming","ar":"إنتاج الفيديو وتصوير الفعاليات"}', 'video', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000008', 'event-planner', '{"en":"Event Planner","ar":"منظم فعاليات"}', '{"en":"Wedding and event planning services","ar":"تخطيط الأعراس والفعاليات"}', 'calendar-days', 1, 3, true),
  ('c0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000008', 'catering', '{"en":"Catering","ar":"ضيافة"}', '{"en":"Food catering for events and parties","ar":"تقديم الطعام للفعاليات والحفلات"}', 'utensils-crossed', 1, 4, true),
  -- Food
  ('c0000000-0000-4000-8000-000000000035', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'restaurants', '{"en":"Restaurants","ar":"مطاعم"}', '{"en":"Dining and restaurant services","ar":"خدمات المطاعم وتناول الطعام"}', 'utensils', 1, 1, true),
  ('c0000000-0000-4000-8000-000000000036', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'cafes', '{"en":"Cafes","ar":"مقاهي"}', '{"en":"Coffee shops and casual dining","ar":"مقاهي ومطاعم غير رسمية"}', 'coffee', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000037', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'bakeries', '{"en":"Bakeries","ar":"مخابز"}', '{"en":"Fresh bread, pastries, and baked goods","ar":"الخبز الطازج والمعجنات والمخبوزات"}', 'croissant', 1, 3, true),
  -- Shopping
  ('c0000000-0000-4000-8000-000000000038', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000010', 'electronics', '{"en":"Electronics","ar":"إلكترونيات"}', '{"en":"Electronics and gadget stores","ar":"متاجر الإلكترونيات والأجهزة"}', 'smartphone', 1, 1, true),
  ('c0000000-0000-4000-8000-000000000039', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000010', 'furniture', '{"en":"Furniture","ar":"أثاث"}', '{"en":"Furniture stores and home furnishings","ar":"متاجر الأثاث ومفروشات المنزل"}', 'sofa', 1, 2, true),
  ('c0000000-0000-4000-8000-000000000040', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000010', 'clothing', '{"en":"Clothing","ar":"ملابس"}', '{"en":"Fashion and apparel stores","ar":"متاجر الأزياء والملابس"}', 'shirt', 1, 3, true)
ON CONFLICT (module_id, slug) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  depth = EXCLUDED.depth,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =============================================================================
-- MIGRATE LEGACY SEARCH LOG SLUGS
-- =============================================================================

UPDATE public.search_logs SET category_slug = 'plumbing' WHERE category_slug = 'plumber';
UPDATE public.search_logs SET category_slug = 'electrical' WHERE category_slug = 'electrician';
UPDATE public.search_logs SET category_slug = 'doctors' WHERE category_slug = 'doctor';
UPDATE public.search_logs SET category_slug = 'lawyers' WHERE category_slug = 'lawyer';
UPDATE public.search_logs SET category_slug = 'auto-repair' WHERE category_slug = 'mechanic';
UPDATE public.search_logs SET category_slug = 'cleaning' WHERE category_slug = 'cleaner';

-- Audit actions for category management
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'category_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'category_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'category_disabled';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'category_enabled';
