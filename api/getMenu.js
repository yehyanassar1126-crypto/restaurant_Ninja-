const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { category } = req.query;

    let query = supabase.from('menu_items').select('*').eq('available', true).order('is_popular', { ascending: false });

    if (category && category !== 'all') {
        query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data: data });
}
