import React, { useState, useEffect } from 'react';
import { Clock, LogOut, CheckCircle2, Coffee, ShoppingBag, Info, HelpCircle, User, Sparkles, CalendarDays, ChevronLeft, Receipt, X, Search, Package, RefreshCw, Plus, Cookie, Zap, Lock, Wind, PenTool, LayoutGrid, LayoutList, MapPin, ArrowRight, CreditCard, Phone, Users, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Modal } from '../components/ui';
import { LeaderDashboard } from '../components/workspace/LeaderDashboard';
import { FinalReceiptModal } from '../components/workspace/FinalReceiptModal';
import { CateringStore } from '../components/workspace/CateringStore';
import { ProfileSection } from '../components/workspace/ProfileSection';
import { SessionDashboard } from '../components/workspace/SessionDashboard';
import { LandingForms } from '../components/workspace/LandingForms';
import { WorkspaceMainUI } from '../components/workspace/WorkspaceMainUI';
import { RegistrationSuccessModal } from '../components/workspace/RegistrationSuccessModal';

// UI tabs options
type activeTabType = 'session' | 'catering' | 'profile' | 'about' | 'how_work';



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
  const [profileData, setProfileData] = useState<any>(null);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Dynamic Loyalty Settings
  const [ptsPerHour, setPtsPerHour] = useState(10);
  const [cbRatio, setCbRatio] = useState(4);

  const [college, setCollege] = useState('');
  const [customCollege, setCustomCollege] = useState('');
  const [showCustomCollege, setShowCustomCollege] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [regSuccessData, setRegSuccessData] = useState<{name: string, code: string, email: string} | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [isLeaderPortal, setIsLeaderPortal] = useState(false);
  const [leaderCode, setLeaderCode] = useState('');
  const [leaderData, setLeaderData] = useState<{
    company: any;
    contract: any;
    members: any[];
  } | null>(null);
  
  const [userCompany, setUserCompany] = useState<any>(null);
  const [currentUserMember, setCurrentUserMember] = useState<any>(null);
  const [userCompanyMembers, setUserCompanyMembers] = useState<any[]>([]);
  const [isUserLeader, setIsUserLeader] = useState(false);
  const [companyContract, setCompanyContract] = useState<any>(null);

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

    // Remember Me: Load credentials if exists
    const rememberedCode = localStorage.getItem('remembered_user_code');
    const rememberedPhone = localStorage.getItem('remembered_user_phone');
    if (rememberedCode && rememberedPhone) {
      setUserCode(rememberedCode);
      setPhoneNumber(rememberedPhone);
      setRememberMe(true);
    }
  }, [branchId]);

  const fetchStoreItems = async () => {
    try {
      // Direct fetch from inventory favoring selling_price > 0 and stock > 0
      let query = supabase
        .from('inventory')
        .select('*, catering_items(is_active)')
        .gt('selling_price', 0)
        .gt('stock', 0);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      const activeItems = (data || []).filter((item: any) => {
          if (item.stock <= 0) return false; // Auto-hide ended products
          
          if (Array.isArray(item.catering_items) && item.catering_items.length > 0) {
              return item.catering_items[0].is_active !== false;
          } else if (item.catering_items && !Array.isArray(item.catering_items)) {
              return (item.catering_items as any).is_active !== false;
          }
          if (item.is_active === false) return false;
          return true;
      });
      setCateringItems(activeItems);
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
      const subtotal = cartEntries.reduce((sum, entry) => sum + ((Number(entry.item.selling_price) || Number(entry.item.price) || 0) * (Number(entry.quantity) || 1)), 0);
      
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
                        price_at_purchase: Number(entry.item.selling_price) || Number(entry.item.price) || 0
                    });
              }
          }
      } catch (tableErr) {
          console.warn("Structured order tables (orders/order_items) not found. Falling back to JSON storage.");
      }

      // 3. Sync to Corporate Logs (if user is in a company)
      if (userCompany && currentUserMember && companyContract) {
         for (const entry of cartEntries) {
            await (supabase as any)
              .from('catering_orders')
              .insert({
                  company_id: userCompany.id,
                  member_id: currentUserMember.id,
                  contract_id: companyContract.id,
                  item_name: entry.item.name,
                  price: Number(entry.item.selling_price) || Number(entry.item.price) || 0,
                  quantity: Number(entry.quantity) || 1
              });
         }
      }

      // 4. Deduct Inventory (Always works if inventory table exists)
      for (const entry of cartEntries) {
          const invId = entry.item.id;
          const currentStock = Number(entry.item.stock) || 0;
          await (supabase as any)
            .from('inventory')
            .update({ stock: Math.max(0, currentStock - (Number(entry.quantity) || 1)) })
            .eq('id', invId);
      }

      // 4. Update Session JSON for legacy compatibility and reliable billing
      const currentOrders = Array.isArray(session.orders) ? session.orders : [];
      const currentCateringAmount = Number(session.catering_amount) || 0;
      
      const newOrders = [...currentOrders, ...cartEntries.map(e => ({
        id: e.item.id,
        name: e.item.name,
        image_url: e.item.image_url,
        price: Number(e.item.selling_price) || Number(e.item.price) || 0,
        quantity: e.quantity,
        time: new Date().toISOString()
      }))];
      
      const newAmount = Number(currentCateringAmount) + Number(subtotal);
      
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
    if (session && (session.status === 'active' || session.status === 'paused' || session.status === 'pause_requested' || session.status === 'checkout_requested')) {
      interval = setInterval(() => {
        const start = new Date(session.start_time).getTime();
        const currentRefTime = session.is_paused ? new Date(session.last_pause_start).getTime() : new Date().getTime();
        const totalPausedMs = (Number(session.total_paused_minutes) || 0) * 60000;
        const diff = Math.max(0, currentRefTime - start - totalPausedMs);
        if (isNaN(diff)) {
          setElapsedTime('00:00:00');
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session, session?.total_paused_minutes, session?.is_paused, session?.last_pause_start]);

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

  const checkCompanyMembership = async (customerId: string, customerPhone: string) => {
    try {
      // 1. First, check if leader (by phone or email)
      const cleanPhone = customerPhone.replace(/\s+/g, '').replace(/^(\+20|0)/, '');
      const { data: leaderComp } = await (supabase as any)
        .from('companies')
        .select('*')
        .or(`leader_phone.ilike.%${cleanPhone}`);

      let foundCompany = null;
      let isLeader = false;

      if (leaderComp && leaderComp.length > 0) {
        foundCompany = leaderComp[0];
        isLeader = true;
      } else {
        // 2. Check if member
        const { data: member } = await (supabase as any)
          .from('company_members')
          .select('*, companies(*)')
          .eq('customer_id', customerId)
          .maybeSingle();
        
        if (member && member.companies) {
          foundCompany = member.companies;
          isLeader = false;
        }
      }

      if (foundCompany) {
        setUserCompany(foundCompany);
        setIsUserLeader(isLeader);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // 1. Concurrent Fetch (Logs + Active Data)
        const [membersRes, sessionsRes, ordersRes, activeSessionsRes] = await Promise.all([
          (supabase as any).from('company_members').select('*, customers(full_name, phone, code, email, created_at)').eq('company_id', foundCompany.id),
          (supabase as any).from('space_sessions').select('*').eq('company_id', foundCompany.id).gte('check_in', startOfMonth),
          (supabase as any).from('catering_orders').select('*').eq('company_id', foundCompany.id).gte('created_at', startOfMonth),
          (supabase as any).from('workspace_sessions').select('*').in('status', ['active', 'paused', 'pause_requested', 'checkout_requested'])
        ]);

        // 2. Identify the current logged-in user within the member roster
        const me = (membersRes.data || []).find((m: any) => m.customer_id === customerId);
        setCurrentUserMember(me);

        // 3. Perform Live Aggregation for every member
        const aggregatedMembers = (membersRes.data || []).map((m: any) => {
          // Logged historical usage
          const mSessions = (sessionsRes.data || []).filter((s: any) => s.member_id === m.id);
          const mOrders = (ordersRes.data || []).filter((o: any) => o.member_id === m.id);
          
          // Live session usage (Active)
          const mActive = (activeSessionsRes.data || []).find((as: any) => as.customer_id === m.customer_id);
          let activeSpaceMins = 0;
          let activeCateringAmt = 0;
          
          if (mActive) {
            const start = new Date(mActive.start_time);
            activeSpaceMins = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
            activeCateringAmt = Number(mActive.catering_amount) || 0;
          }

          const totalCatering = mOrders.reduce((sum: number, o: any) => sum + (Number(o.price) * (Number(o.quantity) || 1)), 0);
          const totalSpace = mSessions.reduce((sum: number, s: any) => sum + (Number(s.duration_hours) * 60 || 0), 0);

          return {
            ...m,
            space_minutes: totalSpace + activeSpaceMins,
            catering_consumption: totalCatering + activeCateringAmt
          };
        });

        setUserCompanyMembers(aggregatedMembers);
        
        // 4. Fetch the contract for the current financial cycle
        const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const { data: contract } = await (supabase as any)
          .from('monthly_contracts')
          .select('*')
          .eq('company_id', foundCompany.id)
          .eq('month', monthStr)
          .maybeSingle();
        setCompanyContract(contract);
      }
    } catch (err) {
      console.error("Company check error:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/^(\+20|0)/, '');
      const cleanCode = userCode.trim().toUpperCase();

      // 1. Resolve Code to Customer Identity
      let targetCustomer: any = null;

      // Try main database code first
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('code', cleanCode)
        .ilike('phone', `%${cleanPhone}`)
        .maybeSingle();

      if (customerData) {
        targetCustomer = customerData;
      } else {
        // Try company-specific member code
        const { data: memberData } = await supabase
          .from('company_members')
          .select('*, customers(*)')
          .eq('unique_code', cleanCode)
          .maybeSingle();

        if (memberData && memberData.customers) {
          // Double check phone for security
          const customerPhone = memberData.customers.phone || '';
          const cleanCustPhone = customerPhone.replace(/\s+/g, '').replace(/^(\+20|0)/, '');
          if (cleanCustPhone.includes(cleanPhone) || cleanPhone.includes(cleanCustPhone)) {
             targetCustomer = memberData.customers;
          }
        }
      }

      if (!targetCustomer) {
        throw new Error('بيانات المستخدم غير صحيحة، تأكد من كود الدخول ورقم الهاتف.');
      }

      // 2. Check for an active session for this specific customer
      const { data: existingSess } = await supabase
        .from('workspace_sessions')
        .select('*, customers(full_name)')
        .eq('customer_id', targetCustomer.id)
        .in('status', ['active', 'checkout_requested', 'pause_requested', 'paused'])
        .maybeSingle();

      // Handle Remember Me Persistence
      if (rememberMe) {
        localStorage.setItem('remembered_user_code', cleanCode);
        localStorage.setItem('remembered_user_phone', cleanPhone);
      } else {
        localStorage.removeItem('remembered_user_code');
        localStorage.removeItem('remembered_user_phone');
      }

      if (existingSess) {
        localStorage.setItem('workspace_session_id', existingSess.id);
        
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

      // 3. Create new session if no active one exists
      const newSession: any = {
        customer_id: targetCustomer.id,
        user_code: targetCustomer.code, // Always use main code for session tracking
        phone_number: targetCustomer.phone,
        start_time: new Date().toISOString(),
        status: 'active',
        branch_id: branchId
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
              orders: newData.orders,
              end_time: newData.end_time || prev.end_time
            };
          });
          
          // Re-fetch customer data if session updated (to sync points/cashback)
          fetchProfileData();
        }
      )
      .on('broadcast', { event: 'session_updated' }, (payload) => {
        const newData = payload.payload;
        setSession((prev: any) => {
          if (!prev) return null;
          
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
            total_amount: newData.total_amount || prev.total_amount,
            total_minutes: newData.total_minutes || prev.total_minutes,
            catering_amount: newData.catering_amount || prev.catering_amount,
            orders: newData.orders || prev.orders,
            end_time: newData.end_time || prev.end_time
          } as any;
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
    setProfileData(null);
    setActiveSub(null);
  };

  const handleRequestPause = async (newStatus: string) => {
    if (!session) return;
    try {
        const { error } = await (supabase as any)
            .from('workspace_sessions')
            .update({ status: newStatus })
            .eq('id', session.id);
        
        if (error) throw error;
        setSession({ ...session, status: newStatus });
    } catch (err: any) {
        alert("فشل الطلب: " + err.message);
    }
  };

  const handleResumeSession = async () => {
    if (!session || !session.last_pause_start) return;
    try {
        const now = new Date();
        const pauseStart = new Date(session.last_pause_start);
        const diffMins = Math.max(0, (now.getTime() - pauseStart.getTime()) / 60000);
        const newTotalPaused = (Number(session.total_paused_minutes) || 0) + diffMins;

        const { error } = await (supabase as any)
            .from('workspace_sessions')
            .update({ 
                status: 'active',
                is_paused: false,
                last_pause_start: null,
                total_paused_minutes: newTotalPaused
            })
            .eq('id', session.id);
            
        if (error) throw error;
        setSession({ 
            ...session, 
            status: 'active', 
            is_paused: false, 
            last_pause_start: null, 
            total_paused_minutes: newTotalPaused 
        });
    } catch (err: any) {
        alert("فشل استكمال الجلسة: " + err.message);
    }
  };

  const handleRequestCheckout = async () => {
    if (!session) return;
    setLoading(true);
    try {
        const { error } = await (supabase as any)
            .from('workspace_sessions')
            .update({ status: 'checkout_requested' })
            .eq('id', session.id);
            
        if (error) throw error;
        setSession({ ...session, status: 'checkout_requested' });
    } catch (err: any) {
        alert("فشل طلب إنهاء الجلسة: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleLeaderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
       // 1. Find Company
       const { data: company, error: compErr } = await (supabase as any)
          .from('companies')
          .select('*')
          .eq('company_code', leaderCode.trim().toUpperCase())
          .maybeSingle();

       if (compErr || !company) throw new Error('كود الشركة غير صحيح');

       // 2. Get current month's contract
       const now = new Date();
       const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
       
       const { data: contract } = await (supabase as any)
          .from('monthly_contracts')
          .select('*')
          .eq('company_id', company.id)
          .eq('month', monthStr)
          .maybeSingle();

       // 3. Get Members and their stats
       const { data: members } = await (supabase as any)
          .from('company_members')
          .select('*')
          .eq('company_id', company.id);

       const memberIds = (members || []).map((m: any) => m.customer_id).filter(Boolean);
       
       // Calculate member consumption
       const startOfMonth = `${monthStr}-01`;
       const { data: orders } = await (supabase as any)
          .from('catering_orders')
          .select('member_id, amount')
          .eq('company_id', company.id)
          .gte('created_at', startOfMonth);

       const { data: sessions } = await (supabase as any)
          .from('space_sessions')
          .select('customer_id, total_hours, total_price')
          .in('customer_id', memberIds)
          .gte('created_at', startOfMonth);

       const enrichedMembers = (members || []).map((m: any) => {
          const mOrders = (orders || []).filter((o: any) => o.member_id === m.id);
          const mSessions = (sessions || []).filter((s: any) => s.customer_id === m.customer_id);
          return {
             ...m,
             catering_consumption: mOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0),
             space_minutes: mSessions.reduce((s, o) => s + (Number(o.total_hours) || 0), 0) * 60,
             cost: mSessions.reduce((s, o) => s + (Number(o.total_price) || 0), 0),
          };
       });

       setLeaderData({ company, contract, members: enrichedMembers });
       setActiveTab('profile'); // Jump to profile to show the data
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  const fetchProfileData = async () => {
    if (!session?.customer_id) return;
    try {
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('*, subscriptions(*)')
        .eq('id', session.customer_id)
        .single();
      
      if (!custErr && customer) {
        setProfileData(customer);
        const sub = customer.subscriptions?.find((s: any) => s.status === 'Active' && new Date(s.end_date) >= new Date());
        setActiveSub(sub || null);

        // Fetch cumulative hours
        const { data: sessionsData } = await supabase
            .from('workspace_sessions')
            .select('total_minutes')
            .eq('customer_id', session.customer_id)
            .eq('status', 'completed');
        
        if (sessionsData) {
            const total = sessionsData.reduce((sum, s) => sum + (Number(s.total_minutes) || 0), 0);
            setTotalMinutes(total);
        }
        
        // Sync company membership
        await checkCompanyMembership(session.customer_id, customer.phone);
      }
    } catch (err) {
      console.error("Profile sync error:", err);
    }
  };

  useEffect(() => {
    if (session?.customer_id && activeTab === 'profile') {
        fetchProfileData();
    }
  }, [session?.customer_id, activeTab]);

  useEffect(() => {
    // Initial company check on session restore
    if (session?.customer_id) {
       checkCompanyMembership(session.customer_id, session.phone_number);
    }
  }, [session?.id]);

  useEffect(() => {
    const fetchLoyaltySettings = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['points_per_hour', 'cashback_ratio']);
      if (data) {
        const ph = data.find(s => s.key === 'points_per_hour')?.value;
        const cr = data.find(s => s.key === 'cashback_ratio')?.value;
        if (ph) setPtsPerHour(Number(ph));
        if (cr) setCbRatio(Number(cr));
      }
    };
    fetchLoyaltySettings();
  }, []);

  const convertPointsToCashback = async () => {
    if (!profileData || !session) return;
    setIsConverting(true);
    try {
        // 1. Calculate Live Points earned so far in this session
        const now = new Date();
        const start = new Date(session.start_time);
        const currentRefTime = session.is_paused ? new Date(session.last_pause_start).getTime() : now.getTime();
        const totalPausedMs = (Number(session.total_paused_minutes) || 0) * 60000;
        const diffMs = Math.max(0, currentRefTime - start.getTime() - totalPausedMs);
        const liveMins = Math.floor(diffMs / 60000);
        
        // Estimated workspace amount so far
        const currentHourlyPrice = session.hourly_price || 0;
        const estimatedSpaceAmt = Math.ceil((liveMins / 60) * currentHourlyPrice);
        const cateringAmt = Number(session.catering_amount) || 0;
        const estimatedTotal = estimatedSpaceAmt + cateringAmt;
        
        // Live points logic: 1 Point per 1 EGP (aligning with RoomsStatus.tsx)
        // Or if ptsPerHour is intended: Math.floor(liveMins / (60 / ptsPerHour))
        // We'll stick to EGP-based since that's how points are awarded at the end.
        const totalLivePoints = Math.floor(estimatedTotal);
        
        let prevConvertedPoints = 0;
        let baseNotes = session.notes || '';
        const match = baseNotes.match(/\|CONVERTED_PTS:(\d+)\|/);
        if (match) {
           prevConvertedPoints = parseInt(match[1]);
           baseNotes = baseNotes.replace(/\|CONVERTED_PTS:\d+\|/g, '').trim();
        }
        
        const newLivePointsToConvert = Math.max(0, totalLivePoints - prevConvertedPoints);
        const historicalPoints = profileData.loyalty_points || 0;
        const totalPointsToConvert = historicalPoints + newLivePointsToConvert;

        if (totalPointsToConvert < 1) {
            window.alert('لا يوجد نقاط كافية للتحويل (تحتاج نقطة واحدة على الأقل)');
            setIsConverting(false);
            return;
        }

        // Conversion logic: Points / Ratio = EGP
        const rewardAmount = parseFloat((totalPointsToConvert / cbRatio).toFixed(2));

        // 2. Perform Atomic Update
        const { error: custError } = await supabase
            .from('customers')
            .update({
                loyalty_points: 0,
                cashback_balance: Number(((profileData.cashback_balance || 0) + rewardAmount).toFixed(2))
            } as any)
            .eq('id', profileData.id);

        if (custError) throw custError;
        
        // 3. Mark session notes so we don't convert these live points again
        const newNotes = `${baseNotes} |CONVERTED_PTS:${prevConvertedPoints + newLivePointsToConvert}|`.trim();
        await supabase.from('workspace_sessions').update({ notes: newNotes }).eq('id', session.id);
        
        setSession({...session, notes: newNotes});
        await fetchProfileData();
        
        window.alert(`🎉 تم تحويل ${totalPointsToConvert} نقطة بنجاح! \n\nتفاصيل التحويل:\n- نقاط سابقة: ${historicalPoints}\n- نقاط الجلسة الحالية: ${newLivePointsToConvert}\n\nتم إضافة ${rewardAmount} جنيه رصيد كاش باك لحسابك. ✨`);
    } catch (err: any) {
        console.error("Conversion failure:", err.message);
        window.alert("عذراً، فشل التحويل. يرجى المحاولة مرة أخرى.");
    } finally {
        setIsConverting(false);
    }
  };

  if (leaderData) {
    return <LeaderDashboard data={leaderData} onLogout={() => setLeaderData(null)} />;
  }

  if (session) {
    if (session.status === 'completed') {
      return (
        <div className="min-h-[100dvh] bg-[#0B0F19] flex items-center justify-center font-['Cairo'] text-right p-4 relative overflow-hidden">
          <FinalReceiptModal bill={session} onClose={handleDone} companyName={userCompany?.name} />
        </div>
      );
    }

    if (leaderData) {
      return <LeaderDashboard data={leaderData} onLogout={() => setLeaderData(null)} />;
    }

    return (
      <WorkspaceMainUI
        session={session}
        userCompany={userCompany}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        elapsedTime={elapsedTime}
        cateringItems={cateringItems}
        cart={cart}
        storeSearch={storeSearch}
        setStoreSearch={setStoreSearch}
        storeCategory={storeCategory}
        setStoreCategory={setStoreCategory}
        viewMode={viewMode}
        setViewMode={setViewMode}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        handleCheckoutCart={handleCheckoutCart}
        orderLoading={orderLoading}
        profileData={profileData}
        totalMinutes={totalMinutes}
        isUserLeader={isUserLeader}
        userCompanyMembers={userCompanyMembers}
        companyContract={companyContract}
        activeSub={activeSub}
        isConverting={isConverting}
        convertPointsToCashback={convertPointsToCashback}
        checkCompanyMembership={checkCompanyMembership}
        setLeaderData={setLeaderData}
        ptsPerHour={ptsPerHour}
        cbRatio={cbRatio}
        showCheckoutConfirm={showCheckoutConfirm}
        setShowCheckoutConfirm={setShowCheckoutConfirm}
        handleRequestPause={handleRequestPause}
        handleResumeSession={handleResumeSession}
        handleCheckoutRequest={handleCheckoutRequest}
        fetchStoreItems={fetchStoreItems}
      />
    );
  }

    return (
      <div className="min-h-[100dvh] bg-[#0B0F19] flex items-center justify-center font-['Cairo'] text-right p-4 relative overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#1e75b9]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#1ed788]/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] bg-[#f78c2a]/10 rounded-full blur-[100px] pointer-events-none" />

        <LandingForms
          isForgotCode={isForgotCode}
          isLeaderPortal={isLeaderPortal}
          isSignUp={isSignUp}
          setIsSignUp={setIsSignUp}
          setIsForgotCode={setIsForgotCode}
          setIsLeaderPortal={setIsLeaderPortal}
          setError={setError}
          error={error}
          loading={loading}
          handleForgotCode={handleForgotCode}
          handleSignUp={handleSignUp}
          handleLogin={handleLogin}
          handleLeaderLogin={handleLeaderLogin}
          forgotEmail={forgotEmail}
          setForgotEmail={setForgotEmail}
          fullName={fullName}
          setFullName={setFullName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          email={email}
          setEmail={setEmail}
          userCode={userCode}
          setUserCode={setUserCode}
          leaderCode={leaderCode}
          setLeaderCode={setLeaderCode}
          gender={gender}
          setGender={setGender}
          birthDate={birthDate}
          setBirthDate={setBirthDate}
          college={college}
          setCollege={setCollege}
          rememberMe={rememberMe}
          setRememberMe={setRememberMe}
          customCollege={customCollege}
          setCustomCollege={setCustomCollege}
          showCustomCollege={showCustomCollege}
          setShowCustomCollege={setShowCustomCollege}
          colleges={colleges}
        />

        {finalBill && (
          <Modal
            isOpen={!!finalBill}
            onClose={() => setFinalBill(null)}
            className="max-w-md p-0 overflow-hidden"
          >
            <FinalReceiptModal bill={finalBill} onClose={() => setFinalBill(null)} companyName={userCompany?.name} />
          </Modal>
        )}

        <RegistrationSuccessModal 
          isOpen={showSuccessModal} 
          onClose={() => setShowSuccessModal(false)} 
          regSuccessData={regSuccessData}
          onAction={(code) => {
            setShowSuccessModal(false);
            setUserCode(code);
            setIsSignUp(false);
          }}
        />
      </div>
    );

};

