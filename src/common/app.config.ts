/**
 * Application Identity (Brand)
 *
 * Also note that the 'Brand' is used in the following places:
 *  - README.md               all over
 *  - package.json            app-slug and version
 *  - [public/manifest.json]  name, short_name, description, theme_color, background_color
 */
export const Brand = {
  Title: {
    Base: '数模工作台',
    Common: (process.env.NODE_ENV === 'development' ? '[DEV] ' : '') + '数模工作台',
  },
  Meta: {
    Description: '数模工作台，面向建模、写作、分析与多模型协作的智能工作平台。',
    SiteName: '数模工作台',
    ThemeColor: '#32383E',
    TwitterSite: '@enricoros',
  },
  URIs: {
    Home: 'https://big-agi.com',
    // App: 'https://get.big-agi.com',
    CardImage: 'https://big-agi.com/icons/card-dark-1200.png',
    OpenRepo: 'https://github.com/enricoros/big-agi',
    OpenProject: 'https://github.com/users/enricoros/projects/4',
    SupportInvite: 'https://discord.gg/MkH4qj2Jp9',
    // Twitter: 'https://www.twitter.com/enricoros',
    PrivacyPolicy: 'https://big-agi.com/privacy',
    TermsOfService: 'https://big-agi.com/terms',
  },
  Docs: {
    Public: (docPage: string) => `https://big-agi.com/docs/${docPage}`,
  },
  /**
   * 专用配置：是否显示个人 API Key 输入框。
   * 当设置为 false 时，全局隐藏所有 LLM 供应商的 API Key 输入。
   */
  ShowPersonalApiKeys: false,
} as const;
