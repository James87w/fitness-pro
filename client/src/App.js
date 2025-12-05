import React, { useEffect, useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Activity, Calendar, TrendingUp, Plus, History, Home, Dumbbell, User as UserIcon, LogOut,
  Trash2, Edit2, Save, Settings, Layers 
} from 'lucide-react';
import { supabase } from './supabaseClient';
import WorkoutLogger from './WorkoutLogger';
import ExerciseManager from './ExerciseManager';
import ProfilePage from './ProfilePage'; // <--- 引入新的 ProfilePage
import { formatWeight, toKg } from './unitUtils'; 
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './Auth';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
const RADIAN = Math.PI / 180;

// === 自定义饼图 Label 组件 (保持不变) ===
const renderCustomizedLabel = ({
  cx, cy, midAngle, outerRadius, percent, name, value
}) => {
  if (percent < 0.05) return null;
  const radius = outerRadius;
  const turningRadius = radius + 15; 
  const textRadius = turningRadius + 25; 
  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const sx = cx + radius * cos;
  const sy = cy + radius * sin;
  const mx = cx + turningRadius * cos;
  const my = cy + turningRadius * sin;
  const ex = cx + (cos >= 0 ? 1 : -1) * textRadius;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#9CA3AF" fill="none" />
      <text 
        x={ex + (cos >= 0 ? 8 : -8)} 
        y={ey} 
        textAnchor={textAnchor} 
        fill="#374151" 
        dominantBaseline="central" 
        fontSize={12}
        fontWeight={500}
      >
        {`${name} (${value})`}
      </text>
    </g>
  );
};


