const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const PAY = ['cash', 'card', 'instapay', 'wallet'];
const CATS = ['appetizers', 'mains', 'beverages', 'desserts'];
const key = () => crypto.createHmac('sha256', 'fh-admin-v1').update(process.env.SUPABASE_SERVICE_ROLE_KEY || '').digest();
const mac = b => crypto.createHmac('sha256', key()).update(b).digest('base64url');
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + mac(b); };
function readToken(t) {
    const [b, s] = String(t || '').split('.');
    if (!b || !s) return null;
    const x = Buffer.from(s), y = Buffer.from(mac(b));
    if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
    try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
async function all(q) {
    const out = [];
    for (let f = 0; ; f += 1000) {
        const { data, error } = await q().range(f, f + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) break;
    }
    return out;
}
function keyRole() {
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (k.startsWith('sb_secret_')) return 'service_role';
    if (k.startsWith('sb_publishable_')) return 'anon';
    try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role || null; } catch { return null; }
}
const bad = (res, m, c = 400) => res.status(c).json({ success: false, error: m });

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return bad(res, 'Method Not Allowed', 405);
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
        return bad(res, 'متغيرات SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ناقصة في Vercel (وبعدها Redeploy)', 500);

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const b = req.body || {};

    if (b.action === 'login') {
        try {
            const { data, error } = await db.rpc('admin_login', { p_username: String(b.username || ''), p_password: String(b.password || '') });
            if (error) throw error;
            if (!data?.ok) return bad(res, data?.locked ? 'الحساب اتقفل 15 دقيقة بسبب محاولات غلط كتير' : 'اسم المستخدم أو كلمة السر غير صحيحة', 401);
            return res.json({ success: true, token: sign({ uid: data.id, exp: Date.now() + 12 * 3600 * 1000 }),
                user: { id: data.id, username: data.username, display_name: data.display_name } });
        } catch (e) {
            const role = keyRole();
            if (/permission denied/i.test(e.message) && role !== 'service_role')
                return bad(res, 'المفتاح SUPABASE_SERVICE_ROLE_KEY في Vercel هو "' + (role || 'غير معروف') + '" مش service_role. بدّله واعمل Redeploy.', 500);
            return bad(res, e.message, 500);
        }
    }

    const session = readToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    let me = null;
    if (session) me = (await db.from('admin_users').select('id, username, display_name').eq('id', session.uid).maybeSingle()).data;
    if (!me) return bad(res, 'سجّل دخول تاني', 401);

    try {
        switch (b.action) {
            case 'ping': return res.json({ success: true, user: me });

            case 'pending': {
                const { data, error } = await db.from('pending_orders').select('*').order('id', { ascending: true });
                if (error) throw error;
                return res.json({ success: true, data });
            }
            case 'approve': {
                if (!PAY.includes(b.payment_method)) return bad(res, 'اختار طريقة الدفع');
                const { data: p } = await db.from('pending_orders').select('*').eq('id', b.id).maybeSingle();
                if (!p) return bad(res, 'الطلب مش موجود أو اتعالج قبل كده', 404);
                const { data: o, error } = await db.from('orders').insert([{ ...p.order_data, payment_method: b.payment_method, status: 'confirmed' }]).select().single();
                if (error) throw error;
                const lines = (p.items_data || []).map(i => ({ order_id: o.id, menu_item_id: i.id || null, item_name: i.name,
                    quantity: i.quantity, unit_price: i.price, total_price: i.price * i.quantity }));
                if (lines.length) await db.from('order_items').insert(lines);
                await db.from('pending_orders').delete().eq('id', p.id);
                return res.json({ success: true });
            }
            case 'reject': {
                await db.from('pending_orders').delete().eq('id', b.id);
                return res.json({ success: true });
            }
            case 'orders':
                return res.json({ success: true, data: await all(() => db.from('orders').select('*').order('created_at', { ascending: false })) });

            case 'menu': {
                const { data, error } = await db.from('menu_items').select('*').order('category').order('name');
                if (error) throw error;
                return res.json({ success: true, data });
            }
            case 'menu_save': {
                const f = {};
                if (b.name !== undefined) f.name = String(b.name).trim();
                if (b.name_en !== undefined) f.name_en = String(b.name_en).trim() || null;
                if (b.description !== undefined) f.description = String(b.description).trim() || null;
                if (b.price !== undefined) f.price = Number(b.price);
                if (b.category !== undefined) f.category = b.category;
                if (b.is_popular !== undefined) f.is_popular = !!b.is_popular;
                if (b.available !== undefined) f.available = !!b.available;
                if ('name' in f && !f.name) return bad(res, 'اكتب اسم الصنف');
                if ('price' in f && !(f.price >= 0)) return bad(res, 'السعر غير صحيح');
                if ('category' in f && !CATS.includes(f.category)) return bad(res, 'القسم غير صحيح');
                if (b.id) {
                    const { error } = await db.from('menu_items').update(f).eq('id', b.id);
                    if (error) throw error;
                } else {
                    if (!f.name || !('price' in f) || !f.category) return bad(res, 'الاسم والسعر والقسم مطلوبين');
                    const { error } = await db.from('menu_items').insert([f]);
                    if (error) throw error;
                }
                return res.json({ success: true });
            }
            case 'menu_delete': {
                const { error } = await db.from('menu_items').delete().eq('id', b.id);
                if (error) return bad(res, error.code === '23503' ? 'الصنف ده اتباع قبل كده ومينفعش يتمسح. اخفيه بدل ما تمسحه.' : error.message, 400);
                return res.json({ success: true });
            }
            case 'feedback': {
                const { data, error } = await db.from('customer_feedback').select('*').order('created_at', { ascending: false }).limit(500);
                if (error) throw error;
                return res.json({ success: true, data });
            }

            case 'admins': {
                const { data, error } = await db.from('admin_users').select('id, username, display_name, last_login, created_at').order('id');
                if (error) throw error;
                return res.json({ success: true, data });
            }
            case 'admin_add': {
                const u = String(b.username || '').trim(), p = String(b.password || '');
                if (!/^[A-Za-z0-9_.-]{3,30}$/.test(u)) return bad(res, 'اسم المستخدم: 3 إلى 30 حرف إنجليزي أو أرقام');
                if (p.length < 6) return bad(res, 'كلمة السر 6 حروف على الأقل');
                const { error } = await db.rpc('admin_create', { p_username: u, p_password: p, p_display: String(b.display_name || '') });
                if (error) return bad(res, /duplicate|unique/i.test(error.message) ? 'اسم المستخدم موجود بالفعل' : error.message);
                return res.json({ success: true });
            }
            case 'admin_password': {
                const p = String(b.password || '');
                if (p.length < 6) return bad(res, 'كلمة السر 6 حروف على الأقل');
                const { error } = await db.rpc('admin_set_password', { p_id: b.id, p_password: p });
                if (error) throw error;
                return res.json({ success: true });
            }
            case 'admin_delete': {
                if (String(b.id) === String(me.id)) return bad(res, 'مينفعش تمسح حسابك اللي داخل بيه');
                const { count } = await db.from('admin_users').select('id', { count: 'exact', head: true });
                if ((count || 0) <= 1) return bad(res, 'لازم يفضل مدير واحد على الأقل');
                const { error } = await db.from('admin_users').delete().eq('id', b.id);
                if (error) throw error;
                return res.json({ success: true });
            }
            default: return bad(res, 'Unknown action');
        }
    } catch (e) { return bad(res, e.message, 500); }
};
