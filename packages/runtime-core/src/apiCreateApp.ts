import { createVNode } from "./createVNode";

export function createAppAPI(render) {
    return (rootComponent, rootProps) => {
        let isMounted = false;
        const app = {
            mount(container) {
                // 1.创造组件虚拟节点 
                let vnode = createVNode(rootComponent, rootProps); // h函数
                // 2.挂载的核心就是根据传入的组件对象 创造一个组件的虚拟节点 ，在将这个虚拟节点渲染到容器中
                render(vnode, container)
                if (!isMounted) {
                    isMounted = true;
                }
            }
        }
        return app
    }
}
