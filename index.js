'use strict';
const { spawn } = require('child_process'); // child_process是node的核心模块，spawn可以开启一个子进程
const path = require('path'); // 处理文件路径的包
const { format } = require('util'); // 格式化字符串工具
const importLazy = require('import-lazy')(require); // 懒加载模块

const configstore = importLazy('configstore'); // 一个加载配置的工具，会在用户配置目录下生成对应的json文件
const chalk = importLazy('chalk'); // 控制台字体样式
const semver = importLazy('semver'); // 语义化版本工具
const semverDiff = importLazy('semver-diff'); // 版本比较工具
const latestVersion = importLazy('latest-version'); // 用于获取最新版本的 npm 包
const isNpm = importLazy('is-npm'); // 检查是否是用npm或yarn安装工具
const isInstalledGlobally = importLazy('is-installed-globally'); // 检查包是否是全局安装的
const isYarnGlobal = importLazy('is-yarn-global'); // 检查包是否通过yarn全局安装
const hasYarn = importLazy('has-yarn'); // 检查包是否通过yarn安装
const boxen = importLazy('boxen'); // 在控制台打印出方框的工具
const xdgBasedir = importLazy('xdg-basedir'); // linux平台下的,获取 XDG 基本目录路径的工具
const isCi = importLazy('is-ci'); // 检测当前环境是否为 CI 服务器(持续集成服务器)
const pupa = importLazy('pupa'); // 模板字符串工具

const ONE_DAY = 1000 * 60 * 60 * 24;

class UpdateNotifier {
  constructor(options = {}) {
    this.options = options;
    options.pkg = options.pkg || {};
    options.distTag = options.distTag || 'latest';

    // Reduce pkg to the essential keys. with fallback to deprecated options
    // TODO: Remove deprecated options at some point far into the future
    options.pkg = {
      name: options.pkg.name || options.packageName,
      version: options.pkg.version || options.packageVersion
    };

    if (!options.pkg.name || !options.pkg.version) {
      throw new Error('pkg.name and pkg.version required');
    }

    this.packageName = options.pkg.name;
    this.packageVersion = options.pkg.version;
    this.updateCheckInterval = typeof options.updateCheckInterval === 'number' ? options.updateCheckInterval : ONE_DAY;
    // process.env 属性返回包含用户环境的对象
    // （1）node设置了NO_UPDATE_NOTIFIER环境变量；
    // （2）node设置了NODE_ENV变量为test；
    // （3）node运行参数里有--no-update-notifier；
    // （4）运行环境为CI服务器（持续集成服务器）时。
    // 以上4种情况，则disabled为true，就不会继续检查包是否是最新版本
    this.disabled = 'NO_UPDATE_NOTIFIER' in process.env ||
      process.env.NODE_ENV === 'test' ||
      process.argv.includes('--no-update-notifier') ||
      isCi();
    // shouldNotifyInNpmScript：允许在作为 npm 脚本运行时显示通知
    this.shouldNotifyInNpmScript = options.shouldNotifyInNpmScript;

    if (!this.disabled) {
      try {
        const ConfigStore = configstore();
        this.config = new ConfigStore(`update-notifier-${this.packageName}`, {
          optOut: false,
          // 翻译：使用当前时间初始化，第一次的时候不会去做检查，以免打扰用户
          // Init with the current time so the first check is only
          // after the set interval, so not to bother users right away
          lastUpdateCheck: Date.now()
        });
      } catch {
        // Expecting error code EACCES or EPERM
        const message =
          chalk().yellow(format(' %s update check failed ', options.pkg.name)) +
          format('\n Try running with %s or get access ', chalk().cyan('sudo')) +
          '\n to the local update config store via \n' +
          chalk().cyan(format(' sudo chown -R $USER:$(id -gn $USER) %s ', xdgBasedir().config));

        process.on('exit', () => {
          console.error(boxen()(message, { align: 'center' }));
        });
      }
    }
  }

