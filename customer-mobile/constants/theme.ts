export const LightTheme = {
  colors: {
    background: "#F8F5F2",
    primary: "#007A53",
    orange: "#FF6720",
    red: "#DA291C",
    surface: "#FFFFFE",

    // primary: "#078080",
    primaryDark: "#056666",

    secondary: "#F45D48",

    headline: "#232323",
    paragraph: "#222525",
    muted: "#777777",

    border: "#E5E2DE",

    success: "#2E8B57",
    error: "#D64545",

    tabBar: "#FFFFFE",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
};

export const DarkTheme = {
  colors: {
    background: "#121212",
    surface: "#1E1E1E",

    primary: "#078080",
    primaryDark: "#056666",

    secondary: "#F45D48",

    headline: "#FFFFFF",
    paragraph: "#E5E5E5",
    muted: "#A0A0A0",

    border: "#2E2E2E",

    success: "#4CAF50",
    error: "#FF5C5C",
    red: "#FF5C5C",

    tabBar: "#1E1E1E",
  },

  spacing: LightTheme.spacing,
  radius: LightTheme.radius,
  fontSize: LightTheme.fontSize,
};

/*Background     #F8F5F2  → warm cream
Surface        #FFFFFE  → cards / tab bar
Primary        #078080  → active tabs, buttons
Primary Dark   #056666  → pressed/hover states
Secondary      #F45D48  → alerts, badges, important actions
Headline       #232323  → headings
Paragraph      #222525  → normal text
Muted          #777777  → secondary text
Border         #E5E2DE  → borders/dividers
Success        #2E8B57
Error          #D64545 */
