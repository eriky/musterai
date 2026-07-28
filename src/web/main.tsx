// File: src/web/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { DeviceApproval } from './components/DeviceApproval.js';
import './index.css';

// /device is a standalone screen (MUS-28's login approval page) outside the
// /projects/:id app shell and its custom router — routed here rather than
// threading it through App's state.
const isDeviceApproval = window.location.pathname === '/device';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDeviceApproval ? <DeviceApproval /> : <App />}
  </React.StrictMode>
);
