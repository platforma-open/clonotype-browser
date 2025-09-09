import { createViteDevConfig } from '@milaboratories/build-configs';
import { defineConfig, mergeConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig((configEnv) => {
  return mergeConfig(createViteDevConfig(configEnv), {
    server: {
      fs: {
        allow: ['/'],
      },
    },
  });
});
