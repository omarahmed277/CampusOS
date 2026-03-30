import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, UserCheck, ClipboardCheck, Users2, Award, Layers, Calendar, Wallet, Receipt, Package, Users, Settings, LogOut, Monitor, Clock } from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };
  const menuItems = [
    { id: 'dashboard', label: 'لوحة القيادة', path: '/dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: 'بوابة الدخول', path: '/checkin', icon: UserCheck },
    { id: 'workspace_sessions', label: 'الجلسات', path: '/admin-sessions', icon: Users2 },
    { id: 'daily_log', label: 'سجل الحضور', path: '/daily_log', icon: ClipboardCheck },
    { id: 'customers', label: 'قاعدة العملاء', path: '/customers', icon: Users2 },
    { id: 'subscriptions', label: 'الاشتراكات', path: '/subscriptions', icon: Award },
    { id: 'contracts', label: 'التعاقدات', path: '/contracts', icon: Layers },
    { id: 'bookings', label: 'الحجوزات', path: '/bookings', icon: Calendar },
    { id: 'rooms_serving', label: 'حالة الغرف', path: '/rooms-status', icon: Clock },
    { id: 'rooms_database', label: 'قاعدة الغرف', path: '/rooms-database', icon: Layers },
    { id: 'rooms_kiosk', label: 'شاشة العرض', path: '/rooms-kiosk', icon: Monitor },
    { id: 'finance', label: 'المالية والتقارير', path: '/finance', icon: Wallet },


    { id: 'expenses', label: 'المصروفات', path: '/expenses', icon: Receipt },
    { id: 'inventory', label: 'المخزن', path: '/inventory', icon: Package },
    { id: 'activities', label: 'الأنشطة', path: '/activities', icon: Calendar },
    { id: 'staff', label: 'المهام', path: '/staff', icon: Users },
    { id: 'settings', label: 'الإعدادات', path: '/settings', icon: Settings },
  ];
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      
      <aside className={`w-64 bg-[#0B0F19] text-slate-300 fixed h-screen right-0 top-0 z-50 flex flex-col font-['Cairo'] shadow-[4px_0_24px_rgba(0,0,0,0.1)] border-l border-white/5 transition-all duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
      <div className="p-8 border-b border-white/5 relative overflow-hidden">
        {/* Decorative gradient orb */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px] -z-10 pointer-events-none" />
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-500/10 ring-1 ring-white/20 group-hover:scale-105 transition-all duration-300">
             <img src="/logo.png" alt="Cloud Logo" className="w-full h-full object-contain p-1" />
          </div>
          <h2 className="text-2xl font-black tracking-widest uppercase text-right text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
            Cloud
          </h2>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              `w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
                ? 'bg-indigo-500/10 text-white border border-indigo-500/20 shadow-[inset_0px_0px_20px_rgba(99,102,241,0.05)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-indigo-400 to-violet-500 rounded-l-full" />
                )}
                <item.icon size={22} className={`transition-transform duration-300 ${isActive ? 'text-indigo-400 scale-110' : 'group-hover:scale-110'}`} />
                <span className={`font-bold text-[15px] ${isActive ? 'text-white' : ''}`}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-6 border-t border-white/5 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-rose-500/5 to-transparent pointer-events-none" />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-2xl transition-all font-bold group border border-transparent hover:border-rose-500/20 relative z-10"
        >
          <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
    </>
  );
};
