'use strict';
const updateNotifier = require('.');

// Run: $ node example

// You have to run this file two times the first time
// This is because it never reports updates on the first run
// If you want to test your own usage, ensure you set an older version

// 第一次之所以没有提示，是因为this.update = undefined

// 实际上这里两次也不一定会有提示，因为子进程的回调结束时间不一定，手速快的话第二次也没有提示

process.env.NODE_ENV = "DEV"; // 如果为test则不会提示

const u = updateNotifier({
	pkg: {
		name: 'vue',
		version: '0.2.1'
	},
	updateCheckInterval: -1
})

u.notify();

// u.fetchInfo().then(res => {
//   console.log(res);
// })