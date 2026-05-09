import React from 'react';
import { WorkforceDashboard } from './WorkforceDashboard';
import { WorkforceProfile } from './WorkforceProfile';

// Simple wrapper to export both dashboard and profile for App.tsx
export const Workforce = () => {
  // You can enhance this to switch between dashboard/profile as needed
  return <WorkforceDashboard />;
};

export { WorkforceDashboard, WorkforceProfile };
