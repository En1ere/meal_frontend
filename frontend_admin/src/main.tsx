import { createRoot } from 'react-dom/client';
import '@meal-planner/design-system/styles.css';
import { App } from './app/app.js';
import './app/globals.css';
import { initializeAdminUnlock } from './shared/auth/unlock.js';
import { installBrowserErrorHandlers } from './shared/telemetry/browser.js';

initializeAdminUnlock();
installBrowserErrorHandlers();
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<App />);
