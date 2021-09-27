'use strict';
const updateNotifier = require('.');

// Run: $ node example

// You have to run this file two times the first time
// This is because it never reports updates on the first run
// If you want to test your own usage, ensure you set an older version

// 第一次之所以没有提示，是因为this.update = undefined

process.env.NODE_ENV = "DEV";

const u = updateNotifier({
	pkg: {
		name: 'vue',
		version: '0.1.1'
	},
	updateCheckInterval: 0 // 提示间隔为数字0，即始终提示（除了第一次）
})

u.notify();

// u.fetchInfo().then(res => {
//   console.log(res);
// })