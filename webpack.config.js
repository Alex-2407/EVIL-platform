// ==================== WEBPACK CONFIG ====================
// Minifies CSS and JS for production performance

const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    // CSS entry
    'style.min': './css/style.css',
    // JS entries - minify the main JS files
    'auth-manager.min': './js/auth-manager.js',
    'progress-manager.min': './js/progress-manager.js',
    'achievement-manager.min': './js/achievement-manager.js'
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { importLoaders: 1 }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['cssnano', {
                    preset: ['default', {
                      discardComments: { removeAll: true },
                      normalizeWhitespace: true,
                      minifyFontValues: true,
                      minifyGradients: true
                    }]
                  }]
                ]
              }
            }
          }
        ]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css'
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log in production
            drop_debugger: true
          },
          mangle: true
        }
      })
    ]
  },
  resolve: {
    extensions: ['.js', '.css']
  }
};