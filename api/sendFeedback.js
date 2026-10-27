const { createClient } = require('@supabase/supabase-js');

// Saves a customer review into customer_feedback (the admin page "التقييمات" tab reads from there).
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    const { rating, type, message, customerName, customerPhone } = req.body || {};

    const stars = Number.parseInt(rating, 10);
    const text = String(message || '').trim();
    if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ success: false, error: 'اختار التقييم من 1 إلى 5' });
    if (!['compliment', 'suggestion', 'complaint'].includes(type)) return res.status(400).json({ success: false, error: 'نوع التقييم غير صحيح' });
    if (!text) return res.status(400).json({ success: false, error: 'اكتب رسالتك' });

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const { error } = await supabase.from('customer_feedback').insert([{
            customer_name: String(customerName || '').trim().slice(0, 100) || 'ضيف',
            customer_phone: String(customerPhone || '').trim().slice(0, 30),
            rating: stars,
            feedback_type: type,
            message: text.slice(0, 1000)
        }]);

        if (error) throw new Error('Database failed: ' + error.message);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Feedback Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
