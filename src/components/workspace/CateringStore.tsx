
import React from 'react';
import { Search, LayoutGrid, LayoutList, Sparkles, Coffee, Cookie, Package, RefreshCw, CheckCircle2, ShoppingBag, X, Plus, PenTool, Receipt, MapPin } from 'lucide-react';

interface CateringStoreProps {
  cateringItems: any[];
  cart: { [id: string]: { item: any, quantity: number } };
  storeSearch: string;
  setStoreSearch: (val: string) => void;
  storeCategory: string;
  setStoreCategory: (val: any) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (val: 'grid' | 'list') => void;
  addToCart: (item: any) => void;
  removeFromCart: (id: string) => void;
  handleCheckoutCart: () => void;
  orderLoading: boolean;
  session: any;
}

export const CateringStore = ({
  cateringItems,
  cart,
  storeSearch,
  setStoreSearch,
  storeCategory,
  setStoreCategory,
  viewMode,
  setViewMode,
  addToCart,
  removeFromCart,
  handleCheckoutCart,
  orderLoading,
  session
}: CateringStoreProps) => {
  return (
    <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in duration-500 pb-20 text-right font-['Cairo']">
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-3xl font-black text-white tracking-tight"> Cloud Store </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cloud Store & Catering</p>
        </div>

        {session.orders?.length > 0 && (
            <div className="mb-12 pb-10 border-b-2 border-dashed border-white/5 text-right animate-in fade-in slide-in-from-top-10 duration-1000">
                <div className="flex flex-col items-center mb-8">
                  <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-4 shadow-2xl border border-white/5">
                    <Receipt size={28}/>
                  </div>
                  <h3 className="font-black text-white text-2xl tracking-tight">قائمة الطلبات المستلمة</h3>
                  <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-[0.3em] mt-2 opacity-60">Verified Order Summary</p>
                </div>

                <div className="bg-[#0B0F19]/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 shadow-[inset_0_2px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[80px] -z-10" />
                    <div className="space-y-4">
                        {session.orders.map((o: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center group/order">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex flex-col items-center justify-center text-[10px] font-black text-white border border-white/5 group-hover/order:bg-indigo-600 transition-colors">
                                  <span>{o.quantity}</span>
                                  <span className="opacity-40 text-[6px] uppercase leading-none mt-0.5">Qty</span>
                                </div>
                                <div className="text-right">
                                   <p className="text-white text-sm font-black group-hover/order:text-indigo-300 transition-colors uppercase tracking-tight">{o.name}</p>
                                   <p className="text-[9px] text-slate-500 font-bold mt-0.5 underline decoration-indigo-500/30 underline-offset-4">{o.price} EGP per unit</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-emerald-400 font-mono text-base font-black tracking-tighter">{(o.price * o.quantity).toFixed(2)}</span>
                                <span className="text-[7px] text-slate-500 font-black rotate-90">EGP</span>
                              </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                        <div className="text-right">
                          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-2">
                             <MapPin size={8} className="text-indigo-400" /> الفرع الرئيسي
                          </p>
                          <p className="text-3xl font-black text-white leading-none">
                            {(session.catering_amount || 0).toLocaleString()}
                            <span className="text-[10px] text-indigo-400 mr-2 font-bold uppercase tracking-tighter">Total EGP</span>
                          </p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex flex-col items-center">
                           <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</p>
                           <div className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 size={14} />
                              <span className="text-[10px] font-black uppercase">Confirmed</span>
                           </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Search & Categories Bar */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="ابحث عن مشروب أو وجبة..."
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] pr-12 pl-6 py-4 text-white font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar flex-row-reverse">
            <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0 shadow-lg">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid size={20} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutList size={20} />
              </button>
            </div>

            <div className="flex gap-2">
                {[
                { id: 'all', label: 'الكل', icon: Sparkles },
                { id: 'drinks', label: 'المشروبات', icon: Coffee },
                { id: 'snacks', label: 'السناكس', icon: Cookie },
                { id: 'office', label: 'أدوات مكتبية', icon: Package }
                ].map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setStoreCategory(cat.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-xs whitespace-nowrap transition-all border ${
                    storeCategory === cat.id 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 scale-105' 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                >
                    <cat.icon size={14} />
                    {cat.label}
                </button>
                ))}
            </div>
          </div>
        </div>

        {/* Cart Summary Header */}
        {Object.keys(cart).length > 0 && (
           <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-[1px] rounded-[2rem] shadow-2xl shadow-indigo-600/30 group animate-in slide-in-from-top-4 duration-500">
             <div className="bg-[#0B0F19]/90 backdrop-blur-3xl p-5 rounded-[1.95rem] flex justify-between items-center relative overflow-hidden">
               <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
               <div className="text-right">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                   <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest">سلة التسوق النشطة</p>
                 </div>
                 <p className="text-white font-black text-xl">
                    {(Object.values(cart) as any[]).reduce((sum, entry) => sum + ((entry.item.selling_price || entry.item.price) * entry.quantity), 0)}
                    <span className="text-[10px] opacity-40 mr-1.5 uppercase tracking-tighter">EGP Total</span>
                 </p>
               </div>
               <button 
                 onClick={handleCheckoutCart}
                 disabled={orderLoading}
                 className="h-14 px-8 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
               >
                 {orderLoading ? <RefreshCw className="animate-spin" size={18} /> : (
                   <>
                     إتمام الطلب
                     <CheckCircle2 size={20} />
                   </>
                 )}
               </button>
             </div>
           </div>
        )}

        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "flex flex-col gap-3"}>
          {cateringItems
            .filter(item => {
              const name = item.name.toLowerCase();
              const matchesSearch = name.includes(storeSearch.toLowerCase());
              const matchesCat = storeCategory === 'all' || 
                (storeCategory === 'drinks' && (item.category === 'beverages' || item.category === 'مشروبات' || name.includes('قهوة') || name.includes('شاي') || name.includes('كولا') || name.includes('ماء'))) ||
                (storeCategory === 'snacks' && (item.category === 'snacks' || item.category === 'سناكس' || name.includes('شيبس') || name.includes('بسكويت') || name.includes('كرواسون'))) ||
                (storeCategory === 'office' && (item.category === 'office' || item.category === 'أدوات مكتبية'));
              return matchesSearch && matchesCat;
            })
            .length > 0 ? (
              cateringItems
                .filter(item => {
                   const matchesSearch = item.name.toLowerCase().includes(storeSearch.toLowerCase());
                   const matchesCat = storeCategory === 'all' || 
                     (storeCategory === 'drinks' && (item.category === 'مشروبات' || item.category === 'beverages')) ||
                     (storeCategory === 'snacks' && (item.category === 'سناكس' || item.category === 'snacks')) ||
                     (storeCategory === 'office' && item.category === 'أدوات مكتبية');
                   return matchesSearch && matchesCat;
                })
                .map(item => {
                  const cartEntry = cart[item.id];
                  const isLowStock = (item.stock || 0) <= 5;
                  
                  // Dynamic Color/Icon logic
                  const name = item.name.toLowerCase();
                  const isDrink = name.includes('قهوة') || name.includes('نسكافيه') || name.includes('شاي') || name.includes('كولا') || name.includes('بيبسي') || name.includes('ماء') || name.includes('عصير');
                  const isSnack = name.includes('شيبس') || name.includes('بسكويت') || name.includes('كرواسون') || name.includes('مولتو') || name.includes('سندوتش');
                  const isOffice = item.category === 'أدوات مكتبية';

                  let typeColor = 'bg-indigo-500/10 text-indigo-400';
                  let typeGlow = 'from-indigo-500/20 to-blue-500/20';
                  let Icon = Coffee;

                  if (isDrink) {
                    typeColor = 'bg-blue-500/10 text-blue-400';
                    typeGlow = 'from-blue-500/30 to-cyan-500/10';
                    Icon = Coffee;
                  } else if (isSnack) {
                    typeColor = 'bg-amber-500/10 text-amber-400';
                    typeGlow = 'from-amber-500/30 to-orange-500/10';
                    Icon = Cookie;
                  } else if (isOffice) {
                    typeColor = 'bg-rose-500/10 text-rose-400';
                    typeGlow = 'from-rose-500/30 to-pink-500/10';
                    Icon = PenTool;
                  }

                  if (viewMode === 'list') {
                    return (
                        <div key={item.id} className="relative group/list">
                            <div className="bg-[#0B0F19]/80 backdrop-blur-3xl border border-white/5 hover:border-white/10 rounded-2xl p-3 flex items-center gap-4 transition-all duration-300 hover:bg-white/5 shadow-lg text-right">
                                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/5 relative">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${typeGlow} opacity-30`}>
                                            <Icon size={24} className="opacity-50" />
                                        </div>
                                    )}
                                    {isLowStock && (
                                        <div className="absolute inset-x-0 bottom-0 bg-rose-500 text-[8px] font-black py-0.5 text-center text-white uppercase z-10">رصيد قليل</div>
                                    )}
                                    
                                    {/* Category Icon Badge - Floating over image */}
                                    <div className={`absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center border border-white/10 backdrop-blur-md z-10 ${typeColor}`}>
                                       <Icon size={10} />
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <h4 className="text-white font-black text-sm line-clamp-1">{item.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-indigo-400 font-black text-sm">{item.selling_price} EGP</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{isDrink ? 'مشروبات' : isSnack ? 'سناكس' : isOffice ? 'أدوات' : 'أخرى'}</span>
                                    </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                    {cartEntry ? (
                                        <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                            <button onClick={() => removeFromCart(item.id)} className="p-2 hover:bg-rose-500/20 text-rose-400 transition-colors">
                                                <X size={14} />
                                            </button>
                                            <span className="px-2 text-white font-black text-sm">{cartEntry.quantity}</span>
                                            <button onClick={() => addToCart(item)} disabled={session?.status === 'checkout_requested'} className="p-2 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-30">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => addToCart(item)} 
                                            disabled={session?.status === 'checkout_requested' || (item.stock || 0) <= 0}
                                            className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-20"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                  }

                  return (
                    <div key={item.id} className="relative group/card h-full">
                      <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br transition-all duration-500 blur-xl opacity-0 group-hover/card:opacity-30 ${typeGlow}`} />
                      <div className="bg-[#0B0F19]/80 backdrop-blur-3xl border border-white/5 hover:border-white/10 rounded-[2.5rem] flex flex-col relative overflow-hidden h-full shadow-2xl transition-all duration-300 hover:-translate-y-1">
                         {/* Product Image Section - Enhanced Cropping & Premium Look */}
                         {/* Premium Product Image Container */}
                         <div className="aspect-[4/3] relative overflow-hidden group/img border-b border-white/5 bg-slate-900/40">
                            {item.image_url && item.image_url.trim() !== '' ? (
                              <img 
                                src={item.image_url} 
                                alt={item.name} 
                                className="w-full h-full object-cover object-center transition-all duration-1000 ease-out group-hover/card:scale-110 group-hover/card:rotate-2" 
                              />
                            ) : (
                              <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${typeGlow} opacity-30`}>
                                 <Icon size={48} className="opacity-20 animate-pulse" />
                                 <span className="text-[8px] font-black uppercase mt-3 tracking-[0.3em] opacity-20">NO IMAGE</span>
                              </div>
                            )}
                            
                            {/* Category Icon Badge - Premium Float */}
                            <div className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-xl shadow-2xl transform group-hover/card:scale-110 transition-all duration-500 ${typeColor}`}>
                               <Icon size={18} />
                               <div className="absolute inset-0 rounded-2xl bg-white/5 animate-pulse" />
                            </div>
                            
                            {/* Glassmorphic Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-black/10 opacity-70 group-hover/card:opacity-40 transition-opacity duration-500" />
                            
                            {/* Premium Price Tag Overlay */}
                            <div className="absolute top-4 left-4 z-20">
                               <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform -rotate-2 group-hover/card:rotate-0 transition-all duration-500 hover:scale-110">
                                  <div className="text-xl font-black text-white leading-none flex items-baseline gap-1">
                                    {item.selling_price}
                                    <span className="text-[10px] text-indigo-400 uppercase tracking-tighter">EGP</span>
                                  </div>
                               </div>
                            </div>
 
                            {isLowStock && (
                               <div className="absolute bottom-4 right-4 z-20 bg-rose-500/90 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-xl animate-pulse border border-white/20 uppercase tracking-[0.2em] shadow-lg">
                                 رصيد محدود
                               </div>
                            )}
                         </div>

                        <div className="p-6 flex flex-col flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div className={`p-2.5 rounded-xl shadow-lg ${typeColor}`}>
                              <Icon size={18}/>
                            </div>
                            <div className="flex items-center gap-1 opacity-40">
                               <LayoutGrid size={10} />
                               <p className="text-[10px] font-bold uppercase tracking-widest">{isDrink ? 'مشروبات' : isSnack ? 'سناكس' : isOffice ? 'أدوات' : 'أخرى'}</p>
                            </div>
                          </div>

                          <div className="text-right flex-1 mb-4">
                              <p className="font-extrabold text-white text-lg leading-snug group-hover/card:text-indigo-300 transition-colors tracking-tight line-clamp-2">{item.name}</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {cartEntry ? (
                            <div className="flex flex-1 items-center justify-between bg-white/5 p-1 rounded-2xl border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                              <button 
                                onClick={() => removeFromCart(item.id)} 
                                className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center font-black transition-all hover:bg-rose-500 hover:text-white active:scale-90"
                              >
                                <X size={16} strokeWidth={4} />
                              </button>
                              <span className="text-xl text-white font-black">{cartEntry.quantity}</span>
                              <button 
                                onClick={() => addToCart(item)} 
                                disabled={session?.status === 'checkout_requested'}
                                className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center font-black transition-all hover:bg-emerald-500 hover:text-white active:scale-90 disabled:opacity-30"
                              >
                                <Plus size={16} strokeWidth={4} />
                              </button>
                            </div>
                          ) : (
                            <button 
                               onClick={() => addToCart(item)} 
                               disabled={session?.status === 'checkout_requested' || (item.stock || 0) <= 0}
                               className="w-full h-14 rounded-2xl bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white border border-white/5 hover:border-indigo-500 transition-all font-black text-sm flex items-center justify-center gap-3 disabled:opacity-20 disabled:pointer-events-none group/btn shadow-lg"
                             >
                               { (item.stock || 0) <= 0 ? 'نفذت الكمية' : (
                                  <>
                                    أضف لطلبك
                                    <div className="p-1.5 bg-white/10 rounded-lg group-hover/btn:bg-white/20 transition-colors">
                                      <Plus size={18} className="group-hover/btn:rotate-90 transition-transform"/>
                                    </div>
                                  </>
                               )}
                             </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                  )
                })
        ) : (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-600 bg-white/2 backdrop-blur-md border border-white/5 border-dashed rounded-[3rem]">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 relative">
              <ShoppingBag size={48} className="text-slate-700 opacity-20" />
              <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full animate-pulse" />
            </div>
            <p className="font-black text-xl text-slate-500">لم يتم العثور على نتائج</p>
            <button onClick={() => { setStoreSearch(''); setStoreCategory('all'); }} className="mt-4 px-6 py-2 bg-indigo-600/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">العودة للرئيسية</button>
          </div>
        )
      }
        </div>
        

    </div>
  );
};
