import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
	build: {
		target: 'es2019',
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'qntjs_lib',
			fileName: 'index',
			formats: ['es']
		},
		outDir: 'dist/bundle',
		minify: true
	}
})