// === Dashboard 核心内容组件 ===
const DashboardContent = () => {
  const { user, signOut } = useAuth();
  
  // === 状态定义 ===
  const [unit, setUnit] = useState('lbs'); 
  const [loading, setLoading] = useState(true);
  const [showLogger, setShowLogger] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showProfile, setShowProfile] = useState(false); // <--- 新增 Profile 状态
  
  // 数据状态
  const [allSessions, setAllSessions] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [muscleStats, setMuscleStats] = useState([]); 
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // 分页状态
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 编辑状态
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({});

  // === Effect: 初始加载 ===
  const fetchInitialData = useMemo(() => async () => {
    setLoading(true);
    try {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      const thirtyDaysAgo = date.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          id, date, title,
          workout_sets (
            id, weight_kg, reps, duration_seconds, distance_meters, set_order, exercise_id,
            exercises (
               name,
               type:exercise_types(code),
               muscles:exercise_muscles(role, muscle:muscles(common_name))
            )
          )
        `)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true });

      if (error) throw error;
      setAllSessions(data);
      setHasMore(true);

      if (data && data.length > 0) {
        handleDateClick(data[data.length - 1]);
      } else {
        setSelectedDate(null);
        setSelectedSession(null);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user, fetchInitialData]);

  // === Effect: 处理图表数据 (保持不变) ===
  const processChartData = useMemo(() => (sessions) => {
    const muscleCountMap = {};
    const stats = sessions.map(session => {
      let sessionVolume = 0; 
      let sessionSets = 0;
      session.workout_sets.forEach(set => {
        const typeCode = set.exercises?.type?.code || 'weight_reps';
        if (typeCode === 'weight_reps') {
          const displayWeight = parseFloat(formatWeight(set.weight_kg, unit));
          sessionVolume += displayWeight * (set.reps || 0);
        }
        sessionSets += 1;
        const primaryMuscleRel = set.exercises?.muscles?.find(m => m.role === 'Primary');
        const muscleName = primaryMuscleRel?.muscle?.common_name || "Other";
        muscleCountMap[muscleName] = (muscleCountMap[muscleName] || 0) + 1;
      });
      return { date: session.date, volume: sessionVolume, sets: sessionSets, originalData: session };
    });

    const topMuscles = Object.keys(muscleCountMap)
      .map(key => ({ name: key, value: muscleCountMap[key] }))
      .sort((a, b) => b.value - a.value);

    setDailyStats(stats);
    setMuscleStats(topMuscles);
  }, [unit]);

  useEffect(() => {
    if (allSessions.length > 0) processChartData(allSessions);
  }, [allSessions, processChartData]);

  // === 3. 加载更多历史 (保持不变) ===
  const fetchOlderData = async () => {
    if (allSessions.length === 0) return;
    
    setLoadingMore(true);
    try {
      const oldestDate = allSessions[0].date;

      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          id, date, title,
          workout_sets (
             id, weight_kg, reps, duration_seconds, distance_meters, set_order, exercise_id,
             exercises (name, type:exercise_types(code), muscles:exercise_muscles(role, muscle:muscles(common_name)))
          )
        `)
        .lt('date', oldestDate)
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;

      if (data.length === 0) {
        setHasMore(false);
        alert("没有更早的数据了");
      } else {
        const newOldSessions = data.reverse();
        setAllSessions(prev => [...newOldSessions, ...prev]);
      }
    } catch (error) {
      alert("加载失败");
    } finally {
      setLoadingMore(false);
    }
  };

  // === 计算分组 (Memo, 保持不变) ===
  const groupedSets = useMemo(() => {
    if (!selectedSession || !selectedSession.workout_sets) return [];
    const groups = {};
    const sortedSets = [...selectedSession.workout_sets].sort((a, b) => a.set_order - b.set_order);
    sortedSets.forEach(set => {
      const exId = set.exercise_id;
      if (!groups[exId]) groups[exId] = { exercise: set.exercises, sets: [] };
      groups[exId].sets.push(set);
    });
    return Object.values(groups);
  }, [selectedSession]);

  // === 交互 Handlers (保持不变) ===
  const handleChartClick = (chartState) => {
    if (chartState && chartState.activePayload && chartState.activePayload.length > 0) {
      handleDateClick(chartState.activePayload[0].payload.originalData);
    }
  };

  const handleDateClick = (session) => {
    setSelectedDate(session.date);
    setSelectedSession(session);
    setEditingSetId(null);
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    if (!window.confirm(`确定删除 ${selectedSession.date} 的记录吗？`)) return;
    try {
      await supabase.from('workout_sessions').delete().eq('id', selectedSession.id);
      setSelectedSession(null);
      fetchInitialData(); 
    } catch (e) { alert(e.message); }
  };

  const handleDeleteSet = async (setId) => {
    if (!window.confirm("删除此组？")) return;
    try {
      await supabase.from('workout_sets').delete().eq('id', setId);
      fetchInitialData(); 
    } catch (e) { alert(e.message); }
  };

  const handleStartEdit = (set) => {
    setEditingSetId(set.id);
    setEditValues({
      weight: formatWeight(set.weight_kg, unit), 
      reps: set.reps || 0,
      duration: set.duration_seconds || 0,
      distance: set.distance_meters ? (set.distance_meters / 1000).toFixed(2) : 0 
    });
  };

  const handleSaveEdit = async (originalSet) => {
    try {
      const typeCode = originalSet.exercises?.type?.code;
      const updates = {};
      if (typeCode === 'weight_reps') { updates.weight_kg = toKg(editValues.weight, unit); updates.reps = parseFloat(editValues.reps); } 
      else if (typeCode === 'duration') { updates.duration_seconds = parseFloat(editValues.duration); } 
      else if (typeCode === 'distance_duration') { updates.distance_meters = parseFloat(editValues.distance) * 1000; updates.duration_seconds = parseFloat(editValues.duration); } 
      else if (typeCode === 'bodyweight_reps') { updates.reps = parseFloat(editValues.reps); }
      
      const { error } = await supabase.from('workout_sets').update(updates).eq('id', originalSet.id);
      if (error) throw error;
      setEditingSetId(null);
      fetchInitialData();
    } catch (err) { alert("保存失败: " + err.message); }
  };


  // === 子页面渲染：优先级最高 ===
  if (showLogger) {
    return (
      <WorkoutLogger 
        unit={unit} 
        onComplete={() => { setShowLogger(false); fetchInitialData(); }} 
        onCancel={() => setShowLogger(false)} 
      />
    );
  }

  if (showManager) return <ExerciseManager onBack={() => setShowManager(false)} />;
  
  if (showProfile) return <ProfilePage onBack={() => setShowProfile(false)} />; // <--- 渲染 Profile Page


  // === 主渲染逻辑 (UI 优化重点) ===
  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800 pb-28">
      
      {/* 1. 顶部导航 (Glassmorphism & Profile Button) */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-5 py-3 pt-safe flex justify-between items-center transition-all">
        
        {/* 左侧：Me (Profile Icon) + Title */}
        <div className="flex items-center gap-2"> 
           {/* Me Button (Top-Left) */}
           <button onClick={() => setShowProfile(true)} className="p-1 text-gray-700 hover:text-blue-600 rounded-full active:bg-gray-100">
              <UserIcon size={20} strokeWidth={2} />
           </button>
           
           <div>
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">
                {new Date().toLocaleDateString('en-US', {weekday: 'long', month:'short', day:'numeric'})}
              </p>
              <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-1">
                <Activity className="text-blue-600 fill-blue-100" size={20} /> Pro Fitness
              </h1>
           </div>
        </div>
        
        {/* 右侧：单位切换 */}
        <div 
          onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')} 
          className="cursor-pointer bg-gray-100 active:bg-gray-200 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600 border border-gray-200 transition-colors"
        >
           {unit.toUpperCase()}
        </div>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-6">
        
        {loading ? (
           <div className="py-20 flex flex-col items-center justify-center opacity-50">
             <Activity className="animate-bounce text-blue-500 mb-2"/>
             <span className="text-sm text-gray-400">Loading your gains...</span>
           </div>
        ) : (
          <>
            {/* 2. 容量图表卡片 (保持不变) */}
            <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="font-bold text-gray-900 text-sm">Volume Trend</h3>
                    <p className="text-xs text-gray-400">Last 30 Days ({unit})</p>
                 </div>
                 {hasMore && (
                    <button onClick={fetchOlderData} disabled={loadingMore} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 px-3 py-1.5 rounded-full transition-colors">
                      {loadingMore ? '...' : <><History size={12}/> Load More</>}
                    </button>
                 )}
               </div>
               
               <div className="h-40 -ml-4">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={dailyStats} onClick={handleChartClick}>
                     <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} /> 
                     <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px'}}
                        cursor={{stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '4 4'}}
                     />
                     <Line type="monotone" dataKey="volume" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{r: 6, fill:'#2563EB', stroke:'white', strokeWidth:2}} fill="url(#colorVol)" />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
            </div>
            
            {/* 3. 肌肉分布饼图 (保持不变) */}
            <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm mb-4">Muscle Focus (Sets Count)</h3>
                <div className="h-60 flex justify-center items-center">
                    {muscleStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={muscleStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60} 
                                    paddingAngle={5}
                                    dataKey="value"
                                    labelLine={false} 
                                    label={renderCustomizedLabel}
                                >
                                    {muscleStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-400 text-sm">No sets recorded yet.</p>
                    )}
                </div>
            </div>


            {/* 4. 训练详情列表 (保持不变) */}
            <div>
               <div className="flex items-center justify-between px-2 mb-3">
                 <h3 className="font-bold text-gray-900 text-lg">
                   {selectedDate ? "Session Details" : "Latest Session"}
                 </h3>
                 {selectedSession && (
                   <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                     {selectedSession.date}
                   </span>
                 )}
               </div>
               
               {selectedSession ? (
                 <div className="space-y-4 animate-fade-in">
                   {/* 标题栏 */}
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">{selectedSession.title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{selectedSession.workout_sets.length} total sets</p>
                      </div>
                      <button onClick={handleDeleteSession} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors">
                        <Trash2 size={16}/>
                      </button>
                   </div>
                   
                   {/* 分组动作列表 */}
                   {groupedSets.map((group, idx) => (
                     <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* 动作头 */}
                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-50 flex justify-between items-center">
                           <h5 className="font-bold text-gray-800">{group.exercise.name}</h5>
                           <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{group.sets.length} Sets</span>
                        </div>
                        
                        {/* Sets 列表 */}
                        <div className="divide-y divide-gray-50">
                           {group.sets.map((set, sIdx) => {
                             const isEditing = editingSetId === set.id;
                             return (
                               <div key={set.id} className="p-4 flex items-center justify-between active:bg-gray-50 transition-colors">
                                  {/* 左侧：序号 + 数据 */}
                                  <div className="flex items-center gap-4">
                                     <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs font-mono flex items-center justify-center">
                                       {sIdx + 1}
                                     </div>
                                     
                                     {isEditing ? (
                                        <div className="flex items-center gap-2">
                                           {/* 简化的编辑输入框 */}
                                           <input type="number" className="w-16 bg-gray-50 border border-blue-200 rounded p-1 text-center font-bold" value={editValues.weight || editValues.distance} onChange={e => setEditValues({...editValues, [set.distance_meters ? 'distance' : 'weight']: e.target.value})} />
                                           <span className="text-xs text-gray-400">×</span>
                                           <input type="number" className="w-12 bg-gray-50 border border-blue-200 rounded p-1 text-center font-bold" value={editValues.reps || editValues.duration} onChange={e => setEditValues({...editValues, [set.duration_seconds && !set.distance_meters ? 'duration' : 'reps']: e.target.value})} />
                                        </div>
                                     ) : (
                                        <div className="flex flex-col">
                                           <span className="font-bold text-gray-800 text-lg leading-none">
                                              {set.exercises.type.code === 'weight_reps' ? (
                                                <>{formatWeight(set.weight_kg, unit)} <span className="text-xs text-gray-400 font-normal">{unit}</span></>
                                              ) : (
                                                // 其他类型的简化显示
                                                set.reps || set.duration_seconds
                                              )}
                                           </span>
                                           <span className="text-xs text-gray-400 mt-1">
                                              {set.exercises.type.code === 'weight_reps' ? `${set.reps} reps` : 'Duration/Dist'}
                                           </span>
                                        </div>
                                     )}
                                  </div>

                                  {/* 右侧：操作按钮 */}
                                  <div className="flex items-center gap-1">
                                    {isEditing ? (
                                      <button onClick={() => handleSaveEdit(set)} className="p-2 text-green-600 bg-green-50 rounded-full"><Save size={16}/></button>
                                    ) : (
                                      <>
                                        <button onClick={() => handleStartEdit(set)} className="p-2 text-gray-300 hover:text-blue-500 transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteSet(set.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                      </>
                                    )}
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 // 空状态
                 <div className="py-10 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
                    <Calendar size={32} className="mb-2 text-gray-300"/>
                    <p className="text-sm">Select a data point on the chart</p>
                 </div>
               )}
            </div>
          </>
        )}
      </div>

      {/* 4. 底部导航栏 (只剩三个元素) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 px-6 py-2 pb-safe flex justify-around items-end z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
         
         {/* Home */}
         <button onClick={() => { setShowLogger(false); setShowManager(false); setShowProfile(false); }} className={`p-2 flex flex-col items-center gap-1 transition-colors text-blue-600`}>
            <Home size={24} strokeWidth={2.5} /> 
            <span className="text-[10px] font-medium">Home</span>
         </button>

         {/* 悬浮添加按钮 */}
         <div className="relative -top-6">
            <button 
              onClick={() => setShowLogger(true)} 
              className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-gray-900/30 active:scale-95 transition-all"
            >
               <Plus size={28} strokeWidth={3} />
            </button>
         </div>

         {/* Exercises */}
         <button onClick={() => setShowManager(true)} className="p-2 flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <Dumbbell size={24} strokeWidth={2} />
            <span className="text-[10px] font-medium">Exercises</span>
         </button>
      </div>

    </div>
  );
};


// === 主 App 组件 (负责路由和 Auth Context) ===
const MainScreen = () => {
  const { user } = useAuth();
  return user ? <DashboardContent /> : <Auth />;
}

const App = () => {
  return (
    <AuthProvider>
      <MainScreen />
    </AuthProvider>
  );
};

export default App;