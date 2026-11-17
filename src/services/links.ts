import type { Locale } from './settings.js'

/** 项目仓库地址：页脚与设置「关于」共用，改这里即可同步所有入口 */
export const REPO_URL = 'https://github.com/darrindeyoung791/ds-chat-demo'

/** DeepSeek 官方用户协议；按界面语言指向对应版本 */
export const termsUrl = (locale: Locale) =>
  `https://cdn.deepseek.com/policies/${locale}/deepseek-terms-of-use.html`
