// import_data.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// === 配置区 ===
// 请在 .env 文件或这里直接填入你的 Supabase URL 和 Service Role Key (注意：用 Service Role Key 绕过 RLS 方便导入)
const SUPABASE_URL = 'https://fqoddqwmzypjczythatj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxb2RkcXdtenlwamN6eXRoYXRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg4NDk2MCwiZXhwIjoyMDgwNDYwOTYwfQ.kYiRfyAxCJx6SLX7zqZymAez67hs6ltYMAycmOMsi38'; // 千万不要在前端暴露这个Key
const USER_ID = '7e64d2ce-0ace-4871-840b-a062454e0a62'; // 你的用户 UUID

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === 你的原始数据 ===
const RAW_DATA = `
2025/11/24	Rowing		4min30 1000m		Warmup
2025/11/24	Rear Delt Fly	4	105/105/110/110	8	Machine
2025/11/24	Chest Fly	4	150/150/155/155	8	Machine
2025/11/24	Hip Abduction	3	270/275/285	12	Machine
2025/11/24	Hip Adduction	3	295/300/305	12	Machine
2025/11/24	Cable Triceps Pressdown	3	42.5 / 42.5 / 45	10	Cable Machine
2025/11/24	Cable Biceps Half Curl	3	32.5 / 32.5 / 32.5	10	Cable Machine
2025/11/24	Back Extension	3	45 / 45 / 45	12	Plate
2025/11/25	Rowing		3min 690m		Warmup
2025/11/25	Lat Pulldown	4	135 / 135 / 140 / 145	8	Machine
2025/11/25	Deadlift	5	90 / 160 / 160 / 160 / 160	8	Barbell, Free
2025/11/25	Seated Row	4	125/125/125/125	8	Machine
2025/11/25	Cable Triceps Pressdown	3	37.5/37.5/37.5	12	Cable Machine
2025/11/25	Split Squat	3	70/70/70	7	Dumbbell
2025/11/25	Lying Leg Raise	3	/	15	Self Weight
2025/11/26	Rowing		4min40 1058m		Warmup
2025/11/26	Hip Abduction	3	280/290/290	12	Machine
2025/11/26	Seated Row	4	135/135/140/140	8	Machine
2025/11/26	Prone Leg Curl	3	115/120/120	10	Machine
2025/11/26	Delt Lat Raise	4	85/85/90/90	10	Machine
2025/11/26	Hip Adduction	3	295/300/305	12	Machine
2025/11/26	Rear Delt Fly	4	115/115/115/115	8	Machine
2025/11/26	Chest Fly	4	150/150/155/155	8	Machine
2025/11/26	Stand Calf	3	180/180/200	15	Machine
2025/11/27	Rowing		3min 670m		Warmup
2025/11/27	Bench Chest Press	4	57.5/57.5/57.5/57.5	8	Dumbbell
2025/11/27	Incline Chest Press	4	45/45/45/45	8	Dumbbell
2025/11/27	Biceps Curl	3	30/30/30	8	Dumbbell
2025/11/27	Chest Fly	4	150/150/155/155	8	Machine
2025/11/27	Kneeling Push-ups	4	/	8	Self Weight
2025/11/27	Bent-knee Sit-ups	3	/	15	Self Weight
2025/11/28	Bicycle		3min 1600m		Warmup
2025/11/28	Chest Fly	4	150/150/155/155	8	Machine
2025/11/28	Hip Abduction	3	270/270/270	12	Machine
2025/11/28	Hip Adduction	3	300/305/305	12	Machine
2025/11/28	Seated Row	4	130/130/135/135	8	Machine
2025/11/28	Chest Press	4	125/120/120/120	8	Machine
2025/11/28	Stand Calf	3	195/197.5/197.5	15	Machine
2025/11/28	Dynamic Plank Core	4	10kg	12	Machine
2025/11/28	Lat Pulldown	4	130/130/135/135	8	Machine
2025/11/29	Rowing		3min 690m		Warmup
2025/11/29	Delt Lat Raise	3	85/85/85	10	Machine
2025/11/29	Squat	4	90/110/120/130	8	Barbell, Free
2025/11/29	Shoulder Press	4	85/85/85/85	6	Machine
2025/11/29	Rear Delt Fly	4	110/110/110/110	8	Machine
2025/11/29	Signle Leg Step Down	4	/	8	Self Weight
2025/11/29	Lying Leg Raise	3	/	15	Self Weight
2025/11/30	Rowing		5min 1130m		Warmup
2025/11/30	MTS High Row	4	85/85/90/90	8	Machine
2025/11/30	Hip Abduction	3	280/290/300	12	Machine
2025/11/30	Hip Adduction	3	300/305/305	12	Machine
2025/11/30	Leg Extension	4	240/240/245/245	8	Machine
2025/11/30	Rear Delt Fly	4	110/110/115/115	8	Machine
2025/11/30	Chest Fly	4	150/150/155/155	8	Machine
`;

async function importData() {
  console.log("🚀 开始导入数据...");
  
  const lines = RAW_DATA.trim().split('\n');
  
  // 1. 缓存映射 Map，减少数据库查询
  const exerciseMap = new Map(); // Name -> UUID
  const sessionMap = new Map();  // Date -> UUID

  for (const line of lines) {
    const parts = line.split(/\t+/); // 根据 Tab 分割
    if (parts.length < 2) continue;

    const dateStr = parts[0].trim().replace(/\//g, '-'); // 2025/11/24 -> 2025-11-24
    const actionName = parts[1].trim();
    const setsCount = parseInt(parts[2]) || 0;
    const weightRaw = parts[3] || "0";
    const repsRaw = parts[4] || "0";
    const comment = parts[5] || "";

    // --- A. 处理 Session (训练课) ---
    if (!sessionMap.has(dateStr)) {
      // 1. 先尝试查询
      const { data: session, error: selectError } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('date', dateStr)
        .eq('user_id', USER_ID)
        .maybeSingle(); // 使用 maybeSingle 避免报错

      if (selectError) {
        console.error(`❌ 查询 Session 失败 (${dateStr}):`, selectError.message);
        continue; // 跳过这一行
      }

      if (session) {
        sessionMap.set(dateStr, session.id);
      } else {
        // 2. 不存在则插入
        const { data: newSession, error: insertError } = await supabase
          .from('workout_sessions')
          .insert({ user_id: USER_ID, date: dateStr, title: `Workout on ${dateStr}` })
          .select()
          .single();

        // --- 错误捕捉核心点 ---
        if (insertError || !newSession) {
          console.error(`❌ 创建 Session 失败 (${dateStr}):`);
          console.error("   原因:", insertError ? insertError.message : "数据库未返回数据 (可能是 RLS 权限问题)");
          console.error("   建议: 请检查是否使用了 service_role key，且 USER_ID 正确。");
          process.exit(1); // 遇到错误直接停止，方便调试
        }
        
        sessionMap.set(dateStr, newSession.id);
        console.log(`📅 创建新训练课: ${dateStr}`);
      }
    }
    const sessionId = sessionMap.get(dateStr);

    // --- B. 处理 Exercise (动作) ---
    if (!exerciseMap.has(actionName)) {
      // 查找或创建动作
      const { data: exercise } = await supabase
        .from('exercises')
        .select('id')
        .eq('name', actionName)
        .eq('user_id', USER_ID)
        .single();

      if (exercise) {
        exerciseMap.set(actionName, exercise.id);
      } else {
        const { data: newExercise } = await supabase
          .from('exercises')
          .insert({ name: actionName, user_id: USER_ID })
          .select()
          .single();
        exerciseMap.set(actionName, newExercise.id);
        console.log(`💪 创建新动作: ${actionName}`);
      }
    }
    const exerciseId = exerciseMap.get(actionName);

    // --- C. 解析重量并插入 Sets ---
    // 处理逻辑：如果有 "/" 分隔符，说明每一组重量不同；否则说明重量相同
    let weights = [];
    if (weightRaw.includes('/') || weightRaw.includes(',')) {
        weights = weightRaw.split(/[\/,]+/).map(w => parseFloat(w.trim()));
    } else {
        // 只有且仅有一个数字，或者根本不是数字（Warmup）
        const val = parseFloat(weightRaw);
        if (!isNaN(val)) {
             // 如果写了 setsCount 是 4，只有一个重量，说明做了 4 组一样的
             weights = Array(setsCount).fill(val);
        }
    }
    
    // 如果是 Warmup 或者非重力训练，可能没有解析出 weights，但也需要记录
    if (weights.length === 0 && setsCount > 0) {
        weights = Array(setsCount).fill(0);
    }

    const setsToInsert = weights.map((w, index) => ({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_order: index + 1,
        weight_kg: isNaN(w) ? 0 : w,
        reps: parseInt(repsRaw) || 0,
        set_type: comment.toLowerCase().includes('warmup') ? 'Warmup' : 'Normal'
    }));

    if (setsToInsert.length > 0) {
        const { error } = await supabase.from('workout_sets').insert(setsToInsert);
        if (error) console.error('插入 Set 失败:', error);
        else console.log(`✅ 插入 ${setsToInsert.length} 组: ${actionName} @ ${dateStr}`);
    }
  }
  console.log("🎉 全部导入完成！");
}

importData();