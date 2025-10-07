import type {O} from 'ts-toolbelt'

export class TypeBuilder<T extends object, I extends object> {
  constructor(public readonly impl: I) {}

  extend<I2 extends Abstract<T>>(ext: I2 | ((Base: I) => I2)) {
    const extension = typeof ext === 'function' ? ext(this.impl) : ext
    const newImpl = {...this.impl, ...extension} as O.Merge<I, I2>

    return new TypeBuilder<T, O.Merge<I, I2>>(newImpl)
  }

  extendType<T2 extends object>() {
    return new TypeBuilder<O.Merge<T, T2>, I>(this.impl)
  }

  finish(this: TypeBuilder<T, Omit<T, 'typeName'>>, typeName: string): T {
    return {...this.impl, typeName} as T
  }

  static begin<Target extends object>(): TypeBuilder<Target, object>
  static begin<Target extends object>(impl: Target): TypeBuilder<Target, Target>
  static begin<Target extends object>(impl = {}) {
    return new TypeBuilder<Target, object>(impl)
  }
}

type Abstract<T extends object> = {
  [K in keyof T]?: T[K] extends (...args: infer A) => infer R
  ? (this: T, ...args: A) => R
  : T[K]
}
