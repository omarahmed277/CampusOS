import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, RefreshCw, X, Receipt, Users2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Session {
  id: string;
  customer_id: string;
  user_code: string;
  phone_number: string;
  start_time: string;
  status: string;
  catering_amount: number;
  orders: any[];
  customers?: { full_name: string };
}

export const WorkspaceAdminSessions = ({ branchId }: { branchId?: string }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [checkoutBill, setCheckoutBill] = useState<any>(null);
  const [manualCode, setManualCode] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    
    fetchSessions();
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // UI update every minute

    const channel = supabase
      .channel(`workspace_admin_sessions_${branchId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'workspace_sessions'
          // Removed specific filter to handle JS-side filtering for robustness
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Only refresh if the change belongs to our branch or was moved out of it
          if (newData?.branch_id === branchId || oldData?.branch_id === branchId) {
            fetchSessions();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('workspace_sessions')
        .select(`*, customers(full_name)`)
        .eq('branch_id', branchId || '')
        .in('status', ['active', 'checkout_requested'])
        .order('start_time', { ascending: false });

      if (error) throw error;
      setSessions(data as any);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCheckout = async (session: Session) => {
    try {
      const endTime = new Date();
      const startTime = new Date(session.start_time);
      const diffMs = endTime.getTime() - startTime.getTime();
      const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000));
      
      const hourlyRate = 10;
      let workspaceAmount = parseFloat(((diffMinutes / 60) * hourlyRate).toFixed(2));
      if (workspaceAmount < 10) {
        workspaceAmount = 10; // الحد الأدنى ساعة واحدة
      }
      const cateringAmount = session.catering_amount || 0;
      const totalAmount = parseFloat((workspaceAmount + cateringAmount).toFixed(2));

      const { error } = await supabase
        .from('workspace_sessions')
        .update({
          status: 'completed',
          end_time: endTime.toISOString(),
          total_minutes: diffMinutes,
          total_amount: totalAmount
        })
        .eq('id', session.id);

      if (error) throw error;

      setCheckoutBill({
        ...session,
        workspaceAmount,
        cateringAmount,
        totalAmount,
        diffMinutes,
        endTime
      });

      fetchSessions();
    } catch (err: any) {
      alert('حدث خطأ أثناء إنهاء الجلسة');
      console.error(err);
    }
  };

  const handleStartManualSession = async () => {
    if (!manualCode.trim()) return;
    setStartingSession(true);
    try {
      // 1. Check if an active session already exists for this code
      const { data: existing } = await supabase
        .from('workspace_sessions')
        .select('id')
        .eq('user_code', manualCode.trim().toUpperCase())
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      if (existing) {
        alert('هذا الكود لديه جلسة نشطة بالفعل');
        return;
      }

      // 2. Fetch customer if exists
      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .eq('code', manualCode.trim().toUpperCase())
        .maybeSingle();

      // 3. Create session
      const { error } = await supabase
        .from('workspace_sessions')
        .insert({
          customer_id: customer?.id || null,
          user_code: manualCode.trim().toUpperCase(),
          phone_number: customer?.phone || 'غير مسجل',
          status: 'active',
          branch_id: branchId,
          start_time: new Date().toISOString()
        });

      if (error) throw error;
      setManualCode('');
      fetchSessions();
      alert(customer ? `تم بدء جلسة لـ ${customer.full_name}` : `تم بدء جلسة زائر بكود ${manualCode.toUpperCase()}`);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء بدء الجلسة');
    } finally {
      setStartingSession(false);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'active').length;
  const requestedCount = sessions.filter(s => s.status === 'checkout_requested').length;

  return (
    <div className="space-y-12 animate-in fade-in duration-700 mt-6 pb-20">

      {/* Manual Entry Section */}
      <div className="glass rounded-[3rem] p-8 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -z-10" />
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-black text-slate-800">بدء جلسة يدوياً</h2>
            <p className="text-slate-500 font-bold text-sm">أدخل كود المستخدم (مثال: A001) أو كود الزائر (مثال: NA1)</p>
          </div>
          <div className="flex w-full md:w-auto items-center gap-4">
            <input 
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="A001 , NA1 ..."
              className="flex-1 md:w-64 h-16 px-6 rounded-2xl bg-white border-2 border-slate-100 font-black text-xl text-center focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all outline-none uppercase"
              onKeyDown={(e) => e.key === 'Enter' && handleStartManualSession()}
            />
            <button 
              onClick={handleStartManualSession}
              disabled={startingSession || !manualCode.trim()}
              className="h-16 px-10 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-3 whitespace-nowrap"
            >
              {startingSession ? <RefreshCw className="animate-spin" /> : <Clock />}
              بدء الجلسة
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px]" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="bg-indigo-500/20 w-16 h-16 rounded-2xl flex items-center justify-center">
              <Clock size={32} className="text-indigo-500" />
            </div>
            <div>
              <p className="text-slate-500 font-bold mb-1">جلسات نشطة</p>
              <h3 className="text-4xl font-black text-slate-900">{activeCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px]" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="bg-amber-500/20 w-16 h-16 rounded-2xl flex items-center justify-center">
              <AlertCircle size={32} className="text-amber-500" />
            </div>
            <div>
              <p className="text-slate-500 font-bold mb-1">طلبات خروج معلّقة</p>
              <h3 className="text-4xl font-black text-amber-600">{requestedCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass rounded-[3rem] p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-slate-900">إدارة الجلسات الحالية</h2>
          <button 
            onClick={fetchSessions}
            className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right min-w-[800px]">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/30">
                  <th className="py-6 px-6 text-indigo-900 font-black">المستخدم</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">رقم الهاتف</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">وقت البدء</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">الوقت المنقضي</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">طلبات الكافتريا</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">الحالة</th>
                  <th className="py-6 px-6 text-indigo-900 font-black">تحديث</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const diffMs = now - new Date(session.start_time).getTime();
                  const totalMins = Math.floor(diffMs / 60000);
                  const hrs = Math.floor(totalMins / 60);
                  const mins = totalMins % 60;
                  
                  return (
                    <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group">
                      <td className="py-6 px-6">
                        <div className="font-extrabold text-slate-900 text-lg">
                          {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم غير مسجل')}
                        </div>
                        <div className="text-sm font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg w-fit mt-1">{session.user_code}</div>
                      </td>
                      <td className="py-6 px-6 font-bold text-slate-600">{session.phone_number}</td>
                      <td className="py-6 px-6 font-semibold text-slate-600">
                        {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-6 px-6">
                        <div className="font-mono text-lg font-black text-indigo-600 flex items-center gap-2">
                          <Clock size={16} />
                          {hrs}س {mins}د
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="font-black text-slate-900 text-lg">
                          {session.catering_amount || 0} EGP
                        </div>
                        <div className="text-xs text-slate-400 max-w-[150px] truncate mt-1">
                          {session.orders?.length > 0 ? session.orders.map((o: any) => `${o.quantity}x ${o.name}`).join('، ') : 'بدون طلبات'}
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        {session.status === 'checkout_requested' ? (
                          <div className="bg-amber-100/50 border border-amber-200 text-amber-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max animate-pulse">
                            <AlertCircle size={14} /> يطلب الخروج
                          </div>
                        ) : (
                          <div className="bg-emerald-100/50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-2xl text-[11px] font-black flex items-center gap-2 w-max">
                            <CheckCircle2 size={14} /> نشط الآن
                          </div>
                        )}
                      </td>
                      <td className="py-6 px-6">
                        <button
                          onClick={() => handleAcceptCheckout(session)}
                          className={`px-6 py-3 rounded-2xl text-white font-black text-sm transition-all hover:-translate-y-1 active:scale-95 shadow-lg ${
                            session.status === 'checkout_requested' 
                              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                              : 'bg-slate-900 hover:bg-black shadow-slate-900/20'
                          }`}
                        >
                          إنهاء و محاسبة
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sessions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-300">
                        <Users2 size={64} className="opacity-20" />
                        <p className="font-black text-xl">لا يوجد جلسات نشطة حالياً</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>

      {checkoutBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] p-10 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-20 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                  <Receipt size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">فاتورة العميل</h2>
                  <p className="text-indigo-600 text-xs font-black tracking-widest mt-1 uppercase">Order Checkout</p>
                </div>
              </div>
              <button 
                onClick={() => setCheckoutBill(null)} 
                className="p-3 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="bg-slate-50/80 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                
                <div className="border-b-2 border-dashed border-slate-200 pb-6 text-center">
                  <p className="text-slate-400 text-sm font-black mb-2 uppercase tracking-widest">Client Name</p>
                  <p className="text-2xl font-black text-slate-900">{checkoutBill.customers?.full_name || (checkoutBill.user_code.startsWith('NA') ? `Guest (${checkoutBill.user_code})` : 'Unknown')}</p>
                  <p className="text-lg font-black text-indigo-600 bg-white inline-block px-4 py-1 rounded-xl shadow-sm border border-indigo-50 mt-3">{checkoutBill.user_code}</p>
                </div>
                
                <div className="space-y-4 font-bold text-slate-600">
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white">
                    <span className="text-sm">وقت الاستخدام:</span>
                    <span className="text-slate-900 mt-1 font-black">{checkoutBill.diffMinutes} دقيقة</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white">
                    <span className="text-sm">قيمة مساحة العمل (10 ج/س):</span>
                    <span className="text-indigo-600 font-black">{checkoutBill.workspaceAmount} EGP</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white">
                    <span className="text-sm">إجمالي طلبات المتجر:</span>
                    <span className="text-slate-900 font-black">{checkoutBill.cateringAmount} EGP</span>
                  </div>
                </div>
                
                {checkoutBill.orders && checkoutBill.orders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest text-center">Breakdown of Items</p>
                    <div className="space-y-3">
                      {checkoutBill.orders.map((o: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm font-black bg-white rounded-xl p-3 border border-slate-50">
                          <span className="text-slate-500">{o.name} <span className="text-[10px] opacity-70">x{o.quantity || 1}</span></span>
                          <span className="text-slate-900 font-mono">{o.price} EGP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-8 mt-4 border-t-2 border-dashed border-slate-200 flex flex-col items-center gap-2">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Final Amount Due</span>
                  <p className="text-5xl font-black text-emerald-600 drop-shadow-sm">{checkoutBill.totalAmount} <span className="text-lg opacity-50">EGP</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setCheckoutBill(null)}
                  className="py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl hover:bg-black hover:-translate-y-1 active:scale-95 transition-all text-sm"
                >
                  تحصيل المبلـغ
                </button>
                <button
                  onClick={() => window.print()}
                  className="py-5 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all text-sm"
                >
                  طباعة التذكرة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
