import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  User, 
  ArrowRight, 
  Package, 
  Coffee, 
  Cookie, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Minus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  HelpCircle,
  LayoutGrid,
  ChevronUp,
  CreditCard,
  ShoppingCart,
  Phone,
  Search,
  Key
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Modal } from '../components/ui';

interface Product {
  id: string;
  name: string;
  price?: number;
  selling_price?: number;
  image_url?: string;
  category: string;
  stock: number;
}

interface CartItem {
  item: Product;
  quantity: number;
}

export const KitchenKiosk = () => {
  // Navigation & State
  const [step, setStep] = useState<'auth' | 'store' | 'success'>('auth');
  const [userCode, setUserCode] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  
  // Store State
  const [categories, setCategories] = useState<string[]>(['الكل', 'مشروبات', 'سناكس']);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [loading, setLoading] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderBill, setOrderBill] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState('');
  const [showCodeReminder, setShowCodeReminder] = useState(false);
  const [rememberedCode, setRememberedCode] = useState('');

  useEffect(() => {
    fetchBranchAndProducts();
  }, []);

  const fetchBranchAndProducts = async () => {
    setLoading(true);
    try {
      // 1. Get Branch
      const { data: branches } = await supabase.from('branches').select('id, name').eq('is_active', true);
      let targetBranchId = '';
      if (branches && branches.length > 0) {
        const mainBranch = branches.find(b => b.name.toLowerCase().includes('cloud')) || branches[0];
        setBranchId(mainBranch.id);
        targetBranchId = mainBranch.id;
      }

      // 2. Get Products (Kitchen Only)
      const { data: invItems } = await supabase
        .from('inventory')
        .select('*')
        .in('category', ['مطبخ وبوفيه', 'مشروبات', 'سناكس'])
        .order('name');
      
      if (invItems) setProducts(invItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleIdentifyUser = async () => {
    if (!userCode.trim() && !isGuest) return;
    
    setLoading(true);
    try {
      let targetCode = userCode.trim().toUpperCase();
      if (isGuest) targetCode = 'GUEST_KITCHEN';

      // Find active session for this code
      let session: any = null;
      
      const { data: existing, error } = await supabase
        .from('workspace_sessions')
        .select('*, customers(full_name)')
        .eq('user_code', targetCode)
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      session = existing;

      if (!session) {
        if (isGuest) {
            // Create a guest session if none exists
            const { data: newSession, error: createErr } = await (supabase as any)
              .from('workspace_sessions')
              .insert({
                user_code: 'GUEST_KITCHEN',
                phone_number: 'Guest',
                status: 'active',
                branch_id: branchId,
                start_time: new Date().toISOString(),
                created_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (createErr) throw createErr;
            session = newSession;
        } else {
            alert('لم يتم العثور على جلسة نشطة لهذا الكود. يرجى التأكد من الكود أو مراجعة الـ Admin.');
            setLoading(false);
            return;
        }
      }

      setActiveSession(session);
      setStep('store');
    } catch (err: any) {
      alert('خطأ في التعرف على المستخدم: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupByPhone = async () => {
    if (!phoneLookup.trim()) return;
    
    setLoading(true);
    try {
      const { data: session, error } = await supabase
        .from('workspace_sessions')
        .select('*, customers(full_name)')
        .eq('phone_number', phoneLookup.trim())
        .in('status', ['active', 'checkout_requested'])
        .maybeSingle();

      if (error) throw error;

      if (!session) {
        alert('لم يتم العثور على جلسة نشطة لهذا الرقم. يرجى التأكد من الرقم أو مراجعة الـ Admin.');
        return;
      }

      setRememberedCode(session.user_code);
      setActiveSession(session);
      setShowForgotModal(false);
      setStep('store');
      setShowCodeReminder(true);
      setPhoneLookup('');
    } catch (err: any) {
      alert('خطأ في البحث عن الجلسة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev[product.id];
      if (existing) {
        return {
          ...prev,
          [product.id]: { ...existing, quantity: existing.quantity + 1 }
        };
      }
      return {
        ...prev,
        [product.id]: { item: product, quantity: 1 }
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev[productId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: existing.quantity - 1 }
      };
    });
  };

  const handleConfirmPurchase = async () => {
    if (Object.keys(cart).length === 0 || !activeSession) return;
    
    setProcessingOrder(true);
    try {
      const cartEntries = Object.values(cart) as CartItem[];
      const subtotal = cartEntries.reduce((sum, entry) => sum + ((entry.item.selling_price || entry.item.price || 0) * entry.quantity), 0);
      
      // 1. Create Order records
      const { data: order, error: orderErr } = await (supabase as any)
        .from('orders')
        .insert({
            customer_id: activeSession.customer_id,
            session_id: activeSession.id,
            total_price: subtotal,
            branch_id: branchId
        })
        .select()
        .single();
        
      if (!orderErr && order) {
          for (const entry of cartEntries) {
              await (supabase as any)
                .from('order_items')
                .insert({
                    order_id: order.id,
                    product_id: entry.item.id,
                    quantity: entry.quantity,
                    price_at_purchase: entry.item.selling_price || entry.item.price || 0
                });
          }
      }

      // 2. Deduct Inventory
      for (const entry of cartEntries) {
          await (supabase as any)
            .from('inventory')
            .update({ stock: Math.max(0, entry.item.stock - entry.quantity) })
            .eq('id', entry.item.id);
      }

      // 3. Update Session JSON
      const currentOrders = Array.isArray(activeSession.orders) ? activeSession.orders : [];
      const currentCateringAmount = Number(activeSession.catering_amount) || 0;
      
      const newOrders = [...currentOrders, ...cartEntries.map(e => ({
        id: e.item.id,
        name: e.item.name,
        price: e.item.selling_price || e.item.price || 0,
        quantity: e.quantity,
        time: new Date().toISOString(),
        kiosk: true // Tag as Kiosk purchase
      }))];
      
      const newAmount = currentCateringAmount + subtotal;
      
      const { error: sessionErr } = await (supabase as any)
        .from('workspace_sessions')
        .update({ orders: newOrders, catering_amount: newAmount })
        .eq('id', activeSession.id);
        
      if (sessionErr) throw sessionErr;

      // Broadcast to users phone & admin
      supabase.channel(`workspace_session_${activeSession.id}`).send({
        type: 'broadcast',
        event: 'session_updated',
        payload: { id: activeSession.id, status: activeSession.status }
      });

      setOrderBill({
        items: cartEntries,
        total: subtotal,
        user: (activeSession as any).customers?.full_name || (activeSession as any).user_code
      });
      setStep('success');
      setCart({});
      setShowConfirmModal(false);
    } catch (err: any) {
      alert("حدث خطأ أثناء إتمام الطلب: " + err.message);
    } finally {
      setProcessingOrder(false);
    }
  };

  const getFilteredProducts = () => {
    let filtered = products;
    if (activeCategory === 'مشروبات') {
      filtered = products.filter(p => p.category === 'مشروبات' || p.name.includes('قهوة') || p.name.includes('شاي') || p.name.includes('عصير'));
    } else if (activeCategory === 'سناكس') {
      filtered = products.filter(p => p.category === 'سناكس' || p.name.includes('شيبس') || p.name.includes('بسكويت') || p.name.includes('كرواسون'));
    }
    return filtered;
  };

  const renderAuth = () => (
    <div className="w-full max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center space-y-4">
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] flex items-center justify-center mx-auto text-white shadow-2xl rotate-12 group-hover:rotate-0 transition-transform duration-500">
            <Coffee size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight px-4">Cloud Kitchen </h1>
        <p className="text-slate-500 font-bold text-base md:text-lg">بوابة الخدمة الذاتية للكافيه والمطبخ</p>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-8 px-4">
        <button 
          onClick={() => { setIsGuest(true); handleIdentifyUser(); }}
          className="group relative h-64 md:h-72 bg-white border-2 border-slate-100 rounded-[2.5rem] md:rounded-[3rem] p-8 flex flex-col items-center justify-center gap-4 md:gap-6 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-100 transition-all active:scale-95 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
          <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
            <User size={36} className="md:w-10 md:h-10" />
          </div>
          <div className="text-center">
            <h3 className="text-xl md:text-2xl font-black text-slate-900">زائر / Guest</h3>
            <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] md:text-xs tracking-widest">Self Service Terminal</p>
          </div>
        </button>

        <div className="relative group h-64 md:h-72 bg-white border-2 border-slate-100 rounded-[2.5rem] md:rounded-[3rem] p-8 flex flex-col items-center justify-center gap-4 md:gap-6 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-100 transition-all overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="w-full space-y-4 relative z-10">
            <div className="text-center">
              <h3 className="text-xl md:text-2xl font-black text-slate-900">كود المستخدم</h3>
              <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] md:text-xs tracking-widest">Enter Your Code</p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder="A001 ..."
                  className="w-full h-12 md:h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 text-center font-black text-lg md:text-xl text-slate-900 focus:border-emerald-400 focus:bg-white outline-none transition-all uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && handleIdentifyUser()}
                />
                <button 
                  onClick={handleIdentifyUser}
                  disabled={loading || !userCode.trim()}
                  className="h-12 w-12 md:h-14 md:w-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 active:scale-90 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <ChevronLeft size={24} />}
                </button>
              </div>
              <button 
                onClick={() => setShowForgotModal(true)}
                className="w-full text-slate-400 hover:text-emerald-500 font-black text-xs md:text-sm underline underline-offset-4 transition-colors"
              >
                نسيت الكود الخاص بك؟
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Code Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="استعادة كود المستخدم"
      >
        <div className="space-y-6 p-2 text-center">
           <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Phone size={32} />
           </div>
           <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">أدخل رقم الهاتف المسجل</h3>
              <p className="text-slate-500 font-bold text-sm">سنقوم بالبحث عن جلستك النشطة واستعادة الكود الخاص بك</p>
           </div>
           
           <div className="space-y-4">
              <input 
                 type="tel"
                 value={phoneLookup}
                 onChange={(e) => setPhoneLookup(e.target.value)}
                 placeholder="010XXXXXXXX"
                 className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 text-center font-black text-xl text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                 onKeyDown={(e) => e.key === 'Enter' && handleLookupByPhone()}
              />
              <button 
                onClick={handleLookupByPhone}
                disabled={loading || !phoneLookup.trim()}
                className="w-full h-16 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                بحث واستعادة <Search size={22} />
              </button>
           </div>
        </div>
      </Modal>
    </div>
  );

  const renderStore = () => (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-8 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-white/80 backdrop-blur-xl border-b border-slate-100 shrink-0 sticky top-0 z-30">
         <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => { setStep('auth'); setUserCode(''); setIsGuest(false); setCart({}); }}
                 className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all"
               >
                 <ArrowRight size={18} className="md:w-5 md:h-5" />
               </button>
               <div>
                 <h2 className="text-lg md:text-2xl font-black text-slate-900 leading-tight">قائمة الطلبات</h2>
                 <p className="text-indigo-600 font-bold text-[10px] md:text-xs uppercase tracking-widest">{(activeSession as any)?.customers?.full_name || (activeSession as any)?.user_code}</p>
               </div>
            </div>
            
            {/* Mobile Shopping Bag Status */}
            <div className="lg:hidden flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
               <ShoppingBag size={14} className="text-indigo-600" />
               <span className="font-black text-indigo-600 text-sm">{Object.values(cart).reduce((sum: number, e: any) => sum + (e.quantity || 0), 0)}</span>
            </div>
         </div>

         {/* Category Filters */}
         <div className="flex gap-2 md:gap-3 bg-slate-50 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] overflow-x-auto no-scrollbar border border-slate-100">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm whitespace-nowrap transition-all ${
                  activeCategory === cat 
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {cat === 'الكل' && <LayoutGrid size={18} />}
                {cat === 'مشروبات' && <Coffee size={18} />}
                {cat === 'سناكس' && <Cookie size={18} />}
                {cat}
              </button>
            ))}
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-32 lg:pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
             {getFilteredProducts().map(product => {
                const cartQty = cart[product.id]?.quantity || 0;
                return (
                  <div key={product.id} className="group relative bg-white border-2 border-transparent rounded-[2.5rem] p-4 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-50/50 transition-all duration-500">
                     <div className="aspect-[4/5] bg-slate-50 rounded-[2rem] overflow-hidden mb-4 relative ring-1 ring-slate-100">
                        {product.image_url ? (
                          <img src={product.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                             {product.category === 'مشروبات' ? <Coffee size={64} strokeWidth={1.5} /> : <Cookie size={64} strokeWidth={1.5} />}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        {cartQty > 0 && (
                          <div className="absolute top-4 left-4 bg-indigo-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-xl ring-4 ring-white animate-in zoom-in bounce-in">
                            {cartQty}
                          </div>
                        )}
                     </div>
                     <div className="space-y-1.5 px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{product.category}</span>
                        <h4 className="font-black text-slate-900 text-lg leading-tight line-clamp-1">{product.name}</h4>
                        <div className="flex items-center justify-between">
                           <p className="text-emerald-600 font-extrabold text-xl">{product.selling_price || product.price} <span className="text-xs">EGP</span></p>
                        </div>
                     </div>
                     <button 
                       onClick={() => addToCart(product)}
                       className="w-full mt-5 h-12 md:h-14 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
                     >
                       <Plus size={18} className="md:w-5 md:h-5" strokeWidth={3} /> إضافة
                     </button>
                  </div>
                );
             })}
          </div>
        </div>

        {/* Floating Mobile Checkout Bar */}
        {Object.keys(cart).length > 0 && (
          <div className="fixed bottom-8 left-8 right-8 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
             <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 shadow-2xl flex items-center justify-between gap-4 ring-1 ring-black/5">
                <div className="flex items-center gap-4 px-2">
                   <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white relative">
                      <ShoppingBag size={24} />
                      <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-slate-900">
                        {Object.values(cart).reduce((sum: number, e: any) => sum + (e.quantity || 0), 0)}
                      </span>
                   </div>
                   <div className="text-right">
                      <p className="text-white/60 font-bold text-[10px] uppercase tracking-wider">الإجمالي</p>
                      <p className="text-white font-black text-xl">{Object.values(cart).reduce((sum: number, e: any) => sum + (((e.item?.selling_price || e.item?.price || 0) * e.quantity) || 0), 0)} EGP</p>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setShowCartDrawer(true)}
                     className="h-14 w-14 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all border border-white/10"
                   >
                     <ChevronUp size={24} />
                   </button>
                   <button 
                     onClick={() => setShowConfirmModal(true)}
                     className="h-14 px-8 bg-indigo-500 text-white rounded-2xl font-black text-lg hover:bg-indigo-400 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
                   >
                     إتمام الطلب
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Sidebar Cart */}
        <div className="w-96 bg-slate-50 border-r border-slate-100 flex flex-col overflow-hidden hidden lg:flex">
          <div className="p-8 border-b border-slate-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <ShoppingBag size={20} />
             </div>
             <h3 className="text-xl font-black text-slate-900">سلة المشتريات</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
             {Object.values(cart).map((entry: any) => (
               <div key={entry.item.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg overflow-hidden shrink-0">
                       {entry.item.image_url ? <img src={entry.item.image_url} className="w-full h-full object-cover" alt="" /> : <Package className="w-full h-full p-2 text-slate-300" />}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900 text-sm line-clamp-1">{entry.item.name}</p>
                      <p className="text-emerald-600 font-bold text-xs">{entry.item.selling_price || entry.item.price} EGP</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                    <button onClick={() => removeFromCart(entry.item.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-rose-500 transition-all"><Minus size={14} /></button>
                    <span className="w-6 text-center font-black text-sm">{entry.quantity}</span>
                    <button onClick={() => addToCart(entry.item)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-emerald-500 transition-all"><Plus size={14} /></button>
                  </div>
               </div>
             ))}
             {Object.keys(cart).length === 0 && (
               <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 italic">
                  <ShoppingBag size={48} />
                  <p className="font-bold text-slate-500">السلة فارغة</p>
               </div>
             )}
          </div>

          <div className="p-8 bg-white border-t border-slate-100 space-y-6 shrink-0">
             <div className="flex justify-between items-center">
                <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">الإجمالي النهائي</span>
                <span className="text-3xl font-black text-slate-900">{Object.values(cart).reduce((sum: number, e: any) => sum + (((e.item?.selling_price || e.item?.price || 0) * e.quantity) || 0), 0)} EGP</span>
             </div>
             <button 
               onClick={() => setShowConfirmModal(true)}
               disabled={Object.keys(cart).length === 0 || processingOrder}
               className="w-full h-20 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-2xl shadow-indigo-200 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-4"
             >
               مراجعة وتأكيد الطلب <ArrowRight size={24} />
             </button>
          </div>
        </div>
      </div>

      {/* Code Reminder Popup */}
      {showCodeReminder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" />
           <div className="relative bg-white rounded-[3rem] p-10 max-w-sm w-full text-center space-y-8 shadow-2xl animate-in zoom-in slide-in-from-bottom-12 duration-500 ring-4 ring-indigo-500/20">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] flex items-center justify-center mx-auto text-white shadow-xl -rotate-6">
                 <Key size={48} />
              </div>
              <div className="space-y-4">
                 <h3 className="text-3xl font-black text-slate-900">كود المستخدم الخاص بك</h3>
                 <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed border-indigo-200">
                    <span className="text-5xl font-black text-indigo-600 tracking-widest">{rememberedCode}</span>
                 </div>
                 <p className="text-xl font-bold text-slate-500 leading-relaxed px-4">خليك فاكر الكود بتاعك علشان المرة الجاية</p>
              </div>
              <button 
                onClick={() => setShowCodeReminder(false)}
                className="w-full h-18 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-100"
              >
                فهمت، شكراً
              </button>
           </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal 
        isOpen={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
        title="تأكيد عملية الشراء"
      >
        <div className="space-y-8 p-2">
           <div className="bg-indigo-50/50 rounded-[2.5rem] p-8 border-2 border-indigo-100 space-y-6">
              <div className="flex flex-col items-center gap-2 text-center">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl mb-2">
                    <CreditCard size={32} />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900">هل تود تأكيد طلبك؟</h3>
                 <p className="text-slate-500 font-bold">يرجى التأكد من المنتجات المضافة قبل المتابعة</p>
              </div>

              <div className="space-y-3">
                 {Object.values(cart).map((entry: any) => (
                   <div key={entry.item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                         <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs">{entry.quantity}</span>
                         <span className="font-black text-slate-700">{entry.item.name}</span>
                      </div>
                      <span className="font-bold text-slate-500">{(entry.item.selling_price || entry.item.price || 0) * entry.quantity} EGP</span>
                   </div>
                 ))}
              </div>

              <div className="pt-6 border-t-2 border-dashed border-indigo-200 flex justify-between items-center font-black">
                 <span className="text-slate-500 uppercase tracking-widest text-xs md:text-sm">الإجمالي المطلوب</span>
                 <span className="text-2xl md:text-3xl text-indigo-600">{Object.values(cart).reduce((sum: number, e: any) => sum + (((e.item?.selling_price || e.item?.price || 0) * e.quantity) || 0), 0)} EGP</span>
              </div>
           </div>

           <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="h-16 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all order-2 sm:order-1"
              >
                تعديل الطلب
              </button>
              <button 
                onClick={handleConfirmPurchase}
                disabled={processingOrder}
                className="h-16 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl order-1 sm:order-2"
              >
                {processingOrder ? <RefreshCw className="animate-spin" /> : <>تأكيد الشراء <CheckCircle2 size={24} /></>}
              </button>
           </div>
        </div>
      </Modal>

      {/* Cart Drawer for Mobile/Tablet */}
      <Modal
        isOpen={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        title="سلة المشتريات"
      >
        <div className="flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar p-2">
            {Object.values(cart).map((entry: any) => (
               <div key={entry.item.id} className="bg-slate-50 p-5 rounded-[2rem] flex items-center justify-between border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-200 overflow-hidden shrink-0">
                       {entry.item.image_url ? <img src={entry.item.image_url} className="w-full h-full object-cover" alt="" /> : <Package size={24} />}
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{entry.item.name}</p>
                      <p className="text-emerald-600 font-bold">{entry.item.selling_price || entry.item.price} EGP</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-2xl p-1 shadow-sm ring-1 ring-slate-100">
                    <button onClick={() => removeFromCart(entry.item.id)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500"><Minus size={18} /></button>
                    <span className="w-8 text-center font-black text-lg">{entry.quantity}</span>
                    <button onClick={() => addToCart(entry.item)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-500"><Plus size={18} /></button>
                  </div>
               </div>
            ))}
            <button 
              onClick={() => { setShowCartDrawer(false); setShowConfirmModal(true); }}
              className="w-full h-16 bg-indigo-500 text-white rounded-2xl font-black text-lg mt-4 shadow-xl"
            >
              متابعة التأكيد
            </button>
        </div>
      </Modal>
    </div>
  );

  const renderSuccess = () => (
    <div className="w-full max-w-xl mx-auto py-8 md:py-12 px-4 animate-in zoom-in duration-500">
       <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 text-center space-y-8 md:space-y-12 shadow-2xl relative overflow-hidden border border-slate-100">
          {/* Animated Background Orbs */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -z-10 animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -z-10" />
          
          <div className="space-y-6 relative z-10">
            <div className="w-20 h-20 md:w-28 md:h-28 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto text-emerald-500 animate-bounce shadow-inner">
              <CheckCircle2 size={48} className="md:w-16 md:h-16" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">تمت العملية بنجاح!</h2>
              <p className="text-slate-500 font-bold text-base md:text-xl px-4 lg:px-12">يرجى التوجه لمكتب الـ Admin لإتمام الحساب والدفع. شكراً لزيارتك!</p>
            </div>
          </div>

          <div className="relative p-6 md:p-10 bg-slate-50/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-200/50 group overflow-hidden">
             {/* Receipt Texture Background */}
             <div className="absolute top-0 left-0 right-0 h-4 bg-white/50 backdrop-blur-sm" style={{ clipPath: 'polygon(0 0, 5% 100%, 10% 0, 15% 100%, 20% 0, 25% 100%, 30% 0, 35% 100%, 40% 0, 45% 100%, 50% 0, 55% 100%, 60% 0, 65% 100%, 70% 0, 75% 100%, 80% 0, 85% 100%, 90% 0, 95% 100%, 100% 0)' }} />
             
             <div className="space-y-6 relative">
                <div className="flex justify-between items-center pb-6 border-b border-slate-200/60">
                   <div className="text-right">
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">العميل</p>
                      <p className="text-lg md:text-2xl font-black text-slate-900">{orderBill?.user}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">الوقت</p>
                      <p className="font-bold text-slate-600 text-sm md:text-base">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                   </div>
                </div>

                <div className="space-y-4 max-h-[16rem] overflow-y-auto px-2 custom-scrollbar">
                   {orderBill?.items.map((entry: any, i: number) => (
                     <div key={i} className="flex justify-between items-center group/item transition-colors">
                        <div className="flex items-center gap-3">
                           <span className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-black text-xs text-indigo-600 shadow-sm">{entry.quantity}</span>
                           <span className="font-black text-slate-700 text-sm md:text-lg">{entry.item.name}</span>
                        </div>
                        <span className="font-extrabold text-slate-400 text-sm md:text-lg">{(entry.item.selling_price || entry.item.price || 0) * entry.quantity} <span className="text-[10px]">EGP</span></span>
                     </div>
                   ))}
                </div>

                <div className="pt-8 border-t-2 border-dashed border-slate-300 flex justify-between items-center">
                   <div>
                      <p className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-widest">إجمالي المنتجات</p>
                      <p className="text-3xl md:text-5xl font-black text-emerald-600 tracking-tighter mt-1">{orderBill?.total} <span className="text-lg">EGP</span></p>
                   </div>
                   <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-3xl flex items-center justify-center text-slate-200 shadow-inner">
                      <ShoppingCart size={32} />
                   </div>
                </div>
             </div>
          </div>

          <button 
            onClick={() => { setStep('auth'); setUserCode(''); setIsGuest(false); setCart({}); }}
            className="w-full h-16 md:h-20 bg-slate-900 text-white rounded-[2rem] font-black text-lg md:text-2xl hover:bg-indigo-600 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 group"
          >
            شكراً، عودة للبداية
            <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </button>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-['Cairo'] text-right relative overflow-hidden" dir="rtl">
      {/* Visual background elements */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[150px] -z-10" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] -z-10" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 relative z-10 overflow-hidden">
        {step === 'auth' && renderAuth()}
        {step === 'store' && renderStore()}
        {step === 'success' && renderSuccess()}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
           <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
              <p className="font-black text-slate-600 animate-pulse">جاري التحميل...</p>
           </div>
        </div>
      )}
    </div>
  );
};
