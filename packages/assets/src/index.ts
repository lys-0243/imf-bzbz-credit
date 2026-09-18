export const colors = {
  primary: {
    red: '#9a1c20',
    blue: '#284080',
  },
  secondary: {
    yellow: '#f4df3c',
    green: '#2ab24b',
  },
  neutral: {
    background: '#f6f4ef',
    surface: '#ffffff',
    text: '#111111',
    textMuted: '#555555',
    textHint: '#777777',
    border: '#cccccc',
    placeholder: '#999999',
  },
} as const;

/** Font family names registered with expo-font / useFonts */
export const fonts = {
  light: 'NeutrifPro-Light',
  lightItalic: 'NeutrifPro-LightItalic',
  regular: 'NeutrifPro-Regular',
  regularItalic: 'NeutrifPro-RegularItalic',
  medium: 'NeutrifPro-Medium',
  mediumItalic: 'NeutrifPro-MediumItalic',
  semiBold: 'NeutrifPro-SemiBold',
  semiBoldItalic: 'NeutrifPro-SemiBoldItalic',
  bold: 'NeutrifPro-Bold',
  boldItalic: 'NeutrifPro-BoldItalic',
} as const;

/** Map for expo-font `useFonts` */
export const fontSources = {
  [fonts.light]: require('../fonts/NeutrifPro-Light.ttf'),
  [fonts.lightItalic]: require('../fonts/NeutrifPro-LightItalic.ttf'),
  [fonts.regular]: require('../fonts/NeutrifPro-Regular.ttf'),
  [fonts.regularItalic]: require('../fonts/NeutrifPro-RegularItalic.ttf'),
  [fonts.medium]: require('../fonts/NeutrifPro-Medium.ttf'),
  [fonts.mediumItalic]: require('../fonts/NeutrifPro-MediumItalic.ttf'),
  [fonts.semiBold]: require('../fonts/NeutrifPro-SemiBold.ttf'),
  [fonts.semiBoldItalic]: require('../fonts/NeutrifPro-SemiBoldItalic.ttf'),
  [fonts.bold]: require('../fonts/NeutrifPro-Bold.ttf'),
  [fonts.boldItalic]: require('../fonts/NeutrifPro-BoldItalic.ttf'),
};

export const images = {
  logo: require('../images/logo.png'),
  logoJpg: require('../images/logo.jpg'),
  login: require('../images/login.jpg'),
};
