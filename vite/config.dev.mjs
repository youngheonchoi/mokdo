import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8081',
                changeOrigin: true
            }
        }
    }
});
