-- ============================================================
-- Flavour Haven - Restaurant Database Setup
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Menu Items Table (replaces oil_products)
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    description_en TEXT,
    price NUMERIC NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('appetizers', 'mains', 'beverages', 'desserts')),
    image_url TEXT,
    is_popular BOOLEAN DEFAULT false,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Orders Table (replaces invoices)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
    table_number TEXT,
    delivery_address TEXT,
    notes TEXT,
    items_summary TEXT,
    subtotal NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Order Items Table (line items for each order)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(id),
    item_name TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Pending Orders Table (for email approval flow, replaces pending_invoices)
CREATE TABLE IF NOT EXISTS pending_orders (
    id SERIAL PRIMARY KEY,
    order_data JSONB,
    items_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Customer Feedback (reuse existing table or create if not exists)
CREATE TABLE IF NOT EXISTS customer_feedback (
    id SERIAL PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    feedback_type TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA: Sample Menu Items (with image_url paths)
-- ============================================================

-- Appetizers (المقبلات)
INSERT INTO menu_items (name, name_en, description, price, category, image_url, is_popular) VALUES
('حمص بالطحينة', 'Hummus', 'حمص كريمي مع طحينة وزيت زيتون وبابريكا', 45, 'appetizers', 'images/menu/hummus.png', true),
('متبل باذنجان', 'Baba Ganoush', 'باذنجان مشوي مهروس مع طحينة وليمون', 50, 'appetizers', 'images/menu/baba_ganoush.png', false),
('فتوش', 'Fattoush', 'سلطة طازجة مع خبز محمص ودبس رمان', 55, 'appetizers', 'images/menu/fattoush.png', true),
('تبولة', 'Tabbouleh', 'بقدونس طازج مع برغل وطماطم وليمون', 45, 'appetizers', 'images/menu/tabbouleh.png', false),
('ورق عنب', 'Stuffed Grape Leaves', 'ورق عنب محشي بالأرز والتوابل', 65, 'appetizers', 'images/menu/grape_leaves.png', true),
('سمبوسك جبنة', 'Cheese Sambousek', 'سمبوسك مقرمش محشي بالجبنة والنعناع', 55, 'appetizers', 'images/menu/sambousek.png', false),
('سلطة سيزر', 'Caesar Salad', 'خس روماني مع صوص سيزر وخبز محمص وبارميزان', 70, 'appetizers', 'images/menu/caesar_salad.png', false),
('شوربة عدس', 'Lentil Soup', 'شوربة عدس تقليدية مع الكمون والليمون', 40, 'appetizers', 'images/menu/lentil_soup.png', true);

-- Main Course (الأطباق الرئيسية)
INSERT INTO menu_items (name, name_en, description, price, category, image_url, is_popular) VALUES
('مشاوي مشكلة', 'Mixed Grill', 'تشكيلة مشاوي فاخرة مع أرز وخضار مشوية', 220, 'mains', 'images/menu/mixed_grill.png', true),
('كباب لحم', 'Lamb Kebab', 'كباب لحم مشوي على الفحم مع أرز بسمتي', 180, 'mains', 'images/menu/lamb_kebab.png', true),
('شيش طاووق', 'Shish Tawook', 'صدور دجاج متبلة مشوية مع صوص ثومية', 150, 'mains', 'images/menu/shish_tawook.png', true),
('فتة شاورما', 'Shawarma Fatteh', 'شاورما لحم مع خبز محمص وزبادي وصنوبر', 135, 'mains', 'images/menu/shawarma_fatteh.png', false),
('كفتة بالصينية', 'Kofta Casserole', 'كفتة مع بطاطس وطماطم في الفرن', 140, 'mains', 'images/menu/kofta.png', false),
('سمك مشوي', 'Grilled Fish', 'سمك طازج مشوي مع سلطة طحينة وأرز', 200, 'mains', 'images/menu/grilled_fish.png', true),
('ملوخية بالأرانب', 'Molokhia', 'ملوخية خضراء مع أرانب مشوية وأرز', 165, 'mains', 'images/menu/molokhia.png', false),
('فاهيتا دجاج', 'Chicken Fajita', 'دجاج مع فلفل ملون وصوص مكسيكي وتورتيلا', 145, 'mains', 'images/menu/chicken_fajita.png', false),
('برجر واغيو', 'Wagyu Burger', 'برجر لحم واغيو مع جبنة شيدر وصوص خاص', 175, 'mains', 'images/menu/wagyu_burger.png', true),
('باستا ألفريدو', 'Pasta Alfredo', 'باستا كريمية مع دجاج مشوي ومشروم', 130, 'mains', 'images/menu/pasta_alfredo.png', false);

-- Beverages (المشروبات)
INSERT INTO menu_items (name, name_en, description, price, category, image_url, is_popular) VALUES
('عصير مانجو طازج', 'Fresh Mango Juice', 'مانجو طازجة مخفوقة مع ثلج', 45, 'beverages', 'images/menu/mango_juice.png', true),
('ليمون بالنعناع', 'Lemon Mint', 'ليمون طازج مع نعناع وثلج', 35, 'beverages', 'images/menu/lemon_mint.png', true),
('موهيتو فراولة', 'Strawberry Mojito', 'فراولة طازجة مع نعناع وصودا', 55, 'beverages', 'images/menu/strawberry_mojito.png', true),
('قهوة تركي', 'Turkish Coffee', 'قهوة تركية تقليدية مع هيل', 30, 'beverages', 'images/menu/turkish_coffee.png', false),
('كابتشينو', 'Cappuccino', 'إسبريسو مع حليب مبخر ورغوة ناعمة', 50, 'beverages', 'images/menu/cappuccino.png', true),
('شاي أخضر', 'Green Tea', 'شاي أخضر فاخر بالنعناع', 25, 'beverages', 'images/menu/green_tea.png', false),
('سموذي توت مشكل', 'Berry Smoothie', 'مزيج من التوت الطازج مع زبادي وعسل', 60, 'beverages', 'images/menu/berry_smoothie.png', false),
('ميلك شيك شوكولاتة', 'Chocolate Milkshake', 'ميلك شيك شوكولاتة كريمي غني', 55, 'beverages', 'images/menu/chocolate_milkshake.png', false);

-- Desserts (الحلويات)
INSERT INTO menu_items (name, name_en, description, price, category, image_url, is_popular) VALUES
('كنافة نابلسية', 'Kunafa', 'كنافة بالجبنة مع شربات وفستق حلبي', 75, 'desserts', 'images/menu/kunafa.png', true),
('أم علي', 'Om Ali', 'حلوى مصرية تقليدية بالمكسرات والقشطة', 65, 'desserts', 'images/menu/om_ali.png', true),
('بسبوسة', 'Basbousa', 'بسبوسة طرية بالقشطة والشربات', 45, 'desserts', 'images/menu/basbousa.png', false),
('تشيز كيك توت', 'Berry Cheesecake', 'تشيز كيك كريمي مع صوص التوت', 80, 'desserts', 'images/menu/berry_cheesecake.png', true),
('كريم بروليه', 'Crème Brûlée', 'كريم بروليه فرنسي بالفانيليا', 70, 'desserts', 'images/menu/creme_brulee.png', false),
('آيس كريم مشكل', 'Mixed Ice Cream', 'ثلاث كرات آيس كريم مع توبينج', 55, 'desserts', 'images/menu/ice_cream.png', false),
('براونيز بالشوكولاتة', 'Chocolate Brownie', 'براونيز دافئ مع آيس كريم فانيليا', 65, 'desserts', 'images/menu/chocolate_brownie.png', true),
('بقلاوة مشكلة', 'Mixed Baklava', 'تشكيلة بقلاوة بالفستق والكاجو', 85, 'desserts', 'images/menu/baklava.png', false);
