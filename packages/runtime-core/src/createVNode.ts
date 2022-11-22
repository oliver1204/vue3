import { isObject, isString, ShapeFlags } from "@vue/shared";
export function createVNode(type, props, children = null) {
  // h('div',{},['helloolifer','helloolifer'])

  // 虚拟节点就是 用一个对象来描述信息的

  // & |
  const shapeFlag = isObject(type)
    ? ShapeFlags.COMPONENT
    : isString(type)
    ? ShapeFlags.ELEMENT
    : 0;

  const vnode = {
    // 跨平台
    __v_isVNode: true,
    type,
    shapeFlag,
    props,
    children,
    key: props && props.key, // key值
    component: null, // 如果是组件的虚拟节点要保存组件的实例
    el: null, // 虚拟节点对应的真实节点
  };
  if (children) {
    // 告诉此节点 是什么样的儿子
    // 稍后渲染虚拟节点的时候 可以判断儿子是数组 就循环渲染
    vnode.shapeFlag =
      vnode.shapeFlag |
      (isString(children)
        ? ShapeFlags.TEXT_CHILDREN
        : ShapeFlags.ARRAY_CHILDREN);
  }
  // vnode 就可以描述出来 当前他是一个什么样的节点 儿子是什么样的
  return vnode; // createApp(App)
}
export function isVNode(vnode) {
  return !!vnode.__v_isVNode;
}

export const Text = Symbol();
export function normalizeVNode(vnode) {
  if (isObject(vnode)) {
    return vnode;
  }
  return createVNode(Text, null, String(vnode));
}

export function isSameVNodeType(n1, n2) {
  // 比较类型是否一致 比较key是否一致
  return n1.type === n2.type && n1.key === n2.key;
}
