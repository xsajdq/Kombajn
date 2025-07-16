// api/auth/[...slug].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import userHandler from '../_handlers/auth/user';
import logoutHandler from '../_handlers/auth/logout';
import updatePasswordHandler from '../_handlers/auth/update-password';
import connectGoogleHandler from '../_handlers/auth/connect-google';
import connectSlackHandler from '../_handlers/auth/connect-slack';
import callbackGoogleHandler from '../_handlers/auth/callback-google';
import callbackSlackHandler from '../_handlers/auth/callback-slack';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { slug } = req.query;

    if (!Array.isArray(slug) || slug.length === 0) {
        return res.status(404).json({ error: 'Auth action not found.' });
    }

    const [action, provider] = slug;

    switch (action) {
        case 'user':
            return userHandler(req, res);
        case 'logout':
            return logoutHandler(req, res);
        case 'update-password':
            return updatePasswordHandler(req, res);
        case 'connect':
            if (provider === 'google') return connectGoogleHandler(req, res);
            if (provider === 'slack') return connectSlackHandler(req, res);
            break;
        case 'callback':
            if (provider === 'google') return callbackGoogleHandler(req, res);
            if (provider === 'slack') return callbackSlackHandler(req, res);
            break;
    }

    return res.status(404).json({ error: `Auth action '${slug.join('/')}' not found.` });
}
