// HealthApp/config.js
require('dotenv').config();

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  USER_ID: process.env.USER_ID
};

if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
  console.error("❌ 错误: 请在 .env 文件中配置 Supabase URL 和 Key");
  process.exit(1);
}

module.exports = config;