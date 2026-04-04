
import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, CreditCard, Plus, Search, 
  Trash2, Edit3, MoreVertical, ExternalLink, 
  ChevronRight, Calendar, User, Mail, 
  ArrowUpRight, ArrowDownRight, LayoutDashboard,
  CheckCircle2, AlertCircle, RefreshCw, X, Filter,
  Clock, LayoutList
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui';

interface Company {
  id: string;
  name: string;
  company_code: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  created_at: string;
}

interface Member {
  id: string;
  company_id: string;
  customer_id: string;
  name?: string;
  unique_code: string;
  created_at: string;
}

interface MonthlyContract {
  id: string;
  company_id: string;
  month: string;
  catering_prepaid_total: number;
  catering_remaining_balance: number;
  space_hour_price: number;
  status: string;
  created_at: string;
}

export const BusinessManagement = ({ branchId }: { branchId?: string }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contracts, setContracts] = useState<MonthlyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'companies' | 'contracts' | 'stats'>('companies');
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  
  // Stats
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalMembers: 0,
    totalCateringUsed: 0,
    totalSpaceHours: 0
  });

  const [selectedPendingMembers, setSelectedPendingMembers] = useState<any[]>([]);
  const [showViewMembersModal, setShowViewMembersModal] = useState(false);
  const [companyMembers, setCompanyMembers] = useState<Member[]>([]);

  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [leaderSearchQuery, setLeaderSearchQuery] = useState('');
  const [filteredLeaders, setFilteredLeaders] = useState<any[]>([]);

  // Form States
  const [companyForm, setCompanyForm] = useState({
    name: '',
    company_code: '',
    leader_name: '',
    leader_email: '',
    leader_phone: '',
    leader_id: ''
  });

  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    customer_id: '',
    unique_code: ''
  });

  const [contractForm, setContractForm] = useState({
    company_id: '',
    month: new Date().toISOString().slice(0, 7),
    catering_prepaid_total: 0,
    space_hour_price: 0
  });

  const [customers, setCustomers] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [spaceReport, setSpaceReport] = useState<any[]>([]);
  const [cateringReport, setCateringReport] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    
    // Set up Realtime subscriptions
    const companySub = (supabase as any).channel('companies-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => fetchData())
      .subscribe();
      
    const memberSub = (supabase as any).channel('members-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_members' }, () => fetchData())
      .subscribe();

    const contractSub = (supabase as any).channel('contracts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_contracts' }, () => fetchData())
      .subscribe();

    return () => {
      (supabase as any).removeChannel(companySub);
      (supabase as any).removeChannel(memberSub);
      (supabase as any).removeChannel(contractSub);
    };
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Companies
      const { data: cos } = await (supabase as any).from('companies').select('*');
      setCompanies(cos || []);

      // 2. Fetch Monthly Contracts for current month
      const { data: mContracts } = await (supabase as any)
        .from('monthly_contracts')
        .select('*')
        .eq('month', selectedMonth);
      setContracts(mContracts || []);

      // 3. Fetch Space Sessions and Catering Orders for current month
      const { data: sSessions } = await (supabase as any)
        .from('space_sessions')
        .select('*, company_members(name), companies(name)')
        .gte('check_in', `${selectedMonth}-01`)
        .lte('check_in', `${selectedMonth}-31`);
      setSpaceReport(sSessions || []);

      const { data: cOrders } = await (supabase as any)
        .from('catering_orders')
        .select('*, company_members(name), companies(name)')
        .gte('created_at', `${selectedMonth}-01`)
        .lte('created_at', `${selectedMonth}-31`);
      setCateringReport(cOrders || []);

      // 4. Fetch Members for count
      const { data: members } = await (supabase as any).from('company_members').select('id');

      // 5. Calculate Stats
      const totalSpaceHrs = sSessions?.reduce((sum: number, s: any) => sum + (Number(s.duration_hours) || 0), 0) || 0;
      const totalCatUsed = cOrders?.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0) || 0;

      setStats({
        totalCompanies: cos?.length || 0,
        totalMembers: members?.length || 0,
        totalCateringUsed: totalCatUsed,
        totalSpaceHours: totalSpaceHrs
      });

      // 6. Remove global customer fetch to avoid memory/limit issues
      // Customer search is now handled server-side in the modal
      setCustomers([]);
      setFilteredCustomers([]);

    } catch (err) {
      console.error("Error fetching business data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyMembers = async (companyId: string) => {
     setLoading(true);
     try {
        // 1. Get Members
        const { data: members } = await (supabase as any)
           .from('company_members')
           .select('*')
           .eq('company_id', companyId)
           .order('name');
        
        // 2. Get this month's stats for these members
        const memberIds = (members || []).map((m: any) => m.customer_id).filter(Boolean);
        
        // Fetch Catering Orders for these members this month
        const startOfMonth = `${selectedMonth}-01`;
        const endOfMonth = `${selectedMonth}-31`; // Simplified for query
        
        const { data: orders } = await (supabase as any)
           .from('catering_orders')
           .select('member_id, amount')
           .eq('company_id', companyId) // Shared wallet uses company_id
           .gte('created_at', startOfMonth)
           .lte('created_at', endOfMonth);

        // Fetch Space Sessions
        const { data: sessions } = await (supabase as any)
           .from('space_sessions')
           .select('customer_id, total_hours, total_price')
           .in('customer_id', memberIds)
           .gte('created_at', startOfMonth)
           .lte('created_at', endOfMonth);

        // 3. Aggregate
        const enrichedMembers = (members || []).map((m: any) => {
           const memberOrders = (orders || []).filter((o: any) => o.member_id === m.id);
           const cateringTotal = memberOrders.reduce((sum: number, o: any) => sum + (Number(o.amount) || 0), 0);
           
           const memberSessions = (sessions || []).filter((s: any) => s.customer_id === m.customer_id);
           const spaceTotalHours = memberSessions.reduce((sum: number, s: any) => sum + (Number(s.total_hours) || 0), 0);
           const spaceTotalCost = memberSessions.reduce((sum: number, s: any) => sum + (Number(s.total_price) || 0), 0);

           return {
              ...m,
              cateringTotal,
              spaceTotalHours,
              spaceTotalCost
           };
        });

        setCompanyMembers(enrichedMembers);
        setSelectedCompanyId(companyId);
        setShowViewMembersModal(true);
     } catch (err) {
        console.error("Error fetching members:", err);
     } finally {
        setLoading(false);
     }
  };

  const handleLeaderSearch = async (query: string) => {
    setLeaderSearchQuery(query);
    if (!query) {
      setFilteredLeaders([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`full_name.ilike.%${query}%,code.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setFilteredLeaders(data || []);
    } catch (err) {
      console.error("Leader search error:", err);
    }
  };

  const handleEditCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    
    try {
      const { error } = await (supabase as any)
        .from('companies')
        .update({
          name: companyForm.name,
          company_code: companyForm.company_code,
          leader_name: companyForm.leader_name,
          leader_email: companyForm.leader_email,
          leader_phone: companyForm.leader_phone
        })
        .eq('id', editingCompany.id);

      if (error) throw error;
      
      setShowEditCompanyModal(false);
      setEditingCompany(null);
      setCompanyForm({ name: '', company_code: '', leader_name: '', leader_email: '', leader_phone: '', leader_id: '' });
      fetchData();
    } catch (err) {
      console.error("Error editing company:", err);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm("Are you sure you want to delete this company and all its associations?")) return;
    
    try {
      const { error } = await (supabase as any)
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error("Error deleting company:", err);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await (supabase as any)
        .from('companies')
        .insert([{
          name: companyForm.name,
          company_code: companyForm.company_code.trim().toUpperCase(),
          leader_name: companyForm.leader_name,
          leader_email: companyForm.leader_email,
          leader_phone: companyForm.leader_phone
        }]);

      if (error) throw error;
      
      setShowAddCompanyModal(false);
      setCompanyForm({ name: '', company_code: '', leader_name: '', leader_email: '', leader_phone: '', leader_id: '' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMemberSearch = async (query: string) => {
     setMemberSearchQuery(query);
     if (!query.trim()) {
        setFilteredCustomers([]);
        return;
     }
     
     const lower = query.toLowerCase().trim().replace('#', '');
     
     try {
        const { data, error } = await (supabase as any)
           .from('customers')
           .select('id, full_name, code, phone')
           .or(`full_name.ilike.%${lower}%,code.ilike.%${lower}%,phone.ilike.%${lower}%`)
           .limit(20);

        if (error) throw error;

        const sorted = (data || []).sort((a: any, b: any) => {
           const aExact = a.code?.toLowerCase() === lower || a.phone === query ? -1 : 1;
           const bExact = b.code?.toLowerCase() === lower || b.phone === query ? -1 : 1;
           return aExact - bExact;
        });

        setFilteredCustomers(sorted);
     } catch (err) {
        console.error("Search error:", err);
     }
  };

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await (supabase as any)
        .from('monthly_contracts')
        .upsert([{
          company_id: contractForm.company_id,
          month: contractForm.month,
          catering_prepaid_total: contractForm.catering_prepaid_total,
          catering_remaining_balance: contractForm.catering_prepaid_total,
          space_hour_price: contractForm.space_hour_price,
          status: 'active'
        }]);

      if (error) throw error;
      
      setShowAddContractModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || selectedPendingMembers.length === 0) return;

    try {
      const inserts = selectedPendingMembers.map(m => ({
        company_id: selectedCompanyId,
        customer_id: m.id,
        name: m.full_name,
        unique_code: `B${Math.random().toString(36).substring(2, 6).toUpperCase()}-${m.code || 'X'}`
      }));

      const { error } = await (supabase as any)
        .from('company_members')
        .insert(inserts);

      if (error) throw error;
      
      setShowAddMemberModal(false);
      setSelectedPendingMembers([]);
      setMemberSearchQuery('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
     if (!window.confirm('هل تريد حذف هذا العضو من الشركة؟')) return;
     try {
        const { error } = await (supabase as any)
           .from('company_members')
           .delete()
           .eq('id', memberId);
        if (error) throw error;
        setCompanyMembers(prev => prev.filter(m => m.id !== memberId));
        fetchData();
     } catch (err: any) {
        alert(err.message);
     }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-['Cairo'] text-right pb-20">
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
         <Card className="bg-white/40 backdrop-blur-md border-white/60 shadow-xl rounded-[2.5rem] border-2">
            <CardContent className="p-8 relative">
               <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                     <Building2 size={28} />
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">COMPANIES</p>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalCompanies}</h3>
                  </div>
               </div>
            </CardContent>
         </Card>
         <Card className="bg-white/40 backdrop-blur-md border-white/60 shadow-xl rounded-[2.5rem] border-2">
            <CardContent className="p-8 relative">
               <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                     <Users size={28} />
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">MEMBERS</p>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalMembers}</h3>
                  </div>
               </div>
            </CardContent>
         </Card>
         <Card className="bg-white/40 backdrop-blur-md border-white/60 shadow-xl rounded-[2.5rem] border-2">
            <CardContent className="p-8 relative">
               <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                     <CreditCard size={28} />
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">CATERING USED</p>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalCateringUsed.toLocaleString()} <span className="text-xs opacity-30">EGP</span></h3>
                  </div>
               </div>
            </CardContent>
         </Card>
         <Card className="bg-slate-900 shadow-2xl rounded-[2.5rem] border-none cursor-pointer" onClick={() => setShowAddCompanyModal(true)}>
            <CardContent className="p-8 relative">
               <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                  <div className="w-14 h-14 bg-white/10 text-white rounded-2xl flex items-center justify-center border border-white/10 hover:bg-indigo-600 transition-colors">
                     <Plus size={28} />
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">SPACE HRS</p>
                     <h3 className="text-3xl font-black text-white">{stats.totalSpaceHours.toFixed(1)} <span className="text-xs opacity-40">HRS</span></h3>
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
         <div className="flex flex-col xl:flex-row justify-between items-center mb-12 gap-8">
            <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-[2rem] border-2 border-slate-100/50">
               {[
                 { id: 'companies', label: 'الشركات والأعضاء' },
                 { id: 'contracts', label: 'عقود الشهر' },
                 { id: 'stats', label: 'الاستهلاك المالي' }
               ].map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-10 py-4 rounded-[1.5rem] text-[15px] font-black transition-all duration-500 ${
                      activeTab === tab.id 
                        ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-100' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                 >
                    {tab.label}
                 </button>
               ))}
            </div>
            
            <div className="flex items-center gap-4">
               <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 text-sm font-black outline-none focus:border-indigo-500 transition-all shadow-sm"
               />
               <div className="w-72 relative group">
                  <input 
                     type="text" 
                     placeholder="بحث..." 
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-14 py-4 text-sm font-black text-right outline-none focus:border-indigo-500 transition-all"
                  />
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
               </div>
            </div>
         </div>

         {activeTab === 'companies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {companies.map((company) => {
                  const activeContract = contracts.find(c => c.company_id === company.id);
                  return (
                    <Card key={company.id} className="group hover:border-indigo-500/30 transition-all rounded-[2rem] overflow-hidden border-slate-100 shadow-sm">
                       <CardHeader className="pb-2">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex gap-2">
                                <button onClick={() => {
                                   setContractForm({ ...contractForm, company_id: company.id });
                                   setShowAddContractModal(true);
                                }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="إعداد عقد الشهر">
                                   <Calendar size={18} />
                                </button>
                                <button 
                                    onClick={() => {
                                       setEditingCompany(company);
                                       setCompanyForm({
                                          name: company.name,
                                          company_code: company.company_code,
                                          leader_name: company.leader_name || '',
                                          leader_email: company.leader_email || '',
                                          leader_phone: company.leader_phone || '',
                                          leader_id: ''
                                       });
                                       setShowEditCompanyModal(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-50 rounded-lg transition-colors"
                                 >
                                    <Edit3 size={18} />
                                 </button>
                                 <button 
                                    onClick={() => handleDeleteCompany(company.id)}
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                 >
                                    <Trash2 size={18} />
                                 </button>
                             </div>
                             <CardTitle className="text-xl font-black text-indigo-600 uppercase tracking-tight">
                                {company.name} <span className="text-xs opacity-30 font-mono">#{company.company_code}</span>
                             </CardTitle>
                          </div>
                          <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase text-right">
                             {company.leader_name} | {company.leader_phone}
                          </p>
                       </CardHeader>
                       <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
                             <div className="text-left">
                                <p className="text-[9px] font-black text-slate-400 mb-1 uppercase">Catering Balance</p>
                                <p className={`text-sm font-black ${activeContract ? 'text-emerald-600' : 'text-slate-300'}`}>
                                   {activeContract ? `${activeContract.catering_remaining_balance} / ${activeContract.catering_prepaid_total}` : 'No Contract'}
                                </p>
                             </div>
                             <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 mb-1 uppercase">Space Price</p>
                                <p className={`text-sm font-black ${activeContract ? 'text-indigo-600' : 'text-slate-300'}`}>
                                   {activeContract ? `${activeContract.space_hour_price} EGP/Hr` : '---'}
                                </p>
                             </div>
                          </div>
                          
                          <button 
                              onClick={() => fetchCompanyMembers(company.id)}
                              className="w-full h-12 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl flex items-center justify-center gap-2 font-black text-xs hover:border-indigo-500 hover:text-indigo-600 transition-all font-['Cairo'] mb-2"
                           >
                              <LayoutList size={14} /> عرض الموظفين والاستهلاك
                           </button>

                          <button 
                             onClick={() => {
                                setSelectedCompanyId(company.id);
                                setShowAddMemberModal(true);
                             }}
                             className="w-full h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-xs hover:bg-indigo-600 transition-all font-['Cairo']"
                          >
                             <Plus size={14} /> إضافة أعضاء للشركة
                          </button>
                       </CardContent>
                    </Card>
                  );
               })}
               {companies.length === 0 && !loading && (
                 <div className="col-span-full py-20 text-center opacity-30 italic font-black uppercase tracking-widest font-['Cairo']">لا توجد شركات مسجلة حالياً</div>
               )}
            </div>
         )}

         {activeTab === 'contracts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {contracts.map((contract) => {
                  const company = companies.find(c => c.id === contract.company_id);
                  return (
                    <Card key={contract.id} className="rounded-[2rem] border-slate-100 shadow-sm p-6 space-y-4">
                       <div className="flex justify-between items-center">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${contract.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                             {contract.status}
                          </span>
                          <h3 className="font-black text-lg">{company?.name}</h3>
                       </div>
                       <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                             <span className="font-bold text-emerald-600">{contract.catering_prepaid_total} EGP</span>
                             <span className="text-slate-400">Prepaid Catering</span>
                          </div>
                          <div className="flex justify-between text-sm">
                             <span className="font-bold text-indigo-600">{contract.space_hour_price} EGP/Hr</span>
                             <span className="text-slate-400">Space Rate</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                             <div 
                                className="bg-emerald-500 h-full transition-all" 
                                style={{ width: `${(contract.catering_remaining_balance / contract.catering_prepaid_total) * 100}%` }}
                             />
                          </div>
                          <p className="text-center text-[10px] font-black text-slate-400 uppercase mt-1">Remaining: {contract.catering_remaining_balance} EGP</p>
                       </div>
                    </Card>
                  );
               })}
               <button 
                  onClick={() => setShowAddContractModal(true)}
                  className="rounded-[2rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-4 text-slate-300 hover:text-indigo-400 hover:border-indigo-200 transition-all group"
               >
                  <Plus size={48} className="group-hover:scale-110 transition-transform" />
                  <span className="font-black tracking-widest uppercase font-['Cairo']">إعداد عقد شهري جديد</span>
               </button>
            </div>
         )}

         {activeTab === 'stats' && (
            <div className="space-y-12">
               <div>
                  <h4 className="text-lg font-black mb-4 flex items-center justify-end gap-2 font-['Cairo']">
                     استهلاك المساحة (Post-paid) <Clock size={20} className="text-indigo-600" />
                  </h4>
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden overflow-x-auto">
                     <table className="w-full text-right">
                        <thead>
                           <tr className="bg-slate-50 border-b border-slate-100 text-slate-400">
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">التاريخ</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">العضو</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">الشركة</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">الساعات</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">السعر</th>
                           </tr>
                        </thead>
                        <tbody>
                           {spaceReport.map((row: any) => (
                              <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                                 <td className="p-6 text-sm font-bold">{new Date(row.check_in).toLocaleDateString('ar-EG')}</td>
                                 <td className="p-6 text-base font-black">{row.company_members?.name}</td>
                                 <td className="p-6">
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase">{row.companies?.name}</span>
                                 </td>
                                 <td className="p-6 text-base font-black">{Number(row.duration_hours).toFixed(2)} Hr</td>
                                 <td className="p-6 text-lg font-black text-indigo-600">{Number(row.total_price).toLocaleString()} EGP</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div>
                  <h4 className="text-lg font-black mb-4 flex items-center justify-end gap-2 font-['Cairo']">
                     طلبات الكافتيريا (Prepaid Shared) <CreditCard size={20} className="text-emerald-600" />
                  </h4>
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden overflow-x-auto">
                     <table className="w-full text-right">
                        <thead>
                           <tr className="bg-slate-50 border-b border-slate-100 text-slate-400">
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">الوقت</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">العضو</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">الشركة</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">المنتج</th>
                              <th className="p-6 text-[10px] font-black uppercase tracking-widest">المبلغ</th>
                           </tr>
                        </thead>
                        <tbody>
                           {cateringReport.map((row: any) => (
                              <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                                 <td className="p-6 text-sm font-bold">{new Date(row.created_at).toLocaleString('ar-EG')}</td>
                                 <td className="p-6 text-base font-black">{row.company_members?.name}</td>
                                 <td className="p-6">
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">{row.companies?.name}</span>
                                 </td>
                                 <td className="p-6 text-base font-black">{row.item_name}</td>
                                 <td className="p-6 text-lg font-black text-emerald-600">{Number(row.price).toLocaleString()} EGP</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
      </div>

      {/* Modals */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
           <Card className="w-full max-w-xl rounded-[3.5rem] overflow-hidden">
             <div className="bg-indigo-600 p-8 text-white flex justify-between items-center font-['Cairo']">
               <button onClick={() => setShowAddCompanyModal(false)}><X /></button>
               <h2 className="text-2xl font-black">إضافة شركة جديدة</h2>
             </div>
             <CardContent className="p-10 bg-white">
               <form onSubmit={handleAddCompany} className="space-y-6 font-['Cairo']">
                 <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 block text-right">البحث عن مسؤول (عضو مسجل مسبقاً)</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text"
                        placeholder="ابحث بكود العضو أو الاسم..."
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-2xl text-right outline-none focus:border-indigo-500 transition-all font-['Cairo']"
                        value={leaderSearchQuery}
                        onChange={(e) => handleLeaderSearch(e.target.value)}
                      />
                    </div>
                    {leaderSearchQuery && (
                      <div className="max-h-40 overflow-y-auto border-2 border-slate-50 rounded-2xl bg-white shadow-xl divide-y divide-slate-50">
                        {filteredLeaders.map(l => (
                          <div 
                            key={l.id}
                            onClick={() => {
                              setCompanyForm({
                                ...companyForm,
                                leader_name: l.full_name,
                                leader_email: l.email || '',
                                leader_phone: l.phone || '',
                                leader_id: l.id
                              });
                              setLeaderSearchQuery('');
                              setFilteredLeaders([]);
                            }}
                            className="p-4 hover:bg-indigo-50 cursor-pointer text-right flex justify-between items-center transition-colors"
                          >
                            <span className="text-[10px] font-black font-mono text-indigo-500">#{l.code}</span>
                            <span className="font-bold text-slate-900">{l.full_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 block text-right">اسم الشركة</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} />
                  </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 block text-right">كود الشركة (للربط)</label>
                       <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-center font-mono uppercase" placeholder="EX: VOD-2026" required value={companyForm.company_code} onChange={e => setCompanyForm({...companyForm, company_code: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 block text-right">المسؤول</label>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={companyForm.leader_name} onChange={e => setCompanyForm({...companyForm, leader_name: e.target.value})} />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 block text-right">رقم الهاتف</label>
                       <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={companyForm.leader_phone} onChange={e => setCompanyForm({...companyForm, leader_phone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 block text-right">البريد الإلكتروني</label>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" type="email" value={companyForm.leader_email} onChange={e => setCompanyForm({...companyForm, leader_email: e.target.value})} />
                    </div>
                 </div>
                 <button type="submit" className="w-full h-18 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-xl">حفظ الشركة</button>
               </form>
             </CardContent>
           </Card>
        </div>
      )}

      {showEditCompanyModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <Card className="w-full max-w-xl rounded-[3.5rem] overflow-hidden">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center font-['Cairo']">
                <button onClick={() => {
                  setShowEditCompanyModal(false);
                  setEditingCompany(null);
                }}><X /></button>
                <h2 className="text-2xl font-black">تعديل بيانات الشركة</h2>
              </div>
              <CardContent className="p-10 bg-white">
                <form onSubmit={handleEditCompany} className="space-y-6 font-['Cairo']">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 block text-right">اسم الشركة</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 block text-right">كود الشركة (للربط)</label>
                        <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-center font-mono uppercase" placeholder="EX: VOD-2026" required value={companyForm.company_code} onChange={e => setCompanyForm({...companyForm, company_code: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 block text-right">اسم المسؤول</label>
                       <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={companyForm.leader_name} onChange={e => setCompanyForm({...companyForm, leader_name: e.target.value})} />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 block text-right">رقم الهاتف</label>
                        <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={companyForm.leader_phone} onChange={e => setCompanyForm({...companyForm, leader_phone: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 block text-right">البريد الإلكتروني</label>
                       <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" type="email" value={companyForm.leader_email} onChange={e => setCompanyForm({...companyForm, leader_email: e.target.value})} />
                     </div>
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="flex-1 h-16 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl">حفظ التغييرات</button>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (editingCompany) handleDeleteCompany(editingCompany.id);
                      }}
                      className="w-16 h-16 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
         </div>
       )}

      {showAddContractModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <Card className="w-full max-w-xl rounded-[3.5rem] overflow-hidden">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center font-['Cairo']">
              <button onClick={() => setShowAddContractModal(false)}><X /></button>
              <h2 className="text-2xl font-black">إعداد عقد الشهر</h2>
            </div>
            <CardContent className="p-10 bg-white">
              <form onSubmit={handleAddContract} className="space-y-6 font-['Cairo']">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 block text-right">اختر الشركة</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-right" required value={contractForm.company_id} onChange={e => setContractForm({...contractForm, company_id: e.target.value})}>
                    <option value="">-- اختر --</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-xs font-black text-slate-400 block text-right">سعر ساعة المساحة</label>
                     <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-center font-bold" type="number" required value={contractForm.space_hour_price} onChange={e => setContractForm({...contractForm, space_hour_price: Number(e.target.value)})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-black text-slate-400 block text-right">ميزانية الكافتيريا</label>
                     <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-center font-bold text-emerald-600" type="number" required value={contractForm.catering_prepaid_total} onChange={e => setContractForm({...contractForm, catering_prepaid_total: Number(e.target.value)})} />
                   </div>
                </div>
                <button type="submit" className="w-full h-18 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl">تفعيل العقد</button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <Card className="w-full max-w-xl rounded-[3.5rem] overflow-hidden">
            <div className="bg-emerald-600 p-8 text-white flex justify-between items-center font-['Cairo']">
              <button onClick={() => setShowAddMemberModal(false)}><X /></button>
              <h2 className="text-2xl font-black">إضافة عضو جديد</h2>
            </div>
            <CardContent className="p-10 bg-white">
              <form onSubmit={handleAddMembers} className="space-y-6 font-['Cairo']">
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 block text-right">بحث عن عميل (الاسم، الكود، الهاتف)</label>
                  <div className="relative">
                     <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input 
                        type="text"
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-2xl text-right outline-none focus:border-indigo-500 transition-all font-['Cairo']"
                        placeholder="ابحث هنا..."
                        value={memberSearchQuery}
                        onChange={(e) => handleMemberSearch(e.target.value)}
                     />
                  </div>
                  
                  {memberSearchQuery && (
                    <div className="max-h-60 overflow-y-auto border-2 border-slate-50 rounded-2xl bg-white shadow-inner">
                       {filteredCustomers.length > 0 ? filteredCustomers.map(c => {
                         const isSelected = selectedPendingMembers.find(m => m.id === c.id);
                         return (
                            <div 
                              key={c.id} 
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedPendingMembers(prev => prev.filter(m => m.id !== c.id));
                                } else {
                                  setSelectedPendingMembers(prev => [...prev, c]);
                                }
                              }}
                              className={`p-4 hover:bg-indigo-50 border-b border-slate-50 cursor-pointer transition-colors text-right flex justify-between items-center ${isSelected ? 'bg-indigo-50 border-r-4 border-r-indigo-500' : ''}`}
                            >
                                <span className={`text-[10px] font-black font-mono ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                                  {isSelected ? <CheckCircle2 size={14} /> : `#${c.code} | ${c.phone}`}
                                </span>
                                <span className={`font-black ${isSelected ? 'text-indigo-600' : 'text-slate-800'}`}>{c.full_name}</span>
                            </div>
                         );
                       }) : (
                         <div className="p-8 text-center text-slate-300 font-black uppercase tracking-widest text-xs">لا توجد نتائج</div>
                       )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 block text-right">الأعضاء الذين سيتم إضافتهم ({selectedPendingMembers.length})</label>
                  <div className="flex flex-wrap gap-2 justify-end min-h-16 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                     {selectedPendingMembers.map(m => (
                       <div key={m.id} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 group animate-in zoom-in-50">
                          <button onClick={() => setSelectedPendingMembers(prev => prev.filter(x => x.id !== m.id))} className="hover:text-rose-300"><X size={12} /></button>
                          <span>{m.full_name}</span>
                       </div>
                     ))}
                     {selectedPendingMembers.length === 0 && <span className="text-slate-300 text-xs font-black self-center">لم يتم اختيار أي عضو بعد</span>}
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={selectedPendingMembers.length === 0}
                  className="w-full h-18 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl disabled:opacity-50"
                >
                  إضافة {selectedPendingMembers.length} عضو للشركة
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showViewMembersModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <Card className="w-full max-w-2xl rounded-[3.5rem] overflow-hidden">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center font-['Cairo']">
              <button onClick={() => setShowViewMembersModal(false)}><X /></button>
              <h2 className="text-2xl font-black">أعضاء الشركة ({companyMembers.length})</h2>
            </div>
            <CardContent className="p-10 bg-white">
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-slate-100 p-4 rounded-2xl grid grid-cols-4 text-center font-black text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                   <span>الأدوات</span>
                   <span>ساعات العمل</span>
                   <span>استهلاك الكافية</span>
                   <span className="text-right">العضو</span>
                </div>
                {companyMembers.map((member: any) => (
                   <div key={member.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl group hover:border-indigo-200 transition-all hover:shadow-lg">
                      <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      
                      <div className="flex-1 grid grid-cols-3 text-center items-center">
                         <div className="flex flex-col">
                            <span className="font-black text-slate-900">{member.spaceTotalHours?.toFixed(1) || 0} hr</span>
                            <span className="text-[9px] text-slate-400">({member.spaceTotalCost || 0} EGP)</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="font-black text-emerald-600">{member.cateringTotal || 0} EGP</span>
                         </div>
                         <div className="text-right">
                           <p className="font-black text-slate-800 text-sm truncate">{member.name}</p>
                           <p className="text-[10px] font-black text-indigo-500 font-mono tracking-tighter">#{member.unique_code}</p>
                         </div>
                      </div>
                   </div>
                ))}
                {companyMembers.length === 0 && <p className="text-center py-20 text-slate-300 italic">لا يوجد أعضاء مضافين</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
