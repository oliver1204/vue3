import { reactive } from '@vue/reactivity';
import { hasOwn, isFunction, isObject } from '@vue/shared';
export function createComponentInstance(vnode){
    const type = vnode.type; // 用户自己传入的属性
    const instance = {
        vnode, // 实例对应的虚拟节点
        type, // 组件对象
        subTree: null, // 组件渲染的内容   vue3中组件的vnode 就叫vnode  组件渲染的结果 subTree
        ctx: {}, // 组件上下文
        props: {}, // 组件属性
        attrs: {}, // 除了props中的属性 
        slots: {}, // 组件的插槽
        setupState: {}, // setup返回的状态
        propsOptions: type.props, // 属性选项
        proxy: null, // 实例的代理对象
        render:null, // 组件的渲染函数
        emit: null, // 事件触发
        exposed:{}, // 暴露的方法
        isMounted: false // 是否挂载完成
    }
    instance.ctx = {_:instance}; // 稍后会说 ， 后续会对他进行代理
    return instance;
}
export function initProps(instance,rawProps){
    const props = {};
    const attrs = {};
    const options = Object.keys(instance.propsOptions); // 用户注册过的, 校验类型
    if(rawProps){
        for(let key in rawProps){
            const value = rawProps[key];
            if(options.includes(key)){
                props[key] = value;
            }else{
                attrs[key] = value
            }
        }
    }
    instance.props = reactive(props);
    instance.attrs = attrs; // 这个attrs 是非响应式的
}

function createSetupContext(instance){
    return {
        attrs:instance.attrs,
        slots:instance.slots,
        emit:instance.emit,
        expose:(exposed) =>instance.exposed = exposed || {}
    }
}
const PublicInstanceProxyHandlers = {
    get({_:instance},key){
        const {setupState,props} = instance;  // 同名 props 和状态同名   通过proxy 可以直接访问状态和属性
        if(hasOwn(setupState,key)){
            return setupState[key];
        }else if(hasOwn(props,key)){
            return props[key];
        }else{
            // ....
        }
    },
    set({_:instance},key,value){
        const {setupState,props} = instance; // 属性不能修改
        if(hasOwn(setupState,key)){
             setupState[key] = value;
        }else if(hasOwn(props,key)){
            console.warn('Props are readonly')
            return false;
        }else{
            // ....
        }
        return true
    }
}
export function setupStatefulComponent(instance){
    // 核心就是调用组件的setup方法
    const Component = instance.type;
    const {setup} = Component;
    instance.proxy = new Proxy(instance.ctx,PublicInstanceProxyHandlers); // proxy就是代理的上下文
    if(setup){
        const setupContext = createSetupContext(instance);
        let setupResult = setup(instance.props,setupContext); /// 获取setup的返回值
        if(isFunction(setupResult)){
            instance.render = setupResult; // 如果setup返回的是函数那么就是render函数
        }else if(isObject(setupResult)){
            instance.setupState = setupResult;
        }
    }
    if(!instance.render){
        // 如果 没有render 而写的是template  可能要做模板编译  下个阶段 会实现如何将template -》 render函数 (耗性能)
        instance.render = Component.render; // 如果setup没有写render 那么就采用组件本身的render
    }
}

export function setupComponent(instance){
    const  {props,children} = instance.vnode;
    // 组件的props 做初始化  attrs也要初始化
    initProps(instance,props)
    // 插槽的初始化
    // initSlots(instance,children) ...
    setupStatefulComponent(instance); // 这个方法的目的就是调用setup函数 拿到返回值 给

}