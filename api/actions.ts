
// api/actions.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import generateTasksHandler from './_handlers/generate-tasks';
import notifySlackHandler from './_handlers/notify/slack';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    if (action === 'generate-tasks') {
        return generateTasksHandler(req, res);
    }
    if (action === 'notify-slack') {
        return notifySlackHandler(req, res);
    }
    
    return res.status(404).json({ error: 'Action not found.' });
}
