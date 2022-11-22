import { isFunction } from "@vue/shared";
import {
  isTracking,
  ReactiveEffect,
  trackEffects,
  triggerEffects,
} from "./effect";

class ComputedRefImpl {
  public dep; // this.dep = undefined;
  public _dirty = true; // this._dirty = true;
  public __v_isRef = true;
  public effect; // 计算属性是依赖于effect的
  public _value;
  constructor(getter, public setter) {
    // 只有调用computed()才执行一次
    // 这里将计算属性包成一个effect
    // 这里 我给计算属性变成了effect ，那么计算属性中的属性会收集这个effect
    this.effect = new ReactiveEffect(getter, () => {
      // 稍后计算属性依赖的值变化 不要重新执行计算属性的effect，而是调用此函数
      if (!this._dirty) {
        this._dirty = true;
        triggerEffects(this.dep);
      }
    });
  }
  // 计算属性 转成es5 object.defineProperty
  get value() {
    // 取值时会走get方法
    if (isTracking()) {
      // 是否是在effect中取值的
      trackEffects(this.dep || (this.dep = new Set()));
    }
    if (this._dirty) {
      // 将结果缓存到this._value 这样就不用每次都run了
      this._value = this.effect.run();
      this._dirty = false;
    }
    return this._value;
  }
  set value(newValue) {
    this.setter(newValue); // 如果修改计算属性的值 就触发你自己的set方法
  }
}
export function computed(getterOrOptions) {
  const onlyGetter = isFunction(getterOrOptions);
  let getter;
  let setter;
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = () => {};
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  return new ComputedRefImpl(getter, setter);
}
