import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",  // ใช้ relative path — เปิดจาก file:// หรือ subdirectory ก็ได้
})
