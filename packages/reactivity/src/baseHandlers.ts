import { track, trigger } from "./effect";
import { ReactiveFlags, readonly, reactive } from "./reactive";
import {
  isObject,
  isArray,
  extend,
  hasOwn,
  isIntegerKey,
  hasChanged,
} from "@vue/shared";
import { TrackOpTypes, TriggerOpTypes } from "./operations";

const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations();
export function toRaw<T>(observed: T): T {
  // client端传入的原始方法fn
  const raw = observed && observed[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
}

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {};

  ["includes", "indexOf", "lastIndexOf"].forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this);
      // 对数组的每个值进行 track 操作，收集依赖
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + "");
      }
      // 参数有可能是响应式的，函数执行后返回值为 -1 或 false，那就用参数的原始值再试一遍
      const res = arr[key]([...args]);
      if (res === -1 || res === false) {
        return arr[key]([...args.map(toRaw)]);
      } else {
        return res;
      }
    };
  });
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  (["push", "pop", "shift", "unshift", "splice"] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      //pauseTracking()
      const res = toRaw(this)[key].apply(this, args);
      //resetTracking()
      return res;
    };
  });
  return instrumentations;
}

/**
 * 要收集依赖
 */
function createGetter(isReadonly = false, shallow = false) {
  return function (target, key: string | symbol, receiver: object) {
    // Reflect + proxy
    /**
     * 第三个参数receiver:
     * 如果target对象中指定了getter，
     * receiver则为getter调用时的this值，
     * 所以上文出现的this其实是这里的target对象，
     * 也就是那个reactive的proxy对象。
     */
    const res = Reflect.get(target, key, receiver); // target[key]
    const targetIsArray = isArray(target);
    // 没怎么看懂
    // if (!isReadonly) {
    //   if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
    //     return Reflect.get(arrayInstrumentations, key, receiver);
    //   }

    // if (key === 'hasOwnProperty') {
    //   return hasOwnProperty
    // }
    // }
    if (!isReadonly) {
      /**
       * 需要收集依赖
       * 当用户取值的时候，触发effect变更执行
       */
      track(target, TrackOpTypes.GET, key);
    }
    if (shallow) {
      return res;
    }
    /**
     * 这里是vue 2 和 vue3 的区别：
     * vue3在调用的时候才对调用的值proxy
     * 懒代理
     */
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res);
    }
    return res;
  };
}

/**
 * 通知所有依赖更新 类似dep.notify()
 */
function createSetter(hallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    let oldValue = target[key];
    /**
     * 如果是数组，且key是数字类型的字符串，走：
     * Number(key) < target.length true: 修改， false： 新增
     * 否则 hasOwn， true: 修改， false： 新增
     */
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key);
    const result = Reflect.set(target, key, value, receiver); // target[key] = value
    if (!hadKey) {
      // 新增
      trigger(target, TriggerOpTypes.ADD, key, value);
    } else if (hasChanged(value, oldValue)) {
      // 修改
      trigger(target, TriggerOpTypes.SET, key, value, oldValue);
    }
    return result;
  };
}

const get = /*#__PURE__*/ createGetter();
const shallowGet = /*#__PURE__*/ createGetter(false, true);
const readonlyGet = /*#__PURE__*/ createGetter(true);
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);

const set = /*#__PURE__*/ createSetter();
const shallowSet = /*#__PURE__*/ createSetter(true);
/**
 * new Proxy(target, baseHandlers)
 */
export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
};
// export const mutableHandlers: ProxyHandler<Record<any, any>> = {
//   get(target, key, recevier) {
//     // 代理对象的本身
//     if (key === ReactiveFlags.IS_REACTIVE) {
//       return true;
//     }
//     track(target, key);
//     // 这里取值了， 可以收集他在哪个effect中
//     const res = Reflect.get(target, key, recevier); // target[key]
//     return res;
//   },
//   set(target, key, value, recevier) {
//     let oldValue = (target as any)[key];
//     // 如果改变值了， 可以在这里触发effect更新
//     const res = Reflect.set(target, key, value, recevier); // target[key] = value

//     if (oldValue !== value) {
//       // 值不发生变化 effect不需要重新执行
//       trigger(target, key); // 找属性对应的effect让她重新执行
//     }
//     return res;
//   },
// };

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    console.warn(
      `Set operation on key "${String(key)}" failed: target is readonly.`,
      target
    );
    return true;
  },
};

export const shallowReactiveHandlers = /*#__PURE__*/ extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet,
  }
);

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers = /*#__PURE__*/ extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet,
  }
);
