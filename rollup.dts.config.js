import dts from 'rollup-plugin-dts';

export default {
  input: 'dist/index.d.ts',
  output: [{ file: 'dist/bundle/index.d.ts', format: 'es' }],
  plugins: [
    dts({
      respectExternal: false,
      compilerOptions: {
        paths: {}
      }
    })
  ]
};
