import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Receipt, Trash2, Calendar, Tag, CreditCard, X, Save, ArrowDownRight,
  Sparkles, Truck, Coffee, Wrench, Zap, PenTool, Users, Package, Megaphone, Home, Heart, 
  MoreHorizontal, Wallet, Landmark, Image as ImageIcon, History, AlertCircle, ShoppingCart, Edit, Layers 
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Modal } from '../components/ui';
import { supabase } from '../lib/supabase';

const EXPENSE_CATEGORIES = [
  { id: 'Cleaning', label: 'تنظيف وتطهير', icon: 'Sparkles', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'transportation', label: 'انتقالات ومواصلات', icon: 'Truck', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'Kitchen', label: 'مطبخ وبوفيه', icon: 'Coffee', color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'Maintenance', label: 'صيانة وإصلاحات', icon: 'Wrench', color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'Utilities', label: 'مرافق (كهرباء/مياه/نت)', icon: 'Zap', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'Office Supplies', label: 'أدوات مكتبية', icon: 'PenTool', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'Salaries', label: 'رواتب وأجور', icon: 'Users', color: 'text-rose-500', bg: 'bg-rose-50' },
  { id: 'Assets', label: 'أصول ومعدات', icon: 'Package', color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'Marketing', label: 'تسويق وإعلانات', icon: 'Megaphone', color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { id: 'Rent', label: 'إيجار', icon: 'Home', color: 'text-slate-700', bg: 'bg-slate-50' },
  { id: 'Employee benefits', label: 'بدلات ومزايا موظفين', icon: 'Heart', color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 'other', label: 'أخرى', icon: 'MoreHorizontal', color: 'text-slate-400', bg: 'bg-slate-100' },
];

const CategoryIcon = ({ name, size = 18, className = "" }: { name: string, size?: number, className?: string }) => {
  const icons: Record<string, any> = {
    Plus, Search, Filter, Receipt, Trash2, Calendar, Tag, CreditCard, X, Save, ArrowDownRight,
    Sparkles, Truck, Coffee, Wrench, Zap, PenTool, Users, Package, Megaphone, Home, Heart, 
    MoreHorizontal, Wallet, Landmark, ImageIcon, History, AlertCircle, ShoppingCart
  };

  const Icon = icons[name] || MoreHorizontal;
  return <Icon size={size} className={className} />;
};


export const ExpensesPanel = ({ branchId }: { branchId?: string }) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: EXPENSE_CATEGORIES[0].label,
    paymentMethod: 'نقدًا (كاش)',
    supplier: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
    items: [] as { name: string, price: string, qty: string, unit: string, piecesPerUnit: string, image_url?: string }[]
  });

  const [submitting, setSubmitting] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [potentialDuplicate, setPotentialDuplicate] = useState<any>(null);


  useEffect(() => {
    fetchExpenses();
  }, [branchId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let query = supabase.from('expenses').select('*').order('date', { ascending: false });
      if (branchId) query = query.eq('branch_id', branchId);
      
      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (submitting) return;
    const finalAmount = newExpense.items.length > 0
      ? newExpense.items.reduce((sum, item) => sum + (parseFloat(item.price || '0') * parseFloat(item.qty || '0')), 0)
      : parseFloat(newExpense.amount || '0');

    if (!finalAmount || !newExpense.category) return;
    setSubmitting(true);
    
    try {
        // Consolidation logic to merge items with identical names
        const uniqueItems = newExpense.items.reduce((acc, current) => {
            const existing = acc.find(item => item.name.trim() === current.name.trim());
            if (existing) {
                existing.qty = (parseFloat(existing.qty) + parseFloat(current.qty)).toString();
                // Take the newest price if they differ
                existing.price = current.price;
            } else {
                acc.push({ ...current });
            }
            return acc;
        }, [] as any[]);

        // Sync Loop: Handles both New Entry (Stock + Price) and Edit (Price Override)
        if ((newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية') && uniqueItems.length > 0) {
            for (const item of uniqueItems) {
                if (!item.name || parseFloat(item.qty) <= 0) continue;
                
                // Find or Create in inventory (matching name AND branch to isolate)
                const { data: existing } = await supabase
                    .from('inventory')
                    .select('id, stock')
                    .eq('name', item.name.trim())
                    .eq('category', newExpense.category)
                    .eq('branch_id', branchId || null)
                    .maybeSingle();
                    
                if (existing) {
                    const costVal = parseFloat(item.price);
                    const ppu = parseFloat(item.piecesPerUnit || '1') || 1;
                    const stockToAdd = parseFloat(item.qty) * ppu;
                    const sellingPrice = parseFloat(item.sellingPrice) || (costVal / ppu * 1.5);

                    const updateObj = !editingExpenseId ? { 
                        stock: (existing.stock || 0) + stockToAdd, 
                        last_restock: newExpense.date,
                        price: costVal / ppu, // COST per piece
                        selling_price: sellingPrice, // Retail Price per piece
                        pieces_per_unit: ppu,
                        image_url: item.image_url || null, // SYNC IMAGE
                        unit: 'قطعة'
                    } : { 
                        price: costVal / ppu, // Update COST on edit too
                        selling_price: sellingPrice,
                        pieces_per_unit: ppu,
                        image_url: item.image_url || null
                    };

                    await supabase.from('inventory').update(updateObj).eq('id', existing.id);
                        
                    if (newExpense.category === 'مطبخ وبوفيه') {
                        await supabase.from('catering_items').upsert({
                            inventory_id: existing.id,
                            name: item.name.trim(),
                            price: sellingPrice, // RETAIL SELLING PRICE
                            branch_id: branchId || null,
                            is_active: true
                        }, { onConflict: 'inventory_id' } as any);
                    }

                    if (!editingExpenseId) {
                        await supabase.from('inventory_logs').insert([{
                            inventory_id: existing.id,
                            type: 'Supply',
                            quantity: stockToAdd,
                            notes: newExpense.note + ` (Bought ${item.qty} ${item.unit} x ${ppu} pc)`
                        }]);
                    }
                } else {
                    // Create NEW Inventory Record (even if editing the expense, 
                    // we should create the item if it never existed before)
                    const costVal = parseFloat(item.price);
                    const ppu = parseFloat(item.piecesPerUnit || '1') || 1;
                    const initialStock = parseFloat(item.qty) * ppu;
                    const sellingPrice = parseFloat(item.sellingPrice) || (costVal / ppu * 1.5);

                    const { data: newInv } = await supabase
                        .from('inventory').insert([{
                            name: item.name.trim(),
                            category: newExpense.category,
                            stock: initialStock,
                            price: costVal / ppu, // COST per piece
                            selling_price: sellingPrice, // Retail Price per piece
                            min_stock: 12,
                            unit: 'قطعة', 
                            pieces_per_unit: ppu,
                            last_restock: newExpense.date,
                            branch_id: branchId || null
                        }]).select().single();
                        
                    if (newInv && newExpense.category === 'مطبخ وبوفيه') {
                        await supabase.from('catering_items').upsert({
                            inventory_id: (newInv as any).id,
                            name: item.name.trim(),
                            price: sellingPrice, // RETAIL SELLING PRICE
                            branch_id: branchId || null,
                            image_url: item.image_url || null, // SYNC IMAGE FOR NEW ITEM
                            is_active: true
                        }, { onConflict: 'inventory_id' } as any);
                    }

                        await supabase.from('inventory_logs').insert([{
                            inventory_id: (newInv as any).id,
                            type: 'Supply',
                            quantity: parseFloat(item.qty),
                            notes: newExpense.note
                        }]);
                }
            }
        }

        const expenseRecord = {
          category: newExpense.category,
          amount: finalAmount,
          date: newExpense.date,
          note: newExpense.note + (newExpense.items.length > 0 ? ` (${newExpense.items.length} أصناف)` : ''),
          payment_method: newExpense.paymentMethod,
          supplier: newExpense.supplier,
          type: 'General',
          items: newExpense.items.length > 0 ? newExpense.items : null,
          branch_id: branchId || null
        };


        if (editingExpenseId) {
            const { error } = await supabase.from('expenses').update(expenseRecord).eq('id', editingExpenseId);
            if (error) throw error;
        } else {
            // Check for duplicates before insert if not editing
            const { data: duplicate } = await supabase
                .from('expenses')
                .select('id, amount, category, date')
                .eq('amount', finalAmount)
                .eq('category', newExpense.category)
                .eq('date', newExpense.date)
                .maybeSingle();

            if (duplicate && !window.confirm('تم العثور على مصروف بنفس المبلغ والفئة في هذا التاريخ. هل تريد الاستمرار وإضافة مصروف مكرر؟')) {
                setSubmitting(false);
                return;
            }

            const { error } = await supabase.from('expenses').insert([expenseRecord]);
            if (error) throw error;
        }

        setShowAddModal(false);
        setEditingExpenseId(null);
        setNewExpense({
          amount: '',
          category: EXPENSE_CATEGORIES[0].label,
          paymentMethod: 'نقدًا (كاش)',
          supplier: '',
          note: '',
          date: new Date().toISOString().split('T')[0],
          items: []
        });

        fetchExpenses();
    } catch (err: any) {
        alert('حدث خطأ أثناء حفظ المصروف: ' + err.message);
    } finally {
        setSubmitting(false);
    }
  };
  
  const handleEditExpense = (expense: any) => {
    setEditingExpenseId(expense.id);
    setNewExpense({
      amount: expense.amount?.toString() || '',
      category: expense.category,
      paymentMethod: expense.payment_method || 'نقدًا (كاش)',
      supplier: expense.supplier || '',
      note: expense.note || '',
      date: expense.date,
      items: expense.items || []
    });
    setShowAddModal(true);
  };

  
  const handleDeleteExpense = async (id: string) => {
      if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
      try {
          const { error } = await supabase.from('expenses').delete().eq('id', id);
          if (error) throw error;
          fetchExpenses();
      } catch (err: any) {
          alert("خطأ أثناء الحذف: " + err.message);
      }
  };

  const addItemRow = () => {
    setNewExpense({
      ...newExpense,
      items: [...newExpense.items, { name: '', price: '', qty: '1', unit: 'كرتونة', piecesPerUnit: '12', sellingPrice: '', image_url: '' }]
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...newExpense.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setNewExpense({ ...newExpense, items: newItems });
  };

  const removeItem = (index: number) => {
    setNewExpense({
      ...newExpense,
      items: newExpense.items.filter((_, i) => i !== index)
    });
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right">
      {/* Action Header */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-6">
        <div className="flex gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Plus size={18} /> إضافة مصروف جديد
          </button>
          <button className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all flex items-center gap-2">
            <Filter size={18} /> تصنيف
          </button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="البحث في المصروفات..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Statistics Summary */}
        {/* Statistics Summary - Redesigned for WOW factor */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
            <ArrowDownRight className="absolute left-6 bottom-6 text-white/10" size={80} />
            
            <p className="text-indigo-200 font-black text-[10px] uppercase tracking-widest mb-2 relative z-10">إجمالي مصروفات الشهر</p>
            <div className="flex items-baseline gap-2 relative z-10">
              <h3 className="text-4xl font-black">{totalExpenses.toLocaleString()}</h3>
              <span className="text-xs text-indigo-300 font-bold">EGP</span>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-indigo-300">
                <span>Monthly Budget</span>
                <span>75% used</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-800 flex items-center gap-2">
                <Tag size={18} className="text-indigo-500" /> تحليل الفئات
              </h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics</span>
            </div>
            
            <div className="space-y-6">
              {[
                { label: 'ثابتة (إيجار/فواتير)', val: 65, color: 'bg-indigo-500' },
                { label: 'متغيرة (مشتريات)', val: 20, color: 'bg-emerald-500' },
                { label: 'أخرى', val: 15, color: 'bg-amber-500' }
              ].map((stat, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-black">
                    <span className="text-slate-500">{stat.label}</span>
                    <span className="text-slate-800">{stat.val}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                    <div className={`h-full ${stat.color} rounded-full`} style={{ width: `${stat.val}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تنبيه الميزانية</p>
                <p className="text-xs font-bold text-slate-700">اقتربت من تجاوز ميزانية بند "المطبخ"</p>
              </div>
            </div>
          </div>
        </div>


        {/* Expenses List */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-6">البند / الفئة</th>
                <th className="px-6 py-6">التاريخ</th>
                <th className="px-6 py-6 font-black">الدفع / المورد</th>
                <th className="px-6 py-6">الملاحظات</th>
                <th className="px-6 py-6 text-center">المبلغ</th>
                <th className="px-8 py-6 text-left">إجراء</th>
              </tr>

            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {expenses.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl group-hover:shadow-md transition-all ${EXPENSE_CATEGORIES.find(c => c.label === item.category)?.bg || 'bg-slate-100'} ${EXPENSE_CATEGORIES.find(c => c.label === item.category)?.color || 'text-slate-500'}`}>
                        <CategoryIcon name={EXPENSE_CATEGORIES.find(c => c.label === item.category)?.icon || 'Receipt'} size={18} />
                      </div>
                      <div>
                        <p className="text-slate-800 text-sm">{item.category}</p>
                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{item.type}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-6 text-slate-400 text-xs">
                    <div className="flex items-center gap-2"><Calendar size={12} /> {item.date}</div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-700 text-xs font-black">
                        <Wallet size={12} className="text-indigo-400" /> {item.payment_method || 'نقدًا'}
                      </div>
                      {item.supplier && (
                        <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                          <Users size={12} /> {item.supplier}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-slate-500 text-xs max-w-xs truncate">{item.note}</td>
                  <td className="px-6 py-6 text-center text-rose-600 font-black">
                    <div className="flex flex-col items-center">
                      <span className="text-lg">{item.amount?.toLocaleString() || 0}</span>
                      <span className="text-[8px] opacity-50 uppercase tracking-tighter">Egyptian Pound</span>
                    </div>
                  </td>

                  <td className="px-8 py-6 text-left">
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => handleEditExpense(item)} className="p-2 text-slate-400 hover:text-indigo-600 transition-all" title="تعديل"><Edit size={18} /></button>
                      <button onClick={() => handleDeleteExpense(item.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={18} /></button>
                    </div>
                  </td>

                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold">لا توجد مصروفات مسجلة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        className={newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية' ? 'max-w-4xl' : 'max-w-xl'}
      >
          <div className="w-full bg-white rounded-[3rem] shadow-none overflow-hidden relative border-none">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 italic">
                  <Receipt size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{editingExpenseId ? 'تعديل المصروف' : 'قيد مصروفات'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editingExpenseId ? 'Update Financial Record' : 'Financial Expense Documentation'}</p>
                </div>

              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-4 bg-white text-slate-400 hover:text-rose-600 rounded-2xl transition-all shadow-sm border border-slate-100 active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Category Grid Selection */}
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mr-2 mb-2">فئة المصروف</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setNewExpense({
                          ...newExpense,
                          category: cat.label,
                          items: (cat.label === 'مطبخ وبوفيه' || cat.label === 'أدوات مكتبية') ? (newExpense.items.length === 0 ? [{ name: '', price: '', qty: '1', unit: 'قطعة' }] : newExpense.items) : []
                        });
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all group ${
                        newExpense.category === cat.label
                          ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-50'
                          : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${cat.bg} ${cat.color}`}>
                        <CategoryIcon name={cat.icon} size={24} />
                      </div>
                      <span className={`text-[11px] font-black ${newExpense.category === cat.label ? 'text-indigo-900' : 'text-slate-600'}`}>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Amount or Itemized List */}
                <div className={`space-y-6 ${(newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية') ? 'md:col-span-2' : ''}`}>
                  {(newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية') ? (
                    <div className="space-y-4 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-slate-700 flex items-center gap-2">
                           <ShoppingCart size={18} className="text-indigo-500" /> تفاصيل المشتريات
                        </span>
                        <button
                          onClick={addItemRow}
                          className="text-xs font-black bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                          <Plus size={16} /> إضافة صنف
                        </button>
                      </div>

                      <div className="space-y-4">
                        {newExpense.items.map((item, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative animate-in slide-in-from-right-2 duration-300 group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50/50 to-transparent -z-10 rounded-bl-[3rem]"/>
                            {/* Delete Button */}
                            <button onClick={() => removeItem(idx)} className="absolute top-4 left-4 w-8 h-8 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl flex items-center justify-center transition-colors z-30 shadow-sm">
                              <X size={14} />
                            </button>

                            <div className="flex flex-col md:flex-row gap-6">
                              {/* Left side: Image uploader */}
                              <div className="w-full md:w-32 shrink-0">
                                <div className="w-full aspect-square bg-slate-50 hover:bg-indigo-50/50 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-[1.5rem] flex items-center justify-center relative transition-all group/img cursor-pointer">
                                  <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                      onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          try {
                                              const fileExt = file.name.split('.').pop();
                                              const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                                              const filePath = `inventory/${branchId || 'default'}/${fileName}`;
                                              
                                              const { error: uploadError } = await supabase.storage
                                                  .from('inventory-images')
                                                  .upload(filePath, file);
                                              
                                              if (uploadError) throw uploadError;
                                              
                                              const { data: { publicUrl } } = supabase.storage
                                                  .from('inventory-images')
                                                  .getPublicUrl(filePath);
                                              
                                              const newItems = [...newExpense.items];
                                              newItems[idx].image_url = publicUrl;
                                              setNewExpense({ ...newExpense, items: newItems });
                                          } catch (err) {
                                              console.error('Upload error:', err);
                                              alert('خطأ أثناء رفع الصورة');
                                          }
                                      }}
                                  />
                                  {item.image_url ? (
                                      <img src={item.image_url} className="w-full h-full object-cover rounded-[1.3rem] shadow-sm" />
                                  ) : (
                                      <div className="text-center">
                                          <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-2 text-slate-300 group-hover/img:text-indigo-400 transition-colors">
                                            <ImageIcon size={20} />
                                          </div>
                                          <p className="text-[9px] text-slate-400 font-black">صورة المنتج</p>
                                      </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 rounded-[1.3rem] flex items-center justify-center transition-opacity z-10 pointer-events-none">
                                      <Plus size={20} className="text-white" />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex-1 space-y-4">
                                {/* Row 1: Name & Unit Dropdown */}
                                <div className="flex gap-3">
                                  <div className="flex-1">
                                    <Input
                                      value={item.name}
                                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                      placeholder="اسم الصنف (مثال: قهوة اسبريسو)"
                                      className="h-14 text-sm font-black border-2 border-slate-100 bg-slate-50/50 rounded-2xl focus:bg-white focus:border-indigo-200 transition-all text-right px-4"
                                    />
                                  </div>
                                  <div className="w-32 shrink-0">
                                     <select
                                        value={item.unit}
                                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                        className="w-full h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-4 text-xs font-black outline-none focus:bg-white focus:border-indigo-200 text-slate-600 transition-all"
                                      >
                                        <option>كرتونة</option>
                                        <option>باكتة</option>
                                        <option>علبة</option>
                                        <option>قطعة</option>
                                      </select>
                                  </div>
                                </div>

                                {/* Row 2: Purchasing Matrix */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-indigo-200 focus-within:bg-white transition-all">
                                    <label className="text-[9px] font-black tracking-widest text-slate-400 mb-2 block">الكمية المشتراة</label>
                                    <div className="flex items-center gap-3">
                                      <Package size={16} className="text-emerald-500" />
                                      <input
                                        type="text" inputMode="decimal"
                                        value={item.qty}
                                        onChange={(e) => updateItem(idx, 'qty', e.target.value.replace(/[^0-9.]/g, ''))}
                                        className="w-full bg-transparent border-none outline-none font-black text-sm text-slate-700 placeholder-slate-300"
                                        placeholder="0"
                                      />
                                    </div>
                                  </div>
                                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-indigo-200 focus-within:bg-white transition-all">
                                    <label className="text-[9px] font-black tracking-widest text-slate-400 mb-2 block">سعر الشراء (للوحدة)</label>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-black text-rose-500">ج.م</span>
                                      <input
                                        type="text" inputMode="decimal"
                                        value={item.price}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            const newItems = [...newExpense.items];
                                            newItems[idx].price = val;
                                            const ppu = parseFloat(item.piecesPerUnit) || 1;
                                            const suggested = (parseFloat(val) / ppu * 1.5).toFixed(2);
                                            newItems[idx].sellingPrice = suggested;
                                            setNewExpense({ ...newExpense, items: newItems });
                                        }}
                                        className="w-full bg-transparent border-none outline-none font-black text-sm text-slate-700"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                  <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 relative overflow-hidden focus-within:border-indigo-300 focus-within:bg-white transition-all">
                                     <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-2xl" />
                                     <label className="text-[9px] font-black tracking-widest text-indigo-400 mb-2 block mr-2">عدد القطع بداخلها</label>
                                     <div className="flex items-center gap-3 mr-2">
                                      <Layers size={16} className="text-indigo-500" />
                                      <input
                                        type="text" inputMode="numeric"
                                        value={item.piecesPerUnit}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            const newItems = [...newExpense.items];
                                            newItems[idx].piecesPerUnit = val;
                                            const cost = parseFloat(item.price) || 0;
                                            const suggested = (cost / (parseFloat(val) || 1) * 1.5).toFixed(2);
                                            newItems[idx].sellingPrice = suggested;
                                            setNewExpense({ ...newExpense, items: newItems });
                                        }}
                                        className="w-full bg-transparent border-none outline-none font-black text-sm text-indigo-700"
                                        placeholder="1"
                                      />
                                     </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Live Math Footer per Item */}
                            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <div className="text-[10px] font-black bg-slate-50 text-slate-500 px-4 py-2 rounded-xl border border-slate-100 flex-1 sm:flex-none text-center">
                                   إجمالي القطع: <span className="text-emerald-600 mx-1">{(parseFloat(item.qty||'0') * parseFloat(item.piecesPerUnit||'1'))||0}</span> قطعة
                                </div>
                                <div className="text-[10px] font-black bg-slate-50 text-slate-500 px-4 py-2 rounded-xl border border-slate-100 flex-1 sm:flex-none text-center">
                                   تكلفة القطعة عليك: <span className="text-rose-600 mx-1">{((parseFloat(item.price||'0') / parseFloat(item.piecesPerUnit||'1'))||0).toFixed(2)}</span> ج.م
                                </div>
                              </div>

                              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                 <label className="text-[10px] font-black text-slate-500 hidden sm:block">سعر البيع للعميل:</label>
                                 <div className="relative group/price">
                                    <input
                                      type="text" inputMode="decimal"
                                      value={item.sellingPrice}
                                      onChange={(e) => updateItem(idx, 'sellingPrice', e.target.value.replace(/[^0-9.]/g, ''))}
                                      className="w-full sm:w-36 h-12 px-4 pt-4 pb-1 text-center bg-emerald-50 border-2 border-emerald-100 rounded-xl font-black text-emerald-700 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-sm"
                                      placeholder="0.00"
                                    />
                                    <span className="absolute top-1 right-3 text-[7px] font-black text-emerald-500 uppercase tracking-widest opacity-80">سعر البيع</span>
                                 </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400">الإجمالي المحسوب</span>
                        <span className="text-2xl font-black text-indigo-600">
                          {newExpense.items.reduce((s, i) => s + (parseFloat(i.price || '0') * parseFloat(i.qty || '0')), 0).toLocaleString()} <span className="text-sm">EGP</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mr-2">المبلغ المالي</label>
                      <div className="relative group">
                        <Input
                          type="number"
                          autoFocus
                          value={newExpense.amount}
                          onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                          placeholder="0.00"
                          className="text-4xl font-black h-28 text-center border-4 border-slate-50 focus:border-indigo-100 bg-slate-50/30 rounded-[2.5rem] transition-all shadow-inner"
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 left-8 text-slate-300 font-black text-xl">EGP</div>
                      </div>
                      
                      {/* Quick Amounts */}
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[50, 100, 200, 500, 1000].map(amt => (
                          <button
                            key={amt}
                            onClick={() => setNewExpense({...newExpense, amount: amt.toString()})}
                            className="px-4 py-2 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black transition-all active:scale-95 border border-slate-200 shadow-sm"
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Logistics & Metadata */}
                <div className={`space-y-8 ${(newExpense.category === 'مطبخ وبوفيه' || newExpense.category === 'أدوات مكتبية') ? 'md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 space-y-0' : ''}`}>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mr-2">بيانات الدفع والتاريخ</label>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="relative group">
                        <Calendar size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                          type="date"
                          value={newExpense.date}
                          onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                          className="h-16 pr-16 font-black border-2 border-slate-50 bg-slate-50/30 focus:border-indigo-100 rounded-3xl transition-all"
                        />
                      </div>

                      <div className="relative group">
                        <Wallet size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <select
                          value={newExpense.paymentMethod}
                          onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value })}
                          className="w-full h-16 pr-16 bg-slate-50/30 border-2 border-slate-50 rounded-3xl font-black text-sm outline-none focus:border-indigo-100 appearance-none transition-all rtl"
                        >
                          <option>نقدًا (كاش)</option>
                          <option>محفظة إلكترونية (Vodafone/etc)</option>
                          <option>تحويل بنكي / Instapay</option>
                          <option>فيزا / كارت ائتمان</option>
                          <option>أخرى</option>
                        </select>
                      </div>

                      <div className="relative group">
                        <Users size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                          value={newExpense.supplier}
                          onChange={(e) => setNewExpense({ ...newExpense, supplier: e.target.value })}
                          placeholder="المورد / الجهة المستلمة"
                          className="h-16 pr-16 font-black border-2 border-slate-50 bg-slate-50/30 focus:border-indigo-100 rounded-3xl transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mr-2">ملاحظات إضافية</label>
                    <div className="relative">
                      <Tag size={18} className="absolute right-6 top-6 text-slate-400" />
                      <textarea
                        value={newExpense.note}
                        onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
                        placeholder="أضف تفاصيل إضافية أو ملاحظات هامة..."
                        className="w-full min-h-[120px] bg-slate-50/30 border-2 border-slate-50 rounded-3xl p-6 pr-16 font-bold text-sm outline-none focus:border-indigo-100 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 text-slate-400">
                <AlertCircle size={18} />
                <span className="text-[10px] font-black uppercase tracking-wider">Please verify all data before confirmation</span>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                  <button
                    disabled={submitting}
                    onClick={handleAddExpense}
                    className="flex-1 md:flex-none h-16 bg-slate-900 text-white px-12 rounded-[1.5rem] font-black text-lg shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 group"
                  >
                    {submitting ? <History className="animate-spin" size={24} /> : (editingExpenseId ? <Save size={24} /> : <Plus size={24} />)}
                    {submitting ? 'جاري الحفظ...' : (editingExpenseId ? 'حفظ التعديلات' : 'تأكيد الحفظ الآن')}
                  </button>
              </div>
            </div>
          </div>
      </Modal>

    </div>
  );
};
