// src/ProfilePage.js

import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { ArrowLeft, LogOut, Mail, User, Settings } from 'lucide-react';

const getUsername = (email) => email ? email.split('@')[0] : 'User';

const ProfilePage = ({ onBack }) => {
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    if (window.confirm("确定要退出登录吗？")) {
      signOut();
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800 p-5">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-3 border-b border-gray-200">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
          <ArrowLeft size={20}/> <span className="font-medium">Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
           <Settings size={22} className="text-blue-500"/> My Profile
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        
        {/* User Info Card */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
              <User size={32} strokeWidth={2}/>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{getUsername(user?.email)}</h2>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Mail size={14}/> {user?.email}
            </p>
          </div>
          
          <div className="space-y-3">
             <div className="text-sm text-gray-700 p-3 bg-gray-50 rounded-xl border border-gray-100">
                当前版本: v0.1.1 (UI, RLS, Perf Fix)
             </div>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout} 
          className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
        >
          <LogOut size={20}/> 退出登录
        </button>

      </div>
    </div>
  );
};

export default ProfilePage;