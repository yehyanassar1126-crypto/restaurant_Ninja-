const { createClient } = require('@supabase/supabase-js');
const brevo = require('@getbrevo/brevo');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        const { orderData, items } = req.body;

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;

        const fullOrderData = {
            customer_name: orderData.customer_name,
            customer_phone: orderData.customer_phone,
            order_type: orderData.order_type || 'dine_in',
            table_number: orderData.table_number || null,
            delivery_address: orderData.delivery_address || null,
            notes: orderData.notes || null,
            items_summary: items.map(i => `${i.name} x${i.quantity}`).join(' | '),
            subtotal: subtotal,
            total: total
        };

        // Stage in pending_orders
        const { data: pendingData, error: pendingError } = await supabase
            .from('pending_orders')
            .insert([{ order_data: fullOrderData, items_data: items }])
            .select();

        if (pendingError) throw pendingError;
        const pendingId = pendingData[0].id;

        // Calculate queue position
        const { data: allPending } = await supabase
            .from('pending_orders')
            .select('id')
            .lt('id', pendingId);

        const queuePosition = allPending ? allPending.length : 0;
        const estimatedMinutes = queuePosition * 15;

        // Send approval email via Brevo
        const host = req.headers.host;
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const approveUrl = `${protocol}://${host}/api/processApproval?id=${pendingId}&action=approve`;
        const rejectUrl = `${protocol}://${host}/api/processApproval?id=${pendingId}&action=reject`;

        let apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        let sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { "name": "Flavour Haven", "email": "restaurant22nassar@gmail.com" };
        sendSmtpEmail.to = [{ "email": "restaurant22nassar@gmail.com" }];
        sendSmtpEmail.subject = `🍽️ New Order: ${fullOrderData.customer_name} - ${total} EGP`;

        // Build items HTML
        let itemsHtml = items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #3a2a1a;">${item.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #3a2a1a; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #3a2a1a; text-align: left;">${(item.price * item.quantity).toFixed(2)} ج.م</td>
            </tr>
        `).join('');

        const orderTypeLabels = { dine_in: 'داخل المطعم 🪑', takeaway: 'تيك أواي 🥡', delivery: 'توصيل 🚗' };
        const orderTypeLabel = orderTypeLabels[fullOrderData.order_type] || fullOrderData.order_type;

        sendSmtpEmail.htmlContent = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; text-align: right; background: linear-gradient(135deg, #1C1410 0%, #2a1f17 100%); padding: 30px; border-radius: 16px; color: #FAF5EB; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #D4A853; font-size: 28px; margin: 0;">🍽️ Flavour Haven</h1>
                    <p style="color: #D4A853; opacity: 0.8; margin: 5px 0;">طلب جديد</p>
                </div>
                <div style="background: rgba(212,168,83,0.1); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                    <p><strong>👤 اسم العميل:</strong> ${fullOrderData.customer_name}</p>
                    <p><strong>📱 رقم التليفون:</strong> ${fullOrderData.customer_phone || 'غير محدد'}</p>
                    <p><strong>📋 نوع الطلب:</strong> ${orderTypeLabel}</p>
                    ${fullOrderData.table_number ? `<p><strong>🪑 رقم الطاولة:</strong> ${fullOrderData.table_number}</p>` : ''}
                    ${fullOrderData.delivery_address ? `<p><strong>📍 عنوان التوصيل:</strong> ${fullOrderData.delivery_address}</p>` : ''}
                    ${fullOrderData.notes ? `<p><strong>📝 ملاحظات:</strong> ${fullOrderData.notes}</p>` : ''}
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                    <thead>
                        <tr style="background: rgba(212,168,83,0.2);">
                            <th style="padding: 10px; text-align: right; color: #D4A853;">الصنف</th>
                            <th style="padding: 10px; text-align: center; color: #D4A853;">الكمية</th>
                            <th style="padding: 10px; text-align: left; color: #D4A853;">السعر</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="text-align: center; background: rgba(212,168,83,0.15); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                    <p style="color: #D4A853; font-size: 24px; font-weight: bold; margin: 0;">الإجمالي: ${total.toFixed(2)} ج.م</p>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="${approveUrl}" style="background: linear-gradient(135deg, #28a745, #218838); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-left: 12px; font-size: 16px; display: inline-block;">✅ قبول الطلب</a>
                    <a href="${rejectUrl}" style="background: linear-gradient(135deg, #C4553A, #a33a24); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">❌ رفض الطلب</a>
                </div>
            </div>`;

        await apiInstance.sendTransacEmail(sendSmtpEmail);

        return res.status(200).json({
            success: true,
            queuePosition,
            estimatedMinutes,
            orderId: pendingId
        });

    } catch (error) {
        console.error("Order Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
