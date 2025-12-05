import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. 监听登录/登出变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth event:", _event, session); // 增加日志方便调试
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // === 修改这里 ===
  // 改为 async 函数，并手动清空状态，确保 UI 立刻反应
  const signOut = async () => {
    try {
      // 1. 先清空本地状态 (让 UI 立即切回登录页)
      setUser(null);
      setSession(null);
      
      // 2. 再执行 Supabase 的登出请求 (清除服务端 Session)
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut, // 使用新的 signOut 函数
    user,
    session,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};