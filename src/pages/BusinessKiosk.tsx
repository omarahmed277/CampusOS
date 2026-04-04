
import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, CreditCard, LogOut, Coffee, 
  History, Clock, ChevronLeft, ArrowRight,
  Sparkles, CheckCircle2, Lock, Smartphone, Search,
  Plus, Minus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui';

export const BusinessKiosk = () => {
  const [step, setStep] = useState<'login' | 'dashboard' | 'ordering'>('login');
  const [code, setCode] = useState('');
  const [member, setMember] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: mem, error: memErr } = await (supabase as any)
        .from('company_members')
        .select('*, companies(*)')
        .eq('unique_code', code.toUpperCase())
        .single();

      if (memErr || !mem) throw new Error('الكود غير صحيح. يرجى التأكد من الكود الخاص بك.');

      // Get current month's contract
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: contract, error: contractErr } = await (supabase as any)
        .from('monthly_contracts')
        .select('*')
        .eq('company_id', mem.company_id)
        .eq('month', currentMonth)
        .single();

      if (contractErr || !contract) {
        throw new Error('لا يوجد عقد نشط لهذا الشهر لشركتك. يرجى مراجعة الإدارة.');
      }

      const memWithContract = { ...mem, contract };
      setMember(memWithContract);
      setCompany(mem.companies);
      setStep('dashboard');
      fetchHistory(mem.id);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data } = await (supabase as any)
      .from('inventory')
      .select('*')
      .in('category', ['مطبخ وبوفيه', 'مشروبات', 'سناكس'])
      .order('name');
    setProducts(data || []);
  };

  const fetchHistory = async (memberId: string) => {
    const { data } = await (supabase as any)
      .from('catering_orders')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(p => p.id === productId ? { ...p, quantity: p.quantity - 1 } : p);
      }
      return prev.filter(p => p.id !== productId);
    });
  };

  const handleConfirmOrder = async () => {
    const total = cart.reduce((sum, item) => sum + (Number(item.selling_price || item.price) * item.quantity), 0);
    const remaining = member.contract?.catering_remaining_balance || 0;

    if (total > remaining) {
      alert(`ميزانية الشركة المتبقية غير كافية. الإجمالي: ${total} ج.م، المتبقي: ${remaining} ج.م`);
      return;
    }

    setProcessing(true);
    try {
      // 1. Log New Catering Orders
      const orders = cart.map(item => ({
        company_id: company.id,
        member_id: member.id,
        contract_id: member.contract.id,
        item_name: item.name,
        price: (item.selling_price || item.price),
        quantity: item.quantity
      }));

      const { error: orderErr } = await (supabase as any)
        .from('catering_orders')
        .insert(orders);

      if (orderErr) throw orderErr;

      // 2. Update Inventory Stock
      for (const item of cart) {
        await (supabase as any)
          .from('inventory')
          .update({ stock: Math.max(0, (item.stock || 0) - item.quantity) })
          .eq('id', item.id);
      }

      // 3. Refresh Contract specifically to get updated balance
      const { data: updatedContract } = await (supabase as any)
        .from('monthly_contracts')
        .select('*')
        .eq('id', member.contract.id)
        .single();

      setMember({ ...member, contract: updatedContract });
      setCart([]);
      setStep('dashboard');
      fetchHistory(member.id);
      alert('تم إتمام الطلب بنجاح! سيصلك طلبك بعد قليل.');
    } catch (err: any) {
      alert('حدث خطأ أثناء إتمام الطلب: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleLogout = () => {
    setMember(null);
    setCompany(null);
    setCode('');
    setStep('login');
    setCart([]);
  };

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-['Cairo'] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        
        <Card className="w-full max-w-lg bg-white/5 border-white/10 backdrop-blur-2xl rounded-[3rem] p-4 shadow-2xl relative z-10 border-2">
           <CardHeader className="text-center py-10">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-indigo-500/40 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                 <Building2 size={40} />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight mb-2 uppercase">Business Portal</h1>
              <p className="text-slate-400 font-bold text-sm">بوابة الخدمات الخاصة بالشركات والتعاقدات</p>
           </CardHeader>
           
           <CardContent className="p-8">
              <form onSubmit={handleLogin} className="space-y-8 text-right">
                 <div className="space-y-4">
                    <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest block">أدخل كود الموظف الخاص بك</label>
                    <div className="relative">
                       <input 
                          type="text" 
                          placeholder="EX: B-W9X2J" 
                          maxLength={10}
                          className="w-full h-20 bg-white/5 border-2 border-white/10 rounded-3xl px-8 text-center text-3xl font-black text-white tracking-[0.5em] outline-none focus:border-indigo-500 focus:bg-white/10 transition-all uppercase placeholder:opacity-20 font-mono"
                          value={code}
                          onChange={e => setCode(e.target.value)}
                       />
                       <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={24} />
                    </div>
                 </div>

                 <button 
                    type="submit"
                    disabled={loading || !code}
                    className="w-full h-20 bg-indigo-600 text-white rounded-3xl font-black text-xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/40 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 group"
                 >
                    {loading ? 'جاري التحقق...' : 'تسجيل الدخول للنظام'}
                    <ChevronLeft className="group-hover:-translate-x-2 transition-transform" />
                 </button>
              </form>
           </CardContent>
           <div className="text-center pb-8">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">© 2026 Cloud Co-Working System</p>
           </div>
        </Card>
      </div>
    );
  }

  if (step === 'ordering') {
    const total = cart.reduce((sum, item) => sum + (Number(item.selling_price || item.price) * item.quantity), 0);
    return (
      <div className="min-h-screen bg-white font-['Cairo'] text-right text-slate-900">
         <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-50">
            <button onClick={() => setStep('dashboard')} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><ArrowRight size={24} /></button>
            <div className="text-right">
               <h2 className="text-2xl font-black text-slate-900">سلة الطلبات</h2>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">اختر ما تفضله من سجل المطبخ</p>
            </div>
         </div>

         <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(product => (
                     <div key={product.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-400 transition-all">
                        <div className="flex flex-col items-end">
                           <h4 className="font-black text-slate-900">{product.name}</h4>
                           <p className="text-indigo-600 font-black">{product.selling_price || product.price} EGP</p>
                        </div>
                        <button 
                           onClick={() => addToCart(product)}
                           className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                        >
                           <Plus size={24} />
                        </button>
                     </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <Card className="rounded-[2.5rem] border-slate-100 shadow-xl p-8 sticky top-32">
                  <h3 className="text-xl font-black mb-6">ملخص الطلب</h3>
                  <div className="space-y-4 mb-8">
                     {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm font-black">
                           <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg">
                              <button onClick={() => removeFromCart(item.id)} className="p-1"><Minus size={12} /></button>
                              <span className="w-6 text-center">{item.quantity}</span>
                              <button onClick={() => addToCart(item)} className="p-1"><Plus size={12} /></button>
                           </div>
                           <p>{item.name}</p>
                        </div>
                     ))}
                     {cart.length === 0 && <p className="text-center text-slate-400 font-bold py-10">السلة فارغة</p>}
                  </div>
                  
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                     <div className="flex justify-between items-center text-slate-500 font-black">
                        <span>{member.contract?.catering_remaining_balance} EGP</span>
                        <span>ميزانية الشركة المتبقية</span>
                     </div>
                     <div className="flex justify-between items-center text-2xl font-black text-indigo-600">
                        <span>{total} EGP</span>
                        <span>الإجمالي</span>
                     </div>
                  </div>

                  <button 
                     onClick={handleConfirmOrder}
                     disabled={cart.length === 0 || processing || total > (member.contract?.catering_remaining_balance || 0)}
                     className="w-full h-16 bg-slate-900 text-white rounded-[1.5rem] mt-8 font-black text-lg hover:bg-indigo-600 transition-all disabled:opacity-50"
                  >
                     {processing ? 'جاري التنفيذ...' : 'تأكيد الخصم من ميزانية الشركة'}
                  </button>
               </Card>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Cairo'] text-right p-4 md:p-10 relative">
      <div className="max-w-6xl mx-auto space-y-8">
         
         {/* User Header */}
         <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
            
            <div className="flex items-center gap-6 order-2 md:order-1">
               <button 
                  onClick={handleLogout}
                  className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all shadow-sm group/btn"
               >
                  <LogOut size={24} className="group-hover:rotate-12 transition-transform" />
               </button>
               <div className="text-right">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{company?.name}</p>
                  <h2 className="text-3xl font-black text-slate-900">{member?.name}</h2>
                  <div className="flex items-center justify-end gap-2 mt-1">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">حساب متعاقد فعال</p>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] flex flex-col items-center justify-center min-w-[240px] shadow-2xl relative group/card order-1 md:order-2 overflow-hidden">
               <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent -z-10" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ميزانية الشركة المتبقية (Catering)</p>
               <div className="flex items-end gap-2">
                  <span className="text-5xl font-black text-emerald-400 drop-shadow-sm">{Number(member?.contract?.catering_remaining_balance || 0).toLocaleString()}</span>
                  <span className="text-sm font-black text-slate-500 mb-2 uppercase tracking-widest">EGP</span>
               </div>
               <div className="mt-4 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                    style={{ width: `${(Number(member?.contract?.catering_remaining_balance || 0) / Number(member?.contract?.catering_prepaid_total || 1)) * 100}%` }} 
                  />
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions */}
            <div className="lg:col-span-2 space-y-8">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Card 
                     onClick={() => setStep('ordering')}
                     className="bg-indigo-600 text-white p-8 rounded-[3rem] border-none shadow-2xl hover:bg-indigo-700 transition-all cursor-pointer group relative overflow-hidden"
                  >
                     <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                     <Coffee size={48} className="mb-6 opacity-30" />
                     <h3 className="text-2xl font-black mb-2">طلب كافتريا</h3>
                     <p className="text-white/60 text-sm font-bold">اطلب مشروبك أو وجبتك المخصصة من رصيد الشركة</p>
                     <div className="mt-8 flex justify-end">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-white text-white group-hover:text-indigo-600 transition-all">
                           <ChevronLeft size={24} />
                        </div>
                     </div>
                  </Card>
                  
                  <Card className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden text-slate-900">
                     <Clock size={48} className="mb-6 text-slate-100" />
                     <h3 className="text-2xl font-black text-slate-800 mb-2">حجز غرف عمل</h3>
                     <p className="text-slate-400 text-sm font-bold">يمكنك حجز غرف الاجتماعات بشكل منفصل (غير شامل الرصيد)</p>
                     <div className="mt-8 flex justify-end">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                           <ChevronLeft size={24} />
                        </div>
                     </div>
                  </Card>
               </div>

               {/* History Section */}
               <div className="bg-white rounded-[3rem] border border-slate-200 p-8 shadow-xl text-slate-900">
                  <div className="flex justify-between items-center mb-8">
                     <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                        <History size={16} /> سجل العمليات
                     </div>
                     <h3 className="text-2xl font-black text-slate-900">آخر التحركات</h3>
                  </div>
                  
                  <div className="space-y-4">
                     {history.length > 0 ? history.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group">
                           <div className="text-left">
                              <p className="text-sm font-black text-rose-500">-{item.price * (item.quantity || 1)} EGP</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{new Date(item.created_at).toLocaleTimeString('ar-EG')}</p>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="text-right">
                                 <p className="text-sm font-black text-slate-800">{item.item_name}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">خصم من ميزانية الشركة المشتركة</p>
                              </div>
                              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                                 <Coffee size={20} />
                              </div>
                           </div>
                        </div>
                     )) : (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400 opacity-30">
                           <History size={48} strokeWidth={1} />
                           <p className="text-sm font-black tracking-widest uppercase">لا توجد عمليات سابقة</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Sidebar Stats/Info */}
            <div className="space-y-8">
               <Card className="bg-indigo-900 text-white p-8 rounded-[3rem] border-none shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1),transparent)]" />
                  <h4 className="text-lg font-black mb-6 flex items-center gap-2 justify-end">
                     ملخص التعاقد <Building2 size={18} className="text-indigo-400" />
                  </h4>
                  <div className="space-y-6 text-right">
                     <div>
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">CONTRACT STATUS</p>
                        <p className="text-sm font-black flex items-center justify-end gap-2">نشط حتى 2027 <CheckCircle2 size={14} className="text-emerald-400" /></p>
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">ALLOWED SERVICES</p>
                        <div className="flex flex-wrap justify-end gap-2 mt-2">
                           {['Catering', 'Fast-WiFi', 'Premium Lounge'].map(s => (
                              <span key={s} className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-tighter">{s}</span>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="mt-10 pt-8 border-t border-white/10">
                     <p className="text-xs font-bold text-white/40 leading-relaxed">
                        الرصيد المخصص للاستخدام الشخصي فقط. لا يمكن تحويل الرصيد لعضو آخر. الاسترداد النقدي غير متاح.
                     </p>
                  </div>
               </Card>
            </div>
         </div>
      </div>
    </div>
  );
};
