import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Campus } from './types';
import { supabase } from './lib/supabase';
import { Sidebar } from './components/Sidebar';

import { WorkspaceLogin } from './pages/WorkspaceLogin';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { BookingsManager } from './pages/BookingsManager';
import { SubscriptionsPanel } from './pages/SubscriptionsPanel';
import { ContractsPanel } from './pages/ContractsPanel';
import { SettingsPanel } from './pages/SettingsPanel';
import { CheckinPortal } from './pages/CheckinPortal';
import { WorkspaceAdminSessions } from './pages/WorkspaceAdminSessions';
import { DailyLog } from './pages/DailyLog';
import { CustomerDatabase } from './pages/CustomerDatabase';
import { StaffManagement } from './pages/StaffManagement';
import { FinancePanel } from './pages/FinancePanel';
import { ExpensesPanel } from './pages/ExpensesPanel';
import { InventoryPanel } from './pages/InventoryPanel';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { RoomsStatus } from './pages/RoomsStatus';
import { RoomsKiosk } from './pages/RoomsKiosk';
import { RoomsDatabase } from './pages/RoomsDatabase';
import { KitchenKiosk } from './pages/KitchenKiosk';

const DashboardLayout = () => {
  const [branches, setBranches] = useState<Campus[]>([]);
  const [currentCampus, setCampus] = useState<Campus | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase.from('branches').select('id, name').eq('is_active', true);
      if (data) {
        const formatted = data.map(b => ({ id: b.id, name: b.name, color: 'blue' })); 
        setBranches(formatted);
        if (formatted.length > 0) {
          const mainBranch = formatted.find(b => b.name.toLowerCase().includes('cloud')) || formatted[0];
          setCampus(mainBranch);
        }
      }
    };
    fetchBranches();
  }, []);

  const getPageTitle = (pathname: string) => {
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    
    switch (lastSegment) {
      case 'dashboard': return 'لوحة القيادة';
      case 'checkin': return 'بوابة الدخول';
      case 'admin-sessions': return 'متابعة جلسات مكاتب العمل';
      case 'daily_log': return 'سجل الحضور اليومي';
      case 'customers': return 'قاعدة بيانات العملاء';
      case 'bookings': return 'جدول الحجوزات';
      case 'subscriptions': return 'إدارة الاشتراكات';
      case 'contracts': return 'التعاقدات والشراكات';
      case 'staff': return 'إدارة المهام والأداء';
      case 'finance': return 'التقارير المالية والتحليل';
      case 'expenses': return 'سجل المصروفات';
      case 'inventory': return 'إدارة المخزن';
      case 'activities': return 'خطة الأنشطة السنوية';
      case 'rooms-status': return 'حالة الغرف وحجوزات الساعة';
      case 'rooms-database': return 'قاعدة بيانات الغرف';
      case 'settings': return 'إعدادات النظام';
      default: return 'Cloud Co-Working';
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent font-['Cairo'] text-slate-800 antialiased selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!isSidebarCollapsed)}
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="fixed bottom-10 right-10 lg:hidden z-[60]">
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="w-16 h-16 bg-slate-900 border border-white/20 shadow-2xl rounded-3xl text-white flex items-center justify-center active:scale-95 transition-all group overflow-hidden"
        >
          <div className="relative w-6 h-5 flex flex-col justify-between items-center transition-transform duration-300">
            <div className={`h-0.5 bg-white rounded-full transition-all duration-300 ${isSidebarOpen ? 'w-6 rotate-45 translate-y-2' : 'w-6'}`} />
            <div className={`h-0.5 bg-white rounded-full transition-all duration-300 ${isSidebarOpen ? 'opacity-0' : 'w-4 translate-x-1'}`} />
            <div className={`h-0.5 bg-white rounded-full transition-all duration-300 ${isSidebarOpen ? 'w-6 -rotate-45 -translate-y-[10px]' : 'w-6'}`} />
          </div>
        </button>
      </div>

      <main className={`flex-1 relative min-h-screen transition-all duration-500 pb-24 lg:pb-0 ${
        isSidebarOpen 
          ? 'lg:mr-64 blur-sm lg:blur-none pointer-events-none lg:pointer-events-auto' 
          : isSidebarCollapsed ? 'lg:mr-20 mr-0' : 'lg:mr-64 mr-0'
      }`}>
        <div className="absolute top-0 right-0 w-full h-[500px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10 pointer-events-none" />
        
        <div className={`responsive-container text-right animate-fade-in-up ${location.pathname.includes('/finance') ? 'p-10 md:p-14' : 'px-6 py-10 md:px-10 md:py-16'}`}>
          {!location.pathname.includes('/finance') && (
            <div className="mb-8 md:mb-12 flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {getPageTitle(location.pathname)}
              </h1>
              <div className="flex items-center gap-3">
                <div className="h-1 w-8 md:w-12 bg-indigo-500 rounded-full" />
                <p className="text-slate-500 font-bold text-sm md:text-lg">إدارة العمليات المركزية في {currentCampus?.name || '...'}</p>
              </div>
            </div>
          )}

          <div className="relative">
            <Routes>
              <Route path="/" element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard branchId={currentCampus?.id} />} />
              <Route path="checkin" element={<CheckinPortal branchId={currentCampus?.id} />} />
              <Route path="admin-sessions" element={<WorkspaceAdminSessions branchId={currentCampus?.id} />} />
              <Route path="daily_log" element={<DailyLog branchId={currentCampus?.id} />} />
              <Route path="customers" element={<CustomerDatabase branchId={currentCampus?.id} />} />
              <Route path="bookings" element={<BookingsManager branchId={currentCampus?.id} />} />
              <Route path="subscriptions" element={<SubscriptionsPanel branchId={currentCampus?.id} />} />
              <Route path="contracts" element={<ContractsPanel branchId={currentCampus?.id} />} />
              <Route path="staff" element={<StaffManagement branchId={currentCampus?.id} />} />
              <Route path="finance" element={<FinancePanel branchId={currentCampus?.id} />} />
              <Route path="expenses" element={<ExpensesPanel branchId={currentCampus?.id} />} />
              <Route path="inventory" element={<InventoryPanel branchId={currentCampus?.id} />} />
              <Route path="activities" element={<ActivitiesPage branchId={currentCampus?.id} />} />
              <Route path="rooms-status" element={<RoomsStatus branchId={currentCampus?.id} />} />
              <Route path="rooms-database" element={<RoomsDatabase branchId={currentCampus?.id} />} />
              <Route path="settings" element={<SettingsPanel branchId={currentCampus?.id} />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-['Cairo']">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 bg-indigo-500 rounded-2xl rotate-12" />
          <p className="text-slate-400 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<WorkspaceLogin />} />
      <Route path="/workspace" element={<WorkspaceLogin />} />
      <Route path="/rooms-kiosk" element={<RoomsKiosk />} />
      <Route path="/kitchen-kiosk" element={<KitchenKiosk />} />
      <Route path="/login" element={<LoginPage />} />
      
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        } 
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
