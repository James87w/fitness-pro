// src/unitUtils.js

const KG_TO_LBS = 2.20462262;

/**
 * 显示转换：从数据库的 KG 转成用户想要的单位 (lbs/kg)
 * @param {number} kgValue - 数据库里存的千克数
 * @param {string} unit - 当前模式 ('lbs' 或 'kg')
 */
export const formatWeight = (kgValue, unit) => {
  if (!kgValue && kgValue !== 0) return 0;
  
  if (unit === 'kg') {
    return parseFloat(kgValue).toFixed(1); // 保持原样
  } else {
    // 核心逻辑：KG -> LBS
    return (kgValue * KG_TO_LBS).toFixed(1); 
  }
};

/**
 * 录入转换：把用户输入的数值转成 KG 存入数据库
 * @param {number} inputValue - 用户输入框里的数字
 * @param {string} unit - 当前模式 ('lbs' 或 'kg')
 */
export const toKg = (inputValue, unit) => {
  if (!inputValue) return 0;
  const val = parseFloat(inputValue);

  if (unit === 'kg') {
    return val;
  } else {
    // 核心逻辑：LBS -> KG
    return val / KG_TO_LBS;
  }
};

/**
 * 获取单位后缀标签
 */
export const getUnitLabel = (unit) => {
  return unit === 'kg' ? 'kg' : 'lbs';
};