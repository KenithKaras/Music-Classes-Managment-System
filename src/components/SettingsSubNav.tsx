import React from 'react';
import { Settings, Database, FileText } from 'lucide-react';
import { Tabs } from './Tabs';

export const SettingsSubNav: React.FC = () => {
  const tabs = [
    { id: 'settings', label: 'Academy Settings', to: '/settings', icon: Settings },
    { id: 'backups', label: 'Database Backups & Restore', to: '/backups', icon: Database },
    { id: 'exports', label: 'Reports & Data Exports', to: '/exports', icon: FileText },
  ];

  return <Tabs tabs={tabs} className="mb-6" />;
};
