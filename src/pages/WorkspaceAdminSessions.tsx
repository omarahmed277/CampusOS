import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, RefreshCw, X, Receipt, Users2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateSessionPrice } from '../lib/pricing';

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
  customers?: { full_name: string };
}

export const WorkspaceAdminSessions = ({ branchId }: { branchId?: string }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [checkoutBill, setCheckoutBill] = useState<any>(null);
  const [editingBill, setEditingBill] = useState<any>(null);
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
      .on('broadcast', { event: 'session_updated' }, () => {
        fetchSessions();
      })
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
        .select(`*, customers(full_name, subscriptions(*))`)
        .eq('branch_id', branchId || '')
        .in('status', ['active', 'checkout_requested'])
        .order('start_time', { ascending: false });

      if (error) throw error;
      
      const sorted = (data as any[]).sort((a, b) => {
        if (a.status === 'checkout_requested' && b.status !== 'checkout_requested') return -1;
        if (a.status !== 'checkout_requested' && b.status === 'checkout_requested') return 1;
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      });
      
      setSessions(sorted);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareCheckout = (session: Session | any) => {
    const endTime = (session.status === 'checkout_requested' && session.end_time) 
      ? new Date(session.end_time) 
      : new Date();
    const startTime = new Date(session.start_time);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000));
    const usedHours = parseFloat((diffMinutes / 60).toFixed(2));

    // Check for Active Subscription
    const activeSub = session.customers?.subscriptions?.find((s: any) => 
        s.status === 'Active' && 
        new Date(s.end_date) >= new Date() &&
        s.used_hours < s.total_hours
    );

    let workspaceAmount = calculateSessionPrice(diffMinutes);
    let isSubscribed = false;
    let remainingSubHours = 0;

    if (activeSub) {
        isSubscribed = true;
        workspaceAmount = 0; 
        remainingSubHours = activeSub.total_hours - activeSub.used_hours;
    }
    
    const orders = Array.isArray(session.orders) ? [...session.orders] : [];
    const cateringAmount = orders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
    const totalAmount = workspaceAmount + cateringAmount;

    setEditingBill({
      ...session,
      orders,
      workspaceAmount,
      cateringAmount,
      totalAmount,
      diffMinutes,
      usedHours,
      startTime: startTime.toISOString(),
      endTime,
      isSubscribed,
      subscriptionId: activeSub?.id,
      remainingSubHours: remainingSubHours - usedHours,
      initialRemaining: remainingSubHours,
      subEndDate: activeSub?.end_date
    });
  };

  const handleUpdateTime = (field: 'startTime' | 'endTime', value: string) => {
    if (!editingBill) return;
    
    const startTime = field === 'startTime' ? new Date(value) : new Date(editingBill.startTime);
    const endTime = field === 'endTime' ? new Date(value) : new Date(editingBill.endTime);
    
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.max(1, Math.ceil(diffMs / 60000));
    const usedHours = parseFloat((diffMinutes / 60).toFixed(2));

    let workspaceAmount = 0;
    let remainingSubHours = 0;

    if (editingBill.isSubscribed) {
       workspaceAmount = 0;
       remainingSubHours = editingBill.initialRemaining - usedHours;
    } else {
       workspaceAmount = calculateSessionPrice(diffMinutes);
    }

    const totalAmount = workspaceAmount + editingBill.cateringAmount;

    setEditingBill({
       ...editingBill,
       startTime: startTime.toISOString(),
       endTime: endTime,
       diffMinutes,
       usedHours,
       workspaceAmount,
       totalAmount,
       remainingSubHours
    });
  };

  const handleUpdateBillItem = (index: number, field: string, value: any) => {
    if (!editingBill) return;
    const newOrders = [...editingBill.orders];
    newOrders[index] = { ...newOrders[index], [field]: value };
    
    const newCateringAmount = newOrders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
    const newTotalAmount = parseFloat((Number(editingBill.workspaceAmount) + newCateringAmount).toFixed(2));
    
    setEditingBill({
      ...editingBill,
      orders: newOrders,
      cateringAmount: newCateringAmount,
      totalAmount: newTotalAmount
    });
  };

  const handleRemoveBillItem = (index: number) => {
    if (!editingBill) return;
    const newOrders = editingBill.orders.filter((_: any, i: number) => i !== index);
    const newCateringAmount = newOrders.reduce((sum, o) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
    const newTotalAmount = parseFloat((Number(editingBill.workspaceAmount) + newCateringAmount).toFixed(2));
    
    setEditingBill({
      ...editingBill,
      orders: newOrders,
      cateringAmount: newCateringAmount,
      totalAmount: newTotalAmount
    });
  };

  const handleAddBillItem = () => {
    if (!editingBill) return;
    const newOrders = [...editingBill.orders, { name: 'صنف جديد', price: 0, quantity: 1, time: new Date().toISOString() }];
    setEditingBill({ ...editingBill, orders: newOrders });
  };

  const handleAcceptCheckout = async () => {
    if (!editingBill) return;
    try {
      // 1. Update the session record
      const { error: sessionError } = await supabase
        .from('workspace_sessions')
        .update({
          status: 'completed',
          start_time: editingBill.startTime,
          end_time: editingBill.endTime.toISOString(),
          total_minutes: Number(editingBill.diffMinutes) || 0,
          catering_amount: Number(editingBill.cateringAmount) || 0,
          orders: editingBill.orders || [],
          total_amount: Number(editingBill.totalAmount) || 0,
          payment_method: editingBill.isSubscribed ? 'subscription' : 'cash'
        })
        .eq('id', editingBill.id);

      if (sessionError) {
          console.error('Session Update Error:', sessionError);
          throw sessionError;
      }

      // 2. Adjust Subscription Balance if applicable
      if (editingBill.isSubscribed && editingBill.subscriptionId) {
          const { data: sub, error: subFetchError } = await supabase
              .from('subscriptions')
              .select('used_hours, total_hours')
              .eq('id', editingBill.subscriptionId)
              .single();
          
          if (subFetchError) {
              console.error('Subscription Fetch Error:', subFetchError);
          } else if (sub) {
              const newUsed = parseFloat((Number(sub.used_hours || 0) + (Number(editingBill.usedHours) || 0)).toFixed(2));
              const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({ 
                    used_hours: newUsed,
                    status: newUsed >= Number(sub.total_hours) ? 'Exhausted' : 'Active'
                })
                .eq('id', editingBill.subscriptionId);
              
              if (subUpdateError) console.error('Subscription Update Error:', subUpdateError);
          }
      }

      setCheckoutBill({ ...editingBill, remainingAfter: editingBill.remainingSubHours });
      setEditingBill(null);
      fetchSessions();
    } catch (err: any) {
      alert('حدث خطأ أثناء إنهاء الجلسة. يرجى مراجعة سجلات الكونسول.');
      console.error('Checkout Main Error:', err);
    }
  };

  const handleCancelCheckoutRequest = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ status: 'active', end_time: null })
        .eq('id', sessionId);

      if (error) throw error;
      fetchSessions();

      // Broadcast to user to resume counter
      supabase.channel(`workspace_session_${sessionId}`).send({
        type: 'broadcast',
        event: 'session_updated',
        payload: { id: sessionId, status: 'active', end_time: null }
      });
    } catch (err: any) {
      alert('حدث خطأ أثناء إلغاء طلب الخروج');
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
                  
                  const activeSub = session.customers?.subscriptions?.find((s: any) => 
                    s.status === 'Active' && 
                    new Date(s.end_date) >= new Date() &&
                    s.used_hours < s.total_hours
                  );

                  return (
                    <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group">
                      <td className="py-6 px-6">
                        <div className="flex flex-row-reverse items-center justify-end gap-3 text-right">
                          <div className="text-right">
                            <div className="font-extrabold text-slate-900 text-lg">
                              {session.customers?.full_name || (session.user_code.startsWith('NA') ? `زائر (${session.user_code})` : 'مستخدم غير مسجل')}
                            </div>
                            <div className="flex flex-row-reverse items-center gap-2 mt-1">
                               <div className="text-sm font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg w-fit">{session.user_code}</div>
                               {activeSub && (
                                  <div className="flex flex-row-reverse items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black animate-pulse">
                                     <Sparkles size={10} />
                                     <span>Subscribed</span>
                                  </div>
                               )}
                            </div>
                            {activeSub && (
                               <div className="mt-2 space-y-1 text-right border-r-2 border-emerald-100 pr-2 mr-1">
                                  <p className="text-[9px] font-black text-slate-400">Ends: {new Date(activeSub.end_date).toLocaleDateString('ar-EG')}</p>
                                  <p className="text-[10px] font-black text-emerald-600">Left: {(activeSub.total_hours - activeSub.used_hours).toFixed(1)}H</p>
                                </div>
                            )}
                          </div>
                        </div>
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
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handlePrepareCheckout(session)}
                            className={`px-6 py-3 rounded-2xl text-white font-black text-sm transition-all hover:-translate-y-1 active:scale-95 shadow-lg ${
                              session.status === 'checkout_requested' 
                                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                                : 'bg-slate-900 hover:bg-black shadow-slate-900/20'
                            }`}
                          >
                            إنهاء و محاسبة
                          </button>
                          {session.status === 'checkout_requested' && (
                            <button
                              onClick={() => handleCancelCheckoutRequest(session.id)}
                              className="px-4 py-1.5 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center gap-1"
                            >
                              <X size={12} /> إلغاء طلب الخروج
                            </button>
                          )}
                        </div>
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
      
      {/* Bill Adjustment Modal */}
      {editingBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in transition-all">
          <div className="bg-white rounded-[3rem] p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-3">
                  <Receipt className="text-indigo-600" size={24} />
                  <h2 className="text-xl font-black text-slate-900">مراجعة وتعديل الحساب</h2>
               </div>
               <button onClick={() => setEditingBill(null)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
                  <X size={20} />
               </button>
            </div>

            <div className="space-y-6 flex-1 pr-1">
              {/* Subscription Info Badge */}
              {editingBill.isSubscribed && (
                <div className="bg-indigo-900 text-white p-6 rounded-3xl relative overflow-hidden group shadow-xl">
                   <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent -z-10" />
                   <div className="flex justify-between items-center relative z-10 text-right">
                      <div>
                         <p className="text-4xl font-black">{editingBill.remainingSubHours.toFixed(1)} <span className="text-sm opacity-50 uppercase tracking-widest">H Left</span></p>
                         <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">Expires: {new Date(editingBill.subEndDate).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <div className="text-right">
                         <div className="flex items-center gap-2 justify-end mb-1">
                            <h4 className="text-lg font-black">اشتراك فعال للساعات</h4>
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                         </div>
                         <p className="text-xs font-bold text-indigo-200">سيتم الخصم المباشر من رصيد العميل</p>
                      </div>
                   </div>
                </div>
              )}

              {/* Time Control */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">وقت الدخول</label>
                    <input 
                      type="datetime-local" 
                      value={editingBill.startTime.slice(0, 16)} 
                      onChange={(e) => handleUpdateTime('startTime', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-indigo-400 text-right"
                    />
                 </div>
                 <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">وقت الخروج</label>
                    <input 
                      type="datetime-local" 
                      value={new Date(editingBill.endTime).toISOString().slice(0, 16)} 
                      onChange={(e) => handleUpdateTime('endTime', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-indigo-400 text-right"
                    />
                 </div>
              </div>

              {/* User Info */}
              <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center border border-slate-100">
                <div className="text-right">
                  <p className="text-slate-400 text-xs font-black uppercase mb-1">العميل</p>
                  <p className="font-black text-slate-900">{editingBill.customers?.full_name || editingBill.user_code}</p>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-xs font-black uppercase mb-1">وقت الجلسة</p>
                    <p className="font-black text-indigo-600">
                       {Math.floor(editingBill.diffMinutes / 60)}h {editingBill.diffMinutes % 60}m
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-xs font-black uppercase mb-1">مبلغ المكان</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black opacity-30">EGP</span>
                      <input 
                        type="number" 
                        value={editingBill.workspaceAmount} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingBill({...editingBill, workspaceAmount: val, totalAmount: parseFloat((val + editingBill.cateringAmount).toFixed(2))});
                        }}
                        className={`w-20 text-center font-black bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 ring-indigo-100 outline-none ${editingBill.isSubscribed ? 'opacity-30' : ''}`} 
                        disabled={editingBill.isSubscribed}
                      />
                    </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-black text-slate-700 text-sm">طلبات الكافتريا</h3>
                  <button onClick={handleAddBillItem} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-colors">إضافة صنف +</button>
                </div>
                
                <div className="space-y-2">
                  {editingBill.orders.map((o: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-white p-3 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                       <input 
                         className="col-span-4 font-bold text-sm bg-slate-50 border-none rounded-xl px-3 py-2 outline-none" 
                         value={o.name} 
                         onChange={(e) => handleUpdateBillItem(idx, 'name', e.target.value)}
                       />
                       <div className="col-span-3 flex items-center gap-2">
                         <span className="text-[10px] text-slate-400 font-bold">السعر</span>
                         <input 
                           type="number" 
                           className="w-full text-center font-black text-emerald-600 bg-emerald-50/50 border-none rounded-xl px-2 py-2 outline-none" 
                           value={o.price} 
                           onChange={(e) => handleUpdateBillItem(idx, 'price', e.target.value)}
                         />
                       </div>
                       <div className="col-span-3 flex items-center gap-2">
                         <span className="text-[10px] text-slate-400 font-bold">كمية</span>
                         <input 
                           type="number" 
                           className="w-full text-center font-black text-indigo-600 bg-indigo-50/50 border-none rounded-xl px-2 py-2 outline-none" 
                           value={o.quantity || 1} 
                           onChange={(e) => handleUpdateBillItem(idx, 'quantity', e.target.value)}
                         />
                       </div>
                       <button onClick={() => handleRemoveBillItem(idx)} className="col-span-2 text-rose-400 hover:text-rose-600 p-2 opacity-0 group-hover:opacity-100 transition-all">
                          <X size={18} />
                       </button>
                    </div>
                  ))}
                  {editingBill.orders.length === 0 && (
                    <p className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">لا توجد طلبات مسجلة</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="mt-8 pt-6 border-t border-slate-100">
               <div className="flex justify-between items-center mb-6">
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-600">{editingBill.totalAmount} <span className="text-xs">EGP</span></p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الإجمالي النهائي</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setEditingBill(null)} className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">إلغاء</button>
                    <button onClick={handleAcceptCheckout} className="px-10 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all">تأكيد ومحاسبة</button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

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
                    <span className="text-slate-900 mt-1 font-black">
                       {Math.floor(checkoutBill.diffMinutes / 60)}h {checkoutBill.diffMinutes % 60}m
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white">
                    <span className="text-sm">قيمة مساحة العمل (10 ج/س):</span>
                    <span className={`font-black ${checkoutBill.isSubscribed ? 'text-indigo-600' : 'text-slate-900'}`}>
                       {checkoutBill.isSubscribed ? '✓ اشتراك ساعات' : `${checkoutBill.workspaceAmount} EGP`}
                    </span>
                  </div>

                  {checkoutBill.isSubscribed && (
                    <div className="bg-indigo-900 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                      <div className="flex justify-between items-center relative z-10">
                        <div className="text-left">
                          <p className="text-2xl font-black">{checkoutBill.remainingSubHours.toFixed(1)} <span className="text-[10px] opacity-40 uppercase">Hours Lasted</span></p>
                          <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mt-1">Expire Date: {new Date(checkoutBill.subEndDate).toLocaleDateString('ar-EG')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Subscription Summary</p>
                          <p className="text-sm font-black whitespace-nowrap">{(Number(checkoutBill.usedHours) || 0).toFixed(2)}h used in this session</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
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
