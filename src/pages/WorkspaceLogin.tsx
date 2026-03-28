import React, { useState, useEffect } from 'react';
import { Clock, LogOut, CheckCircle2, Coffee, ShoppingBag, Info, HelpCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

// UI tabs options
type activeTabType = 'session' | 'catering' | 'about' | 'how_work';

export const WorkspaceLogin = () => {
  const [activeTab, setActiveTab] = useState<activeTabType>('session');
  const [cateringItems, setCateringItems] = useState<any[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('male');
  const [birthDate, setBirthDate] = useState('');
  const [userCode, setUserCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  
  const [branchId, setBranchId] = useState<string | null>(localStorage.getItem('workspace_branch_id'));
  const [branches, setBranches] = useState<any[]>([]);

  const [college, setCollege] = useState('');
  const [customCollege, setCustomCollege] = useState('');
  const [showCustomCollege, setShowCustomCollege] = useState(false);

  const colleges = [
    'جامعة القاهرة',
    'جامعة عين شمس',
    'جامعة حلوان',
    'جامعة المنيا',
    'جامعة النيل',
    'الجامعة الأمريكية بالقاهرة',
    'الجامعة الألمانية بالقاهرة',
    'جامعة المستقبل',
    'جامعة أكتوبر للعلوم الحديثة والآداب (MSA)',
    'جامعة مصر للعلوم والتكنولوجيا (MUST)',
    'أخرى'
  ];

  useEffect(() => {
    // Check if session ID is in local storage
    const activeSessionId = localStorage.getItem('workspace_session_id');
    if (activeSessionId) {
      loadSession(activeSessionId);
    }

    const fetchBranches = async () => {
        const { data } = await supabase.from('branches').select('id, name').eq('is_active', true);
        if (data && data.length > 0) {
            setBranches(data);
            // Default to "Cloud" branch or the first one if not set
            if (!branchId) {
                const mainBranch = data.find(b => b.name.toLowerCase().includes('cloud')) || data[0];
                setBranchId(mainBranch.id);
                localStorage.setItem('workspace_branch_id', mainBranch.id);
            }
        }
    };
    fetchBranches();
  }, [branchId]);

  const fetchStoreItems = async () => {
    try {
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .gt('price', 0);
      setCateringItems(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOrder = async (item: any) => {
    setOrderLoading(true);
    try {
      const currentOrders = Array.isArray(session.orders) ? session.orders : [];
      const currentCateringAmount = Number(session.catering_amount) || 0;
      
      const newOrders = [...currentOrders, {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        time: new Date().toISOString()
      }];
      
      const newAmount = currentCateringAmount + Number(item.price);
      
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ orders: newOrders, catering_amount: newAmount })
        .eq('id', session.id);
        
      if (error) throw error;
      setSession({...session, orders: newOrders, catering_amount: newAmount});
      alert(`تم إضافة ${item.name} لحسابك.`);
    } catch (err: any) {
      alert("حدث خطأ أثناء إضافة الطلب");
    } finally {
      setOrderLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (session && session.status === 'active') {
      interval = setInterval(() => {
        const start = new Date(session.start_time).getTime();
        const now = new Date().getTime();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!fullName || !phoneNumber || !email) throw new Error('يرجى ملء جميع البيانات');

      // Normalize phone number (strip spaces, leading +20 or 0)
      const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/^(\+20|0)/, '');

      // Check if phone or email already exists
      const { data: existingUser } = await supabase
        .from('customers')
        .select('id')
        .or(`phone.ilike.%${cleanPhone},email.eq.${email}`)
        .maybeSingle();

      if (existingUser) {
        throw new Error('هذا المستخدم موجود بالفعل (رقم الهاتف أو البريد الإلكتروني مسجل)');
      }

      // Determine sequential code starting from A001
      const { data: lastCustomer } = await supabase
        .from('customers')
        .select('code')
        .order('code', { ascending: false })
        .limit(1)
        .maybeSingle();

      let generatedCode = 'A001';

      if (lastCustomer && lastCustomer.code) {
        const lastCode = lastCustomer.code.toUpperCase();
        const match = lastCode.match(/^([A-Z])(\d+)$/);
        
        if (match) {
          const prefix = match[1];
          const number = parseInt(match[2], 10);
          
          if (number < 999) {
            generatedCode = `${prefix}${(number + 1).toString().padStart(3, '0')}`;
          } else {
            const nextPrefix = String.fromCharCode(prefix.charCodeAt(0) + 1);
            generatedCode = `${nextPrefix}001`;
          }
        }
      }

      const finalCollege = showCustomCollege ? customCollege : college;

      const newCustomer = {
        full_name: fullName,
        phone: cleanPhone,
        email: email,
        code: generatedCode,
        gender: gender,
        birth_date: birthDate || null,
        college: finalCollege || null,
        is_active: true
      };

      const { data: createdCustomer, error: createError } = await supabase
        .from('customers')
        .insert(newCustomer)
        .select()
        .single();

      if (createError) throw createError;

      /* 
      // Automatically send the welcome email
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ record: createdCustomer })
        });
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
      */

      setUserCode(generatedCode);
      setIsSignUp(false);
      alert(`تم التسجيل بنجاح! كود الدخول الخاص بك هو: ${generatedCode}`);
      
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التسجيل.');
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('workspace_sessions')
        .select('*, customers(full_name)')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      if (data && (data.status === 'active' || data.status === 'checkout_requested')) {
        setSession(data);
      } else {
        localStorage.removeItem('workspace_session_id');
        setSession(null);
      }
    } catch (err: any) {
      console.error(err);
      localStorage.removeItem('workspace_session_id');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Normalize phone number for lookup
      const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/^(\+20|0)/, '');

      // Find the customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, full_name, code, phone')
        .eq('code', userCode.trim().toUpperCase())
        .ilike('phone', `%${cleanPhone}`)
        .maybeSingle();

      if (customerError || !customerData) {
        throw new Error('بيانات المستخدم غير صحيحة، تأكد من كود العميل ورقم الهاتف.');
      }

      // Check for active sessions for this customer
      const { data: existingSessions, error: existingError } = await supabase
        .from('workspace_sessions')
        .select('*, customers(full_name)')
        .eq('customer_id', customerData.id)
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      if (existingSessions) {
        const sess = existingSessions as any;
        // Essential: If the existing session has no branch_id, attach it to our branch now
        if (!sess.branch_id && branchId) {
            await (supabase as any)
                .from('workspace_sessions')
                .update({ branch_id: branchId })
                .eq('id', sess.id);
            sess.branch_id = branchId;
        }
        localStorage.setItem('workspace_session_id', sess.id);
        setSession(sess);
      } else {
        // Create new session
        const newSession: any = {
          customer_id: customerData.id,
          user_code: customerData.code,
          phone_number: customerData.phone,
          start_time: new Date().toISOString(),
          status: 'active',
          branch_id: branchId // Associated with the selected branch
        };

        const { data: created, error: createError } = await (supabase as any)
          .from('workspace_sessions')
          .insert(newSession)
          .select('*, customers(full_name)')
          .single();

        if (createError) throw createError;

        localStorage.setItem('workspace_session_id', created.id);
        setSession(created);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ، حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutRequest = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ status: 'checkout_requested' })
        .eq('id', session.id);

      if (error) throw error;
      setSession({ ...session, status: 'checkout_requested' });
    } catch (err: any) {
      alert('فشل إرسال طلب الخروج.');
    } finally {
      setLoading(false);
    }
  };

  // Realtime listener for session changes
  useEffect(() => {
    if (!session?.id) return;
    
    const channel = supabase
      .channel(`workspace_session_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_sessions',
          filter: `id=eq.${session.id}`
        },
        (payload) => {
          setSession((prev: any) => {
            if (!prev) return prev;
            const newData = payload.new;
            if (newData.status === 'completed') {
               localStorage.removeItem('workspace_session_id');
            }
            return {
              ...prev,
              status: newData.status,
              total_amount: newData.total_amount,
              total_minutes: newData.total_minutes,
              catering_amount: newData.catering_amount,
              orders: newData.orders
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  const handleDone = () => {
    setSession(null);
    setUserCode('');
    setPhoneNumber('');
  };

  if (session) {
    if (session.status === 'completed') {
      return (
        <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center font-['Cairo'] text-right p-4 relative overflow-hidden">
          {/* Brand Background Effects */}
          <div className="absolute top-0 right-0 w-[50vh] h-[50vh] bg-[#1e75b9]/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-[#1ed788]/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 md:p-12 w-full max-w-md text-center flex flex-col items-center animate-in zoom-in-95 duration-500 shadow-2xl">
            <div className="w-24 h-24 bg-[#1ed788]/20 rounded-full flex items-center justify-center mb-6 border border-[#1ed788]/30">
              <CheckCircle2 size={48} className="text-[#1ed788]" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">تم إنهاء الجلسة</h2>
            <div className="bg-white/5 rounded-3xl p-6 w-full space-y-4 mb-8 border border-white/5">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-bold">الوقت الإجمالي:</span>
                <span className="font-black text-white bg-white/10 px-3 py-1 rounded-xl">{session.total_minutes} دقيقة</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-bold">مساحة العمل (10 ج/س):</span>
                <span className="font-black text-[#1e75b9]">
                    {session.total_amount ? (session.total_amount - (session.catering_amount || 0)).toFixed(2) : 0} EGP
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-bold">إجمالي المتجر:</span>
                <span className="font-black text-[#f78c2a]">{session.catering_amount || 0} EGP</span>
              </div>
              
              {session.orders && session.orders.length > 0 && (
                  <div className="text-sm space-y-2 mt-4 pt-4 border-t border-white/10 opacity-90">
                      <p className="text-slate-400 font-bold mb-2 w-full text-right text-xs">تفاصيل القائمة:</p>
                      {session.orders.map((o: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-slate-300 bg-black/20 p-2 rounded-lg">
                              <span>- {o.name} <span className="text-[#f78c2a] text-xs font-bold">(x{o.quantity || 1})</span></span>
                              <span className="font-bold">{o.price} EGP</span>
                          </div>
                      ))}
                  </div>
              )}
              
              <div className="flex justify-between items-center pt-4 border-t border-white/20 mt-4">
                <span className="font-bold text-slate-300">المبلغ الإجمالي المطلـوب:</span>
                <span className="font-black text-[#1ed788] text-2xl">{session.total_amount} EGP</span>
              </div>
            </div>
            <button
              onClick={handleDone}
              className="w-full bg-[#1e75b9] hover:bg-[#155a96] shadow-[0_0_20px_rgba(30,117,185,0.3)] text-white rounded-2xl py-4 font-bold text-lg transition-all active:scale-95"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[100dvh] bg-[#0B0F19] flex flex-col font-['Cairo'] text-right relative overflow-hidden">
        {/* Abstract Branding Elements */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1e75b9]/15 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#1ed788]/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-[#f78c2a]/5 rounded-full blur-[150px] pointer-events-none rotate-45" />

        {/* TOP PROFILE HEADER */}
        <div className="relative z-10 pt-8 pb-4 px-6 bg-[#0B0F19]/40 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between animate-in slide-in-from-top-8 duration-700 shadow-xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              {/* Animated Ring - Smaller */}
              <div className="absolute -inset-1 rounded-full border border-[#1e75b9]/30 border-t-[#1e75b9] animate-[spin_4s_linear_infinite]" />
              <div className="absolute -inset-1 rounded-full border border-[#1ed788]/20 border-b-[#1ed788] animate-[spin_5s_linear_infinite_reverse]" />
              
              <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-[#0B0F19] relative z-20 flex items-center justify-center shadow-[0_0_15px_rgba(30,117,185,0.3)]">
                <User size={20} className="text-[#1e75b9]" />
              </div>
            </div>
            
            <div className="text-right">
              <h1 className="text-lg font-black text-white leading-tight">
                أهلاً، <span className="text-[#1ed788]">{session.customers?.full_name?.split(' ')[0] || 'زائرنا'}</span>
              </h1>
              <p className="text-[#f78c2a] font-bold text-[10px] tracking-widest uppercase mt-0.5">{session.user_code}</p>
            </div>
          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 pb-28 pt-6 relative z-10 custom-scrollbar">
          {/* TAB CONTENTS */}
          {activeTab === 'session' && (
            <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative group w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e75b9] to-[#1ed788] rounded-[2rem] blur opacity-20 transition-opacity" />
                <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-10 w-full relative shadow-inner flex flex-col items-center">
                  <div className="text-sm font-bold text-[#1e75b9] uppercase tracking-widest mb-4">الوقت المنقضي</div>
                  <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 font-mono tracking-wider tabular-nums filter drop-shadow-md">
                    {elapsedTime}
                  </div>
                  {session.status === 'checkout_requested' && (
                    <div className="mt-8 text-white font-bold bg-[#f78c2a] px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(247,140,42,0.4)] animate-pulse w-full text-center">
                      جاري مراجعة طلبك وإصدار الفاتورة...
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={handleCheckoutRequest}
                disabled={session.status === 'checkout_requested' || loading}
                className={`w-full flex items-center justify-center gap-3 py-4 md:py-5 rounded-2xl font-black text-lg transition-all active:scale-95 border ${
                  session.status === 'checkout_requested'
                    ? 'bg-[#0B0F19] border-white/10 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-l from-rose-500 to-rose-600 hover:to-rose-500 border-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                }`}
              >
                {loading ? 'جاري المعالجة...' : session.status === 'checkout_requested' ? 'تم طلب إنهاء الجلسة' : 'إنهاء الجلسة والحساب'}
                {!loading && session.status !== 'checkout_requested' && <LogOut size={22} />}
              </button>
            </div>
          )}
          
          {activeTab === 'catering' && (
            <div className="w-full max-w-lg mx-auto space-y-4 animate-in fade-in duration-300">
                <h2 className="text-xl font-black text-white mb-6 text-center">متجر المساحة</h2>
                {cateringItems.length > 0 ? cateringItems.map(item => (
                    <div key={item.id} className="bg-[#0B0F19]/60 backdrop-blur-md border border-white/5 hover:border-[#f78c2a]/50 transition-colors p-4 rounded-2xl flex justify-between items-center group shadow-lg">
                      <div className="text-right flex-1">
                          <p className="font-black text-white text-lg group-hover:text-[#f78c2a] transition-colors line-clamp-1 truncate ml-2" title={item.name}>{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold mb-1">{item.category}</p>
                          <p className="text-[#1ed788] font-black">{item.price} EGP</p>
                      </div>
                      <button 
                        onClick={() => handleOrder(item)} 
                        disabled={orderLoading || session.status === 'checkout_requested'} 
                        className="bg-white/10 hover:bg-[#f78c2a] shrink-0 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
                      >
                          شراء
                      </button>
                    </div>
                )) : (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-[#0B0F19]/60 border border-white/5 rounded-3xl">
                      <ShoppingBag size={48} className="text-slate-600 mb-4 opacity-50" />
                      <p className="font-bold">القائمة غير متاحة حالياً</p>
                    </div>
                )}
                
                {session.orders?.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/10 text-right">
                      <div className="bg-[#f78c2a]/10 backdrop-blur-md border border-[#f78c2a]/20 p-5 rounded-3xl shadow-[0_0_30px_rgba(247,140,42,0.1)]">
                        <h3 className="font-black text-[#f78c2a] mb-5 flex gap-2 items-center">
                          <Coffee size={18}/> مشترياتي ({session.catering_amount || 0} EGP)
                        </h3>
                        <div className="space-y-3">
                            {session.orders.map((o: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm font-bold text-slate-300 bg-black/40 px-4 py-3 rounded-xl border border-white/5">
                                  <span>{o.name}</span>
                                  <span className="text-white">{o.price} EGP</span>
                                </div>
                            ))}
                        </div>
                      </div>
                    </div>
                )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="w-full max-w-lg mx-auto flex flex-col animate-in fade-in duration-300 space-y-6">
              <div className="bg-[#0B0F19]/60 backdrop-blur-xl border border-white/5 p-8 rounded-3xl relative overflow-hidden shadow-2xl text-right">
                <div className="absolute top-0 left-0 w-32 h-32 bg-[#1e75b9]/20 rounded-full blur-[40px]" />
                <h2 className="text-2xl font-black text-white mb-6 relative z-10 flex items-center gap-3">
                  <span className="w-2 h-8 bg-[#1e75b9] rounded-full inline-block"></span> من نحن
                </h2>
                <div className="space-y-4 relative z-10 text-slate-300">
                  <p className="leading-relaxed text-sm font-bold">
                    تم تصميم مساحتنا خصيصاً لتوفير بيئة عمل ودراسة هادئة واحترافية، تُعزز من إنتاجيتك وتحافظ على تركيزك.
                  </p>
                  <p className="leading-relaxed text-sm">
                    نحن نقدم لك كافة الخدمات التي تحتاجها (إنترنت فائق السرعة، مشروبات طازجة، بيئة مكيّفة، وغرف اجتماعات خاصة).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'how_work' && (
            <div className="w-full max-w-lg mx-auto flex flex-col animate-in fade-in duration-300 text-right">
              <div className="bg-[#0B0F19]/60 backdrop-blur-xl border border-white/5 p-8 rounded-3xl relative overflow-hidden shadow-2xl text-right">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#1ed788]/10 rounded-full blur-[40px]" />
                <h2 className="text-2xl font-black text-white mb-6 relative z-10 flex items-center gap-3">
                  <span className="w-2 h-8 bg-[#1ed788] rounded-full inline-block"></span> سياسة النظام
                </h2>
                <ul className="space-y-4 relative z-10">
                  {[
                     { title: 'بدء الجلسة', desc: 'يبدأ العداد فور تسجيلك للدخول عبر هذه المنصة.' },
                     { title: 'التكلفة بالدقيقة', desc: 'تكلفة الساعة 10 جنيهات، والحساب يتم بنظام كسور الساعات.' },
                     { title: 'الحد الأدنى', desc: 'أقل تكلفة لدخول المساحة هي 10 جنيهات.' },
                     { title: 'المتجر اللحظي', desc: 'تضاف طلباتك من المتجر مباشرة إلى حسابك.' }
                  ].map((item, idx) => (
                    <li key={idx} className="flex gap-3 items-start bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                      <div className="w-7 h-7 rounded-full bg-[#1e75b9]/20 flex items-center justify-center font-black text-[#1e75b9] text-xs shrink-0 mt-0.5">{idx + 1}</div>
                      <div>
                        <strong className="text-white text-sm block mb-1">{item.title}</strong>
                        <span className="text-xs text-slate-400 leading-relaxed block">{item.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAVIGATION BAR */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-[#0B0F19]/90 backdrop-blur-3xl border-t border-white/10 z-50 px-4 md:px-0 flex justify-center pb-safe">
          <div className="w-full max-w-md h-full flex justify-between items-center px-2">
            {[
              { id: 'session', icon: Clock, label: 'الرئيسية' },
              { id: 'catering', icon: ShoppingBag, label: 'المتجر', action: fetchStoreItems },
              { id: 'about', icon: Info, label: 'من نحن' },
              { id: 'how_work', icon: HelpCircle, label: 'الأسئلة' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as activeTabType); if (tab.action) tab.action(); }} 
                  className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all relative ${
                    isActive ? 'text-[#1ed788]' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <tab.icon size={isActive ? 24 : 20} className={`transition-all ${isActive ? 'mb-1 drop-shadow-[0_0_8px_rgba(30,215,136,0.8)] scale-110' : ''}`} />
                  <span className={`text-[10px] lg:text-xs font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>{tab.label}</span>
                  {isActive && (
                    <div className="absolute top-0 w-8 h-1 bg-[#1ed788] rounded-b-full shadow-[0_4px_10px_rgba(30,215,136,0.5)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0B0F19] flex items-center justify-center font-['Cairo'] text-right p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#1e75b9]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#1ed788]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] bg-[#f78c2a]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 md:p-12 w-full max-w-md relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-700">
        <div className="text-center mb-10">
          {/* Logo Abstraction Using Brand Colors */}
          <div className="flex items-center justify-center gap-1 mx-auto mb-6 h-16">
             <div className="w-6 h-6 rounded-full border-4 border-[#1ed788] border-b-transparent rotate-[-45deg]"></div>
             <div className="w-12 h-12 rounded-full border-[6px] border-[#1e75b9] border-b-transparent"></div>
             <div className="w-5 h-5 rounded-full border-4 border-[#f78c2a] border-b-transparent rotate-45 mb-4"></div>
             <div className="w-6 h-6 rounded-full border-4 border-rose-500 border-b-transparent rotate-45 mt-4"></div>
          </div>
          
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">مساحة العمل</h1>
          <p className="text-slate-400 font-bold">{isSignUp ? 'أنشئ حساباً لبدء جلستك' : 'أدخل بياناتك لبدء جلستك'}</p>
        </div>

        {isSignUp ? (
          <form onSubmit={handleSignUp} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm font-bold text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">الاسم بالكامل</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                placeholder="أحمد محمد"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">رقم الهاتف</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold text-left focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">تاريخ الميلاد</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold text-left focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">الجامعة / الكلية</label>
              <select
                value={college}
                onChange={(e) => {
                  setCollege(e.target.value);
                  setShowCustomCollege(e.target.value === 'أخرى');
                }}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
              >
                <option value="">اختر الجامعة</option>
                {colleges.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {showCustomCollege && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-bold text-[#f78c2a] block ml-1">اسم الجامعة الأخرى</label>
                <input
                  type="text"
                  required
                  value={customCollege}
                  onChange={(e) => setCustomCollege(e.target.value)}
                  className="w-full bg-[#0B0F19]/60 border border-[#f78c2a]/30 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-[#f78c2a] focus:ring-1 focus:ring-[#f78c2a] transition-all"
                  placeholder="اكتب اسم الجامعة هنا..."
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">النوع</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-3 rounded-xl font-bold transition-all border ${gender === 'male' ? 'bg-[#1e75b9] border-[#1e75b9] text-white' : 'bg-[#0B0F19]/60 border-white/10 text-slate-400'}`}
                >
                  ذكر
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-3 rounded-xl font-bold transition-all border ${gender === 'female' ? 'bg-[#1e75b9] border-[#1e75b9] text-white' : 'bg-[#0B0F19]/60 border-white/10 text-slate-400'}`}
                >
                  أنثى
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !fullName || !phoneNumber}
                className="w-full bg-[#1ed788] hover:bg-[#1bbd77] disabled:opacity-50 text-[#0B0F19] rounded-2xl py-4 font-black text-lg transition-all shadow-[0_0_20px_rgba(30,215,136,0.3)] active:scale-95"
              >
                {loading ? 'جاري التسجيل...' : 'تسجيل وتأكيد'}
              </button>
            </div>
            
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(''); }}
                className="text-slate-400 hover:text-white text-sm font-bold transition-colors"
              >
                لديك حساب بالفعل؟ <span className="text-[#1e75b9] underline decoration-2 underline-offset-4">تسجيل الدخول</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm font-bold text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">كود المستخدم</label>
              <input
                type="text"
                required
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold text-left focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                placeholder="مثال: C0001"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-400 block ml-1">رقم الهاتف</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold text-left focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !userCode || !phoneNumber}
                className="w-full bg-[#1e75b9] hover:bg-[#155a96] disabled:opacity-50 text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all shadow-[0_0_20px_rgba(30,117,185,0.4)] active:scale-95"
              >
                {loading ? 'جاري التحقق...' : 'بدء الجلسة'}
              </button>
            </div>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(''); }}
                className="text-slate-400 hover:text-white text-sm font-bold transition-colors"
              >
                أول مرة تزورنا؟ <span className="text-[#1ed788] underline decoration-2 underline-offset-4">أنشئ حساباً مجانياً</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
