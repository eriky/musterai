// File: src/web/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { DeviceApproval } from './components/DeviceApproval.js';
import { McpConsent } from './components/McpConsent.js';
import './index.css';

// /device (MUS-28's login approval page) and /mcp/authorize (MUS-29's
// consent screen) are standalone screens outside the /projects/:id app
// shell and its custom router — routed here rather than threading them
// through App's state.
const path = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {path === '/device' ? <DeviceApproval /> : path === '/mcp/authorize' ? <McpConsent /> : <App />}
  </React.StrictMode>
);
