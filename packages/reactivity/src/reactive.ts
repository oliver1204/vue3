import { isObject } from "@vue/shared";
import { track, trigger } from "./effect";
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers,
} from "./baseHandlers";

export const enum ReactiveFlags {
  SKIP = "__v_skip",
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly", //不具备响应式
  IS_SHALLOW = "__v_isShallow",
  RAW = "__v_raw", //不具备响应式
}

/**
 * 分类缓存代理过的对象
 */
export const reactiveMap = new WeakMap();
export const shallowReactiveMap = new WeakMap();
export const readonlyMap = new WeakMap();
export const shallowReadonlyMap = new WeakMap();
/**
 * map和weakMap的区别:
 * weakmap 弱引用   key必须是对象，如果key没有被引用可以被自动垃圾回收
 * 不会造成内存泄漏
 */
function createReactiveObject(
  target: object,
  isReadonly,
  baseHandlers,
  proxyMap
) {
  // reactiveApi 只针对对象才可以
  if (!isObject(target)) {
    return target;
  }
  // 先默认认为这个target已经是代理过的属性了
  // if (target[ReactiveFlags.IS_REACTIVE]) {
  //   return target;
  // }
  // 如果缓存中有， 说明target已经是代理过的属性了， 直接使用上次代理的结果
  const exisitingProxy = proxyMap.get(target);
  if (exisitingProxy) {
    return exisitingProxy;
  }
  // 当用户获取属性 或者更改属性的时候 我能劫持到
  const proxy = new Proxy(target, baseHandlers);
  // 将原对象和生成的代理对象 做一个缓存映射表
  proxyMap.set(target, proxy);

  return proxy; // 返回代理
}

/**
 * reactive ，readonly，shallowReactive， shallowReadonly区别：
 * 是不是只读，只不是深度
 * 核心都是实现响应式，所以可以通过传递参数来创建，也就是柯里化的思想
 * 所以创建了 createReactiveObject
 */

export function reactive(target: object) {
  return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}

export function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
}
export function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowReactiveMap
  );
}
export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyMap
  );
}
export function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}
