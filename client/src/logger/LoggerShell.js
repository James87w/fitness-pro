import React, { useState } from 'react';
import WorkoutLogger from '../WorkoutLogger';
import HistoryEntry from './HistoryEntry';
import PlanView from './PlanView';
import FollowPlaceholder from './FollowPlaceholder';

const tabs = [
  { key: 'free', label: '自由训练', desc: '计时/记录当前训练' },
  { key: 'history', label: '历史录入', desc: '补录历史训练，不计时' },
  { key: 'plan', label: '计划', desc: '管理/编辑训练计划' },
  { key: 'follow', label: '跟练', desc: '按计划或自由跟练' },
];

const PlaceholderCard = ({ title, desc }) => (
  <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-500">
    <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
    <p className="text-sm text-gray-500">{desc}</p>
    <p className="text-xs text-gray-400 mt-3">即将上线，当前请使用自由训练模式</p>
  </div>
);

const LoggerShell = ({ unit = 'lbs', onComplete, onCancel }) => {
  const [activeTab, setActiveTab] = useState('free');

  const renderContent = () => {
    if (activeTab === 'free') {
      return (
        <WorkoutLogger
          unit={unit}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      );
    }
    if (activeTab === 'history') {
      return (
        <HistoryEntry
          unit={unit}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      );
    }
    if (activeTab === 'plan') {
      return (
        <PlanView />
      );
    }
    if (activeTab === 'follow') {
      return (
        <FollowPlaceholder />
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800">
      {/* 顶部 Tab 导航 */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-5 py-3 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div className="max-w-3xl mx-auto p-4 pb-10">{renderContent()}</div>
    </div>
  );
};

export default LoggerShell;

