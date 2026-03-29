
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, Search, Edit, Trash2, X, CheckCircle2, 
  Loader2, LayoutGrid, List, Palette, Users, 
  Banknote, Hash, Type as TypeIcon 
} from 'lucide-react';

interface Room {
  id: string;
  name_ar: string;
  code: string;
  base_price: number;
  capacity: number;
  color: string;
  is_active: boolean;
  branch_id: string;
}

const COLOR_OPTIONS = [
  { id: 'blue', label: 'Blue (#1E75B9)', gradient: 'bg-[#1E75B9]', hex: '#1E75B9' },
  { id: 'orange', label: 'Orange (#F78C2A)', gradient: 'bg-[#F78C2A]', hex: '#F78C2A' },
  { id: 'red', label: 'Red (#F83854)', gradient: 'bg-[#F83854]', hex: '#F83854' },
  { id: 'green', label: 'Green (#1ED788)', gradient: 'bg-[#1ED788]', hex: '#1ED788' },
  { id: 'violet', label: 'Luxury (Violet)', gradient: 'from-violet-400 to-purple-600 bg-violet-500', hex: '#8b5cf6' },
  { id: 'slate', label: 'Small (Slate)', gradient: 'from-slate-400 to-slate-600 bg-slate-500', hex: '#64748b' },
  { id: 'rose', label: 'Special (Rose)', gradient: 'from-rose-400 to-rose-600 bg-rose-500', hex: '#f43f5e' },
  { id: 'indigo', label: 'Standard (Indigo)', gradient: 'from-indigo-400 to-indigo-600 bg-indigo-500', hex: '#6366f1' },
];

