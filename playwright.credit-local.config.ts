import {defineConfig} from '@playwright/test';
import base from './playwright.config';
import path from 'node:path';
import {existsSync} from 'node:fs';
const bundled=process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1248/chrome-win64/chrome.exe'):'';
export default defineConfig({...base,testMatch:['receipt-print.spec.ts','product-discounts.spec.ts','customer-credit.spec.ts','reference-workspace.spec.ts'],use:{...base.use,...(existsSync(bundled)?{launchOptions:{executablePath:bundled}}:{})},reporter:[['list']],outputDir:'test-results/credit-local'});
