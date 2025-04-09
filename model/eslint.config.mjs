import { model } from '@platforma-sdk/eslint-config';

export default [...model, {
  rules: {
    '@stylistic/indent': ['warn', 2, {
      ignoreComments: true,
    }]
  },
}];
