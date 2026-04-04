
import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, LogOut, RefreshCw, Coffee, Users, 
  Search, ExternalLink, Calendar, ArrowUpRight,
  TrendingUp, Clock, User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Member {
  id: string;
  name: string;
  customer_id: string;
  unique_code: string;
  space_minutes: number;
  catering_consumption: number;
  customers?: {
    full_name: string;
    phone: string;
    code: string;
    email: string;
  };
}

interface LeaderDashboardProps {
  data: {
    company: any;
    contract: any;
    members: Member[];
  };
  onLogout: () => void;
}

export const LeaderDashboard = ({ data, onLogout }: LeaderDashboardProps) => {
  const [dashboardData, setDashboardData] = useState(data);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const company = dashboardData.company;
  const contract = dashboardData.contract;
  const members = dashboardData.members;
  
  const refreshDashboard = async () => {
    if (!company?.id) return;
    setIsRefreshing(true);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. Fetch Basic Info & All Company Members
      const { data: memberStats } = await (supabase as any)
        .from('company_members')
        .select('*, customers(id, full_name, phone, code, email, created_at)')
        .eq('company_id', company.id);

      const memberCustIds = (memberStats || []).map((m: any) => m.customer_id).filter(Boolean);
      const memberCorporateIds = (memberStats || []).map((m: any) => m.id);

      // 2. Efficient Usage Queries
      const queries: Promise<any>[] = [
        (supabase as any).from('monthly_contracts').select('*').eq('company_id', company.id).eq('month', monthStr).maybeSingle()
      ];

      // Fetch active sessions for these customers specifically
      if (memberCustIds.length > 0) {
        queries.push(
          (supabase as any).from('workspace_sessions')
            .select('*')
            .in('status', ['active', 'paused', 'pause_requested', 'checkout_requested'])
            .in('customer_id', memberCustIds)
        );
      } else {
        queries.push(Promise.resolve({ data: [] }));
      }

      // Fetch historical space sessions
      if (memberCorporateIds.length > 0) {
        queries.push(
          (supabase as any).from('space_sessions')
            .select('*')
            .or(`company_id.eq.${company.id},member_id.in.(${memberCorporateIds.join(',')})`)
            .gte('check_in', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
        );
      } else {
        queries.push(Promise.resolve({ data: [] }));
      }

      // Fetch catering history
      if (memberCorporateIds.length > 0) {
        queries.push(
          (supabase as any).from('catering_orders')
            .select('*')
            .or(`company_id.eq.${company.id},member_id.in.(${memberCorporateIds.join(',')})`)
            .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
        );
      } else {
        queries.push(Promise.resolve({ data: [] }));
      }

      // Fetch completed workspace_sessions as historical backup
      if (memberCustIds.length > 0) {
        queries.push(
          (supabase as any).from('workspace_sessions')
            .select('*')
            .eq('status', 'completed')
            .in('customer_id', memberCustIds)
            .gte('start_time', monthStart.toISOString())
        );
      } else {
        queries.push(Promise.resolve({ data: [] }));
      }

      const [contractRes, activeSessionsRes, sessionsRes, ordersRes, completedWorkspaceRes] = await Promise.all(queries);

      const updatedMembers = (memberStats || []).map((m: any) => {
        // Source data
        const mActive = (activeSessionsRes.data || []).find((as: any) => as.customer_id === m.customer_id);
        const mSpaceSessions = (sessionsRes.data || []).filter((s: any) => s.company_id === company.id || s.member_id === m.id);
        const mCompletedWorkspace = (completedWorkspaceRes.data || []).filter((s: any) => s.customer_id === m.customer_id);
        const mOrders = (ordersRes.data || []).filter((o: any) => o.company_id === company.id || o.member_id === m.id);
        
        let activeSpaceMins = 0;
        let activeCateringAmt = 0;
        
        if (mActive) {
          const start = new Date(mActive.start_time);
          activeSpaceMins = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
          activeCateringAmt = Number(mActive.catering_amount) || 0;
        }

        // Aggregate Space
        const historySpaceMins = mSpaceSessions.reduce((sum: number, s: any) => sum + (Number(s.duration_hours) * 60 || 0), 0);
        const backupSpaceMins = mCompletedWorkspace.reduce((sum: number, s: any) => sum + (Number(s.total_minutes) || 0), 0);
        
        // Aggregate Catering
        const historyCatering = mOrders.reduce((sum: number, o: any) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
        const backupCatering = mCompletedWorkspace.reduce((sum: number, s: any) => sum + (Number(s.catering_amount) || 0), 0);
        
        return {
          ...m,
          is_active: !!mActive,
          space_minutes: Math.max(historySpaceMins, backupSpaceMins) + activeSpaceMins,
          catering_consumption: Math.max(historyCatering, backupCatering) + activeCateringAmt
        };
      });

      setDashboardData({
        company: company,
        members: updatedMembers,
        contract: contractRes.data
      });
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!company?.id) return;
    const interval = setInterval(refreshDashboard, 10000); 
    return () => clearInterval(interval);
  }, [company?.id]);

  const totalCateringUsed = (members || []).reduce((sum: number, m: any) => sum + (Number(m.catering_consumption) || 0), 0);
  const totalSpaceHours = (members || []).reduce((sum: number, m: any) => sum + (Number(m.space_minutes) || 0), 0) / 60;
  const sharedBalance = Number(contract?.catering_prepaid_total) || 0;
  const remainingBalance = sharedBalance - totalCateringUsed;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-right font-['Cairo'] p-4 md:p-8 animate-in fade-in duration-700">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row-reverse justify-between items-center bg-white/5 backdrop-blur-3xl border border-white/10 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl gap-6 md:gap-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
          
          <div className="flex flex-col md:flex-row-reverse items-center gap-4 md:gap-6 w-full md:w-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
              <LayoutGrid size={32} />
            </div>
            <div className="text-center md:text-right">
              <div className="flex flex-row-reverse items-center justify-center md:justify-start gap-3">
                 <h1 className="text-2xl md:text-3xl font-black text-white leading-tight truncate">{company?.name}</h1>
                 <button 
                   onClick={refreshDashboard}
                   className={`p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                 >
                   <RefreshCw size={16} />
                 </button>
              </div>
              <p className="text-slate-500 text-[10px] md:text-xs font-bold mt-1 tracking-wider">لوحة تحكم مسؤولي الشركة • {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full md:w-auto flex items-center justify-center gap-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-8 py-4 rounded-2xl font-black transition-all border border-rose-500/20 active:scale-95 shadow-lg shadow-rose-500/5"
          >
            <span>تسجيل الخروج</span>
            <LogOut size={20} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {/* Catering Consumption */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/10 animate-in zoom-in-95 duration-500">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                   <Coffee size={24} className="text-white" />
                </div>
                <div className="text-right">
                   <p className="text-white/60 text-[10px] md:text-xs font-black uppercase tracking-widest leading-relaxed">إجمالي استهلاك الضيافة</p>
                   <p className="text-3xl md:text-4xl font-black text-white mt-2">{totalCateringUsed.toFixed(0)} <span className="text-lg opacity-60">EGP</span></p>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">الميزانية المستهلكة</span>
                    <span className="text-xs text-white font-black">{sharedBalance > 0 ? Math.min(100, Math.round((totalCateringUsed / sharedBalance) * 100)) : 0}%</span>
                 </div>
                 <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000" 
                      style={{ width: `${sharedBalance > 0 ? Math.min(100, (totalCateringUsed / sharedBalance) * 100) : 0}%` }}
                    />
                 </div>
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="bg-white/5 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/10 animate-in zoom-in-95 duration-500 delay-75">
            <div className="relative z-10 flex flex-row-reverse h-full justify-between items-center">
              <div className="text-right">
                 <p className="font-black text-slate-500 text-[10px] md:text-xs uppercase tracking-widest leading-relaxed">إجمالي ساعات العمل</p>
                 <h3 className="text-3xl md:text-4xl font-black text-white mt-1">{totalSpaceHours.toFixed(1)} <span className="text-sm opacity-40 uppercase">Hours</span></h3>
                 <div className="flex flex-row-reverse items-center gap-2 mt-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    <p className="text-[9px] md:text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Live Tracking Active</p>
                 </div>
              </div>
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/10 shrink-0">
                 <Clock size={28} />
              </div>
            </div>
          </div>

          {/* Remaining Balance */}
          <div className="bg-white/5 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/10 sm:col-span-2 md:col-span-1 animate-in zoom-in-95 duration-500 delay-150">
            <div className="relative z-10 flex flex-row-reverse h-full justify-between items-center">
              <div className="text-right">
                 <p className="font-black text-slate-500 text-[10px] md:text-xs uppercase tracking-widest leading-relaxed">الرصيد المتبقي</p>
                 <h3 className={`text-3xl md:text-4xl font-black mt-1 ${remainingBalance < 100 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {remainingBalance.toFixed(0)} <span className="text-sm opacity-40 uppercase">EGP</span>
                 </h3>
                 <div className="flex flex-row-reverse items-center gap-1.5 mt-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${remainingBalance < 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className="text-[9px] md:text-[10px] text-slate-500 font-bold">من أصل {sharedBalance} جنيه</span>
                 </div>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 ${remainingBalance < 100 ? 'bg-rose-500/10 text-rose-500 border-rose-500/10' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'}`}>
                 <Coffee size={28} />
              </div>
            </div>
          </div>
        </div>

        {/* Member Roster Card */}
        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
          <div className="p-6 md:p-10 border-b border-white/10 flex flex-col md:flex-row-reverse justify-between items-center md:items-start bg-white/[0.02] gap-4">
            <div className="text-center md:text-right">
               <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">قائمة الموظفين ومعلوماتهم</h2>
               <p className="text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mt-1">Real-Time Team Analytics & Logs</p>
            </div>
            <div className="flex flex-row-reverse items-center gap-3">
               <div className="flex flex-row-reverse items-center gap-3 px-5 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                     <Users size={18} />
                  </div>
                  <span className="text-sm font-black text-slate-300">{members?.length} <span className="text-xs opacity-50 font-bold pr-1">Staff Listed</span></span>
               </div>
            </div>
          </div>

          {/* Desktop Table - Hidden on Mobile/Tablet */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/[0.01]">
                  <th className="py-6 px-10 text-slate-500 font-black text-[10px] uppercase tracking-widest text-right">الموظف</th>
                  <th className="py-6 px-10 text-slate-500 font-black text-[10px] uppercase tracking-widest text-center">كود الدخول</th>
                  <th className="py-6 px-10 text-slate-500 font-black text-[10px] uppercase tracking-widest text-center">ساعات العمل</th>
                  <th className="py-6 px-10 text-slate-500 font-black text-[10px] uppercase tracking-widest text-center">بوفيه</th>
                  <th className="py-6 px-10 text-slate-500 font-black text-[10px] uppercase tracking-widest text-center">الحالة</th>
                  <th className="py-6 px-10 text-slate-500 font-black text-[10px] uppercase tracking-widest text-center">رؤية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(members || []).map((m: any) => (
                  <tr key={m.id} className="hover:bg-white/[0.03] transition-all group border-r-2 border-transparent hover:border-indigo-600">
                    <td className="py-6 px-10">
                       <div className="flex flex-row-reverse items-center gap-4">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 font-black border border-white/5 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 transition-all">
                             {m.customers?.full_name?.[0] || 'U'}
                          </div>
                          <div>
                             <p className="font-black text-white text-base group-hover:text-indigo-300 transition-colors">{m.customers?.full_name}</p>
                             <p className="text-[10px] font-bold text-slate-500 flex flex-row-reverse items-center gap-2">
                               {m.customers?.phone} <div className="w-1 h-1 bg-slate-700 rounded-full" /> {m.customers?.email || 'No Email'}
                             </p>
                          </div>
                       </div>
                    </td>
                    <td className="py-6 px-10 text-center">
                       <span className="bg-indigo-500/10 px-4 py-2 rounded-xl font-mono text-sm text-indigo-400 border border-indigo-500/20 uppercase tracking-widest shadow-inner">
                          {m.unique_code}
                       </span>
                    </td>
                    <td className="py-6 px-10">
                       <div className="flex flex-row-reverse items-center justify-center gap-2">
                          <span className="text-xl font-black text-white">{(m.space_minutes / 60).toFixed(1)}</span>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">h</span>
                       </div>
                    </td>
                    <td className="py-6 px-10">
                       <div className="flex flex-row-reverse items-center justify-center gap-2">
                          <span className="text-xl font-black text-emerald-400">{m.catering_consumption.toFixed(0)}</span>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">egp</span>
                       </div>
                    </td>
                    <td className="py-6 px-10 text-center">
                       {m.is_active ? (
                         <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-pulse">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">In Session</span>
                         </div>
                       ) : (
                         <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Offline</span>
                       )}
                    </td>
                    <td className="py-6 px-10">
                       <div className="flex justify-center">
                          <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-indigo-600 transition-all border border-white/5 shrink-0 group-hover:scale-110 active:scale-90">
                             <ExternalLink size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Optimized Mobile Card Grid */}
          <div className="lg:hidden p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {(members || []).map((m: any) => (
              <div key={m.id} className="bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 rounded-[2rem] p-6 space-y-6 transition-all group overflow-hidden relative shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10 group-hover:bg-indigo-500/10" />
                
                <div className="flex flex-row-reverse items-start justify-between">
                  <div className="flex flex-row-reverse items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400 font-black border border-indigo-500/20 shadow-xl group-hover:shadow-indigo-500/10">
                      {m.customers?.full_name?.[0] || 'U'}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white text-lg group-hover:text-indigo-300 transition-colors line-clamp-1">{m.customers?.full_name}</p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5">{m.customers?.phone}</p>
                    </div>
                  </div>
                  {m.is_active && (
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-right flex flex-col justify-center gap-1 group-hover:bg-black/30 transition-colors">
                    <div className="flex flex-row-reverse items-center gap-2 opacity-40">
                      <Clock size={12} className="text-indigo-400" />
                      <p className="text-[9px] font-black uppercase tracking-widest">ساعات العمل</p>
                    </div>
                    <p className="text-2xl font-black text-white">
                      {(m.space_minutes / 60).toFixed(1)} <span className="text-[11px] opacity-40">HRS</span>
                    </p>
                  </div>
                  
                  <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-right flex flex-col justify-center gap-1 group-hover:bg-black/30 transition-colors">
                    <div className="flex flex-row-reverse items-center gap-2 opacity-40">
                      <Coffee size={12} className="text-emerald-400" />
                      <p className="text-[9px] font-black uppercase tracking-widest">بوفيه</p>
                    </div>
                    <p className="text-2xl font-black text-emerald-400">
                      {m.catering_consumption.toFixed(0)} <span className="text-[11px] opacity-40">EGP</span>
                    </p>
                  </div>
                </div>

                <div className="pt-5 border-t border-white/5 flex flex-row-reverse justify-between items-center bg-white/[0.01] -mx-6 -mb-6 px-6 pb-6 mt-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-400/60 tracking-widest uppercase mb-1">Access Code</p>
                    <span className="font-mono text-xs text-white font-bold tracking-[0.15em]">
                      {m.unique_code}
                    </span>
                  </div>
                  <button className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10 active:scale-90 hover:bg-indigo-600/20">
                    <ExternalLink size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-8 md:p-10 bg-white/[0.01] text-center border-t border-white/5 shadow-inner">
             <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.5em] leading-loose">Business Cloud Terminal • Enterprise Management System • v2.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};
