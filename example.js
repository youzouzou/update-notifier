'use strict';
const updateNotifier = require('.');

// Run: $ node example

// You have to run this file two times the first time
// This is because it never reports updates on the first run
// If you want to test your own usage, ensure you set an older version

const u = updateNotifier({
	pkg: {
		name: 'webpack',
		version: '0.9.2'
	},
	updateCheckInterval: 0
})

// u.notify();

u.fetchInfo().then(res => {
  console.log(res);
})
