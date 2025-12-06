import React from 'react';
import { ClipboardList, Activity } from 'lucide-react';

const FollowPlaceholder = () => (
  <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-500">
    <ClipboardList className="mx-auto mb-3 text-gray-300" size={28} />
    <h3 className="text-lg font-semibold text-gray-800 mb-2">跟练模式</h3>
    <p className="text-sm text-gray-500">
      即将上线：从计划生成训练队列，支持目标 vs 实际、计时与自由加组。
    </p>
    <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
      <Activity size={14} /> 敬请期待
    </div>
  </div>
);

export default FollowPlaceholder;

