import React, { useMemo, useState } from 'react';
import { Plus, Archive, Share2, Shield, User, Users, Copy, RefreshCw, Inbox } from 'lucide-react';
import { usePlans } from '../hooks/usePlans';
import { useAuth } from '../contexts/AuthContext';

const PlanCard = ({ plan, isOwner, onArchive }) => {
  const sharedRoles =
    plan.plan_shares?.filter((s) => s.status === 'active')?.map((s) => s.role) || [];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex justify-between items-start">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">{plan.name}</h3>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              plan.visibility === 'public'
                ? 'bg-green-50 text-green-700 border-green-100'
                : plan.visibility === 'shared'
                ? 'bg-blue-50 text-blue-700 border-blue-100'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {plan.visibility}
          </span>
          {isOwner ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
              <User size={10} /> 我创建
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
              <Users size={10} /> 共享给我
            </span>
          )}
        </div>
        {plan.notes && <p className="text-sm text-gray-600">{plan.notes}</p>}
        {sharedRoles.length > 0 && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <Share2 size={12} /> 协作者角色：{sharedRoles.join(', ')}
          </div>
        )}
      </div>
      {isOwner && (
        <button
          onClick={() => onArchive(plan.id)}
          className="p-2 text-gray-300 hover:text-red-500"
          title="归档"
        >
          <Archive size={16} />
        </button>
      )}
    </div>
  );
};

const EmptyState = ({ title, desc }) => (
  <div className="p-6 border border-dashed border-gray-200 rounded-2xl text-center text-gray-500 bg-white">
    <Inbox className="mx-auto mb-2 text-gray-300" size={24} />
    <h4 className="font-semibold text-gray-800">{title}</h4>
    <p className="text-sm text-gray-500">{desc}</p>
  </div>
);

const PlanView = () => {
  const { plans, loading, error, createPlan, archivePlan, refresh } = usePlans();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { myPlans, sharedPlans } = useMemo(() => {
    const mine = [];
    const shared = [];
    plans.forEach((p) => {
      if (p.owner_id === user?.id) mine.push(p);
      else shared.push(p);
    });
    return { myPlans: mine, sharedPlans: shared };
  }, [plans, user]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createPlan({ name: name.trim(), notes: notes.trim() });
      setName('');
      setNotes('');
    } catch (e) {
      alert(e.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">计划</h2>
            <p className="text-sm text-gray-500">创建、查看或使用共享计划</p>
          </div>
          <button
            onClick={refresh}
            className="p-2 text-gray-400 hover:text-blue-600"
            title="刷新"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="计划名称"
            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="备注（可选）"
            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? '创建中...' : <><Plus size={18} /> 新建计划</>}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-800">我的计划</h3>
        </div>
        {myPlans.length === 0 && !loading && (
          <EmptyState title="暂无计划" desc="创建一个计划以便跟练或分享。" />
        )}
        {myPlans.map((p) => (
          <PlanCard key={p.id} plan={p} isOwner onArchive={archivePlan} />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-amber-500" />
          <h3 className="font-semibold text-gray-800">共享给我的</h3>
        </div>
        {sharedPlans.length === 0 && !loading && (
          <EmptyState title="暂无共享计划" desc="等待教练/朋友的分享或通过链接加入。" />
        )}
        {sharedPlans.map((p) => (
          <PlanCard key={p.id} plan={p} isOwner={false} onArchive={() => {}} />
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">加载中...</p>}
      {error && <p className="text-sm text-red-500">加载失败：{error.message}</p>}
    </div>
  );
};

export default PlanView;

