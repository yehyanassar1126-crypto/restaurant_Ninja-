const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { phone } = req.body;

    try {
        // Fetch latest order to retrieve customer info
        const { data: orderData } = await supabase
            .from('orders')
            .select('customer_name, customer_phone, order_type, table_number, delivery_address')
            .eq('customer_phone', phone)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!orderData) return res.status(200).json({ found: false });

        // Count total orders for this customer
        const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('customer_phone', phone);

        return res.status(200).json({
            found: true,
            customer_name: orderData.customer_name,
            order_type: orderData.order_type,
            table_number: orderData.table_number,
            delivery_address: orderData.delivery_address,
            total_orders: count || 0
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
