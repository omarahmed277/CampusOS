import React, { useState, useEffect } from 'react';
import { CalendarDays, ShoppingBag, Clock, CheckCircle2, User, RefreshCw, X, Receipt, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
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
  customers?: { full_name: string };
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

      // 1. Fetch Sessions
      const { data: sessionsData, error: errSessions } = await (supabase as any)
        .from('workspace_sessions')
        .select(`*, customers(full_name, code)`)
        .eq('branch_id', branchId)
        .gte('created_at', todayISO)
        .order('created_at', { ascending: false });

      if (errSessions) throw errSessions;
      setSessions(sessionsData as Session[]);

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

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const activeCount = sessions.filter(s => s.status === 'active' || s.status === 'checkout_requested').length;
  
  const sessionsIncome = sessions.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  const subsIncome = subscriptions.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  const totalCashIn = sessionsIncome + subsIncome;
  
  const totalCashOut = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right pb-20">
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-end lg:items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">سجل الحضور اليومي</h1>
          <p className="text-slate-500 font-bold">متابعة دقيقة لكل الزوار ومبيعات اليوم</p>
        </div>
        <button 
          onClick={fetchTodayLog}
          className="bg-indigo-50 text-indigo-600 px-5 py-3 rounded-2xl font-black hover:bg-indigo-100 transition-all flex items-center gap-2"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Stats - Connected with Finance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="border-none shadow-sm rounded-[2.5rem] bg-indigo-50 p-6 flex items-center gap-6">
          <div className="w-16 h-16 bg-white text-indigo-600 rounded-3xl flex items-center justify-center shadow-sm">
            <User size={32} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">زوار اليوم</p>
            <p className="text-3xl font-black text-slate-900">{sessions.length}</p>
          </div>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem] bg-indigo-900 text-white p-6 flex items-center gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -z-0" />
          <div className="w-16 h-16 bg-white/10 text-indigo-200 rounded-3xl flex items-center justify-center relative z-10">
            <Clock size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-black opacity-60 uppercase tracking-widest text-right">نشط الآن</p>
            <p className="text-3xl font-black">{activeCount}</p>
          </div>
        </Card>
        
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-emerald-600 text-white p-6 flex items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="w-16 h-16 bg-white/20 text-white rounded-3xl flex items-center justify-center shadow-lg relative z-10">
            <TrendingUp size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-black opacity-80 uppercase tracking-widest text-right">Cash In (دخل اليوم)</p>
            <p className="text-3xl font-black">{totalCashIn.toLocaleString()} <span className="text-sm">EGP</span></p>
          </div>
        </Card>

        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white border border-rose-100 p-6 flex items-center gap-6 group hover:border-rose-300 transition-all">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingDown size={32} />
          </div>
          <div>
            <p className="text-xs font-black text-rose-400 uppercase tracking-widest text-right">Cash Out (مصروفات)</p>
            <p className="text-3xl font-black text-rose-600">{totalCashOut.toLocaleString()} <span className="text-sm">EGP</span></p>
          </div>
        </Card>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-800">تفاصيل جلسات اليوم</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">العميل</th>
                <th className="px-4 py-4 text-center">الخدمة</th>
                <th className="px-4 py-4 text-center">وقت البدء / النهاية</th>
                <th className="px-4 py-4 text-center">المتجر والمشتريات</th>
                <th className="px-4 py-4 text-center">التكلفة الشاملة</th>
                <th className="px-4 py-4 text-center">الحالة</th>
                <th className="px-6 py-4 text-center">أدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 font-bold">جاري تحميل السجل...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 font-bold">لا يوجد حضور سجل اليوم حتى الآن</td></tr>
              ) : sessions.map(session => (
                <tr key={session.id} className="hover:bg-slate-50/80 transition-all font-bold group">
                  <td className="px-6 py-4">
                    <p className="text-slate-800 font-black text-base">{session.customers?.full_name || 'غير معروف'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-indigo-500 font-mono tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded inline-block">{session.user_code}</p>
                      <p className="text-[10px] font-bold text-slate-400">{session.phone_number}</p>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black flex justify-center items-center gap-1 w-max mx-auto">
                      مساحة عمل
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-black mb-0.5">الدخول</span>
                        <span className="text-slate-700 font-mono text-sm font-black">
                          {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-slate-300">-</span>
                      <div className={`px-3 py-1.5 rounded-xl border ${session.end_time ? 'bg-slate-50 border-slate-100 shadow-sm' : 'bg-emerald-50/50 border-emerald-100 shadow-sm'}`}>
                        <span className={`text-[9px] uppercase tracking-widest block font-black mb-0.5 ${session.end_time ? 'text-slate-400' : 'text-emerald-500'}`}>{session.end_time ? 'المغادرة' : 'الوضع'}</span>
                        <span className={`font-mono text-sm font-black ${session.end_time ? 'text-slate-700' : 'text-emerald-600'}`}>
                          {session.end_time ? new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'مستمر'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    {session.catering_amount > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-amber-500 font-black text-sm">{session.catering_amount} EGP</span>
                        <div className="text-[10px] text-slate-400 max-w-[150px] truncate" title={session.orders?.map((o: any) => o.name).join(', ')}>
                           {session.orders?.map((o: any) => `${o.quantity}x ${o.name}`).join('، ')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 font-bold text-sm">-</span>
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="text-lg font-black text-emerald-600">
                      {session.total_amount ? `${session.total_amount} EGP` : '--- EGP'}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-left">
                    {session.status === 'completed' ? (
                      <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-xs font-black inline-flex items-center gap-1.5 w-max">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> مغادر
                      </span>
                    ) : session.status === 'checkout_requested' ? (
                      <span className="bg-amber-100 text-amber-600 px-3 py-1.5 rounded-full text-xs font-black inline-flex items-center gap-1.5 w-max">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span> يطلب الحساب
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-black inline-flex items-center gap-1.5 w-max shadow-sm shadow-emerald-100">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> متواجد
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                       <button 
                         onClick={() => {
                           setEditingSession(session);
                           setEditStartTime(session.start_time);
                           setEditEndTime(session.end_time || '');
                           setEditCatering(session.catering_amount.toString());
                           setEditTotal(session.total_amount?.toString() || '0');
                         }}
                         className="p-2 text-indigo-400 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                       >
                         <Receipt size={16} />
                       </button>
                       <button 
                         onClick={() => handleDeleteSession(session.id)}
                         className="p-2 text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-500 text-right">
          <Card className="w-full max-w-lg border border-white/40 shadow-2xl bg-white rounded-[3rem] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Receipt size={24} />
                </div>
                <CardTitle className="font-black text-2xl">تعديل بيانات الجلسة</CardTitle>
              </div>
              <button 
                onClick={() => setEditingSession(null)} 
                className="p-2 text-slate-400 hover:text-slate-900 transition-all"
              >
                <X size={24} />
              </button>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">وقت البدء</label>
                  <input 
                    type="datetime-local" 
                    value={editStartTime.slice(0, 16)} 
                    onChange={(e) => setEditStartTime(new Date(e.target.value).toISOString())}
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 font-bold focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">وقت المغادرة</label>
                  <input 
                    type="datetime-local" 
                    value={editEndTime ? editEndTime.slice(0, 16) : ''} 
                    onChange={(e) => setEditEndTime(e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 font-bold focus:border-indigo-500 outline-none transition-all"
                    placeholder="مستمر حتى الآن"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">تكلفة المتجر (Catering)</label>
                   <div className="relative">
                     <input 
                       type="number" 
                       value={editCatering} 
                       onChange={(e) => setEditCatering(e.target.value)}
                       className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 font-bold focus:border-indigo-500 outline-none transition-all pl-12"
                     />
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">EGP</span>
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">الإجمالي المدفوع</label>
                   <div className="relative">
                     <input 
                       type="number" 
                       value={editTotal} 
                       onChange={(e) => setEditTotal(e.target.value)}
                       className="w-full h-14 bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-4 font-black text-emerald-600 focus:border-emerald-500 outline-none transition-all pl-12"
                     />
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400">EGP</span>
                   </div>
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button 
                   onClick={() => setEditingSession(null)}
                   className="flex-1 h-16 rounded-[1.5rem] font-black text-slate-400 hover:bg-slate-100 transition-all"
                 >
                   إلغاء
                 </button>
                 <button 
                   onClick={handleUpdateSession}
                   className="flex-[2] h-16 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl shadow-xl shadow-indigo-100 transition-all active:scale-95"
                 >
                   حفظ التعديلات
                 </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
