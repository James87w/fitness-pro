import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Dumbbell, ArrowRight } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn({ email, password });
        if (error) throw error;
      } else {
        const { error } = await signUp({ email, password });
        if (error) throw error;
        alert("注册成功！");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gray-900">
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center blur-sm scale-110 transition-transform duration-1000" 
          style={{ backgroundImage: "url(/images/login-bg.png)" }}
        ></div>
        <div className="absolute inset-0 bg-gray-900/40"></div>
      </div>
      <div className="relative w-full max-w-sm backdrop-blur-xl border border-white/40 p-8 rounded-3xl shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}>  
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30">
            <Dumbbell size={32} className="text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-2 tracking-tight">
          {isLogin ? 'Welcome Back' : 'Join Pro Fitness'}
        </h2>
        <p className="text-center text-gray-600 mb-8 text-sm">记录每一次突破，见证更强的自己</p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <input
              type="email"
              placeholder="Email"
              required
              className="w-full p-4 bg-white/60 border border-white/50 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <input
              type="password"
              placeholder="Password"
              required
              className="w-full p-4 bg-white/60 border border-white/50 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            {loading ? 'Processing...' : (
              <>{isLogin ? 'Sign In' : 'Sign Up'} <ArrowRight size={20}/></>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-700 hover:text-black font-medium transition-colors"
          >
            {isLogin ? "还没有账号？去注册" : "已有账号？去登录"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;