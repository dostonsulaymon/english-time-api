import { cleanEnv, num, str } from 'envalid';

// Use require for dotenv
const dotenv = require('dotenv');
dotenv.config();

export const config = cleanEnv(process.env, {
  APP_PORT: num({ default: 3000 }),
  DATABASE_URL: str(),
  NODE_ENV: str({ choices: ['development', 'production'], default: 'development' }),
  PAYME_MERCHANT_ID: str(),
  PAYME_LOGIN: str(),
  PAYME_PASSWORD: str(),
  PAYME_PASSWORD_TEST: str(),
  CLICK_SERVICE_ID: str(),
  CLICK_MERCHANT_ID: str(),
  CLICK_SECRET: str(),
  CLICK_MERCHANT_USER_ID: str()
});