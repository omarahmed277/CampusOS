import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit3, Trash2, X, CheckCircle2, Clock, CalendarDays, Search, User, Phone, Tag, Receipt, AlertCircle, Loader2, Sparkles, ChevronLeft, Save, RefreshCw, CreditCard, History } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { Subscription } from '../types';

export const SubscriptionsPanel = ({ branchId }: { branchId?: string }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    hours: 40,
    basePrice: 320,
    discount: 0,
    amountPaid: 320,
    startDate: new Date().toISOString().split('T')[0],

  });

  const [editData, setEditData] = useState({
    totalHours: 0,
    usedHours: 0,
    usedHrs: 0,
    usedMins: 0,
    endDate: '',
    status: 'Active' as any,
    price: 0,
    paid: 0
  });


  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (branchId) {
      fetchSubscriptions();
    }
  }, [branchId]);

  // Server-side search with debounce
  useEffect(() => {
    if (searchQuery.trim().length >= 2 && !selectedCustomer) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, selectedCustomer]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const q = query.trim();
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, code, phone')
        .or(`full_name.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchSubscriptions = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('subscriptions')
      .select('*, customers(full_name, code, phone)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (data) {
      const formatted: Subscription[] = (data as any[]).map(s => {
        const total = s.total_hours || 40;
        const used = s.used_hours || 0;
        const isExhausted = used >= total;
        
        return {
          id: s.id,
          name: s.customers?.full_name || 'عميل غير معروف',
          code: s.customers?.code || '---',
          type: s.type,
          price: s.price || 0,
          paid: s.paid || 0,
          remaining: s.remaining || 0,
          startDate: s.start_date || '',
          endDate: s.end_date || '',
          daysLeft: Math.ceil((new Date(s.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)),
          totalHours: total,
          usedHours: used,
          status: isExhausted ? 'Exhausted' : ((s.status as any) || 'Active'),
          customerId: s.customer_id
        };
      });
      setSubscriptions(formatted);
    }
    setLoading(false);
  };

  const PACKAGES = [
    { name: '40 Hours', hours: 40, price: 320, rate: 8 },
    { name: '80 Hours', hours: 80, price: 600, rate: 7.5 },
    { name: '100 Hours', hours: 100, price: 700, rate: 7 },
  ];

  const handlePresetSelect = (pkg: typeof PACKAGES[0]) => {
    setFormData(prev => ({
      ...prev,
      hours: pkg.hours,
      basePrice: pkg.price,
      discount: 0,
      amountPaid: pkg.price // Default to full price
    }));

  };

  const handleHoursChange = (val: number) => {
    const preset = PACKAGES.find(p => p.hours === val);
    const suggestedPrice = preset ? preset.price : val * 8;
    setFormData(prev => ({ ...prev, hours: val, basePrice: suggestedPrice, amountPaid: suggestedPrice }));

  };

  const finalPrice = Math.max(0, formData.basePrice - formData.discount);

  const handleSaveSubscription = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    
    try {
      const { error } = await (supabase as any).from('subscriptions').insert({
        branch_id: branchId,
        customer_id: selectedCustomer.id,
        type: `${formData.hours} Hours Package`,
        price: finalPrice,
        paid: parseFloat(formData.amountPaid.toString()) || 0,
        remaining: Math.max(0, finalPrice - (parseFloat(formData.amountPaid.toString()) || 0)),

        start_date: formData.startDate,
        end_date: new Date(new Date(formData.startDate).setMonth(new Date(formData.startDate).getMonth() + 1)).toISOString().split('T')[0],
        total_hours: formData.hours,
        used_hours: 0,
        status: 'Active'
      });

      if (error) throw error;

      setNotification('تم تفعيل الاشتراك بنجاح والحفظ في قاعدة البيانات');
      setTimeout(() => setNotification(null), 4000);
      
      setIsModalOpen(false);
      setShowConfirm(false);
      fetchSubscriptions();
      resetForm();
    } catch (err: any) {
      alert('خطأ في حفظ الاشتراك: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription) return;
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          total_hours: editData.totalHours,
          used_hours: parseFloat((Number(editData.usedHrs) + (Number(editData.usedMins) / 60)).toFixed(2)),
          end_date: editData.endDate,
          status: editData.status,
          price: editData.price,
          paid: editData.paid,
          remaining: Math.max(0, editData.price - editData.paid)
        })

        .eq('id', editingSubscription.id);

      if (error) throw error;

      setNotification('تم تحديث البيانات بنجاح');
      setTimeout(() => setNotification(null), 3000);
      
      setIsEditModalOpen(false);
      fetchSubscriptions();
    } catch (err: any) {
      alert('خطأ في تحديث الاشتراك: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (sub: Subscription) => {
    const hrs = Math.floor(sub.usedHours);
    const mins = Math.round((sub.usedHours - hrs) * 60);

    setEditingSubscription(sub);
    setEditData({
      totalHours: sub.totalHours,
      usedHours: sub.usedHours,
      usedHrs: hrs,
      usedMins: mins,
      endDate: sub.endDate,
      status: sub.status as any,
      price: sub.price,
      paid: sub.paid
    });

    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ hours: 40, basePrice: 320, discount: 0, amountPaid: 320, startDate: new Date().toISOString().split('T')[0] });

    setSelectedCustomer(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowConfirm(false);
  };

  const getProgressColor = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 100) return 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]';
    if (percentage > 85) return 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]';
    return 'bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)]';
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاشتراك؟')) return;
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (!error) fetchSubscriptions();
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 font-['Cairo'] text-right pb-24 relative overflow-visible">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
         <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Notifications */}
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[300] flex items-center gap-4 animate-in slide-in-from-top-20 border border-white/10 backdrop-blur-xl">
          <div className="p-2 bg-emerald-500/20 rounded-xl">
             <CheckCircle2 className="text-emerald-400" size={24} />
          </div>
          <span className="font-black text-sm tracking-wide">{notification}</span>
        </div>
      )}

      {/* Premium Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
          <p className="text-slate-400 font-bold text-[10px] mb-3 uppercase tracking-widest text-right">المشتركون النشطون</p>
          <div className="flex items-center gap-3 justify-end">
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight">Active Elite</div>
            <h3 className="text-4xl font-black text-slate-800 tracking-tight">{subscriptions.filter(s => s.status === 'Active').length}</h3>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
          <p className="text-slate-400 font-bold text-[10px] mb-3 uppercase tracking-widest text-right">إجمالي مبيعات الباقات</p>
          <div className="flex items-center gap-3 justify-end">
             <h3 className="text-4xl font-black text-indigo-600 tracking-tight">{subscriptions.reduce((acc, curr) => acc + curr.paid, 0).toLocaleString()} <span className="text-base font-bold opacity-30 ml-1">EGP</span></h3>
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-[60px] group-hover:scale-150 transition-transform duration-1000" />
          <p className="text-slate-300 font-bold text-[10px] mb-3 uppercase tracking-widest text-right">الساعات المتاحة للانتقال</p>
          <div className="flex items-center gap-3 justify-end text-white">
             <h3 className="text-4xl font-black tracking-tight">
                {Math.floor(subscriptions.reduce((acc, curr) => acc + (curr.totalHours - curr.usedHours), 0))}
                <span className="text-base font-bold opacity-30 mr-2">ساعة</span>
             </h3>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[3.5rem] border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-10 border-b border-slate-50/50 flex flex-row-reverse justify-between items-center bg-slate-50/20">
          <div className="text-right">
             <div className="flex items-center gap-3 justify-end mb-1">
                <Sparkles size={18} className="text-indigo-500 animate-pulse" />
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">إدارة اشتراكات الساعات</h3>
             </div>
            <p className="text-slate-400 text-xs font-bold mr-7">تحليل واستهلاك باقات المشتركين المميزين</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center gap-4 px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm shadow-[0_15px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95 hover:bg-indigo-700"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" /> اشتراك جديد
          </button>
        </div>

        <div className="overflow-x-auto text-right text-slate-700">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/30 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-10 py-8 text-right first:rounded-tr-[3.5rem]">العميل</th>
                <th className="px-6 py-8 w-1/3 text-right">تقدم الاستهلاك</th>
                <th className="px-6 py-8 text-right">الصلاحية والانتهاء</th>
                <th className="px-6 py-8 text-center">حالة الحساب</th>
                <th className="px-10 py-8 text-left last:rounded-tl-[3.5rem]">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 font-bold">
              {subscriptions.map((sub) => {
                const total = sub.totalHours;
                const used = sub.usedHours;
                const remainingHours = Math.max(0, total - used);
                const overageHours = Math.max(0, used - total);
                const isHourlyExhausted = used >= total;

                return (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-all group duration-500">
                    <td className="px-10 py-8">
                       <div className="flex flex-row-reverse items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all duration-500">
                             <User size={20} />
                          </div>
                          <div className="text-right">
                             <div className="flex flex-row-reverse items-center gap-2">
                               <p className="text-slate-800 font-black text-base leading-tight group-hover:text-indigo-600 transition-colors">{sub.name}</p>
                               {sub.remaining > 0 && (
                                 <span className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg text-[8px] font-black animate-pulse border border-rose-100 shadow-sm shadow-rose-100/50" title={`عليه مديونية: ${sub.remaining} EGP`}>
                                   <AlertCircle size={10} /> غير مكتمل الدفع
                                 </span>
                               )}
                             </div>
                             <p className="text-[10px] text-indigo-500 font-mono tracking-widest bg-indigo-50/50 inline-block px-2 py-0.5 rounded-lg mt-2 font-black">{sub.code}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-8">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-row-reverse justify-between items-center text-[10px]">
                          <span className="font-black text-slate-500 tracking-wide uppercase px-2 py-0.5 bg-slate-100 rounded-md">{sub.type}</span>
                          <span className={`${isHourlyExhausted ? 'text-rose-600 underline decoration-2' : 'text-slate-400'} font-mono font-black`}>
                            {remainingHours > 0 ? `B: ${remainingHours.toFixed(1)}H` : `O: ${overageHours.toFixed(1)}H`}
                          </span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100 flex p-[1.5px]">
                          <div
                            className={`h-full rounded-full transition-all duration-[1500ms] ${getProgressColor(used, total)}`}
                            style={{ width: `${Math.min(100, (used / total) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-8 font-medium">
                      <div className="flex flex-col gap-2 text-[11px] text-right">
                        <span className="flex items-center justify-end gap-2 text-slate-400 font-bold leading-none"><CalendarDays size={14} /> Ends {sub.endDate}</span>
                        <div className={`flex items-center justify-end gap-2 px-3 py-1.5 rounded-xl w-fit mr-auto ${sub.daysLeft < 5 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                           <Clock size={12} /> 
                           <span className="font-black">{sub.daysLeft > 0 ? `باقي ${sub.daysLeft} يوم` : 'منتهي'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-8 text-center text-slate-700">
                      <span className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest inline-block ${isHourlyExhausted ? 'bg-rose-100 text-rose-700 ring-4 ring-rose-50' :
                        sub.status === 'Active' ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50' : 'bg-rose-100 text-rose-700 ring-4 ring-rose-50'
                        }`}>
                        {isHourlyExhausted ? 'Exhausted' : sub.status === 'Active' ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex gap-2 justify-start opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button 
                          onClick={() => openEditModal(sub)}
                          className="p-3.5 bg-white text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm border border-slate-100 active:scale-90"
                          title="تعديل"
                        >
                          <Edit3 size={20} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSubscription(sub.id)}
                          className="p-3.5 bg-white text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm border border-slate-100 active:scale-90"
                          title="حذف"
                        >
                          <Trash2 size={20} />
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

      {/* NEW SUBSCRIPTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[12px] animate-in fade-in duration-700" 
            onClick={() => !isSubmitting && !showConfirm && (setIsModalOpen(false), resetForm())} 
          />
          
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden text-right border border-white animate-in zoom-in-95 slide-in-from-bottom-20 duration-500 flex flex-col max-h-[90vh]">
            <div className="p-10 pb-8 relative overflow-hidden shrink-0 border-b border-slate-100">
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-transparent -z-10" />
              <div className="flex flex-row-reverse justify-between items-center relative z-10">
                <div className="text-right">
                  <div className="flex items-center gap-3 justify-end mb-2">
                     <div className="p-2 bg-indigo-600 rounded-xl">
                        <Plus size={20} className="text-white" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 tracking-tight">إضافة باقة جديدة</h3>
                  </div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mr-12 opacity-60">Elite Activation Portal</p>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); resetForm(); }} 
                  className="p-4 bg-slate-50 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="px-10 pb-10 pt-2 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              {/* Search Section */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">اختيار العميل</label>
                
                <div className="relative">
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، الكود، أو رقم الهاتف..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-16 py-6 text-base font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-right"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedCustomer(null);
                      }}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-3">
                       {isSearching && <Loader2 size={22} className="animate-spin text-indigo-500" />}
                       <Search className={isSearching ? 'hidden' : 'block group-focus-within:text-indigo-600 transition-colors'} size={24} />
                    </div>
                  </div>

                  {searchQuery.trim().length >= 2 && !selectedCustomer && (
                    <div className="absolute w-full mt-2 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-[200] overflow-hidden divide-y divide-slate-50 animate-in slide-in-from-top-2">
                      {searchResults.length > 0 ? (
                        searchResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setSearchQuery(c.full_name);
                              setSearchResults([]);
                            }}
                            className="w-full px-8 py-5 flex flex-row-reverse items-center justify-between hover:bg-indigo-50/50 transition-colors group/item"
                          >
                             <div className="text-right">
                               <p className="font-black text-slate-900 text-sm group-hover/item:text-indigo-600 transition-colors">{c.full_name}</p>
                               <div className="flex flex-row-reverse items-center gap-3">
                                  <span className="text-[10px] text-slate-400 font-bold">{c.phone || 'بدون هاتف'}</span>
                                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                  <span className="text-[10px] text-indigo-500 font-black">{c.code}</span>
                               </div>
                             </div>
                             <CheckCircle2 size={16} className="text-slate-100 group-hover/item:text-indigo-500 transition-all" />
                          </button>
                        ))
                      ) : !isSearching && (
                        <div className="p-10 text-center">
                           <User className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                           <p className="text-sm font-black text-slate-400">عذراً، لم نجد نتائج</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="mt-5 p-7 bg-emerald-50/50 border border-emerald-100 rounded-[2.5rem] flex flex-row-reverse items-center gap-5 animate-in zoom-in-95">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100"><User size={28}/></div>
                      <div className="text-right flex-1">
                        <p className="font-black text-emerald-900 text-lg leading-tight mb-2">{selectedCustomer.full_name}</p>
                        <div className="flex flex-row-reverse items-center gap-3 font-mono">
                           <span className="text-xs text-emerald-600/60 font-bold">{selectedCustomer.phone}</span>
                           <span className="w-1 h-1 bg-emerald-200 rounded-full" />
                           <span className="text-xs text-emerald-600 font-black tracking-widest">{selectedCustomer.code}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedCustomer(null); setSearchQuery(''); }} 
                        className="p-4 bg-white text-rose-400 hover:text-rose-600 rounded-xl shadow-sm hover:shadow-xl transition-all active:scale-90"
                      >
                        <X size={20}/>
                      </button>
                    </div>
                  )}
                </div>
              </div>

               {/* Package Selector */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">اختر الباقة المناسبة</label>
                <div className="grid grid-cols-3 gap-4">
                  {PACKAGES.map(pkg => (
                    <button
                      key={pkg.name}
                      onClick={() => handlePresetSelect(pkg)}
                      className={`relative p-6 rounded-[2rem] border-2 transition-all text-center group ${
                        formData.hours === pkg.hours && formData.basePrice === pkg.price
                        ? 'border-indigo-600 bg-indigo-50/30'
                        : 'border-slate-50 bg-slate-50/30 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                         formData.hours === pkg.hours && formData.basePrice === pkg.price
                         ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]'
                         : 'bg-white text-slate-200 border border-slate-100 shadow-sm'
                      }`}>
                         <Clock size={22} />
                      </div>
                      <p className="text-[11px] font-black text-slate-900 mb-2 leading-none">{pkg.hours} ساعة</p>
                      <p className="text-lg font-black text-indigo-600">{pkg.price} <span className="text-[10px] opacity-40 lowercase ml-1">EGP</span></p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown Section */}

              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">سعر الباقة</label>
                  <div className="relative group">
                    <History className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData({...formData, basePrice: val, amountPaid: val - formData.discount});
                      }}
                      className="w-full bg-white border-2 border-slate-100 rounded-3xl px-14 py-5 text-lg font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center h-16"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">خصم العميل</label>
                  <div className="relative group">
                    <Tag className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                      type="number"
                      value={formData.discount}
                      onChange={(e) => {
                         const val = Number(e.target.value);
                         setFormData({...formData, discount: val, amountPaid: formData.basePrice - val});
                      }}
                      className="w-full bg-white border-2 border-slate-100 rounded-3xl px-14 py-5 text-lg font-black text-rose-500 outline-none focus:border-rose-300 transition-all text-center h-16"
                    />
                  </div>
                </div>

                <div className="space-y-4 col-span-2 pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center px-2 mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ الذي تم دفعه الآن</label>
                    {finalPrice - Number(formData.amountPaid) > 0 && (
                      <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg animate-pulse">
                        متبقي عليه: {(finalPrice - Number(formData.amountPaid)).toLocaleString()} EGP
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                     <CreditCard className="absolute right-8 top-1/2 -translate-y-1/2 text-indigo-400" size={28} />
                     <input
                        type="number"
                        value={formData.amountPaid}
                        onChange={(e) => setFormData({...formData, amountPaid: Number(e.target.value)})}
                        max={finalPrice}
                        className="w-full bg-indigo-900 border-4 border-indigo-100/20 rounded-[2rem] px-20 py-8 text-3xl font-black text-white outline-none focus:scale-[1.02] transition-all text-center shadow-2xl"
                     />
                     <div className="absolute left-8 top-1/2 -translate-y-1/2 text-indigo-300 font-bold">EGP</div>
                  </div>
                  <div className="flex gap-2 justify-center mt-3">
                    <button 
                      onClick={() => setFormData({...formData, amountPaid: finalPrice})}
                      className="text-[9px] font-black bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                    >
                      دفع الكل
                    </button>
                    <button 
                      onClick={() => setFormData({...formData, amountPaid: 0})}
                      className="text-[9px] font-black bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                    >
                      دفع 0 (آجل)
                    </button>
                  </div>
                </div>
              </div>


              {/* Summary Card */}
              <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] group-hover:scale-125 transition-transform duration-[2000ms]" />
                <div className="relative z-10 flex flex-row-reverse justify-between items-center text-right">
                  <div>
                    <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-3">Total Payment Due</p>
                    <p className="text-6xl font-black tracking-tighter">{finalPrice.toLocaleString()} <span className="text-xl font-bold opacity-30 ml-2">EGP</span></p>
                  </div>
                  <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center text-white backdrop-blur-xl">
                     <Receipt size={40} className="opacity-80" />
                  </div>
                </div>
                
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!selectedCustomer}
                  className="w-full mt-12 bg-indigo-600 text-white h-24 rounded-3xl font-black text-2xl hover:bg-white hover:text-indigo-950 transition-all shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-95 disabled:opacity-10 disabled:pointer-events-none flex items-center justify-center gap-6"
                >
                  تأكيد واشتراك الآن
                  <ChevronLeft size={32} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SUBSCRIPTION MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[12px] animate-in fade-in duration-700" 
            onClick={() => !isSubmitting && (setIsEditModalOpen(false), setEditingSubscription(null))} 
          />
          
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-3xl relative overflow-hidden text-right border border-white animate-in zoom-in-95 slide-in-from-bottom-20 duration-500 flex flex-col max-h-[90vh]">
            <div className="p-10 pb-8 relative overflow-hidden shrink-0 border-b border-slate-100">
               <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-transparent -z-10" />
               <div className="flex flex-row-reverse justify-between items-center relative z-10">
                 <div className="text-right">
                   <div className="flex items-center gap-3 justify-end mb-2">
                     <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                        <Edit3 size={20} />
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 tracking-tight">تعديل بيانات الباقة</h3>
                   </div>
                   <p className="text-slate-400 text-[10px] font-black mr-12 opacity-80">{editingSubscription?.name}</p>
                 </div>
                 <button 
                   onClick={() => { setIsEditModalOpen(false); setEditingSubscription(null); }} 
                   className="p-4 bg-slate-50 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 active:scale-95"
                 >
                   <X size={24} />
                 </button>
               </div>
            </div>

            <div className="px-10 pb-10 pt-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">إجمالي الساعات</label>
                     <input
                        type="number"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                        value={editData.totalHours}
                        onChange={(e) => setEditData({ ...editData, totalHours: Number(e.target.value) })}
                     />
                  </div>
                  <div className="space-y-3">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">ساعات الاستهلاك</label>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                           <input
                              type="number"
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                              value={editData.usedHrs}
                              onChange={(e) => setEditData({ ...editData, usedHrs: Number(e.target.value) })}
                           />
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 uppercase">H</span>
                        </div>
                        <div className="relative">
                           <input
                              type="number"
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                              value={editData.usedMins}
                              min={0}
                              max={59}
                              onChange={(e) => setEditData({ ...editData, usedMins: Number(e.target.value) })}
                           />
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 uppercase">M</span>
                        </div>
                     </div>
                  </div>
               </div>
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">سعر الباقة</label>
                      <div className="relative">
                        <History size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                          type="number"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-6 pr-12 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center h-14"
                          value={editData.price}
                          onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) })}
                        />
                      </div>
                   </div>
                   <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">المبلغ المدفوع</label>
                      <div className="relative">
                        <CreditCard size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <input
                          type="number"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-6 pr-12 py-4 text-sm font-black text-emerald-600 outline-none focus:border-indigo-400 transition-all text-center h-14"
                          value={editData.paid}
                          onChange={(e) => setEditData({ ...editData, paid: Number(e.target.value) })}
                        />
                      </div>
                   </div>
                   {editData.price - editData.paid > 0 && (
                     <div className="col-span-2 p-4 bg-rose-50 rounded-2xl flex items-center justify-between border border-rose-100">
                       <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">المبلغ المتبقي للتحصيل</span>
                       <span className="text-xl font-black text-rose-600">{(editData.price - editData.paid).toLocaleString()} EGP</span>
                     </div>
                   )}
                </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">تاريخ الانتهاء</label>
                     <input
                        type="date"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center"
                        value={editData.endDate}
                        onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                     />
                  </div>
                  <div className="space-y-3">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mr-2">حالة الاشتراك</label>
                     <select
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 transition-all text-center appearance-none"
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                     >
                        <option value="Active">نشط (Active)</option>
                        <option value="Exhausted">منتهي الساعات (Exhausted)</option>
                        <option value="Expired">منتهي التاريخ (Expired)</option>
                     </select>
                  </div>
               </div>

               <div className="pt-6">
                  <button
                    onClick={handleUpdateSubscription}
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white h-20 rounded-3xl font-black text-lg hover:bg-slate-900 transition-all shadow-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات الحالية'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* FINAL CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-3xl animate-in fade-in" onClick={() => !isSubmitting && setShowConfirm(false)} />
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 relative overflow-hidden text-right border border-slate-100 shadow-[0_50px_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
             <div className="text-center mb-10">
                <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-rose-100">
                   <AlertCircle size={44} className="animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight">تأكيد نهائي؟</h3>
                <p className="text-slate-400 text-sm font-bold mt-2">يرجى التأكد من اختيار العميل الصحيح</p>
             </div>

             <div className="space-y-5 mb-12">
                <div className="bg-slate-50 p-8 rounded-[2rem] space-y-6 border border-slate-100">
                   <div className="flex flex-row-reverse justify-between items-center text-right border-b border-slate-200 pb-6 last:border-0 last:pb-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المشترك</span>
                      <span className="text-lg font-black text-slate-900">{selectedCustomer?.full_name}</span>
                   </div>
                   <div className="flex flex-row-reverse justify-between items-center text-right border-b border-slate-200 pb-6 last:border-0 last:pb-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع الباقة</span>
                      <span className="text-lg font-black text-indigo-600">{formData.hours} ساعة</span>
                   </div>
                   <div className="flex flex-row-reverse justify-between items-center text-right border-b border-slate-200 pb-6 last:border-0 last:pb-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المبلغ</span>
                      <span className="text-3xl font-black text-emerald-600 underline decoration-8 decoration-emerald-100 underline-offset-4">{finalPrice} EGP</span>
                   </div>
                </div>
             </div>

             <div className="flex flex-row-reverse gap-4">
                <button
                   onClick={handleSaveSubscription}
                   disabled={isSubmitting}
                   className="flex-1 h-20 bg-slate-900 text-white rounded-3xl font-black text-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-4 group/final shadow-2xl"
                >
                   {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                   {isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
                </button>
                <button
                   onClick={() => setShowConfirm(false)}
                   disabled={isSubmitting}
                   className="px-8 h-20 bg-slate-100 text-slate-400 rounded-3xl font-black text-base hover:bg-slate-100 transition-all active:scale-95"
                >
                   تعديل
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPanel;
