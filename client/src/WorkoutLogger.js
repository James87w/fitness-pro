// src/WorkoutLogger.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useExercises } from './hooks/useExercises'; 
import { useAuth } from './contexts/AuthContext';
import { toKg, formatWeight } from './unitUtils';
import { Save, Plus, ArrowLeft, Trash2, X, Check, Search, Clock, Dumbbell, Timer, ArrowRight } from 'lucide-react';


// === 辅助函数 A：格式化秒数 (00:00) ===
const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// === 辅助函数 B：计时器 Hook (保持不变) ===
const useTimer = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    } else if (!isRunning && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    stop();
    setTime(0);
  }, [stop, setTime]);

  return { time, isRunning, start, stop, reset, setTime };
};


// === 核心组件 ===
const WorkoutLogger = ({ onComplete, onCancel, unit = 'lbs' }) => {
  const { user } = useAuth();
  const { exercises, loading: loadingEx } = useExercises();
  
  // === 计时器状态 ===
  const { time, isRunning, start, stop, reset } = useTimer();
  const [timerMode, setTimerMode] = useState('ACTION'); // 'ACTION' (做组) | 'REST' (休息)
  
  // 基础状态
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState("力量训练");
  const [sessionQueue, setSessionQueue] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // 辅助状态
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [inputWeight, setInputWeight] = useState("");
  const [inputReps, setInputReps] = useState("");
  const [inputDuration, setInputDuration] = useState("");
  const [inputDistance, setInputDistance] = useState("");
  const dropdownRef = useRef(null);


  // 初始化和外部点击逻辑 
  useEffect(() => {
    if (exercises.length > 0) setFilteredExercises(exercises);
  }, [exercises]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // 搜索和选择动作逻辑 
  const handleSearchChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    setShowDropdown(true);
    setSelectedExercise(null);
    setFilteredExercises(exercises.filter(ex => ex.name.toLowerCase().includes(text.toLowerCase())));
  };

  const handleSelectExercise = (ex) => {
    setSearchTerm(ex.name);
    setSelectedExercise(ex);
    setShowDropdown(false);
    
    setInputWeight("");
    setInputReps("");
    setInputDuration("");
    setInputDistance("");

    if (isRunning) reset();
    setTimerMode('ACTION');
  };
  
  
  // === 核心逻辑：记录并切换计时器 (Unified Button Logic) ===
  const handleLogAndSwitch = () => {
    if (!selectedExercise) return;
    
    let newQueue = [...sessionQueue];
    const capturedTime = time; 
    
    stop(); 

    // 1. 处理首次点击 (只启动计时器，不记录)
    if (sessionQueue.length === 0 && !isRunning) {
        start();
        return; 
    }

    // 2. ACTION MODE (记录 Set Item / 切换到 REST)
    if (timerMode === 'ACTION') {
      
      // 校验输入数据 (W/R)
      const type = selectedExercise.typeCode;
      if ((type === 'weight_reps' && (!inputWeight || !inputReps)) || 
          (type === 'bodyweight_reps' && !inputReps)) {
          start(); 
          alert("请确保重量/次数已填写！");
          return;
      }
      
      // 构建数据 (Set)
      let setPayload = {
        type: 'SET', 
        exercise_id: selectedExercise.id,
        exercise_name: selectedExercise.name,
        type_code: type,
        id: Date.now() + Math.random(), 
        
        // 关键时间数据 (Action Time)
        action_time_seconds: capturedTime, 
        rest_time_seconds: 0 
      };
      
      // 校验与赋值 
      if (type === 'weight_reps') {
        setPayload.weight_kg = toKg(inputWeight, unit); 
        setPayload.reps = parseInt(inputReps);
      } 
      else if (type === 'bodyweight_reps') {
          setPayload.weight_kg = 0;
          setPayload.reps = parseInt(inputReps);
      }
      else if (type === 'duration') {
          setPayload.duration_seconds = parseInt(inputDuration);
      }
      else if (type === 'distance_duration') {
          setPayload.distance_meters = parseFloat(inputDistance) * 1000;
          setPayload.duration_seconds = parseInt(inputDuration);
      }
      
      newQueue.push(setPayload);
      setTimerMode('REST'); // 下一个周期是休息
    } 
    
    // 3. REST MODE (记录休息 Block / 切换到 ACTION)
    else if (timerMode === 'REST') {
        
      // Log Rest Block
      if (capturedTime > 0) {
        newQueue.push({ 
            type: 'REST_BLOCK', 
            time: capturedTime, 
            id: Date.now() + Math.random() 
        });
      }
      
      setTimerMode('ACTION'); // 下一个周期是做组
    }

    // 4. 统一清理与启动
    setSessionQueue(newQueue);
    reset(); 
    start(); // 启动下一次计时
  };
  
  
  // === 辅助 Effect：确保计时器在首次点击或模式切换后启动 ===
  useEffect(() => {
      if (timerMode === 'REST' && !isRunning) {
          start();
      }
  }, [timerMode, isRunning, start]);


  // === 保存训练 (需要过滤掉 REST_BLOCK) ===
  const handleSaveWorkout = async () => {
    const setsToSubmit = sessionQueue.filter(item => item.type === 'SET');
    
    if (setsToSubmit.length === 0) return;
    setIsSaving(true);
    
    if (isRunning) {
      stop();
      alert("计时器已停止，本次未记录的动作/休息时间将丢失。");
    }
    
    try {
      // 1. 原子化 Upsert Session
      const { data: sessionData, error: sessErr } = await supabase
        .from('workout_sessions')
        .upsert(
          { user_id: user.id, date: date, title: title }, 
          { onConflict: 'user_id, date' }
        )
        .select()
        .single();

      if (sessErr) throw sessErr;
      
      const sessionId = sessionData.id;

      // 2. 插入 Sets (需要附加 Rest Time 信息并动态生成 Set Order)
      const processedSets = [];
      let setOrderCounter = 1; 
      
      for (let i = 0; i < sessionQueue.length; i++) {
        const currentItem = sessionQueue[i];
        
        if (currentItem.type === 'SET') {
          let restDuration = 0;
          // 检查前一个元素是否是休息 Block
          if (i > 0 && sessionQueue[i - 1].type === 'REST_BLOCK') {
             restDuration = sessionQueue[i - 1].time;
          }
          
          processedSets.push({
            session_id: sessionId,
            exercise_id: currentItem.exercise_id,
            set_order: setOrderCounter++, 
            
            weight_kg: currentItem.weight_kg || null,
            reps: currentItem.reps || null,
            duration_seconds: currentItem.duration_seconds || null,
            distance_meters: currentItem.distance_meters || null,
            
            action_time_seconds: currentItem.action_time_seconds || null, 
            rest_time_seconds: restDuration, 
          });
        }
      }

      const { error: setErr } = await supabase.from('workout_sets').insert(processedSets);
      if (setErr) throw setErr;

      onComplete();
    } catch (err) {
      alert("保存失败: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // === 动态渲染输入框组件 (保持不变) ===
  const renderInputs = () => {
    if (!selectedExercise) return <div className="text-gray-400 text-sm py-4">请先搜索并选择一个动作</div>;

    const type = selectedExercise.typeCode;
    
    if (type === 'weight_reps' || type === 'bodyweight_reps') {
       return (
        <div className="flex gap-3 animate-fade-in">
           {type === 'weight_reps' && (
             <div className="w-1/2 relative">
               <input type="number" placeholder="重量" value={inputWeight} onChange={e => setInputWeight(e.target.value)}
                 className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
               <span className="absolute right-3 top-3 text-gray-400 text-sm">{unit}</span>
             </div>
           )}
           <div className={type === 'weight_reps' ? "w-1/2 relative" : "w-full relative"}>
             <input type="number" placeholder="次数" value={inputReps} onChange={e => setInputReps(e.target.value)}
               className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
             <span className="absolute right-3 top-3 text-gray-400 text-sm">reps</span>
           </div>
         </div>
       );
    }

    if (type === 'duration') {
      return (
        <div className="w-full relative animate-fade-in">
          <input type="number" placeholder="时长 (秒)" value={inputDuration} onChange={e => setInputDuration(e.target.value)}
            className="w-full p-3 border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400" />
          <span className="absolute right-3 top-3 text-gray-400 text-sm"><Timer size={16}/> sec</span>
        </div>
      );
    }
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

  // === 辅助渲染列表项 (Set Log) ===
  const renderSetItem = (item, calculatedSetOrder) => {
    let primaryInfo = "";
    const actionTime = item.action_time_seconds ? formatTime(item.action_time_seconds) : null;
    
    // 1. Determine the main set display line
    if (item.type_code === 'weight_reps' || item.type_code === 'bodyweight_reps') {
        const weight = item.type_code === 'weight_reps' ? `${formatWeight(item.weight_kg, unit)} ${unit} × ` : '自重 × ';
        primaryInfo = `${weight}${item.reps} 次`;
        
    } else if (item.type_code === 'duration') {
        primaryInfo = `${item.duration_seconds} 秒`;
    }
    else if (item.type_code === 'distance_duration') {
        primaryInfo = `${(item.distance_meters/1000).toFixed(2)} km in ${item.duration_seconds} 分`;
    }
    
    return (
      <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 w-4/5"> {/* 左侧容器 */}
              <span className="bg-blue-100 text-blue-600 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{calculatedSetOrder}</span>
              <div className="flex flex-col">
                  <p className="font-medium text-gray-800">{item.exercise_name}</p>
                  <p className="text-gray-500 text-xs mt-1">{primaryInfo}</p>
              </div>
          </div>
          
          {/* 右侧：Action Time 和 Delete 按钮 */}
          <div className="flex items-center gap-2">
              {/* [修复] 动作时间只显示数值，统一使用 base/medium 风格 */}
              {actionTime && (
                  <span className="font-medium text-base font-mono text-gray-700">
                      {actionTime}
                  </span>
              )}
              <button onClick={() => {
                  const newQ = [...sessionQueue]; 
                  const index = newQ.findIndex(q => q.id === item.id && q.type === 'SET'); 
                  
                  if (index === -1) return;

                  // 删除 Set 时，如果它紧跟着一个 Rest Block (前面)，Rest Block 也要被删除
                  if (index > 0 && newQ[index - 1].type === 'REST_BLOCK') {
                      newQ.splice(index - 1, 2); // 移除 Rest Block 和 Set
                  } else {
                      newQ.splice(index, 1); // 仅移除 Set
                  }
                  setSessionQueue(newQ);
              }} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
          </div>
      </div>
    );
  };
  
  // === 辅助渲染列表项 (休息 Block) ===
  const renderRestBlock = (item) => {
      return (
          <div key={item.id} className="w-full bg-red-50 p-3 my-1 border-l-4 border-dashed border-red-300 rounded-md flex justify-between items-center text-red-700">
              <span className="flex items-center gap-2 text-sm font-bold">
                 <ArrowRight size={16} className='transform rotate-90'/>
                 组间休息
              </span>
              {/* 休息时间显示，统一使用 base/medium 风格 */}
              <span className="font-medium text-base font-mono"> 
                 {formatTime(item.time)}
              </span>
          </div>
      );
  };


  return (
    <div className="bg-white min-h-screen font-sans text-gray-800 pb-20"> 
      <div className="max-w-md mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-full p-2"><ArrowLeft /></button>
          <h2 className="text-xl font-bold">记录训练</h2> 
          <div className="w-8"></div>
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
            {/* 1. 动作搜索 */}
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
            
            {/* 2. 动态输入区域 (重量/次数等) */}
            {renderInputs()}
            
            {/* 3. 计时器显示区 */}
            <div className={`py-3 px-4 rounded-xl text-center font-mono font-bold text-xl transition-all border ${
              timerMode === 'ACTION' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-red-100 text-red-800 border-red-300'
            }`}>
              {timerMode === 'ACTION' ? 'ACTION TIME' : 'REST TIME'} &nbsp; 
              <span className="text-3xl">{formatTime(time)}</span>
            </div>

            {/* 4. 按钮控制区 (统一 Log/Switch 按钮) */}
            <div className="flex gap-3">
              <button 
                onClick={handleLogAndSwitch} 
                disabled={!selectedExercise}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {timerMode === 'ACTION' ? (
                  <><Clock size={18} /> 记录动作时间 / 启动休息</>
                ) : (
                  <><Plus size={18} /> 记录休息 ({formatTime(time)}) / 启动下一组</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 列表 */}
        <div className="mb-24 space-y-2"> 
           {sessionQueue.map((item, idx) => {
             
             if (item.type === 'REST_BLOCK') {
                return renderRestBlock(item); // 渲染休息区块
             }
             
             // 动态计算 Set 序号 (新的逻辑，确保序号连贯)
             const calculatedSetOrder = sessionQueue.slice(0, idx + 1).filter(i => i.type === 'SET').length;

             // 渲染 Set Item
             return (
               <li key={item.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                  {renderSetItem(item, calculatedSetOrder)} {/* 传入动态计算的序号 */}
               </li>
             );
           })}
        </div>

        {/* 底部按钮 (Save) */}
        <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-gray-100 z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
          <div className="max-w-md mx-auto">
             <button 
                onClick={handleSaveWorkout} 
                disabled={sessionQueue.length === 0 || isSaving} 
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? "保存中..." : <><Save size={20} /> 完成训练</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutLogger;