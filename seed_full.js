// seed_full.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('./config');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const exercisesData = JSON.parse(fs.readFileSync('exercises_comprehensive.json', 'utf8'));

async function seedFull() {
  console.log("🚀 开始导入全面运动数据库...");

  // 1. 加载字典
  const { data: types } = await supabase.from('exercise_types').select('id, code');
  const { data: equipment } = await supabase.from('equipment').select('id, name');
  const { data: muscles } = await supabase.from('muscles').select('id, name, common_name');

  // 辅助函数：智能查找
  const findType = (code) => types.find(t => t.code === code)?.id;
  const findEquip = (name) => equipment.find(e => e.name === name)?.id;
  
  // 肌肉查找：支持学名(name) 和 俗名(common_name)
  const findMuscle = (searchName) => {
    if (!searchName) return null;
    const lower = searchName.toLowerCase();
    return muscles.find(m => 
      m.common_name.toLowerCase() === lower || 
      m.name.toLowerCase() === lower
    )?.id;
  };

  let successCount = 0;

  for (const ex of exercisesData) {
    const typeId = findType(ex.type);
    const equipId = findEquip(ex.equipment);

    if (!typeId || !equipId) {
      console.warn(`⚠️ 跳过 "${ex.name}": 找不到类型或器械`);
      continue;
    }

    // === 逻辑“先查询是否存在” ===
    // 1. 检查是否存在同名系统动作
    const { data: existing } = await supabase
      .from('exercises')
      .select('id')
      .eq('name', ex.name)
      .is('user_id', null) // 只查系统动作
      .maybeSingle();

    let exerciseId;

    if (existing) {
      // A. 如果存在 -> 更新 (Update)
      exerciseId = existing.id;
      // 这里你可以选择是否要更新属性，为了简单我们只更新关联关系，不更新动作本身属性
      // console.log(`🔄 更新动作: ${ex.name}`);
    } else {
      // B. 如果不存在 -> 插入 (Insert)
      const { data: inserted, error: insertError } = await supabase
        .from('exercises')
        .insert({
          name: ex.name,
          type_id: typeId,
          default_equipment_id: equipId,
          user_id: null
        })
        .select()
        .single();

      if (insertError) {
        // 如果虽然查不到但插入报错（比如并发冲突），就跳过
        console.error(`❌ 插入 "${ex.name}" 失败:`, insertError.message);
        continue;
      }
      exerciseId = inserted.id;
      // console.log(`✅ 新增动作: ${ex.name}`);
    }
    // === 修改结束 ===

    if (!exerciseId) continue;

    // 3. 关联肌肉 (保持不变)
    await supabase.from('exercise_muscles').delete().eq('exercise_id', exerciseId);

    const muscleRelations = [];
    const primaryId = findMuscle(ex.muscles.Primary);
    
    if (primaryId) {
      muscleRelations.push({ exercise_id: exerciseId, muscle_id: primaryId, role: 'Primary' });
    }

    if (ex.muscles.Secondary) {
      for (const mName of ex.muscles.Secondary) {
        const secId = findMuscle(mName);
        if (secId) {
          muscleRelations.push({ exercise_id: exerciseId, muscle_id: secId, role: 'Secondary' });
        }
      }
    }

    if (muscleRelations.length > 0) {
      await supabase.from('exercise_muscles').insert(muscleRelations);
    }
    
    successCount++;
    if (successCount % 10 === 0) process.stdout.write('.');
  }

  console.log(`\n🎉 成功导入 ${successCount} 个动作！数据库现在非常丰富了。`);
}

seedFull();