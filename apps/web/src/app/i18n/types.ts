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

export type AppTranslationResource = typeof ko;
export type AppTranslationKey = StringLeafPaths<AppTranslationResource>;
