
import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, TrendingUp, AlertTriangle, ArrowDown, ArrowUp, RefreshCcw, Coffee, Cookie, Sparkles, Printer, Trash2, Plus, X, Edit, Save, Image as ImageIcon } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Input, Modal } from '../components/ui';
import { supabase } from '../lib/supabase';

export const InventoryPanel = ({ branchId }: { branchId?: string }) => {
    const [activeCategory, setActiveCategory] = useState<'all' | 'drinks' | 'snacks' | 'office'>('all');
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        category: 'مشروبات',
        stock: 0,
        min_stock: 12,
        unit: 'كرتونة',
        price: 0, // This will store COST per piece
        pieces_per_unit: 1,
        selling_price: 0,
        image_url: ''
    });
    const [adding, setAdding] = useState(false);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [updating, setUpdating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // New states for "typing-friendly" numeric inputs
    const [boxCostStr, setBoxCostStr] = useState('');
    const [sellPriceStr, setSellPriceStr] = useState('');
    const [cartonQuantityStr, setCartonQuantityStr] = useState('0');
    const [editCartonQuantityStr, setEditCartonQuantityStr] = useState('0');

    useEffect(() => {
        fetchInventory();
        fetchLogs();
    }, [branchId]);

    const fetchInventory = async () => {
        try {
            setLoading(true);
            let query = supabase.from('inventory').select('*, catering_items(is_active)');
            if (branchId) query = query.eq('branch_id', branchId);
            
            const { data: invData, error: invError } = await query;
            if (invError) throw invError;
            
            // Fetch total sold units from workspace_sessions orders JSONB
            const { data: sessionData, error: sessionError } = await supabase
                .from('workspace_sessions')
                .select('orders');
            
            const soldCounts: Record<string, number> = {};
            if (!sessionError && sessionData) {
                sessionData.forEach(session => {
                    const orders = session.orders;
                    if (Array.isArray(orders)) {
                        orders.forEach((order: any) => {
                            // In JSONB, IDs might be stored under 'id' or 'product_id'
                            const pid = order.id || order.product_id;
                            if (pid) {
                                soldCounts[pid] = (soldCounts[pid] || 0) + (Number(order.quantity) || 0);
                            }
                        });
                    }
                });
            }
            
            const mappedData = (invData || []).map(item => ({
                ...item,
                total_sold: soldCounts[item.id] || 0,
                selling_price: item.selling_price
            }));

            setStockItems(mappedData);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            let query = supabase
                .from('inventory_logs')
                .select(`
                    *,
                    inventory:inventory_id(name)
                `)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (branchId) query = query.eq('branch_id', branchId);
            
            const { data, error } = await query;
            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if file is image
        if (!file.type.startsWith('image/')) {
            alert('يرجى اختيار ملف صور صالح');
            return;
        }

        try {
            // Use a temporary uploading state if possible, but for now we'll use loading
            setLoading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `inventory/${branchId || 'default'}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('inventory-images')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('inventory-images')
                .getPublicUrl(filePath);

            if (isEdit && editingItem) {
                setEditingItem({ ...editingItem, image_url: publicUrl });
            } else {
                setNewItem({ ...newItem, image_url: publicUrl });
            }
        } catch (err) {
            console.error('Error uploading image:', err);
            alert('حدث خطأ أثناء رفع الصورة');
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = stockItems.filter(item => {
        const matchesCategory = activeCategory === 'all' || 
                                (activeCategory === 'drinks' && (item.category === 'مشروبات' || item.category === 'beverages')) ||
                                (activeCategory === 'snacks' && (item.category === 'سناكس' || item.category === 'snacks')) ||
                                (activeCategory === 'office' && item.category === 'أدوات مكتبية');
        
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesCategory && matchesSearch;
    });

    const lowStockCount = stockItems.filter(item => item.stock <= (item.min_stock || 0)).length;

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        try {
            // Rule 7: Automatically create corresponding expense record if initial stock > 0
            const cartonCost = newItem.price * (newItem.pieces_per_unit || 1);
            const totalCost = cartonCost * (newItem.stock / (newItem.pieces_per_unit || 1));

            const { data: newInv, error } = await supabase.from('inventory').insert([{
                name: newItem.name,
                category: newItem.category,
                stock: newItem.stock,
                min_stock: newItem.min_stock,
                unit: newItem.unit,
                price: Number(newItem.price) || 0, // COST per piece
                pieces_per_unit: Number(newItem.pieces_per_unit) || 1,
                selling_price: Number(newItem.selling_price) || 0,
                image_url: newItem.image_url || null,
                branch_id: branchId || null,
                last_restock: new Date().toISOString()
            }]).select().single();
            
            if (error) throw error;
            
            if (newInv) {
                // Rule 7: Auto-Expense
                if (totalCost > 0) {
                    await supabase.from('expenses').insert([{
                        category: (newItem.category === 'مشروبات' || newItem.category === 'سناكس') ? 'مطبخ وبوفيه' : 'أخرى',
                        amount: totalCost,
                        date: new Date().toISOString(),
                        note: `رصيد افتتاح لـ ${newItem.name.trim()} (${newItem.stock / newItem.pieces_per_unit} كرتونة)`,
                        payment_method: 'نقدًا (كاش)',
                        branch_id: branchId || null
                    }]);
                }

                // Rule 3: Selling Price (Independent) - Manual Sync
                const { error: caterError } = await supabase.from('catering_items').insert([{
                    inventory_id: newInv.id,
                    name: newItem.name,
                    price: Number(newItem.selling_price) || (Number(newItem.price) * 1.5),
                    branch_id: newInv.branch_id || branchId || null,
                    is_active: true,
                    category: newItem.category === 'مشروبات' ? 'beverages' : (newItem.category === 'سناكس' ? 'snacks' : 'office') // Sync category correctly
                }]);

                if (caterError) {
                    console.error('Catering sync error (Add):', caterError);
                }
            }
            
            setIsAddModalOpen(false);
            setNewItem({ name: '', category: 'مشروبات', stock: 0, min_stock: 12, unit: 'كرتونة', price: 0, pieces_per_unit: 1, selling_price: 0 });
            setBoxCostStr('');
            setSellPriceStr('');
            setCartonQuantityStr('0');
            fetchInventory();
            alert('تم إضافة الصنف وإعداد إحصائيات الأرباح بنجاح');
        } catch (error: any) {
            alert('حدث خطأ أثناء إضافة الصنف: ' + error.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteItem = async (id: string, name: string) => {
        if (!window.confirm(`هل أنت متأكد من حذف ${name}؟`)) return;
        try {
            const { error } = await supabase.from('inventory').delete().eq('id', id);
            if (error) throw error;
            fetchInventory();
        } catch (error: any) {
            alert('حدث خطأ أثناء الحذف: ' + error.message);
        }
    };

    const handleEditClick = (item: any) => {
        const itemCopy = { 
            ...item, 
            selling_price: item.selling_price || item.catering_items?.[0]?.price || 0,
            is_active: Array.isArray(item.catering_items) && item.catering_items.length > 0 ? item.catering_items[0].is_active : true
        };
        setEditingItem(itemCopy);
        setBoxCostStr((Number(itemCopy.price) * (itemCopy.pieces_per_unit || 1)).toString());
        setSellPriceStr((itemCopy.selling_price || 0).toString());
        setEditCartonQuantityStr((itemCopy.stock / (itemCopy.pieces_per_unit || 1)).toString());
        setIsEditModalOpen(true);
    };

    const handleUpdateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);
        
        const targetId = editingItem.id;
        const sellingPriceVal = Number(editingItem.selling_price) || 0;
        
        console.log("--- [UPDATE TRACE START] ---");
        console.log("Updating ID:", targetId);
        console.log("Proposed Price:", sellingPriceVal);

        try {
            const inventoryData = {
                name: editingItem.name,
                stock: Number(editingItem.stock),
                unit: editingItem.unit,
                min_stock: Number(editingItem.min_stock),
                category: editingItem.category,
                price: Number(editingItem.price),
                pieces_per_unit: Number(editingItem.pieces_per_unit) || 1,
                selling_price: sellingPriceVal,
                image_url: editingItem.image_url || null,
                last_restock: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('inventory')
                .update(inventoryData)
                .eq('id', targetId)
                .select();
            
            if (error) throw error;

            console.log("Updated DB row:", data?.[0]);

            // Sync with catering_items for compatibility
            await supabase.from('catering_items').update({
                name: editingItem.name,
                price: sellingPriceVal,
                category: editingItem.category === 'مشروبات' ? 'beverages' : (editingItem.category === 'سناكس' ? 'snacks' : 'office'),
                is_active: editingItem.is_active !== undefined ? editingItem.is_active : true
            }).eq('inventory_id', targetId);

            await fetchInventory();
            await fetchLogs();
            console.log("--- [UPDATE TRACE REFRESH COMPLETE] ---");
            setIsEditModalOpen(false);
            setEditingItem(null);
            setEditCartonQuantityStr('0');
            alert('تم حفظ البيانات والمزامنة مع إحصائيات الأرباح بنجاح');
        } catch (error: any) {
            console.error('Error updating item:', error);
            alert('خطأ أثناء التحديث: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 font-['Cairo'] text-right">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-6 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-slate-50 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-slate-100 transition-colors"></div>
                    <div className="relative z-10 flex flex-col gap-3">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                            <ArrowDown size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي تكلفة المخزون</p>
                            <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-black text-slate-900">
                                    {stockItems.reduce((acc, item) => acc + (Number(item.stock) * (Number(item.price) || 0)), 0).toLocaleString()}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400">EGP</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-6 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-rose-100 transition-colors"></div>
                    <div className="relative z-10 flex flex-col gap-3">
                        <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-600/20">
                            <ArrowUp size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">إيرادات البيع المتوقعة</p>
                            <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-black text-rose-600">
                                    {stockItems.reduce((acc, item) => acc + (Number(item.stock) * (Number(item.selling_price) || 0)), 0).toLocaleString()}
                                </p>
                                <span className="text-[10px] font-bold text-rose-300">EGP</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white p-6 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
                    <div className="relative z-10 flex flex-col gap-3">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/40">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">صافي الربح المتوقع</p>
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[8px] font-black">
                                    {(() => {
                                        const rev = stockItems.reduce((acc, item) => acc + (Number(item.stock) * (Number(item.selling_price) || 0)), 0);
                                        const cost = stockItems.reduce((acc, item) => acc + (Number(item.stock) * (Number(item.price) || 0)), 0);
                                        const profit = rev - cost;
                                        return rev > 0 ? ((profit / rev) * 100).toFixed(1) : 0;
                                    })()}% هامش
                                </Badge>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <p className="text-3xl font-black text-emerald-400 font-mono">
                                    {(
                                        stockItems.reduce((acc, item) => acc + (Number(item.stock) * (Number(item.selling_price) || 0)), 0) -
                                        stockItems.reduce((acc, item) => acc + (Number(item.stock) * (Number(item.price) || 0)), 0)
                                    ).toLocaleString()}
                                </p>
                                <span className="text-[10px] font-bold opacity-40">EGP</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-6 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-indigo-100 transition-colors"></div>
                    <div className="relative z-10 flex flex-col gap-3 text-right">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الأكثر مبيعاً</p>
                            {stockItems.length > 0 ? (
                                (() => {
                                    const bestSeller = [...stockItems].sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))[0];
                                    return (
                                        <>
                                            <p className="text-sm font-black text-slate-900 truncate">{bestSeller.name}</p>
                                            <p className="text-[14px] font-bold text-indigo-500">{bestSeller.total_sold || 0} قطعة مباعة</p>
                                        </>
                                    );
                                })()
                            ) : (
                                <p className="text-sm font-black text-slate-300">لا توجد مبيعات</p>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-6">
                <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeCategory === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Sparkles size={14} /> الكل
                    </button>
                    <button
                        onClick={() => setActiveCategory('drinks')}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeCategory === 'drinks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Coffee size={14} /> المشروبات
                    </button>
                    <button
                        onClick={() => setActiveCategory('snacks')}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeCategory === 'snacks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Cookie size={14} /> السناكس
                    </button>
                    <button
                        onClick={() => setActiveCategory('office')}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeCategory === 'office' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Package size={14} /> الأدوات المكتبية
                    </button>
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="البحث في المخزن..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pr-10 pl-6 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                    />
                </div>
                
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={20} /> إضافة صنف
                </button>
            </div>

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
                {newItem && (
                <Card className="w-full bg-white rounded-[3rem] border-none shadow-none p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-900">إضافة صنف جديد</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-slate-600 mb-2">اسم الصنف</label>
                                    <input required type="text" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3" />
                                </div>
                                <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative group cursor-pointer">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                        onChange={(e) => handleImageUpload(e, false)}
                                    />
                                    {newItem.image_url ? (
                                        <img src={newItem.image_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center">
                                            {loading ? <RefreshCcw size={20} className="text-indigo-400 mx-auto animate-spin" /> : <ImageIcon size={20} className="text-slate-300 mx-auto" />}
                                            <p className="text-[8px] text-slate-400 mt-1 font-black">صورة</p>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                                        <Plus size={16} className="text-white" />
                                    </div>
                                </div>
                             </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">التصنيف</label>
                                    <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3">
                                        <option value="مشروبات">مشروبات</option>
                                        <option value="سناكس">سناكس</option>
                                        <option value="أدوات مكتبية">أدوات مكتبية</option>
                                        <option value="أخرى">أخرى</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-rose-400 mb-2 text-right italic">سعر البيع المعتمد (للقطعة)</label>
                                    <input 
                                        required 
                                        type="number" 
                                        step="0.01" 
                                        value={newItem.selling_price} 
                                        onChange={e => setNewItem({ ...newItem, selling_price: Number(e.target.value) })} 
                                        className="w-full border-2 border-rose-100 rounded-xl px-2 py-3 text-center text-sm font-black bg-rose-50/20 text-rose-600 outline-none focus:border-rose-500 transition-all font-mono" 
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-4 border border-slate-100 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-200 pb-2">بيانات التكلفة والكمية</p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 text-right text-indigo-500 font-['Cairo']">سعر الكرتونة (شامل)</label>
                                        <input 
                                            required
                                            type="text"
                                            inputMode="decimal"
                                            value={boxCostStr} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                const parts = val.split('.');
                                                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                                                setBoxCostStr(cleanVal);
                                                const boxCost = parseFloat(cleanVal) || 0;
                                                setNewItem({ ...newItem, price: boxCost / (newItem.pieces_per_unit || 1) });
                                            }} 
                                            className="w-full border-2 border-indigo-200 bg-white rounded-xl px-4 py-3 text-center font-black text-indigo-700 shadow-sm outline-none focus:border-indigo-500 transition-all font-mono" 
                                        />
                                        <div className="absolute -top-2 right-4 bg-indigo-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">المصدر المالي</div>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 text-right text-rose-500 font-['Cairo']">سعر البيع (لليوزر)</label>
                                        <input 
                                            required
                                            type="text"
                                            inputMode="decimal"
                                            value={sellPriceStr} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                const parts = val.split('.');
                                                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                                                setSellPriceStr(cleanVal);
                                                setNewItem({ ...newItem, selling_price: parseFloat(cleanVal) || 0 });
                                            }} 
                                            className="w-full border-2 border-rose-200 bg-white rounded-xl px-4 py-3 text-center font-black text-rose-700 shadow-sm outline-none focus:border-rose-500 transition-all font-mono" 
                                        />
                                        <div className="absolute -top-2 right-4 bg-rose-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">السعر الظاهر</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 text-right font-['Cairo']">التكلفة / قطعة (محسوبة)</label>
                                        <div className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl px-4 py-3 text-center font-bold text-slate-400 font-mono text-sm">
                                            {newItem.price.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 mb-1 text-center font-['Cairo']">قطع / {newItem.unit}</label>
                                        <input 
                                            required 
                                            type="number" 
                                            min="1" 
                                            value={newItem.pieces_per_unit} 
                                            onChange={e => {
                                                const ppu = Number(e.target.value);
                                                const currentCartons = newItem.stock / (newItem.pieces_per_unit || 1);
                                                setNewItem({ ...newItem, pieces_per_unit: ppu, stock: currentCartons * ppu });
                                            }} 
                                            className="w-full border-b-2 border-slate-200 bg-transparent px-1 py-2 text-center text-xs font-black outline-none focus:border-indigo-500 transition-all font-mono" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 mb-1 text-center font-['Cairo']">عدد الكراتين</label>
                                        <input 
                                            type="text" 
                                            inputMode="decimal"
                                            value={cartonQuantityStr} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                const parts = val.split('.');
                                                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                                                setCartonQuantityStr(cleanVal);
                                                const cartons = parseFloat(cleanVal) || 0;
                                                setNewItem({ ...newItem, stock: cartons * (newItem.pieces_per_unit || 1) });
                                            }} 
                                            className="w-full border-b-2 border-slate-200 bg-transparent px-1 py-2 text-center text-xs font-black outline-none focus:border-indigo-500 transition-all font-mono" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 mb-1 text-center font-['Cairo']">الحد الأدنى</label>
                                        <input required type="number" value={newItem.min_stock} onChange={e => setNewItem({ ...newItem, min_stock: Number(e.target.value) })} className="w-full border-b-2 border-slate-200 bg-transparent px-1 py-2 text-center text-xs font-black outline-none focus:border-indigo-500 transition-all font-mono" />
                                    </div>
                                </div>
                            </div>

                             <div>
                                <label className="block text-[10px] font-black text-slate-400 mb-2">رابط صورة المنتج (اختياري)</label>
                                <div className="relative">
                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="https://example.com/photo.png" 
                                        value={newItem.image_url || ''} 
                                        onChange={e => setNewItem({ ...newItem, image_url: e.target.value })} 
                                        className="w-full border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2 text-xs font-mono" 
                                    />
                                </div>
                             </div>

                            <div className="bg-emerald-600 text-white rounded-[2rem] p-5 shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-2xl transition-transform group-hover:scale-150 duration-700"></div>
                                <div className="relative z-10 grid grid-cols-3 gap-2 text-center">
                                    <div className="border-l border-white/10">
                                        <p className="text-[7px] font-black uppercase opacity-70 mb-1">صافي الربح/قطعة</p>
                                        <p className="text-sm font-black">+ {(newItem.selling_price - newItem.price).toFixed(2)}</p>
                                    </div>
                                    <div className="border-l border-white/10">
                                        <p className="text-[7px] font-black uppercase opacity-70 mb-1">الربح في {newItem.unit}</p>
                                        <p className="text-sm font-black">+ {((newItem.selling_price - newItem.price) * (newItem.pieces_per_unit || 1)).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[7px] font-black uppercase opacity-70 mb-1 font-['Cairo']">هامش الربح</p>
                                        <p className="text-sm font-black">
                                            {newItem.selling_price > 0 ? (((newItem.selling_price - newItem.price) / newItem.selling_price) * 100).toFixed(1) : 0}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={adding} className="w-full bg-slate-900 border-t-2 border-white/10 text-white rounded-2xl py-4 font-black text-sm disabled:opacity-50 mt-4 shadow-2xl transition-all hover:bg-black active:scale-[0.98] font-['Cairo']">
                                {adding ? 'جاري المزامنة...' : 'تأكيد وحفظ في المخزن والمصروفات'}
                            </button>
                        </form>
                    </Card>
                )}
                </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                {editingItem && (
                <Card className="w-full bg-white rounded-[3rem] border-none shadow-none p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">إحصائيات وإدارة الصنف</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">منتج مرتبط بالمشتريات والمصروفات</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-xl">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-slate-900 rounded-[1.75rem] p-5 text-white shadow-lg">
                                <p className="text-[10px] opacity-80 font-bold mb-1 text-slate-400">قيمة رأس المال (التكلفة)</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black">{(editingItem.stock * (editingItem.price || 0)).toFixed(1)}</span>
                                    <span className="text-[10px] opacity-70">EGP</span>
                                </div>
                                <p className="text-[8px] text-slate-500 mt-2">السعر المدفوع فعلياً للبضاعة</p>
                            </div>

                            <div className="bg-indigo-600 rounded-[1.75rem] p-5 text-white shadow-lg shadow-indigo-500/20">
                                <p className="text-[10px] opacity-80 font-bold mb-1">القيمة السوقية (البيع)</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black">{(editingItem.stock * (editingItem.selling_price || 0)).toFixed(1)}</span>
                                    <span className="text-[10px] opacity-70">EGP</span>
                                </div>
                                <p className="text-[8px] text-indigo-300 mt-2">إجمالي الدخل المتوقع عند البيع</p>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-4 border border-slate-100 italic">
                             <div className="border-l border-slate-200 pr-2">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">تاريخ آخر تزويد</p>
                                 <p className="text-sm font-black text-slate-700">{editingItem.last_restock ? new Date(editingItem.last_restock).toLocaleDateString('ar-EG') : 'لا يوجد'}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">مكسب {editingItem.unit || 'الكرتونة'}</p>
                                 <p className="text-lg font-black text-emerald-600">
                                     +{((editingItem.selling_price || 0) * (editingItem.pieces_per_unit || 1) - ((editingItem.price || 0) * (editingItem.pieces_per_unit || 1))).toFixed(2)} EGP
                                 </p>
                                 <p className="text-[8px] text-slate-400 font-bold">بناءً على تكلفة كرتونة = {(editingItem.price * (editingItem.pieces_per_unit || 1)).toFixed(2)}</p>
                             </div>
                        </div>

                        <form onSubmit={handleUpdateItem} className="space-y-4">
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-slate-600 mb-2 px-1">اسم الصنف المعروض</label>
                                        <input required type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold focus:border-indigo-500 outline-none transition-all" />
                                    </div>
                                    <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative group cursor-pointer shrink-0">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                            onChange={(e) => handleImageUpload(e, true)}
                                        />
                                        {editingItem.image_url ? (
                                            <img src={editingItem.image_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center">
                                                {loading ? <RefreshCcw size={16} className="text-indigo-400 mx-auto animate-spin" /> : <ImageIcon size={16} className="text-slate-300 mx-auto" />}
                                                <p className="text-[8px] text-slate-400 mt-1 font-black">لا توجد صورة</p>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                                            <Edit size={14} className="text-white" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2 px-1">التصنيف</label>
                                        <select value={editingItem.category} onChange={e => setEditingItem({ ...editingItem, category: e.target.value })} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 bg-white font-bold outline-none focus:border-indigo-500">
                                            <option value="مشروبات">مشروبات</option>
                                        <option value="سناكس">سناكس</option>
                                            <option value="أدوات مكتبية">أدوات مكتبية</option>
                                            <option value="أخرى">أخرى</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-rose-500 mb-2 px-1">سعر البيع (للقطعة)</label>
                                        <input 
                                            required 
                                            type="number" 
                                            step="0.01" 
                                            value={editingItem.selling_price} 
                                            onChange={e => setEditingItem({ ...editingItem, selling_price: Number(e.target.value) })} 
                                            className="w-full border-2 border-rose-100 rounded-xl px-4 py-3 text-center font-black text-rose-600 focus:border-rose-500 outline-none bg-rose-50/20 font-mono shadow-sm" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 space-y-4 shadow-inner">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-[10px] font-bold text-indigo-500 mb-1 text-right">سعر الكرتونة (شامل التكلفة)</label>
                                        <input 
                                            required
                                            type="text"
                                            inputMode="decimal"
                                            value={boxCostStr} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                const parts = val.split('.');
                                                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                                                setBoxCostStr(cleanVal);
                                                const boxCost = parseFloat(cleanVal) || 0;
                                                setEditingItem({ ...editingItem, price: boxCost / (editingItem.pieces_per_unit || 1) });
                                            }} 
                                            className="w-full border-2 border-indigo-200 bg-white rounded-xl px-4 py-3 text-center font-black text-indigo-700 shadow-sm outline-none focus:border-indigo-500 transition-all font-mono" 
                                        />
                                        <div className="absolute -top-2 right-4 bg-indigo-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black uppercase">التكلفة</div>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[10px] font-bold text-rose-500 mb-1 text-right">سعر البيع (لليوزر)</label>
                                        <input 
                                            required
                                            type="text"
                                            inputMode="decimal"
                                            value={sellPriceStr} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                const parts = val.split('.');
                                                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                                                setSellPriceStr(cleanVal);
                                                setEditingItem({ ...editingItem, selling_price: parseFloat(cleanVal) || 0 });
                                            }} 
                                            className="w-full border-2 border-rose-200 bg-white rounded-xl px-4 py-3 text-center font-black text-rose-700 shadow-sm outline-none focus:border-rose-500 transition-all font-mono" 
                                        />
                                        <div className="absolute -top-2 right-4 bg-rose-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black uppercase">الظاهر للمستخدم</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 text-right">التكلفة / قطعة (محسوبة)</label>
                                        <div className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl px-4 py-1.5 text-center font-bold text-slate-400 font-mono text-xs mt-1.5 opacity-80">
                                            {(editingItem.price || 0).toFixed(2)}
                                        </div>
                                    </div>
                                     <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 px-1">حالة المنتج</label>
                                        <button
                                            type="button"
                                            onClick={() => setEditingItem({ ...editingItem, is_active: !editingItem.is_active })}
                                            className={`w-full border-2 rounded-xl px-4 py-1.5 text-center font-bold text-xs mt-1.5 transition-all shadow-sm ${editingItem.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-rose-200 bg-rose-50 text-rose-600'}`}
                                        >
                                            {editingItem.is_active ? 'متاح للبيع' : 'موقوف / منتهي'}
                                        </button>
                                     </div>
                                 <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 px-1">رابط الصورة</label>
                                    <input 
                                        type="text" 
                                        value={editingItem.image_url || ''} 
                                        onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })} 
                                        placeholder="https://..." 
                                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-[10px] font-mono outline-none focus:border-indigo-500 transition-all bg-white" 
                                    />
                                 </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 mb-1 text-center font-['Cairo']">قطع / {editingItem.unit || 'كرتونة'}</label>
                                        <input 
                                            required 
                                            type="number" 
                                            min="1" 
                                            value={editingItem.pieces_per_unit} 
                                            onChange={e => {
                                                const ppu = Number(e.target.value);
                                                const cartons = editingItem.stock / (editingItem.pieces_per_unit || 1);
                                                setEditingItem({ ...editingItem, pieces_per_unit: ppu, stock: cartons * ppu });
                                            }} 
                                            className="w-full border-b-2 border-slate-200 bg-transparent px-1 py-1 text-center text-xs font-black outline-none focus:border-indigo-500 transition-all font-mono" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 mb-1 text-center font-['Cairo']">الكمية (كرتونة)</label>
                                        <input 
                                            type="text" 
                                            inputMode="decimal"
                                            value={editCartonQuantityStr} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                const parts = val.split('.');
                                                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                                                setEditCartonQuantityStr(cleanVal);
                                                const cartons = parseFloat(cleanVal) || 0;
                                                setEditingItem({ ...editingItem, stock: cartons * (editingItem.pieces_per_unit || 1) });
                                            }} 
                                            className="w-full border-b-2 border-slate-200 bg-transparent px-1 py-1 text-center text-xs font-black outline-none focus:border-indigo-500 transition-all font-mono" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 mb-1 text-center font-['Cairo']">الحد الأدنى</label>
                                        <input required type="number" value={editingItem.min_stock} onChange={e => setEditingItem({ ...editingItem, min_stock: Number(e.target.value) })} className="w-full border-b-2 border-slate-200 bg-transparent px-1 py-1 text-center text-xs font-black outline-none focus:border-indigo-500 transition-all font-mono" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900 border-t border-white/10 text-white rounded-[2rem] p-5 shadow-2xl relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-16 translate-x-16 blur-2xl transition-transform group-hover:scale-150 duration-1000"></div>
                                <div className="relative z-10 grid grid-cols-3 gap-2 text-center">
                                    <div className="border-l border-white/5">
                                        <p className="text-[7px] font-black uppercase text-slate-500 mb-1 px-1">صافي الربح/قطعة</p>
                                        <p className="text-sm font-black text-emerald-400">+ {(editingItem.selling_price - (editingItem.price || 0)).toFixed(2)}</p>
                                    </div>
                                    <div className="border-l border-white/5">
                                        <p className="text-[7px] font-black uppercase text-slate-500 mb-1 px-1">الربح في {editingItem.unit || 'بالتة'}</p>
                                        <p className="text-sm font-black text-emerald-400">+ {((editingItem.selling_price - (editingItem.price || 0)) * (editingItem.pieces_per_unit || 1)).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[7px] font-black uppercase text-slate-400 mb-1">هامش الربح</p>
                                        <p className="text-sm font-black text-indigo-400">
                                            {editingItem.selling_price > 0 ? (((editingItem.selling_price - (editingItem.price || 0)) / editingItem.selling_price) * 100).toFixed(1) : 0}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={updating} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-md disabled:opacity-50 mt-4 flex justify-center items-center gap-2 shadow-xl shadow-indigo-500/30 transition-all hover:bg-indigo-700 active:scale-95 font-['Cairo']">
                                {updating ? 'جاري تحديث البيانات والمزامنة...' : <><Save size={18} /> حفظ التعديلات وإحصائيات الأرباح</>}
                            </button>
                        </form>
                    </Card>
                )}
            </Modal>

            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                <table className="w-full text-right">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest text-center">
                            <th className="px-8 py-6 text-right">إسم الصنف</th>
                            <th className="px-6 py-6 text-center">إجمالي المبيعات</th>
                            <th className="px-6 py-6 text-center">الرصيد المتاح</th>
                            <th className="px-6 py-6 text-center text-rose-600 font-black">سعر البيع</th>
                            <th className="px-6 py-6 text-center">تحليل الربح</th>
                            <th className="px-6 py-6">حالة المخزون</th>
                            <th className="px-8 py-6 text-left">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="py-20 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                </td>
                            </tr>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-all group animate-in slide-in-from-right duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center shadow-sm ${
                                            (item.category === 'مشروبات' || item.category === 'beverages') ? 'bg-blue-50 text-blue-600' : 
                                            (item.category === 'سناكس' || item.category === 'snacks') ? 'bg-amber-50 text-amber-600' : 
                                            'bg-rose-50 text-rose-600'
                                        }`}>
                                            {item.image_url && item.image_url.trim() !== '' ? (
                                                <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                (item.category === 'مشروبات' || item.category === 'beverages') ? <Coffee size={20} /> : 
                                                (item.category === 'سناكس' || item.category === 'snacks') ? <Cookie size={20} /> : 
                                                <Package size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-slate-800 font-black text-sm">{item.name}</p>
                                            <Badge className="bg-slate-100 text-slate-500 border-none text-[8px] font-black mt-1">
                                                {item.category || 'عام'}
                                            </Badge>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className="flex flex-col items-center bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100 shadow-sm">
                                        <span className="text-2xl font-black text-indigo-600 font-mono">
                                            {item.total_sold || 0}
                                        </span>
                                        <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">قطعة مباعة</span>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-black ${item.stock <= (item.min_stock || 0) ? 'text-rose-600' : 'text-slate-900'} font-mono`}>
                                                {item.stock}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold">قطعة</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[9px] text-slate-400 font-black">
                                                ({Math.floor(item.stock / (item.pieces_per_unit || 1))} {item.unit || 'كرتونة'})
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                 <td className="px-6 py-6 text-center text-slate-500 font-black">
                                     <div className="flex flex-col items-center">
                                         <span className="text-sm font-black text-rose-600 font-mono">{Number(item.selling_price).toLocaleString()}</span>
                                         <span className="text-[8px] text-slate-400 uppercase">EGP / قطعة</span>
                                     </div>
                                 </td>
                                 <td className="px-6 py-6 text-center">
                                     <div className="flex flex-col items-center gap-1">
                                         <div className="bg-emerald-500/10 text-emerald-600 rounded-xl px-4 py-1.5 border border-emerald-100 min-w-[120px]">
                                             <p className="text-[8px] font-black uppercase opacity-60 mb-0.5">الربح الصافي</p>
                                             <p className="text-sm font-black font-mono">
                                                 +{( (Number(item.selling_price) || 0) - (Number(item.price) || 0) ).toFixed(2)}
                                             </p>
                                         </div>
                                         <span className="text-[8px] text-slate-400 font-black">
                                             Cost: {Number(item.price).toFixed(2)}
                                         </span>
                                     </div>
                                 </td>
                                <td className="px-6 py-6">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full transition-all duration-1000 ${item.stock <= (item.min_stock || 0) ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                                                    item.stock <= (item.min_stock || 0) * 2 ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${Math.min(100, (item.stock / ((item.min_stock || 1) * 4)) * 100)}%` }}
                                            ></div>
                                        </div>
                                        <p className={`text-[9px] font-black uppercase tracking-tighter ${item.stock <= (item.min_stock || 0) ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                                            {item.stock <= (item.min_stock || 0) ? 'تحذير: نفاذ المخزون' : 'مستقر'}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-left">
                                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => handleEditClick(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                                </tr>
                        ))
                    ) : (
                            <tr>
                                <td colSpan={7} className="py-20 text-center text-slate-300 font-bold">
                                    لا توجد أصناف مسجلة
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Activity Log */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-600">
                            <RefreshCcw size={16} /> سجل حركة المخزن (آخر 10 عمليات)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-50">
                            {logs.length > 0 ? logs.map(log => (
                                <div key={log.id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-all">
                                    <div className="flex items-center gap-4 text-right">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.type === 'Supply' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {log.type === 'Supply' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800">
                                                {log.type === 'Supply' ? 'توريد' : 'صرف'} {log.inventory?.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {new Date(log.created_at).toLocaleString('ar-EG')} {log.notes ? `| ${log.notes}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-black font-mono ${log.type === 'Supply' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {log.type === 'Supply' ? '+' : '-'}{log.quantity}
                                    </span>
                                </div>
                            )) : (
                                <div className="p-10 text-center text-slate-300 font-bold">لا توجد حركات مسجلة</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default InventoryPanel;
