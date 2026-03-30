import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                navigate('/dashboard', { replace: true });
            }
        });
    }, [navigate]);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'فشل تسجيل الدخول');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-indigo-900 to-slate-900 font-['Cairo'] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute top-40 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            {/* Login Card */}
            <div className="relative w-full max-w-md p-8 mx-4">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 sm:p-12 relative z-10 group hover:shadow-indigo-500/20 transition-all duration-500">

                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 bg-white shadow-xl shadow-indigo-500/10 rounded-3xl mx-auto flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform duration-500 overflow-hidden">
                            <img src="/logo.png" alt="Cloud" className="w-full h-full object-contain p-2" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">مرحباً بك مجدداً</h1>
                        <p className="text-slate-300 font-medium">سجل الدخول للمتابعة إلى Cloud Co-Working Space</p>
                        {error && (
                            <div className="mt-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-200 text-sm font-bold">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-slate-200 text-sm font-bold pr-2 block text-right">البريد الإلكتروني</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-indigo-400 transition-colors">
                                    <Mail size={20} />
                                </div>
                                <input
                                    type="email"
                                    placeholder="example@campus.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 text-right pr-12 pl-4 py-4 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder:text-slate-600 transition-all group-hover/input:border-slate-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-slate-200 text-sm font-bold pr-2 block text-right">كلمة المرور</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-indigo-400 transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 text-right pr-12 pl-12 py-4 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder:text-slate-600 transition-all group-hover/input:border-slate-600"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm py-2">
                            <a href="#" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">نسيت كلمة المرور؟</a>
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                                <span className="font-bold">تذكرني</span>
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500" />
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2 group/btn ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <ArrowLeft size={20} className="group-hover/btn:-translate-x-1 transition-transform" />
                            {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 mt-8 text-sm font-medium">
                    © 2024 Cloud Co-Working Space. All rights reserved.
                </p>
            </div>
        </div>
    );
};
