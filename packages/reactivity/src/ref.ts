import { isTracking, trackEffects, triggerEffects } from "./effect";
import { toReactive } from "./reactive";
import { isArray } from "@vue/shared";

// const count = ref(0)
// console.log(count.value) // 0

// count.value++
// console.log(count.value) // 1

/**
 * ref 将一个普通对象转化为深度响应。
 * ref 内部实际使用的是defineProperty,这是和reactive的一个区别
 */

class RefImpl {
  public dep;
  public __v_isRef;
  public _value;
  constructor(public _rawValue) {
    // 原来的值
    // _rawValue如果用户传进来的值 是一个对象 我需要将对象转化成响应式
    this._value = toReactive(_rawValue);
  }

  // 类的属性访问器 最终会变成deifneProperty
  get value() {
    // 取值的时候进行依赖收集
    if (isTracking()) {
      trackEffects(this.dep || (this.dep = new Set()));
    }
    return this._value;
  }
  set value(newValue) {
    // 设置的时候触发更新
    if (newValue !== this._rawValue) {
      // 先看一下之前之后是否一样
      this._rawValue = newValue;
      this._value = toReactive(newValue);
      triggerEffects(this.dep); // 触发更新
    }
  }
}

function createRef(value) {
  return new RefImpl(value);
}

export function ref(value) {
  return createRef(value);
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true;

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K]
  ) {}

  get value() {
    const val = this._object[this._key];
    return val === undefined ? (this._defaultValue as T[K]) : val;
  }

  set value(newVal) {
    this._object[this._key] = newVal;
  }
}

/**
 * 将一个对象的属性转出响应式
 const state = reactive({
  foo: 1,
  bar: 2
})

const fooRef = toRef(state, 'foo')
state必须是reactive
*/
export function toRef(object, key, defaultValue?) {
  return new ObjectRefImpl(object, key, defaultValue);
}
/**
 * 结构时候常用到
const state = reactive({
  foo: 1,
  bar: 2
})
const {foo, bar} = toRefs(state);
 */

export function toRefs(object) {
  const ret: any = isArray(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}

// export function shallowRef(value){
//   return createRef(value,true);
// }

// reactive readonly
