import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { PwaService } from './services/PwaService';
import './index.css';

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).capyPwa = PwaService;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__capyBooted = true;
  }
}
