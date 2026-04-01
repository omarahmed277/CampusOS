import React, { useState, useEffect } from 'react';
import { Clock, LogOut, CheckCircle2, Coffee, ShoppingBag, Info, HelpCircle, User, Sparkles, CalendarDays, ChevronLeft, Receipt, X, Search, Package, RefreshCw, Plus, Cookie, Zap, Lock, Wind, PenTool, LayoutGrid, LayoutList, MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Modal } from '../components/ui';

// UI tabs options
type activeTabType = 'session' | 'catering' | 'about' | 'how_work';

export const WorkspaceLogin = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [cateringItems, setCateringItems] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [id: string]: { item: any, quantity: number } }>({});
  const [orderLoading, setOrderLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<activeTabType>('session');
  const [storeCategory, setStoreCategory] = useState<'all' | 'drinks' | 'snacks' | 'office'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [storeSearch, setStoreSearch] = useState('');
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
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
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
    fetchStoreItems();
  }, [branchId]);

  const fetchStoreItems = async () => {
    try {
      // Direct fetch from inventory favoring selling_price > 0
      let query = supabase
        .from('inventory')
        .select('*')
        .gt('selling_price', 0);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('name');
      
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
        image_url: e.item.image_url,
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
                          <div key={idx} className="flex justify-between items-center text-slate-300 bg-black/20 p-2 rounded-lg gap-3">
                              <div className="flex items-center gap-3">
                                {o.image_url && (
                                  <img src={o.image_url} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="" />
                                )}
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                     <span className="text-white">- {o.name} <span className="text-[#f78c2a] text-xs font-bold">(x{o.quantity || 1})</span></span>
                                  </div>
                                  {o.time && <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{new Date(o.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>}
                                </div>
                              </div>
                              <span className="font-bold text-white">{o.price} EGP</span>
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
                onClick={() => {
                  setShowCheckoutConfirm(true);
                }}
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

              {/* Step-by-step confirmation for Checkout */}
              {showCheckoutConfirm && (
                <Modal
                  isOpen={showCheckoutConfirm}
                  onClose={() => setShowCheckoutConfirm(false)}
                  title="تأكيد إنهاء الجلسة"
                  className="max-w-sm text-center"
                >
                  <div className="relative space-y-8 pb-4">
                    <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-500/5 animate-pulse mb-4 mt-4">
                      <HelpCircle size={48} className="text-rose-500" />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-2xl font-black text-white leading-tight">
                        هل أنت متأكد من إنهاء الجلسة؟
                      </h3>
                      <p className="text-slate-400 text-sm font-bold leading-relaxed px-4">
                        سيتم حساب الوقت الإجمالي وطلب إنهاء الجلسة من الـ Admin. لا يمكنك طلب خدمات إضافية بعد هذا الإجراء.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={() => {
                          setShowCheckoutConfirm(false);
                          handleCheckoutRequest();
                        }}
                        className="w-full h-16 bg-rose-600 text-white rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl shadow-rose-900/20 hover:bg-rose-500"
                      >
                        نعم، إنهاء الجلسة
                      </Button>
                      <Button
                        onClick={() => setShowCheckoutConfirm(false)}
                        className="w-full h-14 bg-white/5 text-slate-300 border border-white/10 rounded-2xl font-black text-md transition-all active:scale-95 hover:bg-white/10"
                      >
                        تراجع، ابقى هنا
                      </Button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}
          
          {activeTab === 'catering' && (
            <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in duration-500 pb-20 text-right">
                <div className="text-center space-y-2 mb-8">
                  <h2 className="text-3xl font-black text-white tracking-tight"> Cloud Store </h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cloud Store & Catering</p>
                </div>
                
                {/* Search & Categories Bar */}
                <div className="space-y-4">
                  <div className="relative group">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                    <input 
                      type="text"
                      placeholder="ابحث عن مشروب أو وجبة..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-[2rem] pr-12 pl-6 py-4 text-white font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar flex-row-reverse">
                    <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0 shadow-lg">
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <LayoutGrid size={20} />
                      </button>
                      <button 
                        onClick={() => setViewMode('list')}
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <LayoutList size={20} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                        {[
                        { id: 'all', label: 'الكل', icon: Sparkles },
                        { id: 'drinks', label: 'المشروبات', icon: Coffee },
                        { id: 'snacks', label: 'السناكس', icon: Cookie },
                        { id: 'office', label: 'أدوات مكتبية', icon: Package }
                        ].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setStoreCategory(cat.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-xs whitespace-nowrap transition-all border ${
                            storeCategory === cat.id 
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 scale-105' 
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                            }`}
                        >
                            <cat.icon size={14} />
                            {cat.label}
                        </button>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Cart Summary Header */}
                {Object.keys(cart).length > 0 && (
                   <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-[1px] rounded-[2rem] shadow-2xl shadow-indigo-600/30 group animate-in slide-in-from-top-4 duration-500">
                     <div className="bg-[#0B0F19]/90 backdrop-blur-3xl p-5 rounded-[1.95rem] flex justify-between items-center relative overflow-hidden">
                       <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
                       <div className="text-right">
                         <div className="flex items-center gap-2 mb-1">
                           <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                           <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest">سلة التسوق النشطة</p>
                         </div>
                         <p className="text-white font-black text-xl">
                            {(Object.values(cart) as any[]).reduce((sum, entry) => sum + ((entry.item.selling_price || entry.item.price) * entry.quantity), 0)}
                            <span className="text-[10px] opacity-40 mr-1.5 uppercase tracking-tighter">EGP Total</span>
                         </p>
                       </div>
                       <button 
                         onClick={handleCheckoutCart}
                         disabled={orderLoading}
                         className="h-14 px-8 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                       >
                         {orderLoading ? <RefreshCw className="animate-spin" size={18} /> : (
                           <>
                             إتمام الطلب
                             <CheckCircle2 size={20} />
                           </>
                         )}
                       </button>
                     </div>
                   </div>
                )}

                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "flex flex-col gap-3"}>
                  {cateringItems
                    .filter(item => {
                      const name = item.name.toLowerCase();
                      const matchesSearch = name.includes(storeSearch.toLowerCase());
                      const matchesCat = storeCategory === 'all' || 
                        (storeCategory === 'drinks' && (item.category === 'beverages' || item.category === 'مشروبات' || name.includes('قهوة') || name.includes('شاي') || name.includes('كولا') || name.includes('ماء'))) ||
                        (storeCategory === 'snacks' && (item.category === 'snacks' || item.category === 'سناكس' || name.includes('شيبس') || name.includes('بسكويت') || name.includes('كرواسون'))) ||
                        (storeCategory === 'office' && (item.category === 'office' || item.category === 'أدوات مكتبية'));
                      return matchesSearch && matchesCat;
                    })
                    .length > 0 ? (
                      cateringItems
                        .filter(item => {
                           const matchesSearch = item.name.toLowerCase().includes(storeSearch.toLowerCase());
                           const matchesCat = storeCategory === 'all' || 
                             (storeCategory === 'drinks' && (item.category === 'مشروبات' || item.category === 'beverages')) ||
                             (storeCategory === 'snacks' && (item.category === 'سناكس' || item.category === 'snacks')) ||
                             (storeCategory === 'office' && item.category === 'أدوات مكتبية');
                           return matchesSearch && matchesCat;
                        })
                        .map(item => {
                          const cartEntry = cart[item.id];
                          const isLowStock = (item.stock || 0) <= 5;
                          
                          // Dynamic Color/Icon logic
                          const name = item.name.toLowerCase();
                          const isDrink = name.includes('قهوة') || name.includes('نسكافيه') || name.includes('شاي') || name.includes('كولا') || name.includes('بيبسي') || name.includes('ماء') || name.includes('عصير');
                          const isSnack = name.includes('شيبس') || name.includes('بسكويت') || name.includes('كرواسون') || name.includes('مولتو') || name.includes('سندوتش');
                          const isOffice = item.category === 'أدوات مكتبية';

                          let typeColor = 'bg-indigo-500/10 text-indigo-400';
                          let typeGlow = 'from-indigo-500/20 to-blue-500/20';
                          let Icon = Coffee;

                          if (isDrink) {
                            typeColor = 'bg-blue-500/10 text-blue-400';
                            typeGlow = 'from-blue-500/30 to-cyan-500/10';
                            Icon = Coffee;
                          } else if (isSnack) {
                            typeColor = 'bg-amber-500/10 text-amber-400';
                            typeGlow = 'from-amber-500/30 to-orange-500/10';
                            Icon = Cookie;
                          } else if (isOffice) {
                            typeColor = 'bg-rose-500/10 text-rose-400';
                            typeGlow = 'from-rose-500/30 to-pink-500/10';
                            Icon = PenTool;
                          }

                          if (viewMode === 'list') {
                            return (
                                <div key={item.id} className="relative group/list">
                                    <div className="bg-[#0B0F19]/80 backdrop-blur-3xl border border-white/5 hover:border-white/10 rounded-2xl p-3 flex items-center gap-4 transition-all duration-300 hover:bg-white/5 shadow-lg text-right">
                                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/5 relative">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${typeGlow} opacity-30`}>
                                                    <Icon size={24} className="opacity-50" />
                                                </div>
                                            )}
                                            {isLowStock && (
                                                <div className="absolute inset-x-0 bottom-0 bg-rose-500 text-[8px] font-black py-0.5 text-center text-white uppercase z-10">رصيد قليل</div>
                                            )}
                                            
                                            {/* Category Icon Badge - Floating over image */}
                                            <div className={`absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center border border-white/10 backdrop-blur-md z-10 ${typeColor}`}>
                                               <Icon size={10} />
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <h4 className="text-white font-black text-sm line-clamp-1">{item.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-indigo-400 font-black text-sm">{item.selling_price} EGP</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{isDrink ? 'مشروبات' : isSnack ? 'سناكس' : isOffice ? 'أدوات' : 'أخرى'}</span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-2">
                                            {cartEntry ? (
                                                <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                                    <button onClick={() => removeFromCart(item.id)} className="p-2 hover:bg-rose-500/20 text-rose-400 transition-colors">
                                                        <X size={14} />
                                                    </button>
                                                    <span className="px-2 text-white font-black text-sm">{cartEntry.quantity}</span>
                                                    <button onClick={() => addToCart(item)} disabled={session?.status === 'checkout_requested'} className="p-2 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-30">
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => addToCart(item)} 
                                                    disabled={session?.status === 'checkout_requested' || (item.stock || 0) <= 0}
                                                    className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-20"
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                          }

                          return (
                            <div key={item.id} className="relative group/card h-full">
                              <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br transition-all duration-500 blur-xl opacity-0 group-hover/card:opacity-30 ${typeGlow}`} />
                              <div className="bg-[#0B0F19]/80 backdrop-blur-3xl border border-white/5 hover:border-white/10 rounded-[2.5rem] flex flex-col relative overflow-hidden h-full shadow-2xl transition-all duration-300 hover:-translate-y-1">
                                 {/* Product Image Section - Enhanced Cropping & Premium Look */}
                                 {/* Premium Product Image Container */}
                                 <div className="aspect-[4/3] relative overflow-hidden group/img border-b border-white/5 bg-slate-900/40">
                                    {item.image_url && item.image_url.trim() !== '' ? (
                                      <img 
                                        src={item.image_url} 
                                        alt={item.name} 
                                        className="w-full h-full object-cover object-center transition-all duration-1000 ease-out group-hover/card:scale-110 group-hover/card:rotate-2" 
                                      />
                                    ) : (
                                      <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${typeGlow} opacity-30`}>
                                         <Icon size={48} className="opacity-20 animate-pulse" />
                                         <span className="text-[8px] font-black uppercase mt-3 tracking-[0.3em] opacity-20">NO IMAGE</span>
                                      </div>
                                    )}
                                    
                                    {/* Category Icon Badge - Premium Float */}
                                    <div className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-xl shadow-2xl transform group-hover/card:scale-110 transition-all duration-500 ${typeColor}`}>
                                       <Icon size={18} />
                                       <div className="absolute inset-0 rounded-2xl bg-white/5 animate-pulse" />
                                    </div>
                                    
                                    {/* Glassmorphic Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-black/10 opacity-70 group-hover/card:opacity-40 transition-opacity duration-500" />
                                    
                                    {/* Premium Price Tag Overlay */}
                                    <div className="absolute top-4 left-4 z-20">
                                       <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform -rotate-2 group-hover/card:rotate-0 transition-all duration-500 hover:scale-110">
                                          <div className="text-xl font-black text-white leading-none flex items-baseline gap-1">
                                            {item.selling_price}
                                            <span className="text-[10px] text-indigo-400 uppercase tracking-tighter">EGP</span>
                                          </div>
                                       </div>
                                    </div>
 
                                    {isLowStock && (
                                       <div className="absolute bottom-4 right-4 z-20 bg-rose-500/90 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-xl animate-pulse border border-white/20 uppercase tracking-[0.2em] shadow-lg">
                                         رصيد محدود
                                       </div>
                                    )}
                                 </div>

                                <div className="p-6 flex flex-col flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className={`p-2.5 rounded-xl shadow-lg ${typeColor}`}>
                                      <Icon size={18}/>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-40">
                                       <LayoutGrid size={10} />
                                       <p className="text-[10px] font-bold uppercase tracking-widest">{isDrink ? 'مشروبات' : isSnack ? 'سناكس' : isOffice ? 'أدوات' : 'أخرى'}</p>
                                    </div>
                                  </div>

                                  <div className="text-right flex-1 mb-4">
                                      <p className="font-extrabold text-white text-lg leading-snug group-hover/card:text-indigo-300 transition-colors tracking-tight line-clamp-2">{item.name}</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {cartEntry ? (
                                    <div className="flex flex-1 items-center justify-between bg-white/5 p-1 rounded-2xl border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                                      <button 
                                        onClick={() => removeFromCart(item.id)} 
                                        className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center font-black transition-all hover:bg-rose-500 hover:text-white active:scale-90"
                                      >
                                        <X size={16} strokeWidth={4} />
                                      </button>
                                      <span className="text-xl text-white font-black">{cartEntry.quantity}</span>
                                      <button 
                                        onClick={() => addToCart(item)} 
                                        disabled={session?.status === 'checkout_requested'}
                                        className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center font-black transition-all hover:bg-emerald-500 hover:text-white active:scale-90 disabled:opacity-30"
                                      >
                                        <Plus size={16} strokeWidth={4} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                       onClick={() => addToCart(item)} 
                                       disabled={session?.status === 'checkout_requested' || (item.stock || 0) <= 0}
                                       className="w-full h-14 rounded-2xl bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white border border-white/5 hover:border-indigo-500 transition-all font-black text-sm flex items-center justify-center gap-3 disabled:opacity-20 disabled:pointer-events-none group/btn shadow-lg"
                                     >
                                       { (item.stock || 0) <= 0 ? 'نفذت الكمية' : (
                                          <>
                                            أضف لطلبك
                                            <div className="p-1.5 bg-white/10 rounded-lg group-hover/btn:bg-white/20 transition-colors">
                                              <Plus size={18} className="group-hover/btn:rotate-90 transition-transform"/>
                                            </div>
                                          </>
                                       )}
                                     </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                          )
                        })
                ) : (
                  <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-600 bg-white/2 backdrop-blur-md border border-white/5 border-dashed rounded-[3rem]">
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 relative">
                      <ShoppingBag size={48} className="text-slate-700 opacity-20" />
                      <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full animate-pulse" />
                    </div>
                    <p className="font-black text-xl text-slate-500">لم يتم العثور على نتائج</p>
                    <button onClick={() => { setStoreSearch(''); setStoreCategory('all'); }} className="mt-4 px-6 py-2 bg-indigo-600/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">العودة للرئيسية</button>
                  </div>
                )
              }
                </div>
                
                {session.orders?.length > 0 && (
                    <div className="mt-24 pt-12 border-t-2 border-dashed border-white/5 text-right animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <div className="flex flex-col items-center mb-10">
                          <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-[2rem] flex items-center justify-center mb-4 shadow-2xl shadow-indigo-500/10 border border-white/5">
                            <Receipt size={36}/>
                          </div>
                          <h3 className="font-black text-white text-3xl tracking-tight">قائمة الطلبات المستلمة</h3>
                          <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-[0.3em] mt-3 opacity-60">Verified Order Summary</p>
                        </div>

                        <div className="bg-[#0B0F19]/60 backdrop-blur-xl rounded-[3rem] p-10 border border-white/5 shadow-[inset_0_2px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[80px] -z-10" />
                            <div className="space-y-6">
                                {session.orders.map((o: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center group/order">
                                      <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex flex-col items-center justify-center text-[10px] font-black text-white border border-white/5 group-hover/order:bg-indigo-600 transition-colors">
                                          <span>{o.quantity}</span>
                                          <span className="opacity-40 text-[7px] uppercase leading-none mt-0.5">Qty</span>
                                        </div>
                                        <div className="text-right">
                                           <p className="text-white text-base font-black group-hover/order:text-indigo-300 transition-colors uppercase tracking-tight">{o.name}</p>
                                           <p className="text-[10px] text-slate-500 font-bold mt-0.5 underline decoration-indigo-500/30 underline-offset-4">{o.price} EGP per unit</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-emerald-400 font-mono text-lg font-black tracking-tighter">{(o.price * o.quantity).toFixed(2)}</span>
                                        <span className="text-[8px] text-slate-500 font-black rotate-90">EGP</span>
                                      </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-center">
                                <div className="text-right">
                                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                     <MapPin size={10} className="text-indigo-400" /> الفرع الرئيسي
                                  </p>
                                  <p className="text-4xl font-black text-white leading-none">
                                    {(session.catering_amount || 0).toLocaleString()}
                                    <span className="text-xs text-indigo-400 mr-3 font-bold uppercase tracking-tighter">Total EGP</span>
                                  </p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 flex flex-col items-center">
                                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</p>
                                   <div className="flex items-center gap-2 text-emerald-400">
                                      <CheckCircle2 size={16} />
                                      <span className="text-xs font-black uppercase">Confirmed</span>
                                   </div>
                                </div>
                            </div>
                        </div>
                        
                        <p className="text-center text-slate-600 text-[10px] font-bold mt-12 tracking-[0.3em] uppercase opacity-40">Thank you for visiting Cloud Space</p>
                    </div>
                )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="w-full max-w-lg mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-20">
              <div className="bg-[#0B0F19]/60 backdrop-blur-3xl border border-white/5 p-10 md:p-12 rounded-[2.5rem] relative overflow-hidden shadow-2xl text-right">
                <div className="absolute top-0 left-0 w-64 h-64 bg-[#1e75b9]/20 rounded-full blur-[100px] -translate-x-12 -translate-y-12" />
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#1ed788]/10 rounded-full blur-[80px] translate-x-20 translate-y-20" />
                
                <div className="relative z-10 text-center mb-12">
                   <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Cloud Co-Working</h2>
                   <div className="h-1.5 w-20 bg-indigo-500 mx-auto rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                   <p className="text-slate-400 mt-6 font-bold leading-relaxed max-w-sm mx-auto">
                      المكان الأمثل الذي يجمع بين هدوء التركيز، وحيوية الإبداع، وخدمات الضيافة الراقية.
                   </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                  {[
                    { title: 'إنترنت فائق', desc: 'سرعات تصل لـ 200 ميجا لتحميل شغلك بلا توقف.', icon: Zap, color: 'text-indigo-400' },
                    { title: 'هدوء كامل', desc: 'عزل صوتي تام يضمن لك أقصى درجات التركيز.', icon: Wind, color: 'text-blue-400' },
                    { title: 'أمان وخصوصية', desc: 'خزائن خاصة ونظام غرف اجتماعات محمي.', icon: Lock, color: 'text-emerald-400' },
                    { title: 'ضيافة مميزة', desc: 'مشروبات وسناكس من اختيارك طوال اليوم.', icon: Coffee, color: 'text-amber-400' }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 p-6 rounded-[2rem] group hover:bg-white/10 transition-all duration-300">
                      <item.icon className={`${item.color} mb-4 group-hover:scale-110 transition-transform`} size={28} />
                      <h4 className="text-white font-black text-lg mb-2">{item.title}</h4>
                      <p className="text-slate-500 text-xs font-bold leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 text-center relative z-10">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Designed for Pioneers</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'how_work' && (
            <div className="w-full max-w-lg mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 text-right pb-20">
              <div className="bg-[#0B0F19]/60 backdrop-blur-3xl border border-white/5 p-12 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#1ed788]/20 rounded-full blur-[100px] translate-x-20 -translate-y-20" />
                
                <div className="text-center mb-16 relative z-10">
                  <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">دليل الاستخدام</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Cloud Membership Roadmap</p>
                </div>

                <div className="space-y-12 relative z-10">
                  {[
                     { title: 'تسجيل الدخول', desc: 'بمجرد كتابة الكود الخاص بك، سيبدأ العداد في العمل تلقائياً.', icon: Clock, color: 'bg-indigo-500' },
                     { title: 'نظام محاسبة الدقيقة', desc: 'ساعة العمل بـ 10 جنيهات فقط، والحساب يتم بالدقيقة لضمان حقك.', icon: Zap, color: 'bg-blue-500' },
                     { title: 'الحد الأدنى للدخول', desc: 'أقل تكلفة للزيارة هي 10 جنيهات فقط (أول ساعة).', icon: User, color: 'bg-emerald-500' },
                     { title: 'طلبات الكافيتريا', desc: 'كل ما تطلبه من المتجر يضاف فوراً لفاتورتك وتتم المحاسبة عند الخروج.', icon: ShoppingBag, color: 'bg-amber-500' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-6 relative">
                      {idx !== 3 && <div className="absolute top-12 bottom-[-48px] right-6 w-1 bg-gradient-to-b from-white/10 to-transparent rounded-full" />}
                      <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center font-black text-white shadow-xl shadow-black/20 shrink-0 z-10 relative group-hover:scale-110 transition-transform`}>
                        <item.icon size={22} strokeWidth={2.5} />
                      </div>
                      <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex-1 hover:bg-white/10 transition-all">
                        <strong className="text-white text-lg font-black block mb-2">{item.title}</strong>
                        <span className="text-sm text-slate-400 font-bold leading-relaxed block">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-16 text-center">
                   <button 
                     onClick={() => setActiveTab('session')} 
                     className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                   >
                     فهمت، لنبدأ الجلسة
                   </button>
                </div>
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

        {/* Floating Checkout Button */}
        {activeTab === 'catering' && Object.keys(cart).length > 0 && (
          <div className="fixed bottom-24 left-6 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-500">
             <button
                onClick={handleCheckoutCart}
                disabled={orderLoading}
                className="group relative flex items-center gap-4 bg-indigo-600 hover:bg-indigo-500 text-white pl-6 pr-4 py-4 rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.4)] transition-all active:scale-95 disabled:opacity-50"
             >
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition-opacity" />
                
                <div className="relative text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 leading-none mb-1">تأكيد الشراء</p>
                  <p className="text-lg font-black leading-none">إتمام الطلب</p>
                </div>

                <div className="relative w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                  {orderLoading ? (
                    <RefreshCw className="animate-spin" size={24} />
                  ) : (
                    <div className="relative">
                      <ShoppingBag size={24} />
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-indigo-600">
                        {Object.values(cart).reduce((s, e: any) => s + e.quantity, 0)}
                      </div>
                    </div>
                  )}
                </div>
             </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0B0F19] flex items-center justify-center font-['Cairo'] text-right p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#1e75b9]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#1ed788]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] bg-[#f78c2a]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="bg-[#0B0F19]/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-8 md:p-12 w-full max-w-md relative z-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 fade-in duration-1000 ring-1 ring-white/10">
        <div className="text-center mb-8 group">
          <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-3xl mx-auto flex items-center justify-center mb-4 border border-white/10 shadow-2xl p-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
             <img src="/logo.png" alt="Cloud Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Cloud Co-Working</h1>
          <div className="h-1 w-10 bg-indigo-500 mx-auto rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
        </div>

        {/* Auth Tabs */}
        {!isForgotCode && (
          <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/10 mb-8 relative">
            <div 
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-indigo-600 rounded-xl transition-all duration-500 ease-in-out shadow-lg shadow-indigo-600/30"
              style={{ 
                left: isSignUp ? '6px' : 'calc(50% + 3px)',
                right: isSignUp ? 'calc(50% + 3px)' : '6px'
              }}
            />
            <button
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`relative z-10 flex-1 py-3 text-sm font-black transition-colors duration-300 ${!isSignUp ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`relative z-10 flex-1 py-3 text-sm font-black transition-colors duration-300 ${isSignUp ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              إنشاء حساب
            </button>
          </div>
        )}

        {isForgotCode && (
           <div className="text-center mb-8">
             <p className="text-slate-400 font-bold text-sm tracking-wide">استعادة كود الدخول</p>
           </div>
        )}

        {isForgotCode ? (
          <form onSubmit={handleForgotCode} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
             {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">البريد الإلكتروني أو رقم الهاتف</label>
              <div className="relative group">
                <input
                  type="text"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold focus:outline-none focus:border-[#f78c2a] focus:ring-4 focus:ring-[#f78c2a]/10 transition-all placeholder:text-slate-600"
                  placeholder="01xxxxxxxxx أو example@mail.com"
                  dir="auto"
                />
              </div>
              <div className="flex items-start gap-2 bg-[#f78c2a]/10 p-4 rounded-2xl border border-[#f78c2a]/20 mt-4">
                 <Info size={16} className="text-[#f78c2a] shrink-0 mt-0.5" />
                 <p className="text-[10px] text-slate-300 font-bold leading-relaxed">
                   تنبيه: سيتم إرسال الكود فوراً إلى بريدك الإلكتروني المسجل لدينا لتتمكن من الدخول.
                 </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-4">
              <button
                type="submit"
                disabled={loading || !forgotEmail}
                className="w-full h-16 bg-[#f78c2a] hover:bg-[#e67b1a] disabled:opacity-50 text-white rounded-2xl font-black text-lg transition-all shadow-[0_20px_40px_rgba(247,140,42,0.2)] active:scale-95 flex items-center justify-center gap-3"
              >
                {loading ? <RefreshCw className="animate-spin" /> : (
                  <>
                    <span>إرسال الكود للبريد</span>
                    <Zap size={20} />
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => { setIsForgotCode(false); setError(''); }}
                className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft size={14} /> العودة لتسجيل الدخول
              </button>
            </div>
          </form>
        ) : isSignUp ? (
          <form onSubmit={handleSignUp} className="space-y-5 animate-in slide-in-from-left-4 duration-500">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">الاسم بالكامل</label>
              <div className="relative group">
                <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                  placeholder="أحمد محمد"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">رقم الهاتف</label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                   className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                  placeholder="example@mail.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 animate-in fade-in duration-700">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">تاريخ الميلاد</label>
                <div className="relative group/date">
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/5 rounded-lg border border-white/10 text-indigo-400 pointer-events-none group-focus-within/date:bg-indigo-600/20 group-focus-within/date:text-indigo-200 transition-all">
                      <CalendarDays size={16} />
                   </div>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-14 pl-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer [color-scheme:dark]"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">الجامعة / الكلية</label>
                <select
                  value={college}
                  onChange={(e) => {
                    setCollege(e.target.value);
                    setShowCustomCollege(e.target.value === 'أخرى');
                  }}
                  className="w-full h-14 bg-[#111827] border border-white/10 rounded-2xl px-5 text-white font-bold focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#0B0F19]">اختر الجامعة</option>
                  {colleges.map((c) => (
                    <option key={c} value={c} className="bg-[#0B0F19]">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {showCustomCollege && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-[#f78c2a] uppercase tracking-[0.2em] block mr-1">اسم الجامعة الأخرى</label>
                <input
                  type="text"
                  required
                  value={customCollege}
                  onChange={(e) => setCustomCollege(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white font-bold focus:outline-none focus:border-[#f78c2a] focus:ring-4 focus:ring-[#f78c2a]/10 transition-all placeholder:text-slate-600"
                  placeholder="اكتب اسم الجامعة هنا..."
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">النوع</label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setGender('Male')}
                  className={`py-3 rounded-xl font-black text-sm transition-all ${gender === 'Male' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  ذكر
                </button>
                <button
                  type="button"
                  onClick={() => setGender('Female')}
                  className={`py-3 rounded-xl font-black text-sm transition-all ${gender === 'Female' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  أنثى
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !fullName || !phoneNumber}
                className="w-full bg-[#1ed788] hover:bg-[#1bbd77] disabled:opacity-50 text-[#0B0F19] rounded-2xl py-5 font-black text-xl transition-all shadow-[0_20px_40px_rgba(30,215,136,0.2)] active:scale-95 flex items-center justify-center gap-3 group"
              >
                {loading ? <RefreshCw className="animate-spin" size={24} /> : (
                  <>
                    <span>تسجيل وتأكيد الحساب</span>
                    <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-center uppercase">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">كود المستخدم</label>
              <div className="relative group">
                <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                <input
                  type="text"
                  required
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700 uppercase tracking-[0.2em]"
                  placeholder="C0001"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mr-1">رقم الهاتف</label>
              <div className="relative group">
                <Wind size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400 rotate-90" />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-12 pl-5 text-white font-bold text-left focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex flex-col gap-5 mt-8 text-center border-t border-white/5 pt-6">
              <button
                type="button"
                onClick={() => { setIsForgotCode(true); setIsSignUp(false); setError(''); }}
                className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest transition-all hover:scale-105"
              >
                نسيت كود الدخول؟ <span className="text-[#f78c2a] underline underline-offset-8 decoration-2 ml-2">استعادة الكود</span>
              </button>
            </div>
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !userCode || !phoneNumber}
                className="w-full h-16 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xl transition-all shadow-[0_20px_40px_rgba(79,70,229,0.2)] active:scale-95 group"
              >
                {loading ? <RefreshCw className="animate-spin" /> : (
                  <>
                    <span>بدء الجلسة الآن</span>
                    <ArrowRight size={22} className="group-hover:translate-x-[-4px] transition-transform" />
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </div>
      {finalBill && (
        <Modal
          isOpen={!!finalBill}
          onClose={() => setFinalBill(null)}
          className="max-w-md p-0 overflow-hidden"
        >
          <FinalReceiptModal bill={finalBill} onClose={() => setFinalBill(null)} />
        </Modal>
      )}

      {/* Registration Success Modal */}
      <Modal
        isOpen={showSuccessModal && !!regSuccessData}
        onClose={() => setShowSuccessModal(false)}
        title="تم التسجيل بنجاح! 🎉"
        className="max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none"
      >
        <div className="bg-[#0B0F19] rounded-[3.5rem] p-10 text-center space-y-10 border border-white/10 relative overflow-hidden shadow-2xl scale-110">
          {/* Animated Background Orbs */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -z-10 animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -z-10" />
          
          <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto text-[#1ed788] animate-bounce shadow-inner border border-emerald-500/20">
             <CheckCircle2 size={48} />
          </div>

          <div className="space-y-3">
             <h2 className="text-4xl font-black text-white tracking-tight leading-tight">مرحباً بك في Cloud!</h2>
             <p className="text-slate-400 font-bold text-lg px-8">
               أهلاً بك <span className="text-emerald-400">{regSuccessData?.name}</span>. لقد تم إنشاء حسابك بنجاح.
             </p>
          </div>

          <div className="relative group p-10 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
             <div className="space-y-4">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">كود الدخول الخاص بك</p>
                <div className="bg-black/40 py-8 px-6 rounded-[2rem] border-2 border-dashed border-indigo-500/30">
                   <span className="text-6xl font-black text-white font-mono tracking-[0.2em]">{regSuccessData?.code}</span>
                </div>
                <div className="flex items-center gap-4 text-right bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                   <Info size={20} className="text-indigo-400 shrink-0" />
                   <p className="text-[11px] font-black text-slate-300 leading-relaxed">
                     يرجى أخذ لقطة شاشة (Screenshot) لهذا الكود. ستستخدمه في كل مرة تدخل فيها مساحة العمل.
                   </p>
                </div>
             </div>
          </div>

          <button
            onClick={() => {
              setShowSuccessModal(false);
              setUserCode(regSuccessData?.code || '');
              setIsSignUp(false);
            }}
            className="w-full h-20 bg-white text-[#0B0F19] rounded-[2rem] font-black text-2xl hover:bg-emerald-400 transition-all shadow-2xl active:scale-95 group"
          >
            ابدأ رحلتك الآن
          </button>
        </div>
      </Modal>
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
        <div className="space-y-8 text-right p-2">
            {/* Header section moved to Modal title or rendered here if Modal title is empty */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-8">
              <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                <Receipt size={32} />
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-black text-slate-900 leading-tight">فاتورة الزيارة</h2>
                <p className="text-indigo-600 text-[10px] font-black tracking-widest mt-1 uppercase">Cloud Session Receipt</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-50/50 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
                
                {/* Client Info Section */}
                <div className="border-b-2 border-dashed border-slate-200 pb-6 text-center">
                  <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest">مرحباً بك مجدداً</p>
                  <p className="text-3xl font-black text-slate-900">{bill.customers?.full_name || 'زائر متميز'}</p>
                  <p className="text-lg font-black text-indigo-600 bg-white inline-block px-5 py-1.5 rounded-2xl shadow-sm border border-indigo-50 mt-4 font-mono">{bill.user_code}</p>
                </div>

                <div className="space-y-4 font-bold text-slate-600">
                  <div className="flex justify-between items-center bg-white/70 p-5 rounded-2xl border border-white shadow-sm">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">وقت الاستخدام</span>
                    <span className="text-slate-900 font-black text-lg">
                       <span className="text-indigo-600">{Math.floor((bill.total_minutes || 0) / 60)}</span>h <span className="text-indigo-600">{Number(bill.total_minutes || 0) % 60}</span>m
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white/70 p-5 rounded-2xl border border-white shadow-sm text-right">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تكلفة الجلسة</span>
                    <span className={`font-black text-lg ${bill.payment_method === 'subscription' ? 'text-emerald-600' : 'text-slate-900'}`}>
                       {bill.payment_method === 'subscription' ? '✓ مخصوم من الاشتراك' : `${Number(bill.total_amount || 0) - (Number(bill.catering_amount) || 0)} EGP`}
                    </span>
                  </div>

                  {bill.payment_method === 'subscription' && (
                    <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px] animate-pulse" />
                      <div className="flex justify-between items-center relative z-10">
                        <div className="text-left">
                          <p className="text-3xl font-black text-white">{loading ? '...' : sub ? (sub.total_hours - sub.used_hours).toFixed(1) : '0.0'} <span className="text-[10px] opacity-40 uppercase tracking-widest ml-1">H Left</span></p>
                          <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mt-1">
                            Expires: {sub ? new Date(sub.end_date).toLocaleDateString('ar-EG') : '...'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Subscription</p>
                            <Sparkles size={12} className="text-amber-400" />
                          </div>
                          <p className="text-sm font-black whitespace-nowrap">{(Number(bill.total_minutes || 0) / 60).toFixed(2)}h consumed</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center bg-white/70 p-5 rounded-2xl border border-white shadow-sm">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">رصيد الكافيتريا</span>
                    <span className="text-slate-900 font-black text-lg">{bill.catering_amount || 0} <span className="text-xs opacity-30">EGP</span></span>
                  </div>
                </div>

                {bill.orders && bill.orders.length > 0 && (
                  <div className="mt-10 pt-8 border-t-2 border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.3em] text-center">أصناف الضيافة</p>
                    <div className="space-y-3">
                      {bill.orders.map((o: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-black bg-white/80 backdrop-blur-sm rounded-[1.25rem] p-4 border border-white shadow-sm gap-4 group/item hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            {o.image_url ? (
                              <img src={o.image_url} className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100" alt="" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
                                    <ShoppingBag size={18} />
                                </div>
                            )}
                            <div className="text-right">
                                <span className="text-slate-800 text-sm block">{o.name}</span>
                                <span className="text-indigo-400 text-[10px] uppercase">Quantity x{o.quantity}</span>
                            </div>
                          </div>
                          <span className="text-slate-900 font-mono text-base">{o.price} <span className="text-[8px] opacity-30">EGP</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-10 mt-6 border-t border-slate-200 flex flex-col items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">المبلغ المستحق للدفع</span>
                  <div className="relative">
                    <div className="absolute inset-x-0 bottom-1 h-3 bg-emerald-500/10 -rotate-1 rounded-full blur-[2px]" />
                    <p className="text-6xl font-black text-emerald-600 relative z-10 italic">
                      {bill.payment_method === 'subscription' ? bill.catering_amount : bill.total_amount} 
                      <span className="text-xl opacity-30 ml-3 not-italic">EGP</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={onClose}
                  className="w-full h-20 bg-slate-900 text-white font-black rounded-[2rem] shadow-2xl hover:bg-black active:scale-95 transition-all text-xl flex items-center justify-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                    <CheckCircle2 size={24} className="text-white" />
                  </div>
                  <span>إنهاء الحضور الآن</span>
                </Button>
              </div>
            </div>
        </div>
    );
};

