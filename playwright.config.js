import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:60000,
  reporter:'list',use:{baseURL:'http://127.0.0.1:5174',headless:true,viewport:{width:1366,height:900},
    launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},
  webServer:{command:'node server.js',env:{PORT:'5174'},url:'http://127.0.0.1:5174',reuseExistingServer:!process.env.CI},
});
