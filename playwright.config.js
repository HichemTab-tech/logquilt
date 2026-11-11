import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests', testMatch:'*.spec.js', fullyParallel:true,
  use:{baseURL:'http://127.0.0.1:4174', headless:true, launchOptions:{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']}, screenshot:'off',trace:'off'},
  webServer:{command:'npm run build && node server.mjs --port 4174',url:'http://127.0.0.1:4174',reuseExistingServer:false},
});
