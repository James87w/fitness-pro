// client/src/hooks/useExercises.js
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useExercises = () => {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dictionaries, setDictionaries] = useState({
    muscles: [],
    types: [],
    equipment: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 并行获取所有字典表
      const [muscleRes, typeRes, equipRes] = await Promise.all([
        supabase.from('muscles').select('*').order('name'),
        supabase.from('exercise_types').select('*'),
        supabase.from('equipment').select('*').order('name')
      ]);

      setDictionaries({
        muscles: muscleRes.data || [],
        types: typeRes.data || [],
        equipment: equipRes.data || []
      });

      // 2. 获取动作列表 (核心：多表联查)
      // 注意这句 SQL 语法，它是 Supabase 的精髓
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          id,
          name,
          notes,
          created_by,
          type:exercise_types ( id, code, name ),
          default_equipment:equipment ( id, name, base_weight_kg ),
          muscles:exercise_muscles (
            role,
            muscle:muscles ( id, name, common_name, region )
          )
        `)
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;

      // 3. 数据整形 (Flattening)
      // 把数据库深层嵌套的结构，扁平化成前端好用的格式
      const formatted = data.map(ex => ({
        id: ex.id,
        name: ex.name,
        // 提取核心属性，防止前端报错
        typeCode: ex.type?.code || 'weight_reps', 
        typeName: ex.type?.name,
        isCustom: !!ex.created_by,
        createdBy: ex.created_by,
        equipmentName: ex.default_equipment?.name,
        baseWeight: ex.default_equipment?.base_weight_kg || 0,
        // 提取主肌群名称 (用于饼图)
        primaryMuscle: ex.muscles.find(m => m.role === 'Primary')?.muscle?.common_name || 'Other',
        // 保留原始引用方便后续使用
        raw: ex 
      }));

      setExercises(formatted);

    } catch (err) {
      console.error("加载动作库失败:", err);
    } finally {
      setLoading(false);
    }
  };

  return { exercises, dictionaries, loading, refresh: fetchData };
};