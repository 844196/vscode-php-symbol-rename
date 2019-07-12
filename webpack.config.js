module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: `${__dirname}/dist`,
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  module: {
    rules: [{ test: /\.ts$/, exclude: /node_modules/, use: 'ts-loader' }],
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  externals: {
    vscode: 'commonjs vscode',
  },
};
