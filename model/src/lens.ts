export type Lens<T, V> = {
  set(obj: T, newValue: V): T;
  get(obj: T): V;
};
