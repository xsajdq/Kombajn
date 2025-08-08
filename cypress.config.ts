import { defineConfig } from 'cypress';
import { seed } from './cypress/tasks/seed';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8000',
    setupNodeEvents(on, config) {
      on('task', {
        seed,
      });

      // Pass environment variables from the .env file to Cypress tests
      config.env.SUPABASE_URL = process.env.CYPRESS_SUPABASE_URL;
      config.env.SUPABASE_ANON_KEY = process.env.CYPRESS_SUPABASE_ANON_KEY;

      return config;
    },
    supportFile: 'cypress/support/e2e.ts',
  },
});