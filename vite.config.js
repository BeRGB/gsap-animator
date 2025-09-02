import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/gsap-animator/',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/img', dest: 'src' } // -> dist/src/img
      ]
    })
  ]
});