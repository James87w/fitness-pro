import React, { useState, useEffect, useRef } from 'react';
import { supabase, CURRENT_USER_ID } from './supabaseClient';
import { useExercises } from './hooks/useExercises'; // <--- 引入刚才写的 Hook
import { toKg, formatWeight } from './unitUtils';
import { Save, Plus, ArrowLeft, Trash2, X, Check, Search, Timer, Dumbbell, MapPin } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

const WorkoutLogger = ({ onComplete, onCancel, unit = 'lbs' }) => {
  const { user } = useAuth();
  // === 1. 使用 Hook 加载数据 ===
  const { exercises, loading: loadingEx } = useExercises();

  // === 基础状态 ===
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState("力量训练");
  
  // === 搜索相关 ===
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  
  // === 核心输入状态 (多态输入) ===
  const [inputWeight, setInputWeight] = useState("");
  const [inputReps, setInputReps] = useState("");
  const [inputDuration, setInputDuration] = useState("");
  const [inputDistance, setInputDistance] = useState("");
  
  // === 队列 ===
  const [sessionQueue, setSessionQueue] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef(null);

  // 初始化列表
  useEffect(() => {
    if (exercises.length > 0) setFilteredExercises(exercises);
  }, [exercises]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 搜索过滤
  const handleSearchChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    setShowDropdown(true);
    setSelectedExercise(null);
    setFilteredExercises(exercises.filter(ex => ex.name.toLowerCase().includes(text.toLowerCase())));
  };

  // 选中动作 (UI 自动切换的核心)
  const handleSelectExercise = (ex) => {
    setSearchTerm(ex.name);
    setSelectedExercise(ex);
    setShowDropdown(false);
    
    // 清空所有输入框
    setInputWeight("");
    setInputReps("");
    setInputDuration("");
    setInputDistance("");
  };

  // 添加一组
  const handleAddSet = () => {
    if (!selectedExercise) return;
    
    // 根据类型构建数据
    const type = selectedExercise.typeCode;
    let setPayload = {
      exercise_id: selectedExercise.id,
      exercise_name: selectedExercise.name,
      type_code: type,
      set_order: sessionQueue.length + 1
    };

    // 校验与赋值
    if (type === 'weight_reps') {
      if (!inputWeight || !inputReps) return;
      setPayload.weight_kg = toKg(inputWeight, unit); // 转存 KG
      setPayload.reps = parseInt(inputReps);
      setPayload.display_weight = inputWeight; // 仅用于前端显示
    } 
    else if (type === 'bodyweight_reps') {
      if (!inputReps) return;
      setPayload.weight_kg = 0;
      setPayload.reps = parseInt(inputReps);
      setPayload.is_bodyweight = true;
    }
    else if (type === 'duration') {
      if (!inputDuration) return;
      setPayload.duration_seconds = parseInt(inputDuration);
    }
    else if (type === 'distance_duration') {
      if (!inputDistance || !inputDuration) return;
      setPayload.distance_meters = parseFloat(inputDistance) * 1000; // 假设输入km，存m
      setPayload.duration_seconds = parseInt(inputDuration);
    }

    setSessionQueue([...sessionQueue, setPayload]);
  };

  // 保存训练 (适配 V3 结构)
    const handleSaveWorkout = async () => {
    if (sessionQueue.length === 0) return;
    setIsSaving(true);
    try {
      // 1. [优化] 查找或创建 Session (使用 Upsert 原子操作)
      // 利用 unique_user_date 约束：如果存在则更新(并返回id)，不存在则插入(并返回id)
      const { data: sessionData, error: sessErr } = await supabase
        .from('workout_sessions')
        .upsert(
          { 
            user_id: user.id, 
            date: date, 
            title: title 
          }, 
          { onConflict: 'user_id, date' } // 必须对应数据库的唯一约束
        )
        .select() // 必须加 select() 才能拿到返回的 id
        .single();

      if (sessErr) throw sessErr;
      
      const sessionId = sessionData.id;

      // 2. 插入 Sets (保持原样)
      const setsToInsert = sessionQueue.map(item => ({
        session_id: sessionId,
        exercise_id: item.exercise_id,
        set_order: item.set_order,
        // 映射字段
        weight_kg: item.weight_kg || null,
        reps: item.reps || null,
        duration_seconds: item.duration_seconds || null,
        distance_meters: item.distance_meters || null,
      }));

      const { error: setErr } = await supabase.from('workout_sets').insert(setsToInsert);
      if (setErr) throw setErr;

      onComplete();
    } catch (err) {
      console.error(err); // 方便调试看具体错误
      alert("保存失败: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // === 动态渲染输入框组件 ===
  const renderInputs = () => {
    if (!selectedExercise) return <div className="text-gray-400 text-sm py-4">请先搜索并选择一个动作</div>;

    const type = selectedExercise.typeCode;

    // 1. 力量训练 (Weight x Reps)
    if (type === 'weight_reps') {
      return (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-1/2 relative">
            <input type="number" placeholder="重量" value={inputWeight} onChange={e => setInputWeight(e.target.value)}
              className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" autoFocus />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">{unit}</span>
          </div>
          <div className="w-1/2 relative">
            <input type="number" placeholder="次数" value={inputReps} onChange={e => setInputReps(e.target.value)}
              className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">reps</span>
          </div>
        </div>
      );
    }

    // 2. 自重训练 (Reps only)
    if (type === 'bodyweight_reps') {
      return (
        <div className="flex gap-3 animate-fade-in">
           <div className="w-full relative">
             <div className="w-full p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-600 font-medium text-center">
                自重训练 (Bodyweight)
             </div>
           </div>
           <div className="w-full relative">
            <input type="number" placeholder="次数" value={inputReps} onChange={e => setInputReps(e.target.value)}
              className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">reps</span>
          </div>
        </div>
      );
    }

    // 3. 计时训练 (Duration)
    if (type === 'duration') {
      return (
        <div className="w-full relative animate-fade-in">
          <input type="number" placeholder="时长 (秒)" value={inputDuration} onChange={e => setInputDuration(e.target.value)}
            className="w-full p-3 border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400" />
          <span className="absolute right-3 top-3 text-gray-400 text-sm"><Timer size={16}/> sec</span>
        </div>
      );
    }

    // 4. 有氧 (Distance + Duration)
    if (type === 'distance_duration') {
      return (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-1/2 relative">
            <input type="number" placeholder="距离" value={inputDistance} onChange={e => setInputDistance(e.target.value)}
              className="w-full p-3 border border-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-400" />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">km</span>
          </div>
          <div className="w-1/2 relative">
            <input type="number" placeholder="时长 (分)" value={inputDuration} onChange={e => setInputDuration(e.target.value)}
              className="w-full p-3 border border-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-400" />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">min</span>
          </div>
        </div>
      );
    }
    
    return <div className="text-red-500">未知的动作类型</div>;
  };

  // === 辅助渲染列表项 ===
  const renderListItem = (item) => {
    let desc = "";
    if (item.type_code === 'weight_reps') desc = `${formatWeight(item.weight_kg, unit)} ${unit} × ${item.reps} 次`;
    else if (item.type_code === 'bodyweight_reps') desc = `自重 × ${item.reps} 次`;
    else if (item.type_code === 'duration') desc = `${item.duration_seconds} 秒`;
    else if (item.type_code === 'distance_duration') desc = `${(item.distance_meters/1000).toFixed(2)} km in ${item.duration_seconds} 分`;

    return (
      <div>
        <p className="font-medium text-gray-800">{item.exercise_name}</p>
        <p className="text-gray-500 text-xs mt-1">{desc}</p>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700"><ArrowLeft /></button>
          <h2 className="text-xl font-bold">记录 V3.0 训练</h2>
          <div className="w-6"></div>
        </div>

        {/* 日期标题 */}
        <div className="flex gap-4 mb-6">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 p-3 border border-gray-300 rounded-lg outline-none" />
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="flex-1 p-3 border border-gray-300 rounded-lg outline-none" />
        </div>
        <hr className="my-6 border-gray-100"/>

        {/* 动作选择区 */}
        <div className="bg-gray-50 p-4 rounded-xl mb-6 shadow-sm border border-gray-200 relative">
          <h3 className="font-semibold text-gray-800 mb-3">动作录入</h3>
          
          <div className="space-y-4" ref={dropdownRef}>
            {/* 搜索框 */}
            <div className="relative">
              <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
                 <div className="pl-3 text-gray-400"><Search size={18} /></div>
                 <input 
                    type="text" value={searchTerm} onChange={handleSearchChange} onFocus={() => setShowDropdown(true)}
                    placeholder="搜索动作 (如 Bench Press)..."
                    className="w-full p-3 outline-none text-gray-800 placeholder-gray-400"
                 />
                 {selectedExercise && <div className="pr-3 text-green-500"><Check size={18} /></div>}
                 {searchTerm && !selectedExercise && (
                    <button onClick={() => { setSearchTerm(""); setFilteredExercises(exercises); }} className="pr-3 text-gray-400"><X size={16} /></button>
                 )}
              </div>
              
              {/* 下拉菜单 */}
              {showDropdown && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {loadingEx && <li className="p-3 text-gray-400">加载中...</li>}
                  {!loadingEx && filteredExercises.map(ex => (
                    <li key={ex.id} onClick={() => handleSelectExercise(ex)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between">
                      <span>{ex.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{ex.primaryMuscle}</span>
                    </li>
                  ))}
                  {!loadingEx && filteredExercises.length === 0 && (
                     <li className="p-3 text-gray-400 text-sm">找不到动作？请先去管理页添加</li>
                  )}
                </ul>
              )}
            </div>

            {/* 动态输入区域 (这是最酷的部分) */}
            {renderInputs()}

            <button onClick={handleAddSet} disabled={!selectedExercise} className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus size={18} /> 添加一组
            </button>
          </div>
        </div>

        {/* 列表 */}
        <div className="mb-24 space-y-2">
           {sessionQueue.map((item, idx) => (
             <li key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-600 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{item.set_order}</span>
                    {renderListItem(item)}
                </div>
                <button onClick={() => {
                   const newQ = [...sessionQueue]; newQ.splice(idx, 1); setSessionQueue(newQ);
                }} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
             </li>
           ))}
        </div>

        {/* 底部按钮 */}
        <div className="fixed bottom-6 left-0 right-0 px-6">
          <div className="max-w-md mx-auto">
             <button onClick={handleSaveWorkout} disabled={sessionQueue.length === 0 || isSaving} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-xl hover:bg-black disabled:opacity-70">
                {isSaving ? "保存中..." : <><Save size={20} /> 完成 V3 训练</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutLogger;