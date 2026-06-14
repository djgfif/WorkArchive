import type { ko } from './resources/ko';

type Primitive = string | number | boolean | null | undefined;

type DotJoin<Prefix extends string, Key extends string> = `${Prefix}.${Key}`;

type StringLeafPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends readonly unknown[]
      ? never
      : T[Key] extends Primitive
        ? never
        : T[Key] extends object
          ? DotJoin<Key, StringLeafPaths<T[Key]>>
          : never;
}[keyof T & string];

type LocalizedResource<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly LocalizedResource<Item>[]
    : T extends Primitive
      ? T
      : T extends object
        ? { readonly [Key in keyof T]: LocalizedResource<T[Key]> }
        : T;

export type AppTranslationResource = LocalizedResource<typeof ko>;
export type AppTranslationKey = StringLeafPaths<AppTranslationResource>;
