import React, { useState, useEffect } from 'react';
import { CalendarDays, ShoppingBag, Clock, CheckCircle2, User, RefreshCw, X, Receipt, TrendingUp, TrendingDown, Trash2, Tag, Sparkles, ChevronLeft, ArrowUpRight, ArrowDownRight, Edit3, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui';

interface Session {
  id: string;
  customer_id: string;
  user_code: string;
  phone_number: string;
  start_time: string;
  end_time?: string;
  status: string;
  catering_amount: number;
  orders: any[];
  total_minutes?: number;
  total_amount?: number;
  payment_method?: string;
  customers?: { 
    full_name: string,
    code: string,
    subscriptions?: any[]
  };
}

export const DailyLog = ({ branchId }: { branchId?: string }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Modal States
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editCatering, setEditCatering] = useState('');
  const [editTotal, setEditTotal] = useState('');

  useEffect(() => {
    if (!branchId) return;
    
    fetchTodayLog();

    const channel = (supabase as any)
      .channel(`daily_log_${branchId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_sessions',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchTodayLog())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'subscriptions',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchTodayLog())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'expenses',
        filter: `branch_id=eq.${branchId}` 
      }, () => fetchTodayLog())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  const fetchTodayLog = async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const dateStr = todayISO.split('T')[0];

      // 1. Fetch Sessions with Subscriptions
      const { data: sessionsData, error: errSessions } = await (supabase as any)
        .from('workspace_sessions')
        .select(`*, customers(full_name, code, subscriptions(*))`)
        .eq('branch_id', branchId)
        .gte('created_at', todayISO)
        .order('created_at', { ascending: false });

      if (errSessions) throw errSessions;
      
      const sorted = (sessionsData as any[]).sort((a, b) => {
        const getPriority = (status: string) => {
          if (status === 'completed') return 0;
          if (status === 'checkout_requested') return 1;
          if (status === 'active') return 2;
          return 3;
        };
        
        const pA = getPriority(a.status);
        const pB = getPriority(b.status);
        
        if (pA !== pB) return pA - pB;
        if (a.status === 'completed') {
          return new Date(b.end_time || b.created_at).getTime() - new Date(a.end_time || a.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setSessions(sorted);

      // 2. Fetch Subscriptions today
      const { data: subsData } = await (supabase as any)
        .from('subscriptions')
        .select('price')
        .eq('branch_id', branchId)
        .gte('created_at', todayISO);
      setSubscriptions(subsData || []);

      // 3. Fetch Expenses today
      const { data: expData } = await (supabase as any)
        .from('expenses')
        .select('*')
        .eq('branch_id', branchId)
        .eq('date', dateStr);
      setExpenses(expData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('هل أنت متأكد من مسح هذه الجلسة؟ سيتم حذفها نهائياً من سجلات اليوم والتقارير المالية.')) return;
    try {
      const { error } = await (supabase as any)
        .from('workspace_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTodayLog();
    } catch (err: any) {
      alert('خطأ في المسح: ' + err.message);
    }
  };

  const handleUpdateSession = async () => {
    if (!editingSession) return;
    try {
      const { error } = await (supabase as any)
        .from('workspace_sessions')
        .update({
          start_time: editStartTime,
          end_time: editEndTime || null,
          catering_amount: parseFloat(editCatering) || 0,
          total_amount: parseFloat(editTotal) || 0
        })
        .eq('id', editingSession.id);

      if (error) throw error;
      setEditingSession(null);
      fetchTodayLog();
    } catch (err: any) {
      alert('خطأ في التحديث: ' + err.message);
    }
  };

  const handleCancelCheckoutRequest = async (sessionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('workspace_sessions')
        .update({ status: 'active', end_time: null })
        .eq('id', sessionId);

      if (error) throw error;
      fetchTodayLog();
    } catch (err: any) {
      alert('خطأ في إلغاء طلب الخروج: ' + err.message);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'active' || s.status === 'checkout_requested').length;
  const sessionsIncome = sessions.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  const subsIncome = subscriptions.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  const totalCashIn = sessionsIncome + subsIncome;
  const totalCashOut = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 font-['Cairo'] text-right pb-24 relative overflow-visible mt-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
         <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8 justify-between items-end lg:items-center">
        <div>
           <div className="flex items-center gap-3 justify-end mb-2">
              <Sparkles className="text-indigo-500" size={24} />
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">سجل الحضور الذكي</h1>
           </div>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mr-10 opacity-70">Daily Activity Intelligence</p>
        </div>
        <button 
          onClick={fetchTodayLog}
          className="bg-white text-indigo-600 px-8 py-4 rounded-[1.5rem] font-black shadow-sm border border-indigo-100 hover:bg-indigo-50 transition-all flex items-center gap-3 active:scale-95"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Stats - Premium Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-indigo-50/50 backdrop-blur-md p-10 rounded-[3rem] border border-indigo-100/50 shadow-sm relative group overflow-hidden">
           <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
           <p className="text-indigo-400 font-black text-[10px] uppercase tracking-widest text-right mb-4">زوار اليوم</p>
           <div className="flex items-center gap-3 justify-end">
              <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm"><User size={20}/></div>
              <h3 className="text-4xl font-black text-indigo-900 tracking-tighter">{sessions.length}</h3>
           </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative group overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
           <p className="text-indigo-300 font-black text-[10px] uppercase tracking-widest text-right mb-4">الجلسات النشطة</p>
           <div className="flex items-center gap-3 justify-end">
              <h3 className="text-4xl font-black tracking-tighter">{activeCount}</h3>
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]" />
           </div>
        </div>

        <div className="bg-emerald-600 p-10 rounded-[3rem] text-white shadow-xl relative group overflow-hidden">
           <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
           <div className="flex flex-row-reverse justify-between items-start">
              <div>
                 <p className="text-emerald-100 font-black text-[10px] uppercase tracking-widest text-right mb-4">Cash In</p>
                 <h3 className="text-4xl font-black tracking-tight">{totalCashIn.toLocaleString()}</h3>
              </div>
              <ArrowUpRight className="text-emerald-100 opacity-30" size={40} />
           </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-rose-100 shadow-sm relative group overflow-hidden">
           <div className="absolute top-1/2 left-0 w-32 h-32 bg-rose-50/50 rounded-full blur-3xl" />
           <div className="flex flex-row-reverse justify-between items-start">
              <div>
                 <p className="text-rose-400 font-black text-[10px] uppercase tracking-widest text-right mb-4">Cash Out</p>
                 <h3 className="text-4xl font-black text-rose-600 tracking-tight">{totalCashOut.toLocaleString()}</h3>
              </div>
              <ArrowDownRight className="text-rose-100" size={40} />
           </div>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-[3.5rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-10 border-b border-slate-100 bg-slate-50/20">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">تحليل تفاصيل الحضور</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/30 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-10 py-8 text-right">المشترك & الحالة</th>
                <th className="px-6 py-8 text-center w-1/4">معدل الاستهلاك الزمني</th>
                <th className="px-6 py-8 text-center">خدمات المتجر</th>
                <th className="px-6 py-8 text-center">دخل الجلسة نهائياً</th>
                <th className="px-6 py-8 text-center">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 font-bold">
              {sessions.map(session => {
                const activeSub = session.customers?.subscriptions?.find((s: any) => 
                  s.status === 'Active' && 
                  new Date(s.end_date) >= new Date() &&
                  s.used_hours < s.total_hours
                );

                return (
                  <tr key={session.id} className="hover:bg-slate-50/40 transition-all font-bold group duration-500">
                    <td className="px-10 py-8">
                       <div className="flex flex-row-reverse items-start gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all duration-500">
                             <User size={20} />
                          </div>
                          <div className="text-right">
                             <p className="text-slate-800 font-black text-base group-hover:text-indigo-600 transition-colors">
                                {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم')}
                             </p>
                             <div className="flex flex-row-reverse items-center gap-3 mt-2">
                                <span className="text-[10px] text-indigo-500 font-black bg-indigo-50 px-2 py-0.5 rounded-lg">{session.user_code}</span>
                                {activeSub && (
                                   <div className="flex flex-row-reverse items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl">
                                      <Sparkles size={10} className="animate-pulse" />
                                      <span className="text-[9px] font-black uppercase tracking-tighter">Subscribed Member</span>
                                   </div>
                                )}
                             </div>
                             {activeSub && (
                               <div className="mt-3 space-y-1.5 border-r-2 border-emerald-100 pr-3 mr-1">
                                  <div className="flex flex-row-reverse items-center gap-2 text-[10px] text-slate-400 font-black">
                                     <CalendarDays size={12} className="text-emerald-500" />
                                     Expires: {new Date(activeSub.end_date).toLocaleDateString('ar-EG')}
                                  </div>
                                  <div className="flex flex-row-reverse items-center gap-2 text-[10px] text-emerald-600 font-black">
                                     <Clock size={12} />
                                     Hours Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H
                                  </div>
                               </div>
                             )}
                          </div>
                       </div>
                    </td>

                    <td className="px-6 py-8">
                      <div className="flex items-center justify-center gap-3">
                        <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl shadow-sm text-center">
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest block font-black mb-1">IN</span>
                          <span className="text-slate-700 font-mono text-xs font-black">
                            {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <ChevronLeft size={16} className="text-slate-200" />
                        <div className={`px-4 py-2 rounded-2xl border text-center ${session.end_time ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
                          <span className={`text-[8px] uppercase tracking-widest block font-black mb-1 ${session.end_time ? 'text-slate-400' : 'text-emerald-500'}`}>{session.end_time ? 'OUT' : 'NOW'}</span>
                          <span className={`font-mono text-xs font-black ${session.end_time ? 'text-slate-700' : 'text-emerald-600'}`}>
                            {session.end_time ? new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'ACTIVE'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-8 text-center">
                      {session.catering_amount > 0 ? (
                        <div className="bg-amber-50/50 border border-amber-100 inline-block px-5 py-3 rounded-[1.5rem] group-hover:bg-amber-50 transition-all">
                           <div className="flex items-center gap-2 justify-center text-amber-600 mb-1">
                              <ShoppingBag size={14} />
                              <span className="text-sm font-black">{session.catering_amount} EGP</span>
                           </div>
                           <p className="text-[9px] text-slate-400 font-black max-w-[120px] truncate">{session.orders?.map((o: any) => o.name).join('، ')}</p>
                        </div>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </td>

                    <td className="px-6 py-8 text-center">
                       <div className={`p-4 rounded-[2rem] inline-block min-w-[120px] ${session.payment_method === 'subscription' ? 'bg-indigo-50 border border-indigo-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                          <p className={`text-lg font-black ${session.payment_method === 'subscription' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                             {session.total_amount ? `${session.total_amount}` : '0'} <span className="text-[10px] opacity-40">EGP</span>
                          </p>
                          {session.payment_method === 'subscription' && <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1">Prepaid Package</span>}
                       </div>
                    </td>

                    <td className="px-10 py-8">
                       <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <button 
                            onClick={() => {
                              setEditingSession(session);
                              setEditStartTime(session.start_time);
                              setEditEndTime(session.end_time || '');
                              setEditCatering(session.catering_amount.toString());
                              setEditTotal(session.total_amount?.toString() || '0');
                            }}
                            className="p-3.5 bg-white text-indigo-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-100 active:scale-90"
                          >
                            <Receipt size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-3.5 bg-white text-rose-300 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-slate-100 active:scale-90"
                          >
                            <Trash2 size={18} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Session Modal - High End */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-3xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="w-full max-w-xl bg-white rounded-[4rem] shadow-3xl overflow-hidden relative border border-white translate-y-[-5%] animate-in zoom-in-95 duration-500">
             <div className="p-12 pb-8 border-b border-slate-50 relative overflow-hidden flex flex-row-reverse justify-between items-center text-right">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-transparent -z-10" />
                <div>
                   <div className="flex items-center gap-3 justify-end mb-2">
                      <div className="p-2 bg-indigo-600 text-white rounded-2xl"><Edit3 size={24}/></div>
                      <h3 className="text-3xl font-black text-slate-800 tracking-tight">تعديل سجل الجلسة</h3>
                   </div>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mr-14">Administrative Override Portal</p>
                </div>
                <button onClick={() => setEditingSession(null)} className="p-5 bg-slate-50 rounded-3xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90 border border-slate-100"><X size={28}/></button>
             </div>

             <div className="p-12 space-y-10">
                {/* Subscription Info Card if applicable */}
                {editingSession.payment_method === 'subscription' && (
                  <div className="bg-indigo-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent -z-10" />
                    <div className="flex flex-row-reverse justify-between items-center relative z-10 text-right">
                       <div>
                          <p className="text-4xl font-black">
                            {(Number((editingSession.customers?.subscriptions?.[0]?.total_hours || 0) - (editingSession.customers?.subscriptions?.[0]?.used_hours || 0))).toFixed(1)} 
                            <span className="text-sm opacity-50 uppercase tracking-widest mr-2">H Left</span>
                          </p>
                          <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {new Date(editingSession.customers?.subscriptions?.[0]?.end_date).toLocaleDateString('ar-EG')}
                          </p>
                       </div>
                       <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                             <h4 className="text-xl font-black">جلسة مشتركة</h4>
                             <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                          </div>
                          <p className="text-xs font-bold text-indigo-200">الدفع عبر رصيد الساعات المفعل</p>
                          <p className="text-[10px] text-white/40 font-black mt-2 uppercase tracking-widest">
                            {(Number(editingSession.total_minutes || 0) / 60).toFixed(2)}h deducted in this session
                          </p>
                       </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">وقت البدء</label>
                      <input 
                        type="datetime-local" 
                        value={editStartTime.slice(0, 16)} 
                        onChange={(e) => setEditStartTime(new Date(e.target.value).toISOString())}
                        className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                      />
                   </div>
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">وقت المغادرة</label>
                      <input 
                        type="datetime-local" 
                        value={editEndTime ? editEndTime.slice(0, 16) : ''} 
                        onChange={(e) => setEditEndTime(e.target.value ? new Date(e.target.value).toISOString() : '')}
                        className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">تكلفة المتجر</label>
                      <input 
                        type="number" 
                        value={editCatering} 
                        onChange={(e) => setEditCatering(e.target.value)}
                        className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                      />
                   </div>
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">الإجمالي النهائي</label>
                      <input 
                        type="number" 
                        value={editTotal} 
                        onChange={(e) => setEditTotal(e.target.value)}
                        className="w-full h-16 bg-emerald-50 border-2 border-emerald-100 rounded-3xl px-6 text-sm font-black text-emerald-600 outline-none focus:border-emerald-500 transition-all text-center"
                      />
                   </div>
                </div>

                <button 
                   onClick={handleUpdateSession}
                   className="w-full h-24 bg-slate-900 text-white rounded-[2rem] font-black text-2xl hover:bg-indigo-600 transition-all shadow-3xl flex items-center justify-center gap-5 group active:scale-95 mt-4"
                >
                   <Save size={32} />
                   <span>تأكيد وحفظ التغييرات</span>
                   <ChevronLeft size={32} className="group-hover:-translate-x-2 transition-transform" />
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyLog;
