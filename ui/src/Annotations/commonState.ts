import { inject, ref, provide, type Ref } from 'vue';

const key = Symbol('commonState');

type CommonState = {
  addFilterModalIndex: number | undefined;
  editStepModalIndex: number | undefined;
};

export function provideCommonState() {
  const commonState = ref<CommonState>({
    addFilterModalIndex: undefined as number | undefined,
    editStepModalIndex: undefined as number | undefined,
  });
  provide(key, commonState);
  return commonState;
}

export function useCommonState() {
  return inject(key) as Ref<CommonState>;
}
