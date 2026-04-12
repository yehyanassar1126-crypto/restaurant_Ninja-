const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

    const { id, action } = req.query;
    if (!id || !action) return res.status(400).send('Missing ID or Action parameter.');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        // Fetch the staged record
        const { data: pendingRecord, error: fetchError } = await supabase
            .from('pending_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !pendingRecord) {
            return res.status(404).send(`
                <div style="font-family: 'Segoe UI', sans-serif; text-align: center; margin-top: 80px; color: #C4553A;">
                    <h1>⚠️ الطلب غير موجود</h1>
                    <p>هذا الطلب تم معالجته مسبقاً أو لم يتم العثور عليه.</p>
                </div>
            `);
        }

        if (action === 'approve') {
            const { order_data: orderData, items_data: items } = pendingRecord;

            // Insert into permanent orders table
            const { data: orderResult, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select();

            if (orderError) {
                console.error('Order insert error:', orderError);
                throw orderError;
            }

            const orderId = orderResult[0].id;

            // Insert order items
            if (items && items.length > 0) {
                const orderItems = items.map(item => ({
                    order_id: orderId,
                    menu_item_id: item.id || null,
                    item_name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems);

                if (itemsError) {
                    console.error('Order items insert error:', itemsError);
                }
            }
        }

        // Delete from pending_orders regardless of approval or rejection
        await supabase.from('pending_orders').delete().eq('id', id);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        if (action === 'approve') {
            return res.status(200).send(`
                <div style="font-family: 'Segoe UI', sans-serif; text-align: center; margin-top: 60px; background: linear-gradient(135deg, #1C1410, #2a1f17); min-height: 100vh; padding: 40px; color: #FAF5EB;">
                    <div style="max-width: 500px; margin: 0 auto; background: rgba(212,168,83,0.1); border: 1px solid rgba(212,168,83,0.3); border-radius: 20px; padding: 40px;">
                        <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                        <h1 style="color: #D4A853; margin-bottom: 10px;">تم تأكيد الطلب</h1>
                        <p style="color: rgba(250,245,235,0.7);">تم حفظ الطلب في قاعدة البيانات وجاري التحضير</p>
                        <div style="margin-top: 20px; color: #D4A853; font-size: 14px;">🍽️ Flavour Haven</div>
                    </div>
                </div>
            `);
        } else {
            return res.status(200).send(`
                <div style="font-family: 'Segoe UI', sans-serif; text-align: center; margin-top: 60px; background: linear-gradient(135deg, #1C1410, #2a1f17); min-height: 100vh; padding: 40px; color: #FAF5EB;">
                    <div style="max-width: 500px; margin: 0 auto; background: rgba(196,85,58,0.1); border: 1px solid rgba(196,85,58,0.3); border-radius: 20px; padding: 40px;">
                        <div style="font-size: 60px; margin-bottom: 20px;">❌</div>
                        <h1 style="color: #C4553A; margin-bottom: 10px;">تم رفض الطلب</h1>
                        <p style="color: rgba(250,245,235,0.7);">تم حذف الطلب من النظام</p>
                        <div style="margin-top: 20px; color: #D4A853; font-size: 14px;">🍽️ Flavour Haven</div>
                    </div>
                </div>
            `);
        }

    } catch (error) {
        console.error("Approval Error:", error);
        return res.status(500).send('System Error: ' + error.message);
    }
}