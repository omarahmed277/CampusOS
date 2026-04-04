
import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Mail, Phone, MoreVertical, Plus, X, Edit, QrCode, Send, Trash2, CheckCircle2, Loader2, ChevronUp, AlertCircle, Clock, Users2, RefreshCw, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { Tables } from '../database.types';

type Customer = Tables<'customers'>;

export const CustomerDatabase = ({ branchId }: { branchId?: string }) => {
  // --- STATE ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'add' | 'edit' | 'qr' | 'email' | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    full_name: '', phone: '', email: '', gender: 'Male', birth_date: '', referral_source: '', is_active: true, college: ''
  });

  const [emailSubject, setEmailSubject] = useState('رسالة من Campus');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [syncingWifi, setSyncingWifi] = useState<string | null>(null);


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

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ column: keyof Customer, ascending: boolean }>({
    column: 'code',
    ascending: true
  });
  const itemsPerPage = 50;

  // --- FETCHING ---
  useEffect(() => {
    fetchCustomers();

    // Realtime Subscription
    const channel = supabase
      .channel('customers_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          console.log('Realtime update:', payload);
          // For large datasets with server pagination, we should probably just refresh the current page
          // or handle inserts/deletes carefully. For now, simple refresh is safest for counts.
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, searchTerm, sortConfig]);

  // Log email errors to console for debugging
  useEffect(() => {
    const failedEmails = customers.filter(c => c.email_status === 'failed');
    if (failedEmails.length > 0) {
      console.group('🚨 Email Sending Failures Report 🚨');
      failedEmails.forEach(c => {
        console.error(
          `%cCustomer:%c ${c.full_name}\n%cEmail:%c ${c.email}\n%cError:%c ${c.email_error || 'Unknown Error (Check Edge Function Logs)'}`,
          'font-weight: bold', 'color: inherit',
          'font-weight: bold', 'color: inherit',
          'font-weight: bold; color: red', 'color: red'
        );
      });
      console.groupEnd();
    }
  }, [customers]);

  const fetchCustomers = async () => {
    setLoading(true);
    console.log('Fetching customers from Supabase (Server-side Pagination)...');
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        // Expand search to include name, code, email, and phone
        query = query.or(`full_name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query
        .order(sortConfig.column, { ascending: sortConfig.ascending })
        .range(from, to);

      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
      
      console.log('Total customers count:', count);
      setCustomers(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      showNotification('خطأ في تحميل البيانات: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---

  // 1. Add New Customer
  const handleAddSubmit = async () => {
    if (!formData.full_name || !formData.phone) {
      showNotification('يرجى ملء الحقول الأساسية');
      return;
    }

    console.log('Attempting to add customer:', formData);
    try {
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

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          full_name: formData.full_name,
          phone: formData.phone!,
          email: formData.email,
          gender: formData.gender,
          birth_date: formData.birth_date,
          referral_source: formData.referral_source,
          college: formData.college,
          code: generatedCode, 
        }] as any)
        .select()
        .single();

      if (error) {
        console.error('Database Error:', error);
        throw error;
      }

      console.log('Customer added successfully:', data);
      
      // Integration: Add user to MikroTik Hotspot via Edge Function
      await handleSyncToMikrotik(data);

      resetForm();
      showNotification(`تم إضافة العميل ${data.full_name} بنجاح!`);
    } catch (error: any) {
      console.error('Registration Error:', error);
      showNotification('خطأ في الإضافة: ' + error.message);
    }
  };

  // 2. Edit Customer
  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(customer);
    setActiveModal('edit');
  };

  const handleEditSubmit = async () => {
    if (!selectedCustomer) return;
    console.log('Updating customer:', selectedCustomer.id, formData);
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          phone: formData.phone,
          email: formData.email,
          is_active: formData.is_active,
        })
        .eq('id', selectedCustomer.id)
        .select()
        .single();

      if (error) {
        console.error('Update Error:', error);
        throw error;
      }

      console.log('Update success:', data);
      // setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? data : c)); // Handled by Realtime subscription
      resetForm();
      showNotification('تم تحديث بيانات العميل بنجاح');
    } catch (error: any) {
      console.error('Edit Error:', error);
      showNotification('خطأ في التحديث: ' + error.message);
    }
  };

  // 3. Sync with MikroTik Hotspot
  const handleSyncToMikrotik = async (customer: Customer) => {
    if (!customer.code) return;
    setSyncingWifi(customer.id);
    try {
      console.log('📡 Syncing with MikroTik Hotspot...');
      const mikrotikUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-mikrotik-hotspot-user`;
      
      const res = await fetch(mikrotikUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          code: customer.code, 
          phone: customer.phone, 
          full_name: customer.full_name 
        })
      });
      
      const result = await res.json();
      if (result.success) {
        showNotification(`📶 تم تفعيل شبكة الواي فاي للعميل (${customer.code}) بنجاح! يمكنه الآن تسجيل الدخول.`);
      } else {
        throw new Error(result.error || 'فشل التفعيل');
      }
    } catch (err: any) {
      console.error('❌ MikroTik Sync Error:', err);
      showNotification('🚫 فشل تفعيل الواي فاي: ' + err.message);
    } finally {
      setSyncingWifi(null);
    }
  };

  // 4. Resend Email
  const handleResendEmail = async (customer: Customer) => {
    if (!customer.email) return;
    try {
      showNotification(`جاري إرسال البريد إلى ${customer.email}...`);
      
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ record: customer })
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'فشل الإرسال عبر الخادم');
      
      showNotification(`تم إعادة إرسال الكود (${customer.code}) إلى ${customer.email} بنجاح!`);
    } catch (err: any) {
      console.error('Email Resend Error:', err);
      showNotification('خطأ في إعادة الإرسال: ' + err.message);
    }
  };

  const handleSendCustomEmail = async () => {
    if (!selectedCustomer || !selectedCustomer.email) return;
    if (!emailSubject || !emailBody) {
      showNotification('يرجى كتابة الموضوع ومحتوى الرسالة');
      return;
    }

    setSendingEmail(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-custom-email`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          customerId: selectedCustomer.id,
          subject: emailSubject,
          body: emailBody
        })
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'فشل الإرسال');
      
      showNotification(`تم إرسال البريد إلى ${selectedCustomer.email} بنجاح!`);
      setActiveModal(null);
      setEmailBody('');
    } catch (err: any) {
      console.error('Custom Email Error:', err);
      showNotification('خطأ في الإرسال: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const openEmailModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEmailBody(`أهلاً ${customer.full_name}،\n\n`);
    setActiveModal('email');
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل ${customer.full_name} نهائياً؟ \nسيتم حذف جميع سجلاته (الزيارات، الطلبات، الاشتراكات، الجلسات) ولا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)
        .select();

      if (error) {
        if (error.code === '23503') {
          throw new Error('لا يمكن حذف هذا العميل لوجود سجلات مرتبطة به (زيارات، حجوزات، أو اشتراكات). يمكنك تعطيل الحساب بدلاً من حذفه.');
        }
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('لم يتم حذف أي سجل. قد لا تملك الصلاحيات الكافية لحذف هذا العميل.');
      }

      showNotification('تم حذف العميل بنجاح');
      // fetchCustomers(); // Handled by realtime
    } catch (error: any) {
      console.error('Delete Error:', error);
      alert('خطأ في الحذف: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  // Helpers
  const resetForm = () => {
    setFormData({ full_name: '', phone: '', email: '', gender: 'Male', birth_date: '', referral_source: '', is_active: true, college: '' });
    setActiveModal(null);
    setSelectedCustomer(null);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // No client-side filtering needed anymore as we do it on server
  const filteredCustomers = customers;

  // Pagination Logic
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = customers; // Already paginated from server

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right pb-20 relative">

      {/* Notifications */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[60] flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="text-emerald-400" size={20} />
          <span className="font-bold">{notification}</span>
        </div>
      )}

      {/* Header Controls */}
      <div className="bg-white/90 backdrop-blur-xl p-3 sm:p-6 rounded-3xl sm:rounded-[2.5rem] border border-white shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-4 sm:gap-6 sticky top-2 sm:top-6 z-40 transition-all mx-2 sm:mx-0">
        <div className="relative flex-1 w-full lg:max-w-md group">
          <Search className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl pr-12 sm:pr-16 pl-4 sm:pl-6 py-3 sm:py-4 text-sm sm:text-lg font-black focus:border-indigo-500 focus:bg-white focus:ring-8 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Desktop Buttons / Mobile Filter Trigger */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="hidden lg:flex items-center gap-3 w-full">
            <button
              onClick={() => setActiveModal('add')}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              <Plus size={18} /> إضافة عميل
            </button>

            <button 
              onClick={() => setSortConfig(prev => ({ column: 'code', ascending: !prev.ascending }))}
              className="px-6 py-4 bg-white text-slate-600 border-2 border-slate-100 rounded-2xl font-black text-sm hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95 flex items-center gap-2"
            >
              {sortConfig.ascending ? <ChevronUp size={16} /> : <ChevronUp size={16} className="rotate-180" />} 
              الترتيب
            </button>
            
            <button className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2">
               <Download size={16} /> تصدير Excel
            </button>
          </div>

          {/* Quick Actions Mobile Bar */}
          <div className="flex lg:hidden items-center gap-2 w-full">
            <button 
              onClick={() => setSortConfig(prev => ({ column: 'code', ascending: !prev.ascending }))}
              className="flex-1 h-12 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center gap-2 font-black text-xs text-slate-600 active:bg-slate-50"
            >
               <Filter size={16} /> تصفية
            </button>
            <button 
              onClick={() => fetchCustomers()}
              className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center active:scale-90 transition-all"
            >
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all">
               <Download size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) for Mobile - Add Customer */}
      <div className="fixed bottom-24 left-6 z-50 lg:hidden">
        <button
          onClick={() => setActiveModal('add')}
          className="w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-300 flex items-center justify-center active:scale-90 active:rotate-90 transition-all border-4 border-white"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      </div>

      {/* Database Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-lg z-40 flex items-center justify-center rounded-[2.5rem]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={64} />
              <p className="text-indigo-900 font-black animate-pulse">جاري تحميل البيانات...</p>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden min-h-[500px] relative group/table transition-all">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 bg-white z-20">
                <th 
                  className="px-8 py-6 cursor-pointer hover:text-indigo-600 transition-colors group"
                  onClick={() => setSortConfig(prev => ({ 
                    column: 'code', 
                    ascending: prev.column === 'code' ? !prev.ascending : true 
                  }))}
                >
                  <div className="flex items-center gap-2">
                    <span>الاسم والكود</span>
                    {sortConfig.column === 'code' && (
                      <ChevronUp className={`transition-transform duration-300 ${sortConfig.ascending ? '' : 'rotate-180'}`} size={12} />
                    )}
                  </div>
                </th>
                <th className="px-6 py-6">التواصل</th>
                <th className="px-6 py-6 text-center">النوع</th>
                <th className="px-6 py-6 text-center">حالة البريد</th>
                <th className="px-6 py-6 text-center">الحالة</th>
                <th className="px-8 py-6 text-left">أدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {paginatedCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-indigo-50/20 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3 text-right">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs uppercase shrink-0">
                        {customer.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-slate-800 font-black truncate max-w-[200px]">{customer.full_name}</p>
                        <p className="text-[10px] text-indigo-500 font-mono tracking-widest bg-indigo-50 px-2 rounded inline-block mt-1">{customer.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col gap-1 text-xs text-slate-500 text-right">
                      <span className="flex items-center gap-2 justify-end"><Phone size={12} /> {customer.phone}</span>
                      {customer.email && <span className="flex items-center gap-2 justify-end"><Mail size={12} /> {customer.email}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] ${customer.gender === 'Male' ? 'bg-blue-50 text-blue-500' : 'bg-pink-50 text-pink-500'}`}>{customer.gender === 'Male' ? 'ذكر' : 'أنثى'}</span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    {customer.email ? (
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 mx-auto w-fit ${
                        customer.email_status === 'sent' ? 'bg-emerald-50 text-emerald-600' :
                        customer.email_status === 'failed' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                        customer.email_status === 'sending' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {customer.email_status === 'sent' ? 'تم الإرساال' : customer.email_status === 'failed' ? 'فشل' : 'معلق'}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${customer.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {customer.is_active ? 'نشط' : 'خامل'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-left whitespace-nowrap">
                    <div className="flex justify-end gap-2 text-right">
                       <button 
                         onClick={() => handleSyncToMikrotik(customer)} 
                         disabled={syncingWifi === customer.id}
                         className={`p-2 rounded-xl transition-all ${syncingWifi === customer.id ? 'bg-indigo-100 text-indigo-400' : 'bg-slate-50 hover:bg-indigo-600 hover:text-white'}`}
                         title="تفعيل الواي فاي"
                       >
                         <Wifi size={16} className={syncingWifi === customer.id ? 'animate-pulse' : ''} />
                       </button>
                       <button onClick={() => openEditModal(customer)} className="p-2 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl transition-all">
                         <Edit size={16} />
                       </button>
                       <button onClick={() => { setSelectedCustomer(customer); setActiveModal('qr'); }} className="p-2 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl transition-all">
                         <QrCode size={16} />
                       </button>
                       <button onClick={() => handleDeleteCustomer(customer)} className="p-2 bg-slate-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all">
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center font-black text-slate-300 italic">لا يوجد عملاء مطابقين</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Mobile List View - Higher Density */}
        <div className="lg:hidden bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden pb-4">
           <div className="divide-y divide-slate-50">
             {paginatedCustomers.map(customer => (
               <div key={customer.id} className="flex items-center justify-between p-3 active:bg-slate-50 transition-colors relative">
                  {/* Visual Accent */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full ${customer.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-200'}`} />
                  
                  <div className="flex items-center gap-3 text-right">
                     <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                          {customer.full_name?.charAt(0)}
                        </div>
                        {customer.is_active && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                        )}
                     </div>
                     <div className="space-y-0 text-right overflow-hidden">
                        <h4 className="font-black text-slate-900 text-[13px] leading-tight truncate max-w-[120px]">{customer.full_name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono font-black text-indigo-500/80 uppercase tracking-tighter">{customer.code}</span>
                          <span className="text-[10px] font-black text-slate-400 font-mono scale-[0.8] origin-right">{customer.phone}</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                      <button 
                         onClick={() => handleSyncToMikrotik(customer)} 
                         disabled={syncingWifi === customer.id}
                         className={`p-2 rounded-lg transition-all ${syncingWifi === customer.id ? 'text-indigo-400 bg-indigo-50' : 'text-indigo-600 bg-indigo-50/50 active:bg-indigo-600 active:text-white'}`}
                       >
                         <Wifi size={14} className={syncingWifi === customer.id ? 'animate-pulse' : ''} />
                      </button>
                      <button 
                        onClick={() => { setSelectedCustomer(customer); setActiveModal('qr'); }}
                       className="p-2 text-indigo-600 bg-indigo-50/50 rounded-lg active:bg-indigo-600 active:text-white transition-all"
                     >
                        <QrCode size={14} />
                     </button>
                     <button 
                       onClick={() => openEditModal(customer)}
                       className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                     >
                        <Edit size={14} />
                     </button>
                     <button 
                       onClick={() => handleDeleteCustomer(customer)}
                       className="p-2 text-rose-400 active:bg-rose-600 active:text-white rounded-lg transition-all"
                     >
                        <Trash2 size={14} />
                     </button>
                  </div>
               </div>
             ))}
           </div>
           {!loading && filteredCustomers.length === 0 && (
              <div className="py-20 text-center">
                <Users2 size={40} className="mx-auto text-slate-200 mb-2" />
                <p className="font-black text-slate-400 text-xs text-center">لا يوجد عملاء</p>
              </div>
           )}
        </div>
      </div>
      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm mb-10 mx-2 sm:mx-0">
          <div className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-widest text-center sm:text-right">
            عرض {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalCount)} من {totalCount}
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 h-10 bg-slate-100 text-slate-800 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all font-black text-xs"
            >
              بعده
            </button>

            <div className="flex items-center gap-1">
              {[...Array(Math.min(3, totalPages))].map((_, i) => {
                let pageNum;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 h-10 bg-slate-100 text-slate-800 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all font-black text-xs"
            >
              قبله
            </button>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. Add Customer Modal */}
      {activeModal === 'add' && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xl p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-2xl rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in slide-in-from-bottom-20 duration-500">
             {/* Mobile Drag Handle */}
             <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 sm:hidden shrink-0" />
            
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 sm:p-8 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2 sm:p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                  <Plus size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black">إضافة عميل جديد</h3>
                  <p className="text-indigo-300/60 text-[8px] sm:text-xs font-bold uppercase tracking-widest mt-0.5 sm:mt-1">إنشاء سجل جديد في النظام</p>
                </div>
              </div>
              <button 
                onClick={resetForm}
                className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    الاسم بالكامل
                  </label>
                  <input type="text" placeholder="مثال: أحمد محمد علي" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
                    value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    رقم الهاتف
                  </label>
                  <input type="text" placeholder="01xxxxxxxxx" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                    value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    البريد الإلكتروني
                  </label>
                  <input type="email" placeholder="example@mail.com" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    تاريخ الميلاد
                  </label>
                  <input type="date" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white"
                    value={formData.birth_date || ''} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    النوع (Gender)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setFormData({...formData, gender: 'Male'})}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border-2 ${formData.gender === 'Male' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                    >
                      ذكر
                    </button>
                    <button 
                      onClick={() => setFormData({...formData, gender: 'Female'})}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border-2 ${formData.gender === 'Female' ? 'bg-pink-600 text-white border-pink-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                    >
                      أنثى
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    كيف عرفت عنا؟
                  </label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    value={formData.referral_source || ''} onChange={e => setFormData({ ...formData, referral_source: e.target.value })}>
                    <option value="">اختر مصدر المعرفة...</option>
                    <option value="Facebook">فيسبوك</option>
                    <option value="Instagram">انستجرام</option>
                    <option value="Friend">ترشيح صديق</option>
                    <option value="Other">أخرى</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    الكلية
                  </label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    value={formData.college || ''} onChange={e => setFormData({ ...formData, college: e.target.value })}>
                    <option value="">اختر الكلية...</option>
                    {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-6 shrink-0 border-t border-slate-100">
                <button 
                  onClick={handleAddSubmit} 
                  className="w-full py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-indigo-200 hover:-translate-y-1 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={24} />
                  إكمال التسجيل و الحفظ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Edit Customer Modal */}
      {activeModal === 'edit' && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xl p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-20 duration-500 overflow-y-auto max-h-[90vh]">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0" />
            
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600">
                  <Edit size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">تعديل البيانات</h3>
                  <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">{selectedCustomer?.code}</p>
                </div>
              </div>
              <button 
                onClick={resetForm}
                className="p-3 hover:bg-slate-100 rounded-full transition-colors"
               >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border-2 border-amber-100/50 rounded-2xl text-amber-700 text-[13px] font-bold leading-relaxed flex items-start gap-4">
                <div className="bg-amber-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <AlertCircle size={14} />
                </div>
                <span>لا يمكن تعديل الاسم أو الكود أو النوع للحفاظ على تكامل البيانات التاريخية للمستخدم.</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700">رقم الهاتف</label>
                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                  value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700">البريد الإلكتروني</label>
                <input type="email" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                  value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700">تنشيط الحساب</label>
                <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                  value={String(formData.is_active)} onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })} >
                  <option value="true">نشط (Active)</option>
                  <option value="false">غير نشط (Inactive)</option>
                </select>
              </div>

              <div className="pt-6 flex gap-4">
                <button onClick={handleEditSubmit} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 hover:-translate-y-1 active:scale-95 transition-all shadow-xl">تحديث السجل</button>
                <button onClick={resetForm} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. QR Code Modal */}
      {activeModal === 'qr' && selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/80 backdrop-blur-2xl p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-sm rounded-t-[3.5rem] sm:rounded-[3rem] shadow-2xl p-8 sm:p-10 text-center relative animate-in slide-in-from-bottom-20 duration-500 overflow-hidden max-h-[95vh] flex flex-col items-center">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0" />
            
            {/* Background pattern */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-50 to-transparent -z-10" />
            
            <button 
              onClick={resetForm} 
              className="absolute top-8 right-8 p-3 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 hover:text-slate-600 transition-all"
            >
              <X size={20} />
            </button>

            <div className="mb-10">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-indigo-100 font-black text-3xl">
                C
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-2">{selectedCustomer.full_name}</h3>
              <p className="text-indigo-600 font-mono font-black tracking-[0.2em] text-xl bg-indigo-50 inline-block px-4 py-1 rounded-lg">{selectedCustomer.code}</p>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(79,70,229,0.2)] border-2 border-indigo-50 inline-block mb-10 group/qr hover:scale-105 transition-transform duration-500">
              <QRCodeSVG value={selectedCustomer.code} size={240} level="H" className="drop-shadow-sm" />
            </div>

            <p className="text-slate-400 text-sm font-bold mb-10 leading-relaxed px-4">استخدم هذا الرمز للمسح الضوئي السريع وبدء الجلسة تلقائياً في بوابة الدخول.</p>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <button className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">تحميل الكود</button>
                <button className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95">طباعة</button>
              </div>
              {selectedCustomer.qr_code && (
                <button 
                  onClick={() => window.open(selectedCustomer.qr_code, '_blank')}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Download size={18} className="text-indigo-400" />
                  فتح الاستمارة الرقمية
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Custom Email Modal */}
      {activeModal === 'email' && selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xl p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-xl rounded-t-[3.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-20 duration-500 max-h-[95vh] flex flex-col">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 sm:hidden shrink-0" />
            
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 sm:p-8 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black">إرسال بريد مخصص</h3>
                  <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">إلى: {selectedCustomer.full_name}</p>
                </div>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700">عنوان الرسالة (Subject)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700">محتوى الرسالة</label>
                <textarea 
                  className="w-full h-48 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all resize-none"
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                />
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleSendCustomEmail}
                  disabled={sendingEmail}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 size={24} className="animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send size={24} />
                      إرسال الرسالة الآن
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Feedback */}

      <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-40 lg:hidden pointer-events-none">
        <div className="bg-indigo-600 text-white px-6 py-4 rounded-3xl shadow-2xl shadow-indigo-200 animate-pulse border-2 border-white">
          <p className="text-[12px] font-black uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            Mobile Version
          </p>
        </div>
      </div>

    </div>
  );
};
