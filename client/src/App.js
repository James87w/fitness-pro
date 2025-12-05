import React, { useEffect, useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Activity, Calendar, TrendingUp, Plus, 
  Trash2, Edit2, Save, Settings, Layers, LogOut, History,
  Home, Dumbbell, User as UserIcon
} from 'lucide-react';
import { supabase } from './supabaseClient';
import WorkoutLogger from './WorkoutLogger';
import ExerciseManager from './ExerciseManager';
import { formatWeight, toKg } from './unitUtils'; 
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './Auth';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
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
      <text x={ex + (cos >= 0 ? 8 : -8)} y={ey} textAnchor={textAnchor} fill="#374151" dominantBaseline="central" fontSize={12} fontWeight={500}>
        {`${name} (${value})`}
      </text>
    </g>
  );
};

const DashboardContent = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [unit, setUnit] = useState('lbs'); 
  const [loading, setLoading] = useState(true);
  const [showLogger, setShowLogger] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [allSessions, setAllSessions] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true); 
  const [dailyStats, setDailyStats] = useState([]);
  const [muscleStats, setMuscleStats] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (user) fetchInitialData(); 
  }, [user]);
  useEffect(() => {
    if (allSessions.length > 0) processChartData(allSessions);
  }, [unit, allSessions]);
  const fetchInitialData = async () => {
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
        .gte('date', thirtyDaysAgo) // 核心：只选 >= 30天前
        .order('date', { ascending: true }); // 按时间正序排列，方便图表显示

      if (error) throw error;

      setAllSessions(data);
      // 如果初次加载就少于1条（或者根据业务逻辑判断），可能就没有更早数据了
      // 这里简单处理：只要不报错，我们暂且认为可能还有更早的，交给 Load More 去探测
      setHasMore(true); 

      // 默认选中最后一次（最近一次）训练
      if (data && data.length > 0) {
        handleDateClick(data[data.length - 1]);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchOlderData = async () => {
    if (allSessions.length === 0) return;
    
    setLoadingMore(true);
    try {
      // 获取当前列表中“最老”的一天
      const oldestDate = allSessions[0].date;

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
        .lt('date', oldestDate) // 核心：选 < 当前最老日期
        .order('date', { ascending: false }) // 核心：倒序取最近的“旧”数据
        .limit(30); // 核心：一次只拿30条

      if (error) throw error;

      if (data.length === 0) {
        setHasMore(false); // 没有更早的数据了
        alert("没有更早的训练记录了");
      } else {
        // data 是倒序回来的 (比如 2月28, 2月27...)
        // 我们需要把它转回正序 (2月27, 2月28...) 以便拼接到 allSessions 头部
        const newOldSessions = data.reverse();
        setAllSessions(prev => [...newOldSessions, ...prev]);
      }
    } catch (error) {
      console.error("Error fetching older data:", error);
      alert("加载失败");
    } finally {
      setLoadingMore(false);
    }
  };
  const processChartData = (sessions) => {
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
  };
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
  const handleChartClick = (chartState) => {
      if (chartState && chartState.activePayload && chartState.activePayload.length > 0) {
        handleDateClick(chartState.activePayload[0].payload.originalData);
      } else if (chartState && chartState.activeLabel) {
        const found = allSessions.find(s => s.date === chartState.activeLabel);
        if (found) handleDateClick(found);
      }
  };
  const handleDateClick = (session) => {
      setSelectedDate(session.date);
      setSelectedSession(session);
      setEditingSetId(null);
  };
  const handleDeleteSession = async () => {
    if (!selectedSession || !window.confirm(`确定删除 ${selectedSession.date} 的记录吗？`)) return;
    try {
      await supabase.from('workout_sessions').delete().eq('id', selectedSession.id);
      setSelectedSession(null);
      fetchInitialData(); 
    } catch (e) { alert(e.message); }
  };
  const handleDeleteSet = async (setId) => {
    if (!window.confirm("确定删除这一组吗？")) return;
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

  if (showManager) return <ExerciseManager onBack={() => setShowManager(false)} />;
  
  if (showLogger) {
    return (
      <WorkoutLogger 
        unit={unit} 
        onComplete={() => { setShowLogger(false); fetchInitialData(); }} 
        onCancel={() => setShowLogger(false)} 
      />
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800 pb-24"> {/* pb-24 防止内容被底部导航遮挡 */}
      
      {/* === 1. 新的极简顶部 Header (吸顶) === */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-end">
        <div>
           <p className="text-xs text-gray-400 font-medium">
             {new Date().toLocaleDateString('zh-CN', {weekday: 'long', month:'short', day:'numeric'})}
           </p>
           <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2 mt-1">
             <Activity className="text-blue-600 fill-blue-100" /> Pro Fitness
           </h1>
        </div>
        <div onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')} className="cursor-pointer bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-200">
           {unit.toUpperCase()}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* === 2. 统计卡片 (优化版) === */}
        {loading ? <div className="text-center py-10 text-gray-400">同步数据中...</div> : (
          <>
            {/* 容量趋势卡片 */}
            <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-700 flex items-center gap-2">
                   <TrendingUp size={18} className="text-blue-500"/> 容量趋势
                 </h3>
                 {hasMore && (
                    <button onClick={fetchOlderData} disabled={loadingMore} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      {loadingMore ? '...' : <><History size={12}/> 更多</>}
                    </button>
                 )}
               </div>
               <div className="h-48">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={dailyStats} onClick={handleChartClick}>
                     <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6"/>
                     <XAxis dataKey="date" hide={true} /> {/* 手机上隐藏 X 轴文字，太挤了 */}
                     <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                        cursor={{stroke: '#3B82F6', strokeWidth: 2}}
                     />
                     <Line type="monotone" dataKey="volume" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{r: 6}} fill="url(#colorVol)" />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* 训练详情列表 (卡片化) */}
            <div className="space-y-4">
               <h3 className="font-bold text-gray-900 text-lg px-2">
                 {selectedDate ? `📅 ${selectedDate} 训练` : "最近训练"}
               </h3>
               
               {selectedSession ? (
                 <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                   {/* Session Header */}
                   <div className="bg-gray-50/80 p-4 border-b border-gray-100 flex justify-between items-center backdrop-blur-sm">
                      <div>
                        <h4 className="font-bold text-gray-800">{selectedSession.title}</h4>
                        <p className="text-xs text-gray-500">{selectedSession.workout_sets.length} 组数据</p>
                      </div>
                      <button onClick={handleDeleteSession} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18}/></button>
                   </div>
                   
                   {/* Sets List */}
                   <div className="divide-y divide-gray-100">
                      {groupedSets.map((group, idx) => (
                        <div key={idx} className="p-4">
                           <div className="flex justify-between items-baseline mb-3">
                              <h5 className="font-bold text-gray-800">{group.exercise.name}</h5>
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">{group.sets.length} sets</span>
                           </div>
                           <div className="space-y-2">
                              {group.sets.map(set => (
                                <div key={set.id} onClick={() => editingSetId === set.id ? null : handleStartEdit(set)} className="flex items-center text-sm group cursor-pointer">
                                   <div className="w-6 text-gray-300 font-mono text-xs">{set.set_order}</div>
                                   <div className="flex-1">
                                      {/* 这里直接复用你之前的表格里的渲染逻辑，为了节省篇幅我简化了 */}
                                      {editingSetId === set.id ? (
                                        <div className="flex gap-2">
                                           {/* ... 你的编辑输入框逻辑 ... */}
                                           {/* 这里需要把你原表格里的 <input> 逻辑搬过来，或者简化为一个简单的文本显示 "编辑中..." */}
                                           <span className="text-blue-600 font-bold">正在编辑... (逻辑同上)</span>
                                           <button onClick={() => handleSaveEdit(set)} className="text-green-600"><Save size={16}/></button>
                                        </div>
                                      ) : (
                                        <div className="flex gap-1 items-baseline">
                                           {/* 简单展示逻辑，你需要把原来那个表格里的 switch case 搬过来 */}
                                           <span className="font-bold text-gray-700">{formatWeight(set.weight_kg, unit)}</span>
                                           <span className="text-xs text-gray-400">{unit}</span>
                                           <span className="text-gray-300 mx-1">×</span>
                                           <span className="font-bold text-gray-700">{set.reps}</span>
                                        </div>
                                      )}
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                 </div>
               ) : (
                 <div className="p-8 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                    点击上方的图表查看详情
                 </div>
               )}
            </div>
          </>
        )}
      </div>

      {/* === 3. 底部导航栏 (Bottom Navigation) === */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 pb-safe flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
         
         <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">主页</span>
         </button>

         {/* 中间的大号添加按钮 */}
         <div className="relative -top-5">
            <button onClick={() => setShowLogger(true)} className="bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-600/30 hover:scale-105 transition-transform">
               <Plus size={28} strokeWidth={3} />
            </button>
         </div>

         <button onClick={() => setShowManager(true)} className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors">
            <Dumbbell size={24} />
            <span className="text-[10px] font-medium">动作库</span>
         </button>
         
         {/* 简单的登出放在这里，或者做一个单独的 Profile 弹窗 */}
         <button onClick={signOut} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500 transition-colors">
            <UserIcon size={24} />
            <span className="text-[10px] font-medium">我</span>
         </button>
      </div>

    </div>
  );
};

// === 主 App 组件 ===
const App = () => {
  return (
    <AuthProvider>
      <MainScreen />
    </AuthProvider>
  );
};

// 负责路由判定的子组件
const MainScreen = () => {
  const { user } = useAuth();
  return user ? <DashboardContent /> : <Auth />;
}

export default App;