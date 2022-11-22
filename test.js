
// 1最好的情况 默认序列就是递增的  1 2 3 4 5 6 7  -> 0 1 2 3 4 5 6

function getSequence1(arr) {
    let len = arr.length;
    const result = [0]; // 这里放的是索引
    let lastIndex;
    // 1.直接看元素 如果比当前的末尾大直接追加即可  ok 1
    for (let i = 0; i < len; i++) {
        const arrI = arr[i]; // 存的每一项的值
        if (arrI !== 0) {
            lastIndex = result[result.length - 1]; // 获取结果集中的最后一个
            if (arr[lastIndex] < arrI) { // 当前结果集中的最后一个 和这一项比较
                result.push(i);
                continue
            }
        }
    }
    // [0,1,2,3]   [2,3,8,9]  // 用5找到  递增的序列为了快速查找我们可以采用二分查找的方式进行查找  O（n）  O(logn)
}




function getSequence2(arr) {
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
                p[i] = result[start-1]; // 用找到的索引 标记到p上

                result[start] = i;
            } // 找到更有潜力 替换之前的 （贪心算法 ）
        }
    }
    let i = result.length; // 拿到最后一个 开始向前追溯
    let last = result[i-1]; // 取出最后一个

    while(i-->0){ // 通过前驱节点找到正确的调用顺序
        result[i] = last; // 最后一项肯定是正确的
        last = p[last]; // 通过最后一项 向前查找
    }
    return result;
    // [0,1,2,3]   [2,3,8,9]  // 用5找到  递增的序列为了快速查找我们可以采用二分查找的方式进行查找  O（n）  O(logn)
}
console.log(getSequence2([2, 3,1,5,6,8,7,9,4]));// [0,1,4,3]

// 思路ok 1


// 求最长递增子序列的长度

// 2 3 8 9  5 6 7 1 12 22


// 找更有潜力的数值


// 2.如果比末尾小， 我们知道这个数值更有潜力， 就用替换的方式 找到当前序列中比这个元素大的值替换

// 1 3 5 6  7  12 22  这里面的长度是没为题的 而且最后一个 永远是对的  （现在采用这种方式算出的长度肯定是ok的）