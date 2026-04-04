
import React, { useState, useEffect } from 'react';
import { Briefcase, GraduationCap, Plus, Search, Settings, X, CheckCircle2, Printer, Calendar, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Contract } from '../types';

export const ContractsPanel = ({ branchId }: { branchId?: string }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'business' | 'student'>('business');
  const [activeModal, setActiveModal] = useState<'add' | 'view' | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (branchId) fetchContracts();
  }, [branchId]);

  const fetchContracts = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('contracts')
      .select('*, customers(id, code, full_name)')
      .eq('branch_id', branchId);

    if (data) {
      const formatted: Contract[] = data.map(c => ({
        id: c.id,
        partner: c.partner_name,
        type: (c.type as any) || 'Business',
        discount: c.discount || '0%',
        members: c.members || 0,
        status: (c.status as any) || 'Active',
        cashback: c.cashback || 0,
        startDate: c.start_date || '',
        endDate: c.end_date || '',
        conditionsUs: c.conditions_us || [],
        conditionsPartner: c.conditions_partner || [],
        prepaidBalance: c.prepaid_balance || 0,
        spacePrice: c.space_price || 0,
        memberCodes: c.customers?.map((m: any) => m.code).join(', ') || ''
      }));
      setContracts(formatted);
    }
    setLoading(false);
  };

  // Form State
  const [formData, setFormData] = useState({
    partner: '',
    discount: '',
    members: '',
    cashback: '', 
    startDate: '',
    endDate: '',
    conditionsUs: '',
    conditionsPartner: '',
    prepaidBalance: '',
    spacePrice: '',
    memberCodes: ''
  });

  const getStudentCashbackPercentage = () => {
    return localStorage.getItem('studentCashback') || '15';
  };

  const filteredContracts = contracts.filter(c => tab === 'business' ? c.type === 'Business' : c.type === 'Student');

  const handleAddContract = async () => {
    if (!formData.partner || !formData.discount) return;

    const cashbackValue = tab === 'business' ? 0 : Number(getStudentCashbackPercentage());

    const { data: newContract, error } = await (supabase as any).from('contracts').insert({
      branch_id: branchId,
      partner_name: formData.partner,
      type: tab === 'business' ? 'Business' : 'Student',
      discount: formData.discount.includes('%') ? formData.discount : `${formData.discount}%`,
      members: Number(formData.members) || 0,
      status: 'Active',
      cashback: cashbackValue,
      start_date: formData.startDate,
      end_date: formData.endDate,
      conditions_us: formData.conditionsUs.split('\n').filter(Boolean),
      conditions_partner: formData.conditionsPartner.split('\n').filter(Boolean),
      prepaid_balance: Number(formData.prepaidBalance) || 0,
      space_price: Number(formData.spacePrice) || 0
    }).select().single();

    if (error) {
        alert(error.message);
        return;
    }

    // Assign members if codes are provided
    if (newContract && formData.memberCodes) {
       const codes = formData.memberCodes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
       if (codes.length > 0) {
          await supabase
            .from('customers')
            .update({ contract_id: newContract.id } as any)
            .in('code', codes);
       }
    }

    setActiveModal(null);
    setNotification('تم إضافة التعاقد بنجاح');
    setTimeout(() => setNotification(null), 3000);
    fetchContracts();
    setFormData({ 
        partner: '', 
        discount: '', 
        members: '', 
        cashback: '', 
        startDate: '', 
        endDate: '', 
        conditionsUs: '', 
        conditionsPartner: '',
        prepaidBalance: '',
        spacePrice: '',
        memberCodes: ''
    });
  };

  const openViewModal = (contract: Contract) => {
    setSelectedContract(contract);
    setActiveModal('view');
  };

  const handlePrintContract = (contract: Contract) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cashbackDisplay = contract.type === 'Business' ? 'غير مفعل' : `${contract.cashback}%`;

    const htmlContent = `
      <html dir="rtl">
        <head>
          <title>عقد اتفاق - ${contract.partner}</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; background: #f8fafc; padding: 10px; margin-bottom: 15px; border-radius: 8px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .item { margin-bottom: 10px; }
            .label { font-weight: bold; color: #64748b; font-size: 14px; }
            .value { font-size: 16px; font-weight: bold; }
            ul { margin: 0; padding-right: 20px; }
            li { margin-bottom: 8px; }
            .footer { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; }
            .sig-line { width: 200px; border-top: 1px solid #000; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">عقد اتفاق وشراكة</h1>
            <p>بين Campus Hub و ${contract.partner}</p>
          </div>

          <div class="section">
            <div class="section-title">بيانات التعاقد</div>
            <div class="grid">
              <div class="item"><div class="label">نوع التعاقد</div><div class="value">${contract.type === 'Business' ? 'شركات (Business)' : 'أنشطة طلابية (Student Activity)'}</div></div>
              <div class="item"><div class="label">تاريخ البدء</div><div class="value">${contract.startDate || '-'}</div></div>
              <div class="item"><div class="label">تاريخ الانتهاء</div><div class="value">${contract.endDate || '-'}</div></div>
              <div class="item"><div class="label">نسبة الخصم</div><div class="value">${contract.discount}</div></div>
              <div class="item"><div class="label">عدد الأعضاء</div><div class="value">${contract.members}</div></div>
              <div class="item"><div class="label">كاش باك</div><div class="value">${cashbackDisplay}</div></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">التزامات الطرف الأول (Campus Hub)</div>
            <ul>
              ${contract.conditionsUs?.map(c => `<li>${c}</li>`).join('') || '<li>لا توجد شروط إضافية</li>'}
            </ul>
          </div>

          <div class="section">
            <div class="section-title">التزامات الطرف الثاني (${contract.partner})</div>
            <ul>
              ${contract.conditionsPartner?.map(c => `<li>${c}</li>`).join('') || '<li>لا توجد شروط إضافية</li>'}
            </ul>
          </div>

          <div class="footer">
            <div>
              <p>توقيع الطرف الأول</p>
              <div class="sig-line"></div>
            </div>
            <div>
              <p>توقيع الطرف الثاني</p>
              <div class="sig-line"></div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right pb-20 relative">

      {/* Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[60] flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="text-emerald-400" />
          <span className="font-bold">{notification}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white p-2 rounded-[2.5rem] border border-slate-100 w-fit mx-auto shadow-sm">
        <button
          onClick={() => setTab('business')}
          className={`flex items-center gap-3 px-12 py-4 rounded-[2rem] font-black transition-all ${tab === 'business' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
        >
          <Briefcase size={20} /> تعاقدات البيزنس
        </button>
        <button
          onClick={() => setTab('student')}
          className={`flex items-center gap-3 px-12 py-4 rounded-[2rem] font-black transition-all ${tab === 'student' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
        >
          <GraduationCap size={20} /> الأنشطة الطلابية
        </button>
      </div>

      {/* Contracts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredContracts.map((contract) => (
          <div key={contract.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all relative group">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl shadow-inner">{contract.partner[0]}</div>
                <div>
                  <h4 className="text-xl font-black text-slate-800">{contract.partner}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{contract.type} Partnership</span>
                </div>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black border ${contract.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>{contract.status}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">الخصم</p><p className="text-xl font-black text-indigo-600">{contract.discount}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">الأعضاء</p><p className="text-xl font-black text-slate-800">{contract.members}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">كاش باك</p>
                <p className="text-xl font-black text-emerald-600">
                  {contract.type === 'Business' ? '-' : `${contract.cashback}%`}
                </p>
              </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-slate-50">
              <button
                onClick={() => openViewModal(contract)}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors"
              >
                <Search size={14} /> عرض التفاصيل
              </button>
              <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-colors"><Settings size={18} /></button>
            </div>
          </div>
        ))}

        {/* Add Button */}
        <button
          onClick={() => setActiveModal('add')}
          className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-indigo-400 hover:text-indigo-400 transition-all min-h-[300px]"
        >
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
            <Plus size={32} />
          </div>
          <span className="font-black text-lg">إضافة تعاقد جديد</span>
          <span className="text-xs font-bold text-slate-400">لـ {tab === 'business' ? 'البيزنس' : 'الأنشطة الطلابية'}</span>
        </button>
      </div>

      {/* --- ADD CONTRACT MODAL --- */}
      {activeModal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 relative my-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800">تعاقد جديد</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">إضافة {tab === 'business' ? 'شركة' : 'نشاط طلابي'} جديد</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X className="text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2">اسم الشريك (Partner)</label>
                <input
                  type="text"
                  placeholder="اسم الشركة أو النشاط"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-500 transition-all"
                  value={formData.partner}
                  onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">بداية التعاقد</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">نهاية التعاقد</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">نسبة الخصم</label>
                <input
                  type="text"
                  placeholder="20%"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-500 transition-all"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">عدد الأعضاء المتوقع</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-500 transition-all"
                  value={formData.members}
                  onChange={(e) => setFormData({ ...formData, members: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2">شروط التعاقد (علينا) - كل شرط في سطر</label>
                <textarea
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-medium text-slate-600 outline-none focus:border-indigo-500 transition-all min-h-[80px]"
                  placeholder="مثال: توفير قاعة اجتماعات مرة شهرياً..."
                  value={formData.conditionsUs}
                  onChange={(e) => setFormData({ ...formData, conditionsUs: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2">شروط التعاقد (على الشريك) - كل شرط في سطر</label>
                <textarea
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-medium text-slate-600 outline-none focus:border-indigo-500 transition-all min-h-[80px]"
                  placeholder="مثال: وضع الشعار على صفحات التواصل..."
                  value={formData.conditionsPartner}
                  onChange={(e) => setFormData({ ...formData, conditionsPartner: e.target.value })}
                />
              </div>

              {tab === 'student' && (
                <div className="col-span-2 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-600">نظام الكاش باك مفعل (Global)</p>
                    <p className="text-[10px] text-emerald-400 mt-1">يتم تطبيق نسبة كاش باك تلقائية من الإعدادات</p>
                  </div>
                  <span className="text-2xl font-black text-emerald-600">{getStudentCashbackPercentage()}%</span>
                </div>
              )}
            </div>

            <button
              onClick={handleAddContract}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
            >
              حفظ التعاقد
            </button>
          </div>
        </div>
      )}

      {/* --- VIEW DETAILS MODAL --- */}
      {activeModal === 'view' && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative overflow-hidden text-center my-8">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-6 left-6 p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="text-slate-400" />
            </button>

            <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 font-black text-4xl shadow-inner mx-auto mb-6">
              {selectedContract.partner[0]}
            </div>

            <h3 className="text-3xl font-black text-slate-800 mb-2">{selectedContract.partner}</h3>
            <p className="text-slate-400 text-sm font-bold mb-4">{selectedContract.startDate} - {selectedContract.endDate}</p>
            <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">{selectedContract.type} Partnership</span>

            <div className="grid grid-cols-3 gap-4 my-8">
              <div className="bg-indigo-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-indigo-400 mb-1">الخصم</p>
                <p className="text-2xl font-black text-indigo-700">{selectedContract.discount}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 mb-1">الأعضاء</p>
                <p className="text-2xl font-black text-slate-800">{selectedContract.members}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-emerald-500 mb-1">كاش باك</p>
                <p className="text-2xl font-black text-emerald-700">
                  {selectedContract.type === 'Business' ? '-' : `${selectedContract.cashback}%`}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-right mb-8">
              {selectedContract.conditionsUs && selectedContract.conditionsUs.length > 0 && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-indigo-500" /> التزاماتنا (Us)</h4>
                  <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                    {selectedContract.conditionsUs.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {selectedContract.conditionsPartner && selectedContract.conditionsPartner.length > 0 && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2"><FileText size={14} className="text-slate-500" /> التزامات الشريك</h4>
                  <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                    {selectedContract.conditionsPartner.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handlePrintContract(selectedContract)}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
              >
                <Printer size={16} /> طباعة العقد
              </button>
              <button className="py-4 px-6 border-2 border-rose-100 text-rose-500 font-bold rounded-2xl hover:bg-rose-50 transition-all">
                إنهاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
