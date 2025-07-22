// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import handlers from the existing _handlers directory
import bootstrapHandler from './_handlers/bootstrap';
import generateTasksHandler from './_handlers/generate-tasks';
import planProjectHandler from './_handlers/plan-project';
import notifySlackHandler from './_handlers/notify/slack';
import saveWorkspacePrefsHandler from './_handlers/save-workspace-prefs';
import dataHandler from './_handlers/data';
import appConfigHandler from './_handlers/config';
import integrationTokenHandler from './_handlers/integrations/token';
import authUserHandler from './_handlers/auth/user';
import authLogoutHandler from './_handlers/auth/logout';
import authUpdatePasswordHandler from './_handlers/auth/update-password';
import authConnectGoogleHandler from './_handlers/auth/connect-google';
import authConnectSlackHandler from './_handlers/auth/connect-slack';
import authCallbackGoogleHandler from './_handlers/auth/callback-google';
import authCallbackSlackHandler from './_handlers/auth/callback-slack';

// Import page data handlers
import clientsPageDataHandler from './_handlers/page_data/clients-page-data';
import projectsPageDataHandler from './_handlers/page_data/projects-page-data';
import tasksPageDataHandler from './_handlers/page_data/tasks-page-data';
import salesDataHandler from './_handlers/page_data/sales-data';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    switch (action) {
        // Main Actions
        case 'bootstrap':
            return bootstrapHandler(req, res);
        case 'data':
            return dataHandler(req, res);
        case 'app-config':
             return appConfigHandler(req, res);
        case 'integration-token':
            return integrationTokenHandler(req, res);
        case 'generate-tasks':
             return generateTasksHandler(req, res);
        case 'plan-project':
            return planProjectHandler(req, res);
        case 'notify-slack':
            return notifySlackHandler(req, res);
        case 'save-workspace-prefs':
            return saveWorkspacePrefsHandler(req, res);

        // Page-specific data fetching
        case 'get-clients-page-data':
            return clientsPageDataHandler(req, res);
        case 'projects-page-data':
            return projectsPageDataHandler(req, res);
        case 'tasks-page-data':
            return tasksPageDataHandler(req, res);
        case 'sales-data':
            return salesDataHandler(req, res);

        // Auth actions
        case 'auth-user':
            return authUserHandler(req, res);
        case 'auth-logout':
            return authLogoutHandler(req, res);
        case 'auth-update-password':
            return authUpdatePasswordHandler(req, res);
        case 'auth-connect-google':
            return authConnectGoogleHandler(req, res);
        case 'auth-connect-slack':
            return authConnectSlackHandler(req, res);
        case 'auth-callback-google':
            return authCallbackGoogleHandler(req, res);
        case 'auth-callback-slack':
            return authCallbackSlackHandler(req, res);

        default:
            return res.status(404).json({ error: `Action '${action}' not found.` });
    }
}
