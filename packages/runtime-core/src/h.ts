import { isObject } from "@vue/shared";
import { isVNode, createVNode } from "./createVNode";

export function h(type, propsOrChildren, children) {
    // 写法1.  h('div',{color:red})
    // 写法2.  h('div',h('span'))
    // 写法3   h('div','hello')
    // 写法4：  h('div',['hello','hello'])
    let l = arguments.length;
    if (l === 2) {
        if (isObject(propsOrChildren) && !Array.isArray(propsOrChildren)) {
            if (isVNode(propsOrChildren)) {
                return createVNode(type, null, [propsOrChildren])//  h('div',h('span'))
            }
            return createVNode(type, propsOrChildren);  //  h('div',{color:red})
        } else {
            return createVNode(type, null, propsOrChildren); // h('div','hello')   h('div',['hello','hello'])
        }
    } else {
        if (l > 3) {
            children = Array.prototype.slice.call(arguments, 2);
        } else if (l === 3 && isVNode(children)) {
            children = [children]
        }
        return createVNode(type, propsOrChildren, children);
    }
    // h('div',{},'孩子')
    // h('div',{},['孩子','孩子','孩子'])
    // h('div',{},[h('span'),h('span'),h('span')])
}