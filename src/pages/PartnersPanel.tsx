
import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Briefcase, 
  GraduationCap, 
  Plus, 
  Search, 
  Settings, 
  X, 
  CheckCircle2, 
  Printer, 
  Calendar, 
  FileText, 
  TrendingUp, 
  History, 
  DollarSign, 
  User, 
  Users,
  Users2,
  Phone,
  Copy,
  ChevronRight,
  Filter,
  Quote,
  ArrowUpRight,
  Cloud,
  LayoutDashboard,
  RefreshCw
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
  type: 'Business' | 'Student Activity';
  cashback_rate: number;
  total_earned: number;
  branch_id: string;
  is_active: boolean;
  discount: string;
  hours_discount?: string;
  members_count: number;
  start_date: string;
  end_date: string;
  conditions_us: string[];
  conditions_partner: string[];
  prepaid_balance: number;
  space_price: number;
  leader_name: string;
  leader_phone: string;
  notes: string;
  status: string;
  created_at: string;
}

export const PartnersPanel = ({ branchId }: { branchId?: string }) => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'All' | 'Business' | 'Student Activity'>('All');
  const [activeModal, setActiveModal] = useState<'add' | 'view' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Partner>>({});
  const [partnerHistory, setPartnerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    partner_code: '',
    type: 'Student Activity' as 'Business' | 'Student Activity',
    cashback_rate: 10,
    discount: '15%',
    hours_discount: '',
    members_count: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    conditions_us: '',
    conditions_partner: '',
    leader_name: '',
    leader_phone: '',
    notes: '',
    prepaid_balance: 0,
    space_price: 0,
    total_earned: 0
  });

  useEffect(() => {
    if (branchId) fetchPartners();
  }, [branchId]);

  const fetchPartners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    if (data) setPartners(data);
    setLoading(false);
  };

  const fetchHistory = async (partnerId: string) => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('workspace_sessions')
      .select('*, customers(full_name)')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) console.error(error);
    if (data) setPartnerHistory(data);
    setLoadingHistory(false);
  };

  const handleAddPartner = async () => {
    if (!formData.name || !formData.partner_code) {
      alert('الرجاء إدخال اسم الشريك وكود النشاط');
      return;
    }

    const { error } = await supabase.from('partners').insert({
      branch_id: branchId,
      name: formData.name,
      partner_code: formData.partner_code.trim().toUpperCase(),
      type: formData.type,
      cashback_rate: Number(formData.cashback_rate) || 0,
      discount: formData.discount || null,
      hours_discount: formData.hours_discount || null,
      members_count: Number(formData.members_count) || 0,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      conditions_us: formData.conditions_us.split('\n').filter(Boolean),
      conditions_partner: formData.conditions_partner.split('\n').filter(Boolean),
      leader_name: formData.leader_name,
      leader_phone: formData.leader_phone,
      notes: formData.notes,
      prepaid_balance: Number(formData.prepaid_balance) || 0,
      space_price: Number(formData.space_price) || 0,
      total_earned: Number(formData.total_earned) || 0,
      status: 'Active'
    });

    if (error) {
      alert('خطأ أثناء الإضافة: ' + error.message);
      return;
    }

    setNotification('تم إضافة الشريك بنجاح');
    setTimeout(() => setNotification(null), 3000);
    setActiveModal(null);
    fetchPartners();
    // Reset form
    setFormData({
        name: '',
        partner_code: '',
        type: 'Student Activity',
        cashback_rate: 10,
        discount: '15%',
        members_count: 0,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        conditions_us: '',
        conditions_partner: '',
        leader_name: '',
        leader_phone: '',
        notes: '',
        prepaid_balance: 0,
        space_price: 0,
        total_earned: 0
    });
  };

  const openViewModal = (partner: Partner) => {
    setSelectedPartner(partner);
    setEditFormData(partner);
    setIsEditing(false);
    setPartnerHistory([]);
    fetchHistory(partner.id);
    setActiveModal('view');
  };

  const handleUpdatePartner = async () => {
    if (!selectedPartner) return;

    // Convert string inputs back to arrays if needed
    const updatedConditionsUs = Array.isArray(editFormData.conditions_us) 
      ? editFormData.conditions_us 
      : (editFormData.conditions_us as unknown as string)?.split('\n').filter(Boolean) || [];
      
    const updatedConditionsPartner = Array.isArray(editFormData.conditions_partner) 
      ? editFormData.conditions_partner 
      : (editFormData.conditions_partner as unknown as string)?.split('\n').filter(Boolean) || [];

    const { error } = await supabase
      .from('partners')
      .update({
        ...editFormData,
        conditions_us: updatedConditionsUs,
        conditions_partner: updatedConditionsPartner,
        cashback_rate: Number(editFormData.cashback_rate),
        members_count: Number(editFormData.members_count),
        prepaid_balance: Number(editFormData.prepaid_balance),
        space_price: Number(editFormData.space_price),
        total_earned: Number(editFormData.total_earned)
      })
      .eq('id', selectedPartner.id);

    if (error) {
      alert('خطأ أثناء التحديث: ' + error.message);
      return;
    }

    setNotification('تم تحديث بيانات الشريك بنجاح');
    setTimeout(() => setNotification(null), 3000);
    setIsEditing(false);
    fetchPartners();
  };

  const filteredPartners = partners.filter(p => {
    const matchesTab = tab === 'All' || p.type === tab;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.partner_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalCashback = partners.reduce((sum, p) => sum + (p.total_earned || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right pb-20 relative">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 flex items-center gap-3">
            لوحة الشركاء والأنشطة
            <Award className="text-amber-500 w-8 h-8" />
          </h1>
          <p className="text-slate-400 font-bold mt-2">إدارة التعاقدات والأنشطة الطلابية ونظام الكاش باك</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="بحث بالاسم أو الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-white border border-slate-100 rounded-2xl pr-11 pl-4 text-sm font-bold outline-none focus:border-indigo-400 shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={() => setActiveModal('add')}
            className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-indigo-600 shadow-lg hover:shadow-indigo-200 transition-all hover:-translate-y-0.5"
          >
            <Plus size={18} />
            إضافة شريك
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-indigo-100 transition-all">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <Users2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي الشركاء</p>
            <p className="text-2xl font-black text-slate-800">{partners.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-amber-100 transition-all">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">أنشطة طلابية</p>
            <p className="text-2xl font-black text-slate-800">{partners.filter(p => p.type === 'Student Activity').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-emerald-100 transition-all">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">كاش باك مصروف</p>
            <p className="text-2xl font-black text-slate-800">{totalCashback.toFixed(0)} <span className="text-xs">EGP</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-rose-100 transition-all">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معدل النمو</p>
            <p className="text-2xl font-black text-slate-800">+12%</p>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-3 rounded-[2.5rem] border border-white/20 shadow-sm">
        <div className="flex gap-2 p-1 bg-slate-100/50 rounded-2xl">
          {['All', 'Business', 'Student Activity'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${tab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t === 'All' ? 'الكل' : t === 'Business' ? 'شركات' : 'أنشطة طلابية'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
          <Filter size={12} />
          <span>تصفية حسب النوع</span>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {filteredPartners.map((partner) => (
          <div 
            key={partner.id} 
            className="group relative bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all hover:-translate-y-2 overflow-hidden"
          >
            {/* Background Decorative Element */}
            <div className={`absolute -top-10 -left-10 w-32 h-32 blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${partner.type === 'Business' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
            
            <div className="flex justify-between items-start mb-6 relative">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${partner.type === 'Business' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                  {partner.name[0]}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800">{partner.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded tracking-widest uppercase">{partner.type}</span>
                    <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <Copy size={10} className="cursor-pointer hover:text-indigo-700" onClick={() => {navigator.clipboard.writeText(partner.partner_code); alert('تم نسخ الكود')}} />
                      CODE: {partner.partner_code}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-[8px] font-black border tracking-widest uppercase ${partner.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                {partner.status}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8 relative">
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-tighter">كاش باك مكتسب</p>
                <p className="text-xl font-black text-emerald-600">{partner.total_earned?.toFixed(0)} <span className="text-[10px] opacity-60">EGP</span></p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-tighter">نسبة الكاش باك</p>
                <p className="text-xl font-black text-indigo-600">{partner.cashback_rate}%</p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-50 relative">
              <button
                onClick={() => openViewModal(partner)}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all"
              >
                تحديث وتفاصيل
                <ChevronRight size={14} className="rotate-180" />
              </button>
              <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                <Settings size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* --- ADD PARTNER MODAL (PORTAL) --- */}
      {activeModal === 'add' ? createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 md:p-10 animate-in fade-in duration-300 pointer-events-auto">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] relative flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            
            {/* Sticky Header */}
            <div className={`p-10 md:p-14 border-b border-slate-100 flex justify-between items-center bg-white relative overflow-hidden flex-shrink-0`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full translate-x-32 -translate-y-32 blur-[60px]" />
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${formData.type === 'Business' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                    <Plus size={24} />
                  </div>
                  <div className="flex-1 text-right">
                    <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-none">إضافة شريك جديد</h3>
                    <p className="text-slate-400 text-[9px] font-bold mt-2 tracking-wide uppercase">Partner Professional Onboarding</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)} 
                className="w-14 h-14 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all shadow-sm active:scale-90 group"
              >
                <X size={28} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar space-y-10 md:space-y-14 bg-[#F8FAFC]">
              
              {/* --- Section 1: Type Selection --- */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">نوع الشريك / النشاط</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => setFormData({...formData, type: 'Student Activity'})}
                    className={`relative p-6 rounded-[2rem] border-2 transition-all duration-300 flex flex-col gap-4 group text-right overflow-hidden ${formData.type === 'Student Activity' ? 'border-amber-400 bg-white shadow-xl shadow-amber-900/5' : 'border-white bg-white/50 hover:border-slate-200 shadow-sm'}`}
                  >
                    {formData.type === 'Student Activity' && <div className="absolute top-0 right-0 w-2 h-full bg-amber-400" />}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${formData.type === 'Student Activity' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      <GraduationCap size={28} />
                    </div>
                    <div>
                      <p className={`font-black text-xl ${formData.type === 'Student Activity' ? 'text-slate-900' : 'text-slate-600'}`}>نشاط طلابي</p>
                      <p className="text-xs font-bold text-slate-400 mt-1 leading-relaxed">اتحادات طلابية، جمعيات خيرية، أو فرق تطوعية جامعية</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, type: 'Business'})}
                    className={`relative p-6 rounded-[2rem] border-2 transition-all duration-300 flex flex-col gap-4 group text-right overflow-hidden ${formData.type === 'Business' ? 'border-indigo-400 bg-white shadow-xl shadow-indigo-900/5' : 'border-white bg-white/50 hover:border-slate-200 shadow-sm'}`}
                  >
                    {formData.type === 'Business' && <div className="absolute top-0 right-0 w-2 h-full bg-indigo-400" />}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${formData.type === 'Business' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Briefcase size={28} />
                    </div>
                    <div>
                      <p className={`font-black text-xl ${formData.type === 'Business' ? 'text-slate-900' : 'text-slate-600'}`}>بيزنس / شركة</p>
                      <p className="text-xs font-bold text-slate-400 mt-1 leading-relaxed">شركات ناشئة، مؤسسات، أو جهات اعتبارية مرخصة</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* --- Section 2: Core Details --- */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">البيانات الأساسية والمالية</h4>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
                  {/* Name & Code Area */}
                  <div className="lg:col-span-8 space-y-10 bg-white p-10 md:p-14 rounded-[3.5rem] shadow-sm border border-slate-100 group transition-all hover:shadow-xl hover:shadow-indigo-900/5">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">بيانات الهوية الرسمية للنشاط</label>
                         <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100/50">موثق إدارياً</span>
                      </div>
                      <div className="relative group/input">
                        <input
                          type="text"
                          placeholder="مثال: Google Developer Student Club - Campus Edition"
                          className="w-full h-18 bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-10 text-xl font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-[12px] focus:ring-indigo-500/5 transition-all shadow-sm placeholder:text-slate-300"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] px-2">كود التتبع (Unique ID)</label>
                        <div className="relative group/input">
                          <input
                            type="text"
                            placeholder="GDSC-CLOUD"
                            className="w-full h-18 bg-indigo-50/30 border-2 border-indigo-100/50 rounded-[2rem] px-10 pr-16 text-xl font-black text-indigo-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-[12px] focus:ring-indigo-500/5 transition-all shadow-sm placeholder:text-indigo-200"
                            value={formData.partner_code}
                            onChange={(e) => setFormData({ ...formData, partner_code: e.target.value })}
                          />
                          <Award className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-indigo-300 group-focus-within/input:text-indigo-500 transition-colors" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">نسبة خصم الحجز (Default)</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="15%"
                            className="w-full h-18 bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-10 text-xl font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-[12px] focus:ring-indigo-500/5 transition-all shadow-sm placeholder:text-slate-300 font-mono"
                            value={formData.discount}
                            onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-amber-600 uppercase tracking-[0.2em] px-2">عروض الساعات (Bonus)</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="ساعتين مجاناً"
                            className="w-full h-18 bg-amber-50/20 border-2 border-amber-100/30 rounded-[2rem] px-10 text-xl font-black text-amber-800 outline-none focus:border-amber-500 focus:bg-white focus:ring-[12px] focus:ring-amber-500/5 transition-all shadow-sm placeholder:text-amber-200"
                            value={formData.hours_discount || ''}
                            onChange={(e) => setFormData({ ...formData, hours_discount: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profit Sidecard */}
                  <div className="lg:col-span-4 bg-indigo-600 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-indigo-900/20 text-white flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md">
                          <DollarSign size={16} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest">إعدادات العمولة</h4>
                      </div>
                      <p className="text-xs font-bold text-indigo-100 mb-6 leading-relaxed">حدد نسبة الكاش باك التي يحصل عليها الشريك من كل حجز</p>
                      
                      <div className="flex items-center justify-center gap-4 bg-white/10 rounded-2xl p-6 backdrop-blur-md border border-white/10 group-hover:bg-white/15 transition-all">
                        <input
                          type="number"
                          className="w-20 bg-transparent text-4xl font-black text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={formData.cashback_rate}
                          onChange={(e) => setFormData({ ...formData, cashback_rate: Number(e.target.value) })}
                        />
                        <span className="text-3xl font-black opacity-40">%</span>
                      </div>
                    </div>
                    <p className="text-[9px] font-bold text-indigo-200 mt-6 text-center italic relative z-10 opacity-70">يتم احتساب النسبة من صافي مبلغ حجز الغرف</p>
                  </div>
                </div>

                {/* Migrated Balance / Points */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-900/5 group">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">رصيد سابق / نقاط محولة</h4>
                   </div>
                   <div className="flex flex-col md:flex-row gap-8 items-center">
                      <div className="flex-1 space-y-2 w-full">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">إجمالي الكاش باك المستحق (رصيد افتتاحِي)</label>
                         <div className="relative group/input">
                            <input
                              type="number"
                              placeholder="0.00"
                              className="w-full h-16 bg-emerald-50/20 border-2 border-emerald-100/30 rounded-2xl px-10 text-2xl font-black text-emerald-800 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                              value={formData.total_earned}
                              onChange={(e) => setFormData({ ...formData, total_earned: Number(e.target.value) })}
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-emerald-200 group-focus-within/input:text-emerald-500 transition-colors">EGP</div>
                         </div>
                      </div>
                      <div className="flex-1 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-right">
                         <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">ملاحظة: استخدم هذا الحقل إذا كان للشريك رصيد سابق من نظام آخر أو نقاط تم تجميعها يدوياً قبل البدء في استخدام النظام الحالي.</p>
                      </div>
                   </div>
                </div>
              </div>

              {/* --- Section 3: Management & Timeline --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                {/* Manager Box */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">المسؤول المباشر</h4>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 relative group">
                        <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          type="text"
                          placeholder="الاسم الكامل للمسؤول"
                          className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pr-12 pl-4 text-xs font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all text-right shadow-inner"
                          value={formData.leader_name}
                          onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                        />
                      </div>
                      <div className="flex-1 relative group">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                          type="text"
                          placeholder="رقم الموبايل"
                          className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pr-12 pl-4 text-xs font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all text-right shadow-inner"
                          value={formData.leader_phone}
                          onChange={(e) => setFormData({ ...formData, leader_phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Box */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">فترة الشراكة</h4>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-6">
                    <div className="flex-1 space-y-2">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">تاريخ البدء</p>
                       <input
                        type="date"
                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[10px] font-black text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-inner"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">تاريخ الانتهاء</p>
                       <input
                        type="date"
                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[10px] font-black text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-inner"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Section 4: Terms & Notes --- */}
              <div className="space-y-8 pb-10">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">بنود الاتفاقية والملاحظات</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50 group focus-within:border-emerald-400 transition-all">
                    <label className="text-xs font-black text-emerald-800 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center"><CheckCircle2 size={14} /></div>
                      التزاماتنا (Campus OS)
                    </label>
                    <textarea
                      placeholder="اكتب الالتزامات سطر بسطر..."
                      className="w-full h-36 bg-white border border-emerald-100 rounded-2xl p-5 text-sm font-bold text-slate-600 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-400 transition-all text-right shadow-sm resize-none"
                      value={formData.conditions_us}
                      onChange={(e) => setFormData({ ...formData, conditions_us: e.target.value })}
                    />
                  </div>
                  <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/50 group focus-within:border-indigo-400 transition-all">
                    <label className="text-xs font-black text-indigo-800 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500 text-white flex items-center justify-center"><FileText size={14} /></div>
                      التزامات الشريك المستلم
                    </label>
                    <textarea
                      placeholder="اكتب التزامات الجهة هنا..."
                      className="w-full h-36 bg-white border border-indigo-100 rounded-2xl p-5 text-sm font-bold text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all text-right shadow-sm resize-none"
                      value={formData.conditions_partner}
                      onChange={(e) => setFormData({ ...formData, conditions_partner: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bg-slate-100/50 p-8 rounded-[2.5rem] border border-slate-200/50 group focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History size={14} /> ملاحظات مرجعية إضافية
                  </label>
                  <textarea
                    placeholder="أي ملاحظات حول آلية التنفيذ أو معلومات تواصل إضافية..."
                    className="w-full h-28 bg-transparent border-none rounded-2xl p-0 text-sm font-bold text-slate-600 outline-none text-right resize-none"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Sticky Footer Action */}
            <div className="p-6 md:p-10 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-4 flex-shrink-0">
              <button
                onClick={() => setActiveModal(null)}
                className="w-full sm:w-auto px-10 py-5 bg-white border border-slate-200 text-slate-400 rounded-[2rem] font-black text-sm hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddPartner}
                className="flex-1 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xl hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-4 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div className="p-2 bg-white/10 rounded-xl group-hover:rotate-12 transition-transform">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                </div>
                تأكيد بيانات الشريك وتفعيل العقد
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* --- VIEW DETAILS & HISTORY MODAL (PORTAL) --- */}
      {activeModal === 'view' && selectedPartner ? createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 animate-in fade-in duration-300 pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-2xl w-full max-w-6xl max-h-[92vh] rounded-[4rem] shadow-[0_32px_128px_-32px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-500">
            
            <button
                onClick={() => {
                  setActiveModal(null);
                  setIsEditing(false);
                }}
                className="absolute top-4 left-4 sm:top-8 sm:left-8 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-2xl sm:rounded-3xl hover:bg-white/20 transition-all flex items-center justify-center backdrop-blur-md active:scale-90 border border-white/10 hover:rotate-90 group z-[60]"
            >
                <X size={28} className="text-white group-hover:scale-110 transition-transform" />
            </button>

            {/* Modal Header Wrap */}
            <div className={`p-8 md:p-12 pb-28 md:pb-40 text-white relative flex-shrink-0 transition-all duration-700 ${isEditing ? 'bg-slate-900' : selectedPartner.type === 'Business' ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/10 -z-10" />
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                
                <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-center relative z-10 pt-4">
                    <div className="w-20 h-20 md:w-32 md:h-32 bg-white/10 rounded-[2.5rem] backdrop-blur-3xl flex items-center justify-center text-4xl md:text-6xl font-black shadow-2xl border border-white/20 relative group overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />
                        {selectedPartner.name[0]}
                    </div>
                    
                    <div className="flex-1 space-y-4 w-full text-center md:text-right">
                        <div className="space-y-1">
                           {isEditing ? (
                             <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Partner Identity</label>
                                <input 
                                  className="w-full bg-white/10 border-b-2 border-white/30 text-2xl md:text-4xl font-black tracking-tight outline-none focus:border-white focus:bg-white/20 transition-all px-4 py-1 rounded-xl text-center md:text-right"
                                  value={editFormData.name}
                                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                                />
                             </div>
                           ) : (
                             <>
                               <h3 className="text-lg md:text-xl font-black tracking-tight drop-shadow-sm leading-tight">
                                  {selectedPartner.name}
                               </h3>
                               <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
                                 <div className="flex items-center gap-2 bg-white/15 px-4 py-1.5 rounded-xl border border-white/5 backdrop-blur-md">
                                    <div className={`w-1.5 h-1.5 rounded-full ${selectedPartner.type === 'Business' ? 'bg-indigo-300' : 'bg-amber-300'}`} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                                       {selectedPartner.type === 'Business' ? 'Business Partner' : 'Student Activity'}
                                    </span>
                                 </div>
                                 <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border ${selectedPartner.status === 'Active' ? 'bg-emerald-500/80 border-emerald-400 text-white' : 'bg-slate-500/80 border-slate-400 text-white'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                                       {selectedPartner.status === 'Active' ? 'Active' : 'N/A'}
                                    </span>
                                 </div>
                               </div>
                             </>
                           )}
                        </div>
                        
                        {!isEditing && (
                          <div className="flex flex-wrap items-center gap-6 opacity-60 font-bold justify-center md:justify-start">
                              <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                                  <FileText size={14} />
                                  <span>Portal ID: {selectedPartner.partner_code}</span>
                              </span>
                              <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                                  <Calendar size={14} />
                                  <span>Validity: {selectedPartner.start_date || '...'} / {selectedPartner.end_date || '...'}</span>
                              </span>
                          </div>
                        )}
                    </div>
                </div>

                {/* Compact Floating Stats */}
                <div className="absolute bottom-0 left-4 sm:left-10 right-4 sm:right-10 translate-y-1/2 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 z-30">
                    <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-xl border border-slate-100 group hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center justify-between mb-3 flex-row-reverse">
                           <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm"><DollarSign size={18} /></div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
                        </div>
                        {isEditing ? (
                           <div className="flex items-center justify-end gap-2 bg-slate-50 rounded-xl px-3 py-2 border-2 border-emerald-100">
                              <input 
                                type="number" 
                                className="w-full bg-transparent text-right font-black text-emerald-700 outline-none text-base"
                                value={editFormData.total_earned}
                                onChange={(e) => setEditFormData({...editFormData, total_earned: Number(e.target.value)})}
                              />
                              <span className="text-[10px] font-black text-emerald-400">EGP</span>
                           </div>
                        ) : (
                           <p className="text-xl sm:text-2xl font-black text-slate-900 text-right leading-none">
                              {selectedPartner.total_earned?.toFixed(0)} <span className="text-[10px] font-bold text-slate-300 ml-1">EGP</span>
                           </p>
                        )}
                    </div>
                    
                    <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 group hover:-translate-y-2 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"><TrendingUp size={20} /></div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reward</p>
                        </div>
                        {isEditing ? (
                           <div className="flex items-center justify-end gap-2">
                              <input 
                                type="number" 
                                className="w-16 md:w-24 bg-slate-50 border-2 border-indigo-50 rounded-xl px-2 py-1.5 text-right font-black text-indigo-700 outline-none focus:border-indigo-500 text-sm md:text-lg"
                                value={editFormData.cashback_rate}
                                onChange={(e) => setEditFormData({...editFormData, cashback_rate: Number(e.target.value)})}
                              />
                              <span className="text-sm font-black text-slate-400">%</span>
                           </div>
                        ) : (
                           <p className="text-xl md:text-3xl font-black text-slate-900 text-right leading-none">{selectedPartner.cashback_rate}%</p>
                        )}
                    </div>

                    <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 group hover:-translate-y-2 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm"><Award size={20} /></div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Discount</p>
                        </div>
                        {isEditing ? (
                           <input 
                              type="text" 
                              className="w-full bg-slate-50 border-2 border-amber-50 rounded-xl px-2 py-1.5 text-right font-black text-slate-700 outline-none focus:border-amber-500 text-sm md:text-lg"
                              value={editFormData.discount}
                              onChange={(e) => setEditFormData({...editFormData, discount: e.target.value})}
                           />
                        ) : (
                           <p className="text-xl md:text-3xl font-black text-slate-900 text-right leading-none">{selectedPartner.discount}</p>
                        )}
                    </div>

                    <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 group hover:-translate-y-2 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm"><Users size={20} /></div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Team</p>
                        </div>
                        {isEditing ? (
                           <input 
                              type="number" 
                              className="w-full bg-slate-50 border-2 border-rose-50 rounded-xl px-2 py-1.5 text-right font-black text-slate-700 outline-none focus:border-rose-500 text-sm md:text-lg"
                              value={editFormData.members_count}
                              onChange={(e) => setEditFormData({...editFormData, members_count: Number(e.target.value)})}
                           />
                        ) : (
                           <p className="text-xl md:text-3xl font-black text-slate-900 text-right leading-none">{selectedPartner.members_count || 0}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-10 pt-48 sm:pt-48 lg:pt-44 custom-scrollbar bg-slate-50/20">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                   {/* --- Info Column --- */}
                   <div className="space-y-8 sm:space-y-12">
                       <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-full translate-x-32 -translate-y-32 blur-[60px]" />
                           
                           <div className="flex items-center justify-between mb-8 relative z-10 flex-row-reverse">
                               <h4 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                   إدارة الشريك
                                   <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                               </h4>
                           </div>

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 relative z-10">
                               <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 hover:bg-white transition-all group/box">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 flex-row-reverse">
                                      المسؤول <User size={12} className="group-hover/box:text-indigo-500" />
                                   </p>
                                   {isEditing ? (
                                      <input className="w-full bg-transparent border-b border-indigo-200 font-bold text-sm outline-none focus:border-indigo-600 text-right py-1" value={editFormData.leader_name} onChange={(e) => setEditFormData({...editFormData, leader_name: e.target.value})} />
                                   ) : (
                                      <p className="text-md font-black text-slate-900 text-right">{selectedPartner.leader_name || '---'}</p>
                                   )}
                               </div>
                               <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 hover:bg-white transition-all group/box">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 flex-row-reverse">
                                      الهاتف <Phone size={12} className="group-hover/box:text-emerald-500" />
                                   </p>
                                   {isEditing ? (
                                      <input className="w-full bg-transparent border-b border-emerald-200 font-bold text-sm outline-none focus:border-emerald-600 text-right font-mono py-1" value={editFormData.leader_phone} onChange={(e) => setEditFormData({...editFormData, leader_phone: e.target.value})} />
                                   ) : (
                                      <p className="text-md font-black text-indigo-600 font-mono tracking-tight text-right">{selectedPartner.leader_phone || '---'}</p>
                                   )}
                               </div>
                           </div>

                           <div className="mt-8 space-y-3 relative z-10 text-right">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pr-2">ملاحظات إدارية</p>
                               {isEditing ? (
                                  <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 min-h-[120px] text-right resize-none" value={editFormData.notes} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} />
                               ) : (
                                  <div className="bg-slate-50/30 p-6 rounded-2xl border border-dashed border-slate-200 text-right">
                                      <p className="text-xs font-bold text-slate-500 leading-relaxed italic pr-2 border-r-2 border-slate-200">{selectedPartner.notes || 'لا يوجد ملاحظات...'}</p>
                                  </div>
                               )}
                           </div>
                       </div>

                       <div className="space-y-6">
                           <h4 className="text-lg font-black text-slate-800 flex items-center gap-3 px-4 flex-row-reverse">
                               الالتزامات والبنود
                               <div className="w-1.5 h-8 bg-emerald-600 rounded-full" />
                           </h4>
                           <div className="space-y-4">
                               {[
                                  { title: 'بنود Campus Hub', data: selectedPartner.conditions_us, editKey: 'conditions_us', color: 'emerald', icon: CheckCircle2 },
                                  { title: `التزامات الشريك`, data: selectedPartner.conditions_partner, editKey: 'conditions_partner', color: 'indigo', icon: FileText }
                               ].map((sec, idx) => (
                                 <div key={idx} className={`bg-white p-6 sm:p-8 rounded-[2rem] border border-${sec.color}-100 shadow-sm hover:shadow-md transition-all`}>
                                    <p className={`text-[9px] font-black text-${sec.color}-600 uppercase tracking-widest mb-4 flex items-center gap-2 flex-row-reverse border-b border-${sec.color}-50 pb-2`}>
                                       <sec.icon size={14} /> 
                                       {sec.title}
                                    </p>
                                    {isEditing ? (
                                       <textarea className={`w-full bg-slate-50 border-2 border-${sec.color}-50 rounded-xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-${sec.color}-500 min-h-[100px] text-right`} value={Array.isArray(editFormData[sec.editKey as keyof typeof editFormData]) ? (editFormData[sec.editKey as keyof typeof editFormData] as string[]).join('\n') : editFormData[sec.editKey as keyof typeof editFormData] as string} onChange={(e) => setEditFormData({...editFormData, [sec.editKey]: e.target.value})} />
                                    ) : (
                                       <ul className="space-y-3">
                                          {(Array.isArray(sec.data) ? sec.data : (sec.data?.split('\n') || [])).filter(Boolean).map((c, i) => (
                                            <li key={i} className="flex flex-row-reverse items-start gap-3 text-xs font-bold text-slate-600 group">
                                               <div className={`w-1 h-1 bg-${sec.color}-500 rounded-full mt-2 shrink-0 group-hover:scale-150 transition-transform`} />
                                               <span className="leading-relaxed text-right">{c}</span>
                                            </li>
                                          ))}
                                       </ul>
                                    )}
                                 </div>
                               ))}
                           </div>
                       </div>
                   </div>

                   {/* --- Log Column --- */}
                   <div className="flex flex-col gap-8">
                       <div className="flex items-center justify-between px-6 flex-row-reverse">
                           <h4 className="text-lg font-black text-slate-800 flex items-center gap-3">
                               سجل الإيرادات
                               <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                           </h4>
                           <span className="text-[10px] bg-amber-50 text-amber-600 px-3 py-1 rounded-full font-black border border-amber-100">{partnerHistory.length} Sessions</span>
                       </div>
                       
                       <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px] flex flex-col relative max-h-[800px] overflow-hidden">
                           <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 p-2">
                               {loadingHistory ? (
                                   <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
                                       <RefreshCw size={32} className="animate-spin text-indigo-300" />
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sychronizing...</p>
                                   </div>
                               ) : partnerHistory.length === 0 ? (
                                   <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 text-slate-300">
                                       <History size={48} className="opacity-20" />
                                       <p className="text-xs font-bold text-slate-400">لا يوجد سجلات حالية</p>
                                   </div>
                               ) : (
                                   partnerHistory.map((session, i) => (
                                       <div key={i} className="bg-slate-50/50 p-4 rounded-2xl flex items-center justify-between border border-transparent hover:border-indigo-100 hover:bg-white transition-all group flex-row-reverse">
                                           <div className="flex items-center gap-4 flex-row-reverse">
                                               <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                   <Users size={20} />
                                               </div>
                                               <div className="text-right">
                                                   <p className="text-sm font-black text-slate-800 truncate max-w-[120px]">{session.customers?.full_name || 'Guest User'}</p>
                                                   <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                      {new Date(session.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                                                   </p>
                                               </div>
                                           </div>
                                           <div className="text-left">
                                               <p className="text-lg font-black text-emerald-600">
                                                  +{((session.workspace_amount || 0) * (selectedPartner.cashback_rate / 100)).toFixed(1)}
                                               </p>
                                               <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Accrued Reward</p>
                                           </div>
                                       </div>
                                   ))
                               )}
                           </div>
                           <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />
                       </div>
                   </div>
                </div>
            </div>

            {/* --- Management Footer Action Bar --- */}
            <div className="p-6 sm:p-10 lg:p-12 bg-white/95 backdrop-blur-3xl border-t border-slate-100 flex flex-col md:flex-row justify-between gap-6 flex-shrink-0 z-50">
                <div className="flex gap-3 w-full md:w-auto flex-row-reverse">
                    <button 
                      onClick={() => {
                        setActiveModal(null);
                        setIsEditing(false);
                      }}
                      className="flex-1 md:flex-none px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-200 transition-all active:scale-95"
                    >
                      إغلاق
                    </button>
                    {isEditing && (
                       <button 
                         onClick={() => setIsEditing(false)}
                         className="flex-1 md:flex-none px-6 py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-xs hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                       >
                         إلغاء التعديل
                       </button>
                    )}
                </div>
                
                <div className="flex gap-4 w-full md:w-auto flex-row-reverse">
                   {!isEditing ? (
                      <>
                        <button 
                          onClick={() => window.print()} 
                          className="flex-1 md:flex-none h-14 px-8 bg-slate-900 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl active:scale-95"
                        >
                          <Printer size={18} className="group-hover:-rotate-6 transition-transform" />
                          كشف الحساب
                        </button>
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="flex-1 md:flex-none h-14 px-10 bg-indigo-600 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                        >
                          <Settings size={18} className="animate-spin-slow" />
                          تعديل العقد
                        </button>
                      </>
                   ) : (
                      <button 
                        onClick={handleUpdatePartner}
                        className="w-full md:px-16 lg:px-24 h-16 bg-emerald-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-4 hover:bg-emerald-700 transition-all shadow-xl hover:shadow-emerald-200 active:scale-95 animate-in zoom-in-95"
                      >
                        <CheckCircle2 size={24} />
                        تأكيد وحفظ التغييرات
                      </button>
                   )}
                </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
      {/* Notification */}
      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-[2rem] shadow-2xl z-[200] flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
            <CheckCircle2 size={16} className="text-white" />
          </div>
          <span className="font-black text-sm">{notification}</span>
        </div>
      )}
    </div>
  );
};
