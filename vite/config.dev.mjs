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
        proxy: {
            '/api': {
                target: 'http://localhost:8081',
                changeOrigin: false
            },
            '/oauth2': {
                target: 'http://localhost:8081',
                changeOrigin: false
            },
            '/login/oauth2': {
                target: 'http://localhost:8081',
                changeOrigin: false
            }
        }
    }
});
