import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// 计划列表与基础 CRUD（不含 items 编辑）
export const usePlans = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPlans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('plans')
        .select(`
          id,
          name,
          notes,
          visibility,
          is_archived,
          owner_id,
          created_at,
          plan_shares:plan_shares!left(user_id, role, status)
        `)
        .eq('is_archived', false)
        .or(`owner_id.eq.${user.id},plan_shares.user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setPlans(data || []);
    } catch (e) {
      console.error('加载计划失败', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = useCallback(
    async ({ name, notes }) => {
      if (!user) throw new Error('未登录');
      const { data, error: err } = await supabase
        .from('plans')
        .insert({
          owner_id: user.id,
          name,
          notes: notes || '',
          visibility: 'private',
        })
        .select()
        .single();
      if (err) throw err;
      await fetchPlans();
      return data;
    },
    [user, fetchPlans]
  );

  const archivePlan = useCallback(
    async (planId) => {
      const { error: err } = await supabase
        .from('plans')
        .update({ is_archived: true })
        .eq('id', planId);
      if (err) throw err;
      await fetchPlans();
    },
    [fetchPlans]
  );

  return {
    plans,
    loading,
    error,
    createPlan,
    archivePlan,
    refresh: fetchPlans,
  };
};

