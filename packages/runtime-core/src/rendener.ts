
// runtime-core  根平台无关的运行时  

import { ShapeFlags } from '@vue/shared'
import { ReactiveEffect } from '@vue/reactivity';
import { createAppAPI } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';
import { isSameVNodeType, normalizeVNode, Text } from './createVNode';
function getSequence(arr) {
    let len = arr.length;
    const result = [0]; // 这里放的是索引
    let p = arr.slice(0); // 用来记录前驱节点的索引， 用来追溯正确的顺序
    let lastIndex;
    let start;
    let end;
    let middle;
    // 1.直接看元素 如果比当前的末尾大直接追加即可  ok 1
    for (let i = 0; i < len; i++) {
        const arrI = arr[i]; // 存的每一项的值
        if (arrI !== 0) {
            lastIndex = result[result.length - 1]; // 获取结果集中的最后一个
            if (arr[lastIndex] < arrI) { // 当前结果集中的最后一个 和这一项比较

                // 记录当前前一个人索引
                p[i] = lastIndex;
                result.push(i);
                continue
            }
            // 二分查找 替换元素 
            start = 0;
            end = result.length - 1;
            while (start < end) { // start = end    0  3 = 1.5  二分查找
                middle = ((start + end) / 2) | 0; // 中间的索引 
                // 找到序列中间的索引， 通过索引找到对应的值
                if (arr[result[middle]] < arrI) {
                    start = middle + 1;
                } else {
                    end = middle;
                }
            }
            if (arrI < arr[result[start]]) { // 要替换成 5的索引

                // 这里在替换之前 应该让当前元素
                p[i] = result[start - 1]; // 用找到的索引 标记到p上

                result[start] = i;
            } // 找到更有潜力 替换之前的 （贪心算法 ）
        }
    }
    let i = result.length; // 拿到最后一个 开始向前追溯
    let last = result[i - 1]; // 取出最后一个

    while (i-- > 0) { // 通过前驱节点找到正确的调用顺序
        result[i] = last; // 最后一项肯定是正确的
        last = p[last]; // 通过最后一项 向前查找
    }
    return result;
    // [0,1,2,3]   [2,3,8,9]  // 用5找到  递增的序列为了快速查找我们可以采用二分查找的方式进行查找  O（n）  O(logn)
}
export function createRenderer(renderOptions) { // runtime-core   renderOptionsDOMAPI -> rootComponent -> rootProps -> container
    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        createComment: hostCreateComment,
        setText: hostSetText,
        setElementText: hostSetElementText,
        parentNode: hostParentNode,
        nextSibling: hostNextSibling,
    } = renderOptions;


    const setupRenderEffect = (initialVNode, instance, container) => {
        // 创建渲染effect

        // 核心就是调用render，数据变化 就重新调用render 
        const componentUpdateFn = () => {
            let { proxy } = instance; //  render中的参数
            if (!instance.isMounted) {
                // 组件初始化的流程
                // 调用render方法 （渲染页面的时候会进行取值操作，那么取值的时候会进行依赖收集 ， 收集对应的effect，稍后属性变化了会重新执行当前方法）
                const subTree = instance.subTree = instance.render.call(proxy, proxy); // 渲染的时候会调用h方法

                // 真正渲染组件 其实渲染的应该是subTree

                patch(null, subTree, container); // 稍后渲染完subTree 会生成真实节点之后挂载到subTree
                initialVNode.el = subTree.el
                instance.isMounted = true;
            } else {
                // 组件更新的流程 。。。
                // 我可以做 diff算法   比较前后的两颗树 

                const prevTree = instance.subTree;
                const nextTree = instance.render.call(proxy, proxy);
                patch(prevTree, nextTree, container); // 比较两棵树
            }
        }
        const effect = new ReactiveEffect(componentUpdateFn);
        // 默认调用update方法 就会执行componentUpdateFn
        const update = effect.run.bind(effect);
        update();
    }

    const mountComponent = (initialVNode, container) => { // 组件的挂载流程
        // 根据组件的虚拟节点 创造一个真实节点 ， 渲染到容器中
        // 1.我们要给组件创造一个组件的实例 
        const instance = initialVNode.component = createComponentInstance(initialVNode);
        // 2. 需要给组件的实例进行赋值操作
        setupComponent(instance); // 给实例赋予属性

        // 3.调用render方法实现 组件的渲染逻辑。 如果依赖的状态发生变化 组件要重新渲染
        // 数据和视图是双向绑定的 如果数据变化视图要更新 响应式原理 
        // effect  data  effect 可以用在组件中，这样数据变化后可以自动重新的执行effect函数
        setupRenderEffect(initialVNode, instance, container); // 渲染effect

    }
    const processComponent = (n1, n2, container) => {
        if (n1 == null) {
            // 组件的初始化
            mountComponent(n2, container);
        } else {
            // 组件的更新
        }
    }

    const mountChildren = (children, container) => {
        // 如果是一个文本 可以直接   el.textContnt = 文本2
        // ['文本1','文本2']   两个文本 需要 创建两个文本节点 塞入到我们的元素中

        for (let i = 0; i < children.length; i++) {
            const child = (children[i] = normalizeVNode(children[i]));
            patch(null, child, container); // 如果是文本需要特殊处理
        }
    }

    const mountElement = (vnode, container, anchor) => {
        // vnode中的children  可能是字符串 或者是数组  对象数组  字符串数组

        let { type, props, shapeFlag, children } = vnode; // 获取节点的类型 属性 儿子的形状 children

        let el = vnode.el = hostCreateElement(type)

        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, children)
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {  // 按位与
            mountChildren(children, el);
        }
        // 处理属性
        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key]); // 给元素添加属性
            }
        }
        hostInsert(el, container, anchor);
    }
    const patchProps = (oldProps, newProps, el) => {
        if (oldProps === newProps) return;

        for (let key in newProps) {
            const prev = oldProps[key];
            const next = newProps[key]; // 获取新老属性
            if (prev !== next) {
                hostPatchProp(el, key, prev, next);
            }
        }
        for (const key in oldProps) { // 老的有新的没有  移除老的
            if (!(key in newProps)) {
                hostPatchProp(el, key, oldProps[key], null);
            }
        }

    }

    const unmountChildren = (children) => {
        debugger;
        for (let i = 0; i < children.length; i++) {
            unmount(children[i])
        }
    }



    const patchKeyedChildren = (c1, c2, container) => {
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;
        let i = 0; // 从头开始比较

        // 1.sync from start 从头开始一个个孩子来比较 , 遇到不同的节点就停止了
        while (i <= e1 && i <= e2) { // 如果i 和 新的列表或者老的列表指针重合说明就比较完毕了
            const n1 = c1[i];
            const n2 = c2[i];

            if (isSameVNodeType(n1, n2)) { // 如果两个节点是相同节点 则需要递归比较孩子和自身的属性
                patch(n1, n2, container)
            } else {
                break;
            }
            i++;
        }
        // sync from end
        while (i <= e1 && i <= e2) { // 如果i 和 新的列表或者老的列表指针重合说明就比较完毕了
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVNodeType(n1, n2)) { // 如果两个节点是相同节点 则需要递归比较孩子和自身的属性
                patch(n1, n2, container)
            } else {
                break;
            }
            e1--;
            e2--
        }
        console.log(i, e1, e2); // 确定好了 头部 和 尾部相同的节点 定位到除了头部和尾部的节点

        // 3.common sequence + mount

        if (i > e1) { // 看i和e1 之间的关系 如果i 大于 e1  说明有新增的元素
            if (i <= e2) {  // i和 e2 之间的内容就是新增的

                const nextPos = e2 + 1;
                // 取e2 的下一个元素 如果下一个没有 则长度和当前c2长度相同  说明追加
                // 取e2 的下一个元素 如果下一个有 说明要在头部追加 则取出下一个节点作为参照物
                const anchor = nextPos < c2.length ? c2[nextPos].el : null;

                // 参照物的目的 要计算是向前插入还是向后插入
                while (i <= e2) {
                    patch(null, c2[i], container, anchor); // 没有参照物 就是appendChild
                    i++;
                }
            }

            // 4.common sequence + unmount
        } else if (i > e2) {   // 看一下 i 和 e2 的关系 如果 e2 比i小 说明 老的多新的少
            while (i <= e1) {
                // i 和 e1 之间的就是要删除的
                unmount(c1[i]);
                i++;
            }
        }

        // unknown sequence
        const s1 = i;  // s1 -> e1 老的孩子列表
        const s2 = i;  // s2 -> e2  新的孩子列表

        // 根据新的节点 创造一个映射表 ， 用老的列表去里面找有没有，如果有则复用，没有就删除。 最后新的多余在追加

        const keyToNewIndexMap = new Map(); // 这个目的是为了可以用老的来查看有没有新的
        for (let i = s2; i <= e2; i++) {
            const child = c2[i];
            keyToNewIndexMap.set(child.key, i)
        }

        const toBepatched = e2 - s2 + 1; // 4
        const newIndexToOldMapIndex = new Array(toBepatched).fill(0); // 最长递增子序列会用到这个列表  5 3 4 0




        // 拿老的去新的中查找

        // 找到一样的需要patch
        for (let i = s1; i <= e1; i++) { // 新的索引映射到老的索引的映射表
            const prevChild = c1[i]; // 拿到老的每一个节点
            let newIndex = keyToNewIndexMap.get(prevChild.key);
            if (newIndex == undefined) { // 删掉老的多余的
                unmount(prevChild)
            } else {
                newIndexToOldMapIndex[newIndex - s2] = i + 1;// 保证填的肯定不是0 , 0意味着添加了一个元素

                // 比较两个人的节点 
                patch(prevChild, c2[newIndex], container); // 填表后 还要比对属性和儿子
            }
        }

        // 在去移动需要移动的元素
        let queue = getSequence(newIndexToOldMapIndex); // 求出队列   [1,2]  1 ,2 不用动

        let j = queue.length - 1; // 拿到最长递增子序列的末尾索引
        for (let i = toBepatched - 1; i >= 0; i--) {
            let lastIndex = s2 + i; // h的索引
            let lastChild = c2[lastIndex];
            let anchor = lastIndex + 1 < c2.length ? c2[lastIndex + 1].el : null

            if (newIndexToOldMapIndex[i] == 0) { // 等于0的时候还没有真实节点，需要创建真实节点在插入
                patch(null, lastChild, container, anchor); // 创建一个h 插入到 f的前面
            } else {
                // 这里可以进行优化 问题出在可能有一些节点不需要移动，但是还是全部插入了一遍
                // 性能消耗， 最长递增子序列 减少dom的插入操作 
                if (i !== queue[j]) {
                    // 3 2 1 0  倒叙插入 所以  i的值 就是  3 2 1 0
                    hostInsert(lastChild.el, container, anchor); // 将列表倒序的插入
                }else{
                    j--; // 这里做了一个优化 表示元素不需要移动了
                }
            }
        }
    }

    const patchChildren = (n1, n2, el) => {
        const c1 = n1 && n1.children;
        const c2 = n2 && n2.children;
        const prevShapeFlag = n1.shapeFlag;
        const shapeFlag = n2.shapeFlag
        // c1 和 c2 儿子有哪些类型 
        // 1.之前是数组 ， 现在是文本   删除老的节点 ，用新的文本替换掉
        // 2.之前是数组 ， 现在也是数组  比较两个儿子列表的差异  （* diff算法）
        // 3.之前是文本， 现在是是空   直接删除老的即可

        // 4.之前是文本  现在也是文本 直接更新文本
        // 5.之前是文本 现在是数组  删除文本 新增儿子
        // 6之前是空  现在是文本 
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                unmountChildren(c1); // 1.
            }
            if (c1 !== c2) { // 4.
                hostSetElementText(el, c2);
            }
        } else {
            // 现在是数组 
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    patchKeyedChildren(c1, c2, el);
                } else {
                    // 之前是数组  空文本
                    unmountChildren(c1);
                }
            } else {
                // 之前是文本
                if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
                    hostSetElementText(el, '');
                }
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    mountChildren(c2, el);
                }
            }
        }
    }


    const patchElement = (n1, n2) => {
        let el = n2.el = n1.el; // 先比较元素 元素一致 则复用 
        const oldProps = n1.props || {}; // 复用后比较属性
        const newProps = n2.props || {};
        patchProps(oldProps, newProps, el);

        // 实现比较儿子  diff算法   我们的diff算法是同级别比较的

        patchChildren(n1, n2, el); // 用新的儿子n2 和 老的儿子n1 来进行比对  比对后更新容器元素

    }
    const processElement = (n1, n2, container, anchor) => { // 组件对应的返回值的初始化
        if (n1 == null) {
            // 初始化
            mountElement(n2, container, anchor);
        } else {
            // diff
            patchElement(n1, n2); // 更新两个元素之间的差异
        }

    }
    const processText = (n1, n2, container) => {
        if (n1 === null) {
            // 文本的初始化 
            let textNode = hostCreateText(n2.children);
            n2.el = textNode; // 要让虚拟节点和真实节点挂载上
            hostInsert(textNode, container)
        }
    }
    const unmount = (vnode) => {
        hostRemove(vnode.el); // 删除真实节点即可
    }
    const patch = (n1, n2, container, anchor = null) => {
        // 两个元素 完全没用关系 
        if (n1 && !isSameVNodeType(n1, n2)) { // n1 有值 再看两个是否是相同节点
            unmount(n1);
            n1 = null;
        }
        // 如果前后元素不一致 需要删除老的元素 换成新的元素


        if (n1 == n2) return;
        const { shapeFlag, type } = n2; // createApp(组件)

        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;

            default:
                if (shapeFlag & ShapeFlags.COMPONENT) {
                    processComponent(n1, n2, container);
                } else if (shapeFlag & ShapeFlags.ELEMENT) {
                    processElement(n1, n2, container, anchor);
                }
        }
    }
    const render = (vnode, container) => { // 将虚拟节点 转化成真实节点渲染到容器中
        // 后续还有更新 patch  包含初次渲染 还包含更新
        patch(null, vnode, container);// 后续更新 prevNode nextNode container
    }
    // 
    return {
        createApp: createAppAPI(render), // 创建一个api createApp
        render
    }
}