export const RoomsDatabase = ({ branchId }: { branchId?: string }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeModal, setActiveModal] = useState<'add' | 'edit' | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Room>>({
    name_ar: '',
    code: '',
    base_price: 0,
    capacity: 1,
    color: 'indigo',
    is_active: true
  });

  useEffect(() => {
    if (branchId) {
      fetchRooms();
    }
  }, [branchId]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('branch_id', branchId)
        .ilike('service_type', 'room')
        .order('code', { ascending: true });

      if (error) throw error;
      setRooms(data || []);
    } catch (err: any) {
      showNotification('خطأ في تحميل البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenAdd = () => {
    setFormData({
      name_ar: '',
      code: '',
      base_price: 0,
      capacity: 1,
      color: 'indigo',
      is_active: true
    });
    setActiveModal('add');
  };

  const handleOpenEdit = (room: Room) => {
    setSelectedRoom(room);
    setFormData(room);
    setActiveModal('edit');
  };

  const handleSubmit = async () => {
    if (!formData.name_ar || !formData.code) {
      showNotification('يرجى إدخال اسم الغرفة وكودها');
      return;
    }

    setSaving(true);
    try {
      if (activeModal === 'edit' && selectedRoom) {
        const { error } = await supabase
          .from('services')
          .update({
            name: formData.name_ar, // Satifying the NOT NULL constraint
            name_ar: formData.name_ar,
            code: formData.code,
            base_price: formData.base_price,
            capacity: formData.capacity,
            color: formData.color,
            is_active: formData.is_active
          })
          .eq('id', selectedRoom.id);

        if (error) throw error;
        showNotification('تم تحديث بيانات الغرفة بنجاح');
      } else {
        const { error } = await supabase
          .from('services')
          .insert([{
            ...formData,
            name: formData.name_ar, // Satifying the NOT NULL constraint
            branch_id: branchId,
            service_type: 'Room'
          }]);

        if (error) throw error;
        showNotification('تم إضافة الغرفة الجديدة بنجاح');
      }

      setActiveModal(null);
      fetchRooms();
    } catch (err: any) {
      showNotification('خطأ في الحفظ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الغرفة ${name}؟`)) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('تم حذف الغرفة بنجاح');
      fetchRooms();
    } catch (err: any) {
      showNotification('خطأ في الحذف: ' + err.message);
    }
  };

  const filteredRooms = rooms.filter(room => 
    room.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGradient = (colorId: string) => {
    switch (colorId) {
      case 'blue': return 'bg-[#1E75B9]';
      case 'orange': return 'bg-[#F78C2A]';
      case 'red': return 'bg-[#F83854]';
      case 'green': return 'bg-[#1ED788]';
      case 'amber': return 'from-amber-400 to-orange-600 bg-amber-500';
      case 'emerald': return 'from-emerald-400 to-teal-600 bg-emerald-500';
      case 'sky': return 'from-sky-400 to-cyan-600 bg-sky-500';
      case 'violet': return 'from-violet-400 to-purple-600 bg-violet-500';
      case 'slate': return 'from-slate-400 to-slate-600 bg-slate-500';
      case 'rose': return 'from-rose-400 to-rose-600 bg-rose-500';
      case 'indigo': return 'from-indigo-400 to-indigo-600 bg-indigo-500';
      default: return 'from-indigo-400 to-indigo-600 bg-indigo-500';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right pb-20 relative">
      {/* Notifications */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="text-emerald-400" size={20} />
          <span className="font-bold">{notification}</span>
        </div>
      )}

      {/* Header Controls */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-col xl:flex-row justify-between items-center gap-6 sticky top-6 z-30">
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="البحث باسم الغرفة أو الكود (مثال: R1)..."
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pr-16 pl-6 py-4 text-lg font-bold focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={20} />
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Plus size={20} /> إضافة غرفة جديدة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[...Array(6)].map((_, i) => (
             <div key={i} className="h-64 bg-slate-100 rounded-[3rem] animate-pulse"></div>
           ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-100 text-slate-400">
           <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
           <p className="text-xl font-black">لا توجد غرف مسجلة حالياً</p>
           <p className="font-bold text-sm mt-2">ابدأ بإضافة غرف جديدة للمساحة الخاصة بك</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredRooms.map(room => (
            <div key={room.id} className={`group relative bg-white rounded-[3rem] border-2 border-slate-50 p-8 transition-all hover:shadow-2xl hover:-translate-y-2 overflow-hidden ${!room.is_active && 'opacity-50 grayscale'}`}>
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getGradient(room.color)} opacity-5 rounded-bl-[5rem]`} />
              
              <div className="flex justify-between items-start mb-10">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getGradient(room.color)} flex items-center justify-center text-white font-black text-xl shadow-lg`}>
                  {room.code}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                  <button onClick={() => handleOpenEdit(room)} className="p-3 bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(room.id, room.name_ar)} className="p-3 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-800 mb-2 truncate">{room.name_ar}</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-400 font-bold text-sm">
                   <Users size={16} className="text-indigo-400" />
                   <span>سعة الغرفة: {room.capacity} فرد</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-bold text-sm">
                   <Banknote size={16} className="text-emerald-400" />
                   <span>السعر: {room.base_price} EGP / Hr</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <span>Status: {room.is_active ? 'Active' : 'Hidden'}</span>
                 <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${room.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                 </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-8 py-6">Code & Color</th>
                <th className="px-8 py-6">Room Name</th>
                <th className="px-8 py-6">Capacity</th>
                <th className="px-8 py-6">Hourly Rate</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-left">Tools</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {filteredRooms.map(room => (
                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradient(room.color)} flex items-center justify-center text-white text-xs font-black`}>
                        {room.code}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Hex/Gradient</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-slate-800 font-black">{room.name_ar}</td>
                  <td className="px-8 py-4 text-slate-500">{room.capacity} أفراد</td>
                  <td className="px-8 py-4 text-indigo-600 font-black">{room.base_price} EGP</td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${room.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {room.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(room)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(room.id, room.name_ar)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-rose-600 hover:text-white transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal - Add/Edit Room */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4 animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
            {/* Header */}
            <div className={`p-8 bg-gradient-to-r ${getGradient(formData.color || 'indigo')} flex justify-between items-center text-white shrink-0 relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                  {activeModal === 'add' ? <Plus size={32} /> : <Edit size={32} />}
                </div>
                <div>
                  <h3 className="text-3xl font-black">{activeModal === 'add' ? 'إضافة غرفة جديدة' : 'تعديل بيانات الغرفة'}</h3>
                  <p className="text-white/70 text-sm font-bold uppercase tracking-[0.2em] mt-1">
                    {activeModal === 'edit' ? `Configuration for ${formData.code}` : 'New Workspace Setup'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="relative z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row h-full overflow-hidden">
              {/* Form Fields */}
              <div className="flex-1 p-10 space-y-8 overflow-y-auto custom-scrollbar border-l border-slate-50 bg-white">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-2 pr-2 uppercase tracking-widest">
                        <Hash size={14} className="text-indigo-600" strokeWidth={3} /> كود الغرفة (Code)
                      </label>
                      <input 
                        type="text" 
                        placeholder="R1, VIP, etc."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-base font-black text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all uppercase placeholder:text-slate-300"
                        value={formData.code} 
                        onChange={e => setFormData({ ...formData, code: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-2 pr-2 uppercase tracking-widest">
                        <TypeIcon size={14} className="text-indigo-600" strokeWidth={3} /> اسم الغرفة (Name)
                      </label>
                      <input 
                        type="text" 
                        placeholder="مثال: غرفة اجتماعات"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-base font-black text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-300"
                        value={formData.name_ar} 
                        onChange={e => setFormData({ ...formData, name_ar: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-2 pr-2 uppercase tracking-widest">
                        <Banknote size={14} className="text-emerald-600" strokeWidth={3} /> السعر (EGP/Hr)
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pr-12 text-base font-black text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                          value={formData.base_price} 
                          onChange={e => setFormData({ ...formData, base_price: Number(e.target.value) })} 
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xs">EGP</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-2 pr-2 uppercase tracking-widest">
                        <Users size={14} className="text-blue-600" strokeWidth={3} /> السعة (Capacity)
                      </label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-base font-black text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                        value={formData.capacity} 
                        onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })} 
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-2 pr-2 uppercase tracking-widest">
                      <Palette size={14} className="text-amber-600" strokeWidth={3} /> اختر اللون المميز (Theme Color)
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                      {COLOR_OPTIONS.map(color => (
                        <button
                          key={color.id}
                          onClick={() => setFormData({ ...formData, color: color.id })}
                          className={`h-12 w-full rounded-xl relative overflow-hidden transition-all group bg-gradient-to-br ${getGradient(color.id)} ${formData.color === color.id ? 'ring-4 ring-offset-2 ring-indigo-500 shadow-xl scale-95' : 'opacity-80 hover:opacity-100 hover:scale-110 shadow-sm'}`}
                          title={color.label}
                        >
                           {formData.color === color.id && (
                             <div className="absolute inset-0 flex items-center justify-center text-white bg-black/10">
                                <CheckCircle2 size={24} />
                             </div>
                           )}
                           <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 group cursor-pointer" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}>
                    <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 shadow-inner'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${formData.is_active ? 'right-7' : 'right-1'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">تفعيل هذه الغرفة</p>
                      <p className="text-[10px] font-bold text-slate-500">ستظهر الغرفة في شاشات الحجز السريع والكشك فور التفعيل</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSubmit}
                  disabled={saving}
                  className={`w-full py-6 rounded-[2rem] font-black text-xl text-white shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 mt-8 bg-gradient-to-r ${getGradient(formData.color || 'indigo')} hover:brightness-110 disabled:opacity-50`}
                >
                  {saving ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
                  {activeModal === 'add' ? 'إضافة الغرفة الآن' : 'تحديث البيانات'}
                </button>
              </div>

              {/* Live Preview */}
              <div className="w-full lg:w-[380px] bg-slate-50/50 p-10 flex flex-col items-center justify-center gap-8 shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
                <div className="text-center space-y-2 relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Live Preview</p>
                  <h4 className="text-lg font-black text-slate-800">معاينة تصميم الغرفة</h4>
                </div>

                {/* Preview Card */}
                <div className={`w-full bg-white rounded-[2.5rem] border-2 border-white shadow-2xl shadow-slate-200/50 p-8 relative overflow-hidden transition-all duration-500 scale-100 group`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getGradient(formData.color || 'indigo')} opacity-5 rounded-bl-[5rem]`} />
                  
                  <div className="flex justify-between items-start mb-8">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getGradient(formData.color || 'indigo')} flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/10`}>
                      {formData.code || '??'}
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                       Available
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-slate-800 mb-2 truncate">{formData.name_ar || 'اسم الغرفة'}</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-400 font-bold text-sm">
                       <Users size={16} className="text-indigo-400" />
                       <span> {formData.capacity || 0} فرد</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 font-bold text-sm">
                       <Banknote size={16} className="text-emerald-400" />
                       <span> {formData.base_price || 0} EGP / Hr</span>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                     <span>Design System Preview</span>
                     <div className="flex gap-1">
                        <div className={`w-2 h-2 rounded-full bg-emerald-400`} />
                     </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-bold text-center leading-relaxed">
                  يظهر هذا التصميم في لوحة التحكم الرئيسية<br />
                  بينما تظهر الألوان في شاشة الكشك بتدرجات أوسع
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
