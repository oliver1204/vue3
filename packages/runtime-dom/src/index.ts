
// 需要涵盖我们的 dom操作的api 属性操作的api  ， 将这些api 传入到 我们的runtime-core中

// runtime-core 在操作中不需要依赖于平台代码 （平台代码是被传入的）


// 我们在渲染页面的时候 需要节点操作的一列方法

import { createRenderer } from '@vue/runtime-core';
import { nodeOps } from './nodeOps';
import { patchProp } from './patchProp';

const renderOptions = Object.assign(nodeOps, { patchProp }); // 包含所需要的所有api


// 实现将renderOptions 传入到core中
// runtime-dom  在这层 对我们浏览器的操作做了一些

export const createApp = (component, rootProps = null) => {
    // 需要创建一个渲染器
    const { createApp } = createRenderer(renderOptions); // runtime-core中的方法
    let app = createApp(component, rootProps);
    let { mount } = app; // 获取core中mount
    app.mount = function (container) {  // 在重写mount
        container = nodeOps.querySelector(container);
        container.innerHTML = '';
        mount(container); // 处理节点后传入到mount中
    }
    return app;
}

export const createSSRApp = () =>{ 

}

// ..

// 12月12日班  周三周五晚 8-10  周日全天  直播课5个月 webpack react vue node

export * from '@vue/runtime-core'; // 导出这个模块中的所有代码  es6 模块规范