  check() {
    if (
      !this.config ||
      this.config.get('optOut') ||
      this.disabled
    ) {
      return;
    }

    this.update = this.config.get('update');

    console.log(111, this.config, this.update);

    if (this.update) {
      // Use the real latest version instead of the cached one
      this.update.current = this.packageVersion;

      // Clear cached information
      this.config.delete('update');
    }

    // 在一定时间间隔内不会再提示，以免打扰用户
    // Only check for updates on a set interval
    if (Date.now() - this.config.get('lastUpdateCheck') < this.updateCheckInterval) {
      return;
    }

    // 翻译：开启子进程，并将options作为环境变量进行传递
    // Spawn a detached process, passing the options as an environment property
    spawn(process.execPath, [path.join(__dirname, 'check.js'), JSON.stringify(this.options)], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }

  // 异步获取最新版本信息
  async fetchInfo() {
    const { distTag } = this.options;
    const latest = await latestVersion()(this.packageName, { version: distTag });

    return {
      latest,
      current: this.packageVersion,
      type: semverDiff()(this.packageVersion, latest) || distTag,
      name: this.packageName
    };
  }

  notify(options) {
    const suppressForNpm = !this.shouldNotifyInNpmScript && isNpm().isNpmOrYarn; // 如果使用的是npm或yarn，且配置了不允许通知，则不用继续往下了
    if (!process.stdout.isTTY){
      console.log(1)
    }
    if (suppressForNpm) {
      console.log(2, this.shouldNotifyInNpmScript, isNpm().isNpmOrYarn)
    }
    if (!this.update) {
      console.log(3, this.update)
    } else if (!semver().gt(this.update.latest, this.update.current)) {
      console.log(4)
    }


    if (!process.stdout.isTTY || suppressForNpm || !this.update || !semver().gt(this.update.latest, this.update.current)) {
      return this;
    }

    console.log(666)

    options = {
      isGlobal: isInstalledGlobally(),
      isYarnGlobal: isYarnGlobal()(),
      ...options
    };

    let installCommand; // 提示安装语句
    if (options.isYarnGlobal) { // 如果这个包是用yarn全局安装的
      installCommand = `yarn global add ${this.packageName}`;
    } else if (options.isGlobal) { // 如果这个包是npm全局安装的
      installCommand = `npm i -g ${this.packageName}`;
    } else if (hasYarn()()) { // 如果不是全局安装的，而且配置了yarn
      installCommand = `yarn add ${this.packageName}`;
    } else { // 如果不是全局安装的，也没有yarn，那么就提示用npm
      installCommand = `npm i ${this.packageName}`;
    }

    // 提示模板，提示从当前版本更新到最新模板
    const defaultTemplate = 'Update available ' +
      chalk().dim('{currentVersion}') +
      chalk().reset(' → ') +
      chalk().green('{latestVersion}') +
      ' \nRun ' + chalk().cyan('{updateCommand}') + ' to update';

    const template = options.message || defaultTemplate;

    options.boxenOptions = options.boxenOptions || {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: 'yellow',
      borderStyle: 'round'
    };

    // 用方框把提示语句包起来
    const message = boxen()(
      // 用pupa填充模板语句里的内容， 包括包名，当前版本，最新版本，安装提示
      pupa()(template, {
        packageName: this.packageName,
        currentVersion: this.update.current,
        latestVersion: this.update.latest,
        updateCommand: installCommand
      }),
      options.boxenOptions
    );

    if (options.defer === false) { // defer为true时等进程退出后再通知，false时则直接通知
      console.error(message);
    } else { // 等进程退出时再通知
      process.on('exit', () => {
        console.error(message);
      });

      process.on('SIGINT', () => { // 键盘中断事件，也会打印提示
        console.error('');
        process.exit();
      });
    }

    return this;
  }
}

module.exports = options => {
  const updateNotifier = new UpdateNotifier(options);
  updateNotifier.check();
  return updateNotifier;
};

module.exports.UpdateNotifier = UpdateNotifier;
