// src/ExerciseManager.js 

import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { 
  ArrowLeft, Search, Save, Edit2, Archive, X, 
  Dumbbell, Activity, Lock, User, Plus, Home as HomeIcon, User as UserIcon
} from 'lucide-react';

const ExerciseManager = ({ onBack }) => {
  const { user } = useAuth();

  // === 状态 ===
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 字典数据
  const [dicts, setDicts] = useState({ types: [], equipment: [], muscles: [] });

  // 编辑/新建模式 (editingEx: { id: null } 表示新建)
  const [editingEx, setEditingEx] = useState(null);
  const [formValues, setFormValues] = useState({});

  // === 1. 初始化加载 ===
  useEffect(() => {
    fetchData();
  }, [user]); 

  const fetchData = async () => {
    if (!user) return; 
    
    setLoading(true);
    try {
      // A. 并行加载字典
      const [typeRes, equipRes, muscleRes] = await Promise.all([
        supabase.from('exercise_types').select('*'),
        supabase.from('equipment').select('*').order('name'),
        supabase.from('muscles').select('*').order('common_name')
      ]);

      setDicts({
        types: typeRes.data || [],
        equipment: equipRes.data || [],
        muscles: muscleRes.data || []
      });

      // B. 加载动作 (只查询当前用户创建的自定义动作)
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          id, name, notes, is_archived, created_by,
          type:exercise_types(id, name, code),
          equipment:equipment(id, name),
          muscles:exercise_muscles(
            role,
            muscle:muscles(id, common_name)
          )
        `)
        .eq('is_archived', false)
        .eq('created_by', user.id)
        .order('name');
      
      if (error) throw error;
      setExercises(data || []);
      
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // === 2. 归档 ===
  const handleArchive = async (ex) => {
    if (ex.created_by !== user.id) return alert("无权操作此动作");
    
    if (!window.confirm(`确定要归档 "${ex.name}" 吗？`)) return;
    try {
      const { error } = await supabase.from('exercises').update({ is_archived: true }).eq('id', ex.id);
      if (error) throw error;
      
      setExercises(exercises.filter(item => item.id !== ex.id)); 
    } catch (err) { alert(err.message); }
  };

  // === 3. 开始编辑 ===
  const startEdit = (ex) => {
    if (ex.created_by !== user.id) return alert("无法编辑系统内置动作"); 

    const primaryMuscleRel = ex.muscles.find(m => m.role === 'Primary');
    setEditingEx(ex);
    setFormValues({
      name: ex.name,
      type_id: ex.type?.id || dicts.types[0]?.id,
      equipment_id: ex.equipment?.id || dicts.equipment[0]?.id,
      primary_muscle_id: primaryMuscleRel?.muscle?.id || '', 
      notes: ex.notes || ''
    });
  };

  // === 4. 开始新建 ===
  const startCreate = () => {
    setEditingEx({ id: null }); 
    setFormValues({
      name: "",
      type_id: dicts.types[0]?.id,
      equipment_id: dicts.equipment[0]?.id,
      primary_muscle_id: "", 
      notes: ""
    });
  };

  // === 5. 保存 (新建或更新) ===
  const handleSave = async () => {
    if (!formValues.name.trim()) return alert("请输入动作名称");

    try {
      const payload = {
        name: formValues.name,
        type_id: formValues.type_id,
        default_equipment_id: formValues.equipment_id,
        notes: formValues.notes
      };

      let targetId = editingEx.id;

      if (targetId) {
        if (editingEx.created_by === null || editingEx.created_by !== user.id) return alert("无权修改此动作");

        const { error } = await supabase.from('exercises').update(payload).eq('id', targetId);
        if (error) throw error;

        await supabase.from('exercise_muscles').delete().eq('exercise_id', targetId).eq('role', 'Primary');

      } else {
        const { data: newEx, error } = await supabase
          .from('exercises')
          .insert({ ...payload, created_by: user.id }) 
          .select().single();
        
        if (error) throw error;
        targetId = newEx.id;
      }

      if (formValues.primary_muscle_id && targetId) {
        await supabase.from('exercise_muscles').insert({
          exercise_id: targetId,
          muscle_id: formValues.primary_muscle_id,
          role: 'Primary'
        });
      }

      await fetchData();
      setEditingEx(null);

    } catch (err) {
      alert("保存失败: " + err.message);
    }
  };

  // 搜索过滤
  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white min-h-screen p-6 font-sans text-gray-800 pb-20"> {/* 增加底部 padding */}
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 active:bg-gray-100 rounded-full p-2">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">自定义动作库</h1>
          <button 
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-medium text-sm"
          >
            <Plus size={18} /> 新建动作
          </button>
        </div>

        {/* === 编辑/新建表单 === */}
        {editingEx ? (
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-blue-200 pb-4">
              <h3 className="text-lg font-bold text-blue-900">
                {editingEx.id ? '编辑动作' : '新建自定义动作'}
              </h3>
              <button onClick={() => setEditingEx(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>

            <div className="space-y-5">
              {/* 名称 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">动作名称</label>
                <input type="text" value={formValues.name} onChange={e => setFormValues({...formValues, name: e.target.value})}
                  placeholder="例如：杠铃深蹲"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              {/* 类型与器械 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1">记录类型</label>
                   <select value={formValues.type_id} onChange={e => setFormValues({...formValues, type_id: e.target.value})}
                     className="w-full p-3 border border-gray-300 rounded-xl outline-none bg-white">
                     {dicts.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1">默认器械</label>
                   <select value={formValues.equipment_id} onChange={e => setFormValues({...formValues, equipment_id: e.target.value})}
                     className="w-full p-3 border border-gray-300 rounded-xl outline-none bg-white">
                     {dicts.equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                   </select>
                </div>
              </div>

              {/* 主肌群 */}
              <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-1">主肌群 (Primary Muscle)</label>
                 <select value={formValues.primary_muscle_id} onChange={e => setFormValues({...formValues, primary_muscle_id: e.target.value})}
                   className="w-full p-3 border border-gray-300 rounded-xl outline-none bg-white">
                   <option value="">-- 选择肌群 --</option>
                   {dicts.muscles.map(m => <option key={m.id} value={m.id}>{m.common_name} ({m.name})</option>)}
                 </select>
              </div>
              
              {/* 备注 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">备注/要点</label>
                <textarea rows="3" value={formValues.notes} onChange={e => setFormValues({...formValues, notes: e.target.value})}
                  placeholder="动作要领或注意事项..."
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2 shadow-lg">
                  <Save size={20}/> 保 存
                </button>
                <button onClick={() => setEditingEx(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200">取消</button>
              </div>
            </div>
          </div>
        ) : (
          // === 列表模式 ===
          <>
            <div className="relative mb-6">
              <div className="absolute left-3 top-3.5 text-gray-400"><Search size={20}/></div>
              <input type="text" placeholder="搜索我的自定义动作..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>

            {loading ? <div className="text-center py-10 text-gray-400">加载动作库...</div> : (
              <div className="space-y-3">
                {filteredExercises.map(ex => {
                   const primaryMuscle = ex.muscles.find(m => m.role === 'Primary')?.muscle?.common_name || "Unassigned";
                   const typeCode = ex.type?.code;
                   
                   return (
                    <div key={ex.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow group">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-800">{ex.name}</h3>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                            <User size={10}/> 自定义
                          </span>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                             <Activity size={12}/> {primaryMuscle}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                             <Dumbbell size={12}/> {ex.equipment?.name}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            typeCode === 'duration' ? 'bg-purple-50 text-purple-700' :
                            typeCode === 'distance_duration' ? 'bg-green-50 text-green-700' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {ex.type?.name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <>
                          <button onClick={() => startEdit(ex)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="编辑">
                            <Edit2 size={18}/>
                          </button>
                          <button onClick={() => handleArchive(ex)} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500" title="归档">
                            <Archive size={18}/>
                          </button>
                        </>
                      </div>
                    </div>
                   );
                })}
                
                {/* 空状态提示 */}
                {filteredExercises.length === 0 && (
                    <div className="py-12 px-6 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                        <h3 className="font-bold text-lg text-gray-700 mb-2">
                             您还没有添加任何自定义动作。
                        </h3>
                        <p className="text-sm text-gray-500">
                            点击右上角的 **+ 新建动作** 来创建，或者返回看板使用系统内建动作吧。
                        </p>
                    </div>
                )}

              </div>
            )}
          </>
        )}
      </div>

      {/* 底部导航栏 (统一风格) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 pb-safe flex justify-around items-center z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
         
         {/* Home */}
         <button onClick={onBack} className="p-1 flex flex-col items-center gap-0.5 transition-colors text-gray-400 hover:text-gray-600">
            <HomeIcon size={20} strokeWidth={2} /> 
            <span className="text-[9px] font-medium">Home</span>
         </button>

         {/* 悬浮添加按钮 (Placeholder for Logger) */}
         <button onClick={onBack} className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-all hover:bg-blue-700">
            <Plus size={20} strokeWidth={3} />
         </button>

         {/* Exercises (Active State for current page) */}
         <button className="p-1 flex flex-col items-center gap-0.5 transition-colors text-blue-600">
            <Dumbbell size={20} strokeWidth={2} />
            <span className="text-[9px] font-medium">Exercises</span>
         </button>
      </div>

    </div>
  );
};

export default ExerciseManager;