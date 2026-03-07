import { createApp } from './app.js';
import { createRuntimeDependencies } from './factories.js';

const deps = createRuntimeDependencies(process.env);
const app = createApp(deps);

export { app, createApp };
export default app;
