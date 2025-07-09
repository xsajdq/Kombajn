import type { VercelRequest, VercelResponse } from '@vercel/node';

// This is a placeholder file to prevent Vercel build errors. It should not be used.
export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Allow', []);
    res.status(404).json({ error: 'Endpoint not found.' });
}
