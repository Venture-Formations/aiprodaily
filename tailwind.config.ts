import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1877F2',
          secondary: '#42B883',
          accent: '#FF6B6B',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
export default config