import React, { useState, useEffect } from 'react';
import { Clock, LogOut, CheckCircle2, Coffee, ShoppingBag, Info, HelpCircle, User, Sparkles, CalendarDays, ChevronLeft, Receipt, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// UI tabs options
type activeTabType = 'session' | 'catering' | 'about' | 'how_work';

export const WorkspaceLogin = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [cateringItems, setCateringItems] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [id: string]: { item: any, quantity: number } }>({});
  const [orderLoading, setOrderLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<activeTabType>('session');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('Male');
  const [birthDate, setBirthDate] = useState('');
  const [userCode, setUserCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [finalBill, setFinalBill] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotCode, setIsForgotCode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [branchId, setBranchId] = useState<string | null>(localStorage.getItem('workspace_branch_id'));

  const [college, setCollege] = useState('');
  const [customCollege, setCustomCollege] = useState('');
  const [showCustomCollege, setShowCustomCollege] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [regSuccessData, setRegSuccessData] = useState<{name: string, code: string, email: string} | null>(null);

  const colleges = [
    'كلية الهندسة',
    'كلية الطب',
    'كلية الصيدلة',
    'كلية الحاسبات والمعلومات',
    'كلية التجارة',
    'كلية الآداب',
    'كلية الحقوق',
    'كلية العلوم',
    'كلية الإعلام',
    'كلية الألسن',
    'كلية الاقتصاد والعلوم السياسية',
    'كلية طب الأسنان',
    'كلية التربية',
    'كلية الزراعة',
    'كلية الفنون الجميلة',
    'كلية الفنون التطبيقية',
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
      // Direct fetch from inventory favoring selling_price > 0
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .gt('selling_price', 0)
        .order('name');
      
      if (error) throw error;
      setCateringItems(data || []);
    } catch (err) {
      console.error('Error fetching store items:', err);
    }
  };

  const addToCart = (item: any) => {
    setCart(prev => {
        const id = item.id;
        const existing = prev[id] || { item, quantity: 0 };
        return { ...prev, [id]: { ...existing, quantity: existing.quantity + 1 } };
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
        const newCart = { ...prev };
        if (newCart[itemId].quantity > 1) {
            newCart[itemId].quantity -= 1;
        } else {
            delete newCart[itemId];
        }
        return newCart;
    });
  };

  const handleCheckoutCart = async () => {
    if (Object.keys(cart).length === 0) return;
    if (session?.status === 'checkout_requested') {
      alert("لا يمكن إضافة طلبات بعد طلب إنهاء الجلسة، يرجى إلغاء الطلب أولاً أو مراجعة المسئول");
      return;
    }
    setOrderLoading(true);
    try {
      const cartEntries = Object.values(cart) as any[];
      const subtotal = cartEntries.reduce((sum, entry) => sum + ((entry.item.selling_price || entry.item.price) * entry.quantity), 0);
      
      // 1. Attempt to create structured order records (if tables exist)
      try {
          const { data: order, error: orderErr } = await (supabase as any)
            .from('orders')
            .insert({
                customer_id: session.customer_id,
                session_id: session.id,
                total_price: subtotal,
                branch_id: branchId
            })
            .select()
            .single();
            
          if (!orderErr && order) {
              // 2. Insert Order Items (Structured)
              for (const entry of cartEntries) {
                  await (supabase as any)
                    .from('order_items')
                    .insert({
                        order_id: order.id,
                        product_id: entry.item.id,
                        quantity: entry.quantity,
                        price_at_purchase: entry.item.selling_price || entry.item.price
                    });
              }
          }
      } catch (tableErr) {
          console.warn("Structured order tables (orders/order_items) not found. Falling back to JSON storage.");
      }

      // 3. Deduct Inventory (Always works if inventory table exists)
      for (const entry of cartEntries) {
          const invId = entry.item.id; // Use item.id directly from inventory fetch
          const currentStock = Number(entry.item.stock) || 0;
          await (supabase as any)
            .from('inventory')
            .update({ stock: Math.max(0, currentStock - entry.quantity) })
            .eq('id', invId);
      }

      // 4. Update Session JSON for legacy compatibility and reliable billing
      const currentOrders = Array.isArray(session.orders) ? session.orders : [];
      const currentCateringAmount = Number(session.catering_amount) || 0;
      
      const newOrders = [...currentOrders, ...cartEntries.map(e => ({
        id: e.item.id,
        name: e.item.name,
        price: e.item.selling_price || e.item.price,
        quantity: e.quantity,
        time: new Date().toISOString()
      }))];
      
      const newAmount = currentCateringAmount + subtotal;
      
      const { error: sessionErr } = await (supabase as any)
        .from('workspace_sessions')
        .update({ orders: newOrders, catering_amount: newAmount })
        .eq('id', session.id);
        
      if (sessionErr) throw sessionErr;

      setSession({...session, orders: newOrders, catering_amount: newAmount});
      setCart({});
      alert("تمت عملية الشراء بنجاح!");
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء إتمام الطلب: " + err.message);
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

      // Automatically send the welcome email
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ record: createdCustomer })
        });

        if (res.ok) {
            console.log('Welcome email sent successfully to:', createdCustomer.email);
            setRegSuccessData({ name: createdCustomer.full_name, code: createdCustomer.code, email: createdCustomer.email });
            setShowSuccessModal(true);
        } else {
            const errData = await res.json().catch(() => ({}));
            console.warn('Welcome email trigger returned non-ok status:', errData);
            
            // Log failure to database
            await supabase.from('customers').update({ 
              email_status: 'failed', 
              email_error: errData.error || 'Server error' 
            }).eq('id', createdCustomer.id);

            setRegSuccessData({ name: createdCustomer.full_name, code: createdCustomer.code, email: '' });
            setShowSuccessModal(true);
        }
      } catch (emailErr: any) {
        console.error('Network error during welcome email trigger:', emailErr);
        
        // Log failure to database
        await supabase.from('customers').update({ 
          email_status: 'failed', 
          email_error: emailErr.message || 'Network error' 
        }).eq('id', createdCustomer.id);

        setRegSuccessData({ name: createdCustomer.full_name, code: createdCustomer.code, email: '' });
        setShowSuccessModal(true);
      }

      setUserCode(generatedCode);
      setIsSignUp(false);
      
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
      const cleanCode = userCode.trim().toUpperCase();

      // 1. Direct session lookup (to "find session and time" as requested)
      // This works for both registered customers and visitors (NA codes)
      const { data: existingSess, error: directError } = await supabase
        .from('workspace_sessions')
        .select('*, customers(full_name)')
        .eq('user_code', cleanCode)
        .ilike('phone_number', `%${cleanPhone}`)
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      if (existingSess) {
        localStorage.setItem('workspace_session_id', existingSess.id);
        
        // Ensure branch context for consistency
        const sess = existingSess as any;
        if (!sess.branch_id && branchId) {
            await (supabase as any)
                .from('workspace_sessions')
                .update({ branch_id: branchId })
                .eq('id', sess.id);
            sess.branch_id = branchId;
        }

        setSession(sess);
        setLoading(false);
        return;
      }

      // 2. Traditional customer login (to start a NEW session)
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, full_name, code, phone')
        .eq('code', cleanCode)
        .ilike('phone', `%${cleanPhone}`)
        .maybeSingle();

      if (customerError || !customerData) {
        throw new Error('بيانات المستخدم غير صحيحة، تأكد من كود العميل ورقم الهاتف.');
      }

      // At this point, we know the customer is valid but has no active session found in step 1
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
      
    } catch (err: any) {
      setError(err.message || 'حدث خطأ، حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!forgotEmail) throw new Error('يرجى إدخال البريد الإلكتروني أو رقم الهاتف');

      const cleanInput = forgotEmail.trim();
      const isPhone = /^[0-9]+$/.test(cleanInput);

      let query = (supabase.from('customers') as any).select('*');
      
      if (isPhone) {
        // Normalize: strip all non-digits, then remove ONLY the leading 0 or +20 if present
        const digitsOnly = cleanInput.replace(/\D/g, '');
        const cleanPhone = digitsOnly.replace(/^(\+20|0)/, '');
        query = query.ilike('phone', `%${cleanPhone}%`);
      } else {
        query = query.ilike('email', cleanInput);
      }

      const { data: customer, error: fetchErr } = await query.limit(1).maybeSingle();

      if (fetchErr) {
          console.error('Lookup error:', fetchErr);
          throw new Error('حدث خطأ فني أثناء البحث. يرجى المحاولة مرة أخرى.');
      }

      if (!customer) {
        throw new Error('لم نجد أي حساب بهذا البريد أو الرقم، تأكد من صحته.');
      }

      if (!customer.email) {
        throw new Error('لا يوجد بريد إلكتروني مسجل لهذا الحساب لإرسال الكود إليه. يرجى مراجعة الاستقبال.');
      }

      // Trigger the existing email function to resend the code
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
      const res = await fetch(url, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ record: customer })
      });

      if (!res.ok) throw new Error('فشل إرسال البريد، حاول مرة أخرى لاحقاً.');

      setRegSuccessData({ 
          name: customer.full_name, 
          code: customer.code, 
          email: customer.email 
      });
      setShowSuccessModal(true);
      setIsForgotCode(false);
      setIsSignUp(false);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutRequest = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const checkoutTime = new Date().toISOString();
      const { error } = await supabase
        .from('workspace_sessions')
        .update({ 
          status: 'checkout_requested',
          end_time: checkoutTime // Set end_time immediately at request to lock the billable time
        })
        .eq('id', session.id);

      if (error) throw error;
      
      // Broadcast to let admin know immediately
      supabase.channel(`workspace_admin_sessions_${branchId}`).send({
        type: 'broadcast',
        event: 'session_updated',
        payload: { sessionId: session.id, status: 'checkout_requested' }
      });

      setSession({ ...session, status: 'checkout_requested', end_time: checkoutTime });
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
               setFinalBill({
                 ...prev,
                 ...newData
               });
               return null; 
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
      .on('broadcast', { event: 'session_updated' }, (payload) => {
        const newData = payload.payload;
        setSession((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: newData.status,
            end_time: newData.end_time || prev.end_time
          };
        });
      })
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
                      بإنتظار موافقة ال Admin علي هذا الطلب يرجي التوجه لدفع الحساب
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
                {loading ? 'جاري المعالجة..' : session.status === 'checkout_requested' ? 'تم طلب إنهاء الجلسة' : 'إنهاء الجلسة والحساب'}
                {!loading && session.status !== 'checkout_requested' && <LogOut size={22} />}
              </button>
            </div>
          )}
          
          {activeTab === 'catering' && (
            <div className="w-full max-w-lg mx-auto space-y-4 animate-in fade-in duration-300">
                <h2 className="text-xl font-black text-white mb-6 text-center">متجر المساحة</h2>
                
                {/* Cart Summary Header */}
                {Object.keys(cart).length > 0 && (
                   <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 p-4 rounded-2xl flex justify-between items-center mb-6 animate-in slide-in-from-top-4">
                     <div className="text-right">
                       <p className="text-indigo-400 font-bold text-xs">سلة المشتريات</p>
                       <p className="text-white font-black">{Object.values(cart).reduce((s, e) => s + (e as any).quantity, 0)} أصناف</p>
                     </div>
                     <button 
                       onClick={handleCheckoutCart}
                       disabled={orderLoading}
                       className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-2"
                     >
                       {orderLoading ? 'جاري...' : 'إتمام الطلب'}
                       <CheckCircle2 size={18} />
                     </button>
                   </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  {cateringItems.length > 0 ? cateringItems.map(item => {
                      const cartEntry = cart[item.id];
                      return (
                        <div key={item.id} className="bg-[#0B0F19]/60 backdrop-blur-md border border-white/5 hover:border-indigo-500/50 transition-colors p-4 rounded-2xl flex justify-between items-center group shadow-lg">
                          <div className="text-right flex-1">
                              <p className="font-black text-white text-lg group-hover:text-indigo-400 transition-colors line-clamp-1 truncate ml-2" title={item.name}>{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[#1ed788] font-black">{item.selling_price} EGP</p>
                                <span className="text-[10px] text-slate-500 font-bold">| متوفر: {item.stock || 0}</span>
                              </div>
                          </div>
                          
                          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
                            {cartEntry && (
                              <>
                                <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center font-black">-</button>
                                <span className="w-6 text-center text-white font-black">{cartEntry.quantity}</span>
                              </>
                            )}
                            <button 
                               onClick={() => addToCart(item)} 
                               disabled={session?.status === 'checkout_requested'}
                               className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                             >
                               +
                             </button>
                          </div>
                        </div>
                      );
                  }) : (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-[#0B0F19]/60 border border-white/5 rounded-3xl">
                        <ShoppingBag size={48} className="text-slate-600 mb-4 opacity-50" />
                        <p className="font-bold">القائمة غير متاحة حالياً</p>
                      </div>
                  )}
                </div>
                
                {session.orders?.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-white/10 text-right">
                        <h3 className="font-black text-indigo-400 mb-5 flex gap-2 items-center text-lg">
                           <Coffee size={24}/> سجل مشتريات الجلسة
                        </h3>
                        <div className="space-y-3">
                            {session.orders.map((o: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm font-bold text-slate-300 bg-white/5 px-5 py-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs">{o.quantity}x</span>
                                    <span>{o.name}</span>
                                  </div>
                                  <span className="text-white font-black">{(o.price * o.quantity).toLocaleString()} EGP</span>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-lg font-black text-[#1ed788]">
                                <span>إجمالي الكافيتريا</span>
                                <span>{session.catering_amount || 0} EGP</span>
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
          <div className="w-24 h-24 bg-white/5 backdrop-blur-md rounded-3xl mx-auto flex items-center justify-center mb-6 border border-white/10 shadow-2xl p-3">
             <img src="/logo.png" alt="Cloud Logo" className="w-full h-full object-contain" />
          </div>
          
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Cloud Co-Working Space</h1>
          <p className="text-slate-400 font-bold">{isForgotCode ? 'استعادة كود الدخول' : isSignUp ? 'أنشئ حساباً لبدء جلستك' : 'أدخل بياناتك لبدء جلستك'}</p>
        </div>

        {isForgotCode ? (
          <form onSubmit={handleForgotCode} className="space-y-6">
             {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm font-bold text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 block ml-1">البريد الإلكتروني أو رقم الهاتف المسجل</label>
              <input
                type="text"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                placeholder="01xxxxxxxxx أو example@mail.com"
                dir="auto"
              />
              <p className="text-[10px] text-[#f78c2a] font-black mr-1 mt-1 italic leading-relaxed">تنبيه: سيتم إرسال الكود فوراً إلى بريدك الإلكتروني المسجل لدينا.</p>
            </div>

            <div className="pt-4 flex flex-col gap-4">
              <button
                type="submit"
                disabled={loading || !forgotEmail}
                className="w-full bg-[#f78c2a] hover:bg-[#e67b1a] disabled:opacity-50 text-white rounded-2xl py-4 font-black text-lg transition-all shadow-[0_0_20px_rgba(247,140,42,0.3)] active:scale-95"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال الكود للبريد'}
              </button>
              
              <button
                type="button"
                onClick={() => { setIsForgotCode(false); setError(''); }}
                className="text-slate-400 hover:text-white text-sm font-bold transition-colors"
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          </form>
        ) : isSignUp ? (
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
              <label className="text-sm font-bold text-slate-400 block ml-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0B0F19]/60 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold text-left focus:outline-none focus:border-[#1e75b9] focus:ring-1 focus:ring-[#1e75b9] transition-all"
                placeholder="example@mail.com"
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
                  onClick={() => setGender('Male')}
                  className={`py-3 rounded-xl font-bold transition-all border ${gender === 'Male' ? 'bg-[#1e75b9] border-[#1e75b9] text-white' : 'bg-[#0B0F19]/60 border-white/10 text-slate-400'}`}
                >
                  ذكر
                </button>
                <button
                  type="button"
                  onClick={() => setGender('Female')}
                  className={`py-3 rounded-xl font-bold transition-all border ${gender === 'Female' ? 'bg-[#1e75b9] border-[#1e75b9] text-white' : 'bg-[#0B0F19]/60 border-white/10 text-slate-400'}`}
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

            <div className="flex flex-col gap-4 mt-6 text-center">
              <button
                type="button"
                onClick={() => { setIsForgotCode(true); setIsSignUp(false); setError(''); }}
                className="text-slate-400 hover:text-white text-sm font-bold transition-colors"
              >
                نسيت كود الدخول؟ <span className="text-[#f78c2a] underline decoration-2 underline-offset-4">استعادة الكود</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsSignUp(true); setIsForgotCode(false); setError(''); }}
                className="text-slate-400 hover:text-white text-sm font-bold transition-colors"
              >
                أول مرة تزورنا؟ <span className="text-[#1ed788] underline decoration-2 underline-offset-4">أنشئ حساباً مجانياً</span>
              </button>
            </div>
          </form>
        )}
      </div>
      {finalBill && <FinalReceiptModal bill={finalBill} onClose={() => setFinalBill(null)} />}
      {/* Registration Success Modal */}
      {showSuccessModal && regSuccessData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0F19]/90 backdrop-blur-xl animate-in fade-in duration-500 p-4">
          <div className="w-full max-w-sm bg-gradient-to-br from-[#1e75b9]/20 to-[#1ed788]/20 border border-white/10 rounded-[3rem] p-8 text-center relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            {/* Background Orbs */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#1ed788]/20 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#1e75b9]/20 rounded-full blur-3xl -ml-16 -mb-16" />

            {/* Content */}
            <div className="relative space-y-6">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10 scale-110 animate-pulse">
                <CheckCircle2 size={40} className="text-[#1ed788]" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white mb-2 font-['Cairo']">تم التسجيل بنجاح! 🎉</h3>
                <p className="text-slate-400 text-sm font-bold font-['Cairo'] px-4">
                  أهلاً بك <span className="text-white">{regSuccessData.name}</span> في عائلة Campus
                </p>
              </div>

              <div className="bg-[#0B0F19]/60 border border-white/10 rounded-[2rem] p-6 space-y-3 shadow-inner">
                <p className="text-xs font-black text-[#1e75b9] uppercase tracking-widest">كود الدخول الخاص بك</p>
                <div className="text-5xl font-black text-[#1ed788] font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(30,215,136,0.3)]">
                  {regSuccessData.code}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white/5 border border-white/5 py-3 px-4 rounded-2xl flex items-center gap-2 justify-center">
                  <Info size={14} className="text-blue-400" />
                  <p className="text-[10px] text-white/50 font-bold font-['Cairo'] leading-relaxed">
                    يرجى أخذ لقطة شاشة (Screenshot) لهذا الكود لاستخدامه عند الحضور.
                    {regSuccessData.email && <span className="block text-emerald-400 mt-1">تم إرسال نسخة لبريدك: {regSuccessData.email}</span>}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    // Force the user back to the login screen with the code pre-filled
                    setUserCode(regSuccessData.code);
                    setIsSignUp(false);
                  }}
                  className="w-full bg-white text-[#0B0F19] rounded-2xl py-4 font-black text-lg hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                  فهمت، ابدأ الآن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FinalReceiptModal = ({ bill, onClose }: { bill: any, onClose: () => void }) => {
    const [sub, setSub] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (bill.payment_method === 'subscription' && bill.customer_id) {
            const fetchSub = async () => {
                setLoading(true);
                const { data } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('customer_id', bill.customer_id)
                    .in('status', ['Active', 'Exhausted'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data) setSub(data);
                setLoading(false);
            };
            fetchSub();
        }
    }, [bill]);

    return (
        <div className="fixed inset-0 bg-[#0B0F19]/95 backdrop-blur-3xl z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white rounded-t-[3.5rem] sm:rounded-[3.5rem] p-10 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-20 duration-500 overflow-hidden relative max-h-[95vh] overflow-y-auto custom-scrollbar">
            {/* Header matching Admin Bill */}
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                  <Receipt size={28} />
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">فاتورة الزيارة</h2>
                  <p className="text-indigo-600 text-[10px] font-black tracking-widest mt-1 uppercase">Session Summary</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-slate-400 hover:bg-slate-50 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8 text-right">
              <div className="bg-slate-50/80 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                
                {/* Client Info Section */}
                <div className="border-b-2 border-dashed border-slate-200 pb-6 text-center">
                  <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest">مرحباً بك مجدداً</p>
                  <p className="text-2xl font-black text-slate-900">{bill.customers?.full_name || 'زائر متميز'}</p>
                  <p className="text-lg font-black text-indigo-600 bg-white inline-block px-4 py-1 rounded-xl shadow-sm border border-indigo-50 mt-3 font-mono">{bill.user_code}</p>
                </div>
                
                <div className="space-y-4 font-bold text-slate-600">
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white">
                    <span className="text-xs font-black text-slate-400">وقت الاستخدام</span>
                    <span className="text-slate-900 font-black">
                       {Math.floor((bill.total_minutes || 0) / 60)}h {Number(bill.total_minutes || 0) % 60}m
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white text-right">
                    <span className="text-xs font-black text-slate-400">تكفلة الجلسة</span>
                    <span className={`font-black ${bill.payment_method === 'subscription' ? 'text-indigo-600' : 'text-slate-900'}`}>
                       {bill.payment_method === 'subscription' ? '✓ اشتراك ساعات فعال' : `${Number(bill.total_amount || 0) - (Number(bill.catering_amount) || 0)} EGP`}
                    </span>
                  </div>

                  {bill.payment_method === 'subscription' && (
                    <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                      <div className="flex justify-between items-center relative z-10">
                        <div className="text-left">
                          <p className="text-2xl font-black">{loading ? '...' : sub ? (sub.total_hours - sub.used_hours).toFixed(1) : '0.0'} <span className="text-[10px] opacity-40 uppercase tracking-widest ml-1">H Left</span></p>
                          <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {sub ? new Date(sub.end_date).toLocaleDateString('ar-EG') : '...'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end mb-1">
                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Subscription</p>
                            <Sparkles size={10} className="text-emerald-400" />
                          </div>
                          <p className="text-xs font-black whitespace-nowrap">{(Number(bill.total_minutes || 0) / 60).toFixed(2)}h used</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white">
                    <span className="text-xs font-black text-slate-400">رصيد المتجر</span>
                    <span className="text-slate-900 font-black">{bill.catering_amount || 0} EGP</span>
                  </div>
                </div>

                {bill.orders && bill.orders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em] text-center">أصناف الكافيتريا</p>
                    <div className="space-y-2">
                      {bill.orders.map((o: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-black bg-white rounded-xl p-3 border border-slate-50 shadow-sm">
                          <span className="text-slate-500">{o.name} <span className="opacity-40 ml-1">x{o.quantity}</span></span>
                          <span className="text-slate-900 font-mono">{o.price} EGP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-8 mt-4 border-t-2 border-dashed border-slate-200 flex flex-col items-center gap-1">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">المبلغ كاش للمتجر</span>
                  <p className="text-5xl font-black text-emerald-600 drop-shadow-sm">
                    {bill.payment_method === 'subscription' ? bill.catering_amount : bill.total_amount} 
                    <span className="text-base opacity-30 ml-2">EGP</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={onClose}
                  className="w-full py-6 bg-slate-900 text-white font-black rounded-[2.5rem] shadow-xl hover:bg-black hover:-translate-y-1 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 group"
                >
                  <CheckCircle2 size={24} className="text-emerald-400" />
                  <span>تم الدفع والإنهاء</span>
                  <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
    );
};

