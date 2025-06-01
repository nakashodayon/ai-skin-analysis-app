import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StagewiseToolbar } from '@stagewise/toolbar-react';

const stagewiseConfig = {
  plugins: []
};

const StagewiseWrapper: React.FC = () => {
  return <StagewiseToolbar config={stagewiseConfig} />;
};

export const initStagewiseToolbar = () => {
  if (process.env.NODE_ENV === 'development') {
    // Create a separate container for the stagewise toolbar
    const toolbarContainer = document.createElement('div');
    toolbarContainer.id = 'stagewise-toolbar-container';
    document.body.appendChild(toolbarContainer);

    // Create a separate React root for the toolbar
    const toolbarRoot = createRoot(toolbarContainer);
    toolbarRoot.render(<StagewiseWrapper />);
  }
}; 