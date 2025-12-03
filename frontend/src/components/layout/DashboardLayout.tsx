import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const DashboardLayout = () => {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};