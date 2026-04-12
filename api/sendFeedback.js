const { createClient } = require('@supabase/supabase-js');
const brevo = require('@getbrevo/brevo');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { rating, type, message, customerName, customerPhone } = req.body;

    try {
        // Save to Supabase
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error: dbError } = await supabase.from('customer_feedback').insert([{
            customer_name: customerName,
            customer_phone: customerPhone,
            rating: parseInt(rating),
            feedback_type: type,
            message: message
        }]);

        if (dbError) throw new Error("Database failed: " + dbError.message);

        // Send email alert via Brevo
        let apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        let sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { "name": "Flavour Haven", "email": "restaurant22nassar@gmail.com" };
        sendSmtpEmail.to = [{ "email": "restaurant22nassar@gmail.com" }];
        sendSmtpEmail.subject = `🍽️ Customer Feedback from ${customerName}`;

        const ratingStars = '⭐'.repeat(parseInt(rating));
        const typeLabels = { compliment: '🌟 إشادة', suggestion: '💡 اقتراح', complaint: '⚠️ شكوى' };

        sendSmtpEmail.htmlContent = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; text-align: right; background: linear-gradient(135deg, #1C1410 0%, #2a1f17 100%); padding: 30px; border-radius: 16px; color: #FAF5EB; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #D4A853; font-size: 24px; margin: 0;">🍽️ Flavour Haven</h1>
                    <p style="color: rgba(212,168,83,0.8); margin: 5px 0;">تقييم جديد من عميل</p>
                </div>
                <div style="background: rgba(212,168,83,0.1); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 20px;">
                    <p><strong>👤 العميل:</strong> ${customerName}</p>
                    <p><strong>📱 الهاتف:</strong> ${customerPhone}</p>
                    <p><strong>📊 التقييم:</strong> ${ratingStars}</p>
                    <p><strong>📋 النوع:</strong> ${typeLabels[type] || type}</p>
                    <hr style="border-top: 1px solid rgba(212,168,83,0.3);">
                    <p><strong>💬 الرسالة:</strong></p>
                    <p style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;">${message}</p>
                </div>
            </div>`;

        await apiInstance.sendTransacEmail(sendSmtpEmail);

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Feedback Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}