import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    testTimeout: 10000,
    retry: 2,
    // pool: 'forks',
    // poolOptions: {
    //   forks: {
    //     execArgv: [
    //       '--prof',
    //     ],
    //     singleFork: true,
    //   },
    // },
  }
});
