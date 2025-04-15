export type GetLens<T, V> = {
  get(obj: T): V;
};

export type Lens<T, V> = GetLens<T, V> & {
  set(obj: T, newValue: V): T;
};
