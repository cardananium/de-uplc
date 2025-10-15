//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node', // vscode extensions run in a Node.js-context

    node: {
        __dirname: false,
        __filename: false,
    },

    entry: {
        extension: './src/extension.ts',
        'wasm-worker-host-runner': './src/debugger/wasm-worker-host-runner.ts'
    },
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    experiments: {
        asyncWebAssembly: true,
    },
    devtool: 'source-map',
    externals: {
        vscode: 'commonjs vscode', // the vscode-module is created on-the-fly
    },
    resolve: {
        extensions: ['.ts', '.js', '.wasm']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: 'ts-loader'
            }
        ]
    }
};
module.exports = config;
