/**
 * 1. effect 中的所有属性都会发生收集依赖 -> track
 * 2. 当set依赖到的属性时， 会重新执行effect -> trigger
 */

import { isObject, isArray, extend, hasOwn, isIntegerKey } from "@vue/shared";
import { TrackOpTypes, TriggerOpTypes } from "./operations";

/**
 * effectStack:
 * 目的就是为了能保证我们effect执行的时候 可以存储正确的顺序
 * 之前每个effect都有一个id, 来源于全局变量uid = 0；
 * 每次new 一个新的effect id++,id越大，顺序有靠后
 * 现在用一个数组维护，则无需id了
 * 另外，下面的例子：一个activeEffect无法确定当前是哪个effect
    effect1(()=>{
        state.name   // effect1
        effect2(()=>{
            state.age; // effect2
        })
        state.address // effect2 显然不对
    })
    所以用effectStack， 调用入栈，执行完出栈
    vue3.2 改成下面这样
    while (parent) {
        if (parent === this) {
            return
        }
        parent = parent.parent
    }
 */
let effectStack = []; // 确保activeEffect是正确的
let activeEffect; // 记录当前活跃的Effect

function cleanupEffect(effect) {
  const { deps } = effect;
  for (let dep of deps) {
    // set 删除effect 让属性 删除掉对应的effect   name = []
    dep.delete(effect); // 让属性对应的effect移除掉，这样属性更新的时候 就不会触发这个effect重新执行了
  }
}
// 属性变化 触发的是 dep -> effect
// effect.deps = [] 和属性是没关系的
export class ReactiveEffect {
  active = true; // this.active = true;
  deps = []; // 让effect 记录他依赖了哪些属性 ， 同时要记录当前属性依赖了哪个effect
  constructor(public fn, public scheduler?) {
    this.fn = fn;
  }
  run() {
    // 调用run的时候会让fn执行
    if (!this.active) {
      // 稍后如果非激活状态 调用run方法 默认会执行fn函数
      return this.fn();
    }
    /**
     * 屏蔽同一个effect会多次执行
     * 试想：effect(()=>state.age++);
     * age一变化effect入栈出栈，这样肯定不好
     */
    if (!effectStack.includes(this)) {
      try {
        effectStack.push((activeEffect = this)); // 插入尾部
        return this.fn(); // 取值  new Proxy 会执行get方法  (依赖收集)
      } finally {
        effectStack.pop(); // 删除最后一个
        // 设置ctiveEffect是effectStack的最后一个
        activeEffect = effectStack[effectStack.length - 1];
      }
    }
  }
  stop() {
    // 让effect 和 dep 取消关联 dep上面存储的effect移除掉即可
    if (this.active) {
      cleanupEffect(this);
      this.active = false;
    }
  }
}
// obj name :[effect]
//     age : [effect]
// {对象：{属性 ： [effect,effect]}  }
export function isTracking() {
  return activeEffect !== undefined;
}

/**
 * 让target对象中的属性收集对应的effect
 * {name: 'ol', age: 1} => name 对应 [effect1, effect2]
 * 原理就是 生成一个weakMap (targetMap)
 * key => {name: 'ol', age: 1}
 * value 也是一个weakMap => {name: [effect1, effect2]}
 */
const targetMap = new WeakMap();
export function track(target, type, key) {
  // 一个属性对应多个effect， 一个effect中依赖了多个属性 =》 多对多
  // 是只要取值我就要收集吗？
  if (!isTracking()) {
    // 如果这个属性 不依赖于effect直接跳出即可
    return;
  }
  // target对象是否在收集map,targetMap中了,
  let depsMap = targetMap.get(target);
  // 如果没有收集，收集 {{name: 'ol', age: 1} => new Map()}
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map())); // {对象：map{}}
  }
  // depsMap 是否有key(此例子中的name)
  let dep = depsMap.get(key);
  // 处理value值： {name: new Set()}
  // 用set防止重复收集依赖，比如state.name, state.name, 联系赋值，那么只收集一次
  if (!dep) {
    depsMap.set(key, (dep = new Set())); // {对象：map{name:set[]}}
  }
  trackEffects(dep);
}
export function trackEffects(dep) {
  let shouldTrack = !dep.has(activeEffect); // 看一下这个属性有没有存过这个effect
  if (shouldTrack) {
    dep.add(activeEffect); // // {对象：map{name:set[effect,effect]}}
    activeEffect.deps.push(dep); // 稍后用到
  } // { 对象：{name:set,age:set}
}
/**
 * 先将所有effect都收集到deps中，在统一触发更新
 */
export function trigger(target, type, key?, newValue?, oldValue?, oldTarget?) {
  let depsMap = targetMap.get(target);
  if (!depsMap) return; // 属性修改的属性 根本没有依赖任何的effect
  let deps = []; // [set ,set ]
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()];
  } else if (key === "length" && isArray(target)) {
    const newLength = Number(newValue); // newValue一定是数字
    depsMap.forEach((dep, key) => {
      // // 数组长度变短了, 原来 arr = [1, 2, 3];现在 arr.length = 1;
      // 此时也需要收集依赖
      if (key === "length" || key >= newLength) {
        deps.push(dep);
      }
    });
  } else {
    // 除了数组以外的情况
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }
    // 对数组的索引处理
    switch (type) {
      case TriggerOpTypes.ADD:
        if (isArray(target) && isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get("length"));
        }
        // map 处理
        //   if (!isArray(target)) {
        //     deps.push(depsMap.get(ITERATE_KEY))
        //     if (isMap(target)) {
        //       deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
        //     }
        //   }
        break;
    }
  }

  let effects = [];
  for (const dep of deps) {
    effects.push(...dep);
  }
  triggerEffects(effects);
}
export function triggerEffects(dep) {
  for (const effect of dep) {
    // 如果当前effect执行 和 要执行的effect是同一个，不要执行了 防止循环
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        return effect.scheduler();
      }
      effect.run(); // 执行effect
    }
  }
}

export function effect(fn, options?) {
  if (fn.effect) {
    fn = fn.effect.fn;
  }

  const _effect = new ReactiveEffect(fn);
  if (options) {
    extend(_effect, options);
  }
  if (!options || !options.lazy) {
    _effect.run(); // 会默认让fn执行一次
  }
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect; // 给runner添加一个effect实现 就是 effect实例
  return runner;
}

// vue3 的响应式原理  取值时 收集对应的effect， 改值时找到对应的effect执行
export let shouldTrack = true;
const trackStack: boolean[] = [];
export function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}

export function enableTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = true;
}

export function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === undefined ? true : last;
}
