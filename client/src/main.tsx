import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/onest';
import '@fontsource-variable/chivo-mono';
import './styles/tokens.css';
import { WorkspaceApp } from './local/WorkspaceApp';
import { registerOffline } from './local/offline';

registerOffline();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WorkspaceApp />
  </React.StrictMode>
);
