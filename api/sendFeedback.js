const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        const { orderData, items } = req.body || {};
        if (!orderData?.customer_name || !Array.isArray(items) || !items.length || items.length > 50)
            return res.status(400).json({ success: false, error: 'بيانات الطلب غير مكتملة' });

        // Prices always come from the database, never from the browser.
        const ids = [...new Set(items.map(i => Number(i.id)))];
        const { data: menu, error: mErr } = await supabase.from('menu_items').select('id, name, price').in('id', ids).eq('available', true);
        if (mErr) throw mErr;
        const byId = Object.fromEntries(menu.map(m => [m.id, m]));

        const lines = [];
        for (const i of items) {
            const m = byId[Number(i.id)], q = Math.trunc(Number(i.quantity));
            if (!m || !(q >= 1 && q <= 50)) return res.status(400).json({ success: false, error: 'فيه صنف غير متاح أو كمية غير صحيحة' });
            lines.push({ id: m.id, name: m.name, price: Number(m.price), quantity: q });
        }
        const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
        const type = ['dine_in', 'takeaway', 'delivery'].includes(orderData.order_type) ? orderData.order_type : 'dine_in';

        const fullOrderData = {
            customer_name: String(orderData.customer_name).slice(0, 100),
            customer_phone: String(orderData.customer_phone || '').slice(0, 30),
            order_type: type,
            table_number: type === 'dine_in' ? String(orderData.table_number || '').slice(0, 20) || null : null,
            delivery_address: type === 'delivery' ? String(orderData.delivery_address || '').slice(0, 300) || null : null,
            notes: String(orderData.notes || '').slice(0, 500) || null,
            items_summary: lines.map(l => `${l.name} x${l.quantity}`).join(' | '),
            subtotal: total,
            total
        };

        const { data: pending, error } = await supabase.from('pending_orders')
            .insert([{ order_data: fullOrderData, items_data: lines }]).select();
        if (error) throw error;
        const pendingId = pending[0].id;

        const { count } = await supabase.from('pending_orders').select('id', { count: 'exact', head: true }).lt('id', pendingId);
        const queuePosition = count || 0;

        return res.status(200).json({ success: true, queuePosition, estimatedMinutes: queuePosition * 15, orderId: pendingId });
    } catch (error) {
        console.error('Order Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
