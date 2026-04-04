import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, UserCheck, ClipboardCheck, Users2, Award, Layers, Calendar, Wallet, Receipt, Package, Users, Settings, LogOut, Monitor, Clock, ChevronRight, ChevronLeft, Building2 } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = ({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) => {
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
    { id: 'dashboard', label: 'لوحة القيادة', path: '/admin/dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: 'بوابة الدخول', path: '/admin/checkin', icon: UserCheck },
    { id: 'workspace_sessions', label: 'الجلسات', path: '/admin/admin-sessions', icon: Users2 },
    { id: 'daily_log', label: 'سجل الحضور', path: '/admin/daily_log', icon: ClipboardCheck },
    { id: 'customers', label: 'قاعدة العملاء', path: '/admin/customers', icon: Users2 },
    { id: 'subscriptions', label: 'الاشتراكات', path: '/admin/subscriptions', icon: Award },
    { id: 'contracts', label: 'التعاقدات', path: '/admin/contracts', icon: Layers },
    { id: 'business', label: 'الشركات', path: '/admin/business', icon: Building2 },
    { id: 'bookings', label: 'الحجوزات', path: '/admin/bookings', icon: Calendar },
    { id: 'rooms_serving', label: 'حالة الغرف', path: '/admin/rooms-status', icon: Clock },
    { id: 'rooms_database', label: 'قاعدة الغرف', path: '/admin/rooms-database', icon: Layers },
    { id: 'rooms_kiosk', label: 'شاشة العرض', path: '/rooms-kiosk', icon: Monitor },
    { id: 'finance', label: 'المالية والتقارير', path: '/admin/finance', icon: Wallet },
    { id: 'expenses', label: 'المصروفات', path: '/admin/expenses', icon: Receipt },
    { id: 'inventory', label: 'المخزن', path: '/admin/inventory', icon: Package },
    { id: 'activities', label: 'الأنشطة', path: '/admin/activities', icon: Calendar },
    { id: 'staff', label: 'المهام', path: '/admin/staff', icon: Users },
    { id: 'settings', label: 'الإعدادات', path: '/admin/settings', icon: Settings },
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
      
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-[#0B0F19] text-slate-300 fixed h-screen right-0 top-0 z-50 flex flex-col font-['Cairo'] shadow-[4px_0_24px_rgba(0,0,0,0.1)] border-l border-white/5 transition-all duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        
        {/* Collapse Toggle Button - Desktop Only */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -left-4 top-10 w-8 h-8 bg-indigo-600 rounded-full items-center justify-center text-white shadow-xl hover:bg-indigo-500 transition-all z-[60] border-2 border-[#0B0F19]"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className={`p-6 border-b border-white/5 relative overflow-hidden flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
          {/* Decorative gradient orb */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px] -z-10 pointer-events-none" />
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-500/10 ring-1 ring-white/20 group-hover:scale-105 transition-all duration-300 flex-shrink-0">
               <img src="/logo.png" alt="Cloud Logo" className="w-full h-full object-contain p-1" />
            </div>
            {!isCollapsed && (
              <h2 className="text-xl font-black tracking-widest uppercase text-right text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 animate-in fade-in duration-500">
                Cloud
              </h2>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-4 px-4'} py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
                  ? 'bg-indigo-500/10 text-white border border-indigo-500/20 shadow-[inset_0px_0px_20px_rgba(99,102,241,0.05)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
              title={isCollapsed ? item.label : ''}
            >
              {({ isActive }) => (
                <>
                  {isActive && !isCollapsed && (
                    <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-indigo-400 to-violet-500 rounded-l-full" />
                  )}
                  <item.icon size={22} className={`transition-transform duration-300 flex-shrink-0 ${isActive ? 'text-indigo-400 scale-110' : 'group-hover:scale-110'}`} />
                  {!isCollapsed && (
                    <span className={`font-bold text-[14px] whitespace-nowrap animate-in slide-in-from-right-4 duration-300 ${isActive ? 'text-white' : ''}`}>
                      {item.label}
                    </span>
                  )}
                  {isCollapsed && isActive && (
                    <div className="absolute inset-y-2 right-1 w-1 bg-indigo-500 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`p-4 border-t border-white/5 relative overflow-hidden`}>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-rose-500/5 to-transparent pointer-events-none" />
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-4 px-4'} py-3.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-2xl transition-all font-bold group border border-transparent hover:border-rose-500/20 relative z-10`}
            title={isCollapsed ? 'تسجيل الخروج' : ''}
          >
            <LogOut size={22} className="group-hover:-translate-x-1 transition-transform flex-shrink-0" />
            {!isCollapsed && <span className="animate-in fade-in duration-300">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
