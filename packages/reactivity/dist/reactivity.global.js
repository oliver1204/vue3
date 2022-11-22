var VueReactivity = (function (exports) {
    'use strict';

    // effect1(()=>{
    //     state.name
    //     effect2(()=>{
    //         state.age;
    //     })
    //     state.address
    // })
    // // effectStack = [effect1] activeEffect = effect1
    // // effect1 -> name
    // // effect2 -> age
    // // effect1 -> address
    let effectStack = []; // 目的就是为了能保证我们effect执行的时候 可以存储正确的关系
    let activeEffect;
    function cleanupEffect(effect) {
        const { deps } = effect;
        for (let dep of deps) {
            // set 删除effect 让属性 删除掉对应的effect   name = []
            dep.delete(effect); // 让属性对应的effect移除掉，这样属性更新的时候 就不会触发这个effect重新执行了
        }
    }
    // 属性变化 触发的是 dep -> effect
    // effect.deps = [] 和属性是没关系的
    class ReactiveEffect {
        constructor(fn, scheduler) {
            this.fn = fn;
            this.scheduler = scheduler;
            this.active = true; // this.active = true;
            this.deps = []; // 让effect 记录他依赖了哪些属性 ， 同时要记录当前属性依赖了哪个effect
        }
        run() {
            if (!this.active) { // 稍后如果非激活状态 调用run方法 默认会执行fn函数
                return this.fn();
            }
            if (!effectStack.includes(this)) { // 屏蔽同一个effect会多次执行
                try {
                    effectStack.push(activeEffect = this);
                    return this.fn(); // 取值  new Proxy 会执行get方法  (依赖收集)
                }
                finally {
                    effectStack.pop(); // 删除最后一个
                    activeEffect = effectStack[effectStack.length - 1];
                }
            }
        }
        stop() {
            if (this.active) {
                cleanupEffect(this);
                this.active = false;
            }
        }
    }
    // obj name :[effect]
    //     age : [effect]
    // {对象：{属性 ： [effect,effect]}  } 
    function isTracking() {
        return activeEffect !== undefined;
    }
    const targetMap = new WeakMap();
    function track(target, key) {
        // 是只要取值我就要收集吗？
        if (!isTracking()) { // 如果这个属性 不依赖于effect直接跳出即可
            return;
        }
        let depsMap = targetMap.get(target);
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map())); // {对象：map{}}
        }
        let dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set())); // {对象：map{name:set[]}}
        }
        trackEffects(dep);
    }
    function trackEffects(dep) {
        let shouldTrack = !dep.has(activeEffect); // 看一下这个属性有没有存过这个effect
        if (shouldTrack) {
            dep.add(activeEffect); // // {对象：map{name:set[effect,effect]}}
            activeEffect.deps.push(dep); // 稍后用到
        } // { 对象：{name:set,age:set}
    }
    function trigger(target, key) {
        let depsMap = targetMap.get(target);
        if (!depsMap)
            return; // 属性修改的属性 根本没有依赖任何的effect
        let deps = []; // [set ,set ]
        if (key !== undefined) {
            deps.push(depsMap.get(key));
        }
        let effects = [];
        for (const dep of deps) {
            effects.push(...dep);
        }
        triggerEffects(effects);
    }
    function triggerEffects(dep) {
        for (const effect of dep) { // 如果当前effect执行 和 要执行的effect是同一个，不要执行了 防止循环
            if (effect !== activeEffect) {
                if (effect.scheduler) {
                    return effect.scheduler();
                }
                effect.run(); // 执行effect
            }
        }
    }
    function effect(fn) {
        const _effect = new ReactiveEffect(fn);
        _effect.run(); // 会默认让fn执行一次
        let runner = _effect.run.bind(_effect);
        runner.effect = _effect; // 给runner添加一个effect实现 就是 effect实例
        return runner;
    }
    // vue3 的响应式原理  取值时 收集对应的effect， 改值时找到对应的effect执行

    function isObject(value) {
        return typeof value === 'object' && value !== null;
    }
    function isFunction(value) {
        return typeof value === 'function';
    }

    const mutableHandlers = {
        get(target, key, recevier) {
            if (key === "__v_isReactive" /* IS_REACTIVE */) {
                return true;
            }
            track(target, key);
            // 这里取值了， 可以收集他在哪个effect中
            const res = Reflect.get(target, key, recevier); // target[key]
            return res;
        },
        set(target, key, value, recevier) {
            let oldValue = target[key];
            // 如果改变值了， 可以在这里触发effect更新
            const res = Reflect.set(target, key, value, recevier); // target[key] = value
            if (oldValue !== value) { // 值不发生变化 effect不需要重新执行
                trigger(target, key); // 找属性对应的effect让她重新执行
            }
            return res;
        }
    };
    // map和weakMap的区别
    const reactiveMap = new WeakMap(); // weakmap 弱引用   key必须是对象，如果key没有被引用可以被自动销毁
    function createReactiveObject(target) {
        // 先默认认为这个target已经是代理过的属性了
        if (target["__v_isReactive" /* IS_REACTIVE */]) {
            return target;
        }
        // reactiveApi 只针对对象才可以 
        if (!isObject(target)) {
            return target;
        }
        const exisitingProxy = reactiveMap.get(target); // 如果缓存中有 直接使用上次代理的结果
        if (exisitingProxy) {
            return exisitingProxy;
        }
        const proxy = new Proxy(target, mutableHandlers); // 当用户获取属性 或者更改属性的时候 我能劫持到
        reactiveMap.set(target, proxy); // 将原对象和生成的代理对象 做一个映射表
        return proxy; // 返回代理
    }
    function reactive(target) {
        return createReactiveObject(target);
    }
    function toReactive(value) {
        return isObject(value) ? reactive(value) : value;
    }
    // readonly shallowReactive shallowReadnly 
    // export function readonly(){
    // }
    // export function shallowReactive(){
    // }
    // export function shallowReadnly(){
    // }

    class ComputedRefImpl {
        constructor(getter, setter) {
            this.setter = setter;
            this._dirty = true; // this._dirty = true;
            this.__v_isRef = true;
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
        get value() {
            if (isTracking()) { // 是否是在effect中取值的
                trackEffects(this.dep || (this.dep = new Set));
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
    function computed(getterOrOptions) {
        const onlyGetter = isFunction(getterOrOptions);
        let getter;
        let setter;
        if (onlyGetter) {
            getter = getterOrOptions;
            setter = () => { };
        }
        else {
            getter = getterOrOptions.get;
            setter = getterOrOptions.set;
        }
        return new ComputedRefImpl(getter, setter);
    }

    class RefImpl {
        constructor(_rawValue) {
            this._rawValue = _rawValue;
            // _rawValue如果用户传进来的值 是一个对象 我需要将对象转化成响应式
            this._value = toReactive(_rawValue);
        }
        // 类的属性访问器 最终会变成deifneProperty
        get value() {
            if (isTracking()) {
                trackEffects(this.dep || (this.dep = new Set()));
                console.log(this.dep);
            }
            return this._value;
        }
        set value(newValue) {
            if (newValue !== this._rawValue) {
                // 先看一下之前之后是否一样
                this._rawValue = newValue;
                this._value = toReactive(newValue);
                triggerEffects(this.dep);
            }
        }
    }
    function createRef(value) {
        return new RefImpl(value);
    }
    function ref(value) {
        return createRef(value);
    }
    // export function shallowRef(value){
    //   return createRef(value,true);
    // }
    // reactive readonly

    exports.computed = computed;
    exports.effect = effect;
    exports.reactive = reactive;
    exports.ref = ref;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=reactivity.global.js.map
