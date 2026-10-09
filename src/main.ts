import { App } from './ui/app.js';
import { titleScreen } from './ui/screens/title.js';

const root = document.getElementById('app')!;
const app = new App(root);
app.go(titleScreen);
if (new URLSearchParams(location.search).get('debug') === '1') (globalThis as any).__branchlikeApp = app;
