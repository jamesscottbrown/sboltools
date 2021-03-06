
var path = require('path')
var nodeExternals = require('webpack-node-externals');
var webpack = require('webpack');
var fs = require('fs');

module.exports = {
    mode: 'development',
    entry: "./src/main.ts",
    target: 'node',
    //externals: [nodeExternals()],
    output: {
        filename: "sbol.js",
        path: __dirname
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".js", ".json"]
    },

    module: {
        rules: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: "awesome-typescript-loader" // 1
                    }
                ]
            },

            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    },

    // When importing a module whose path matches one of the following, just
    // assume a corresponding global variable exists and use that instead.
    // This is important because it allows us to avoid bundling all of our
    // dependencies, which allows browsers to cache those libraries between builds.
    externals: {
        //"react": "React",
        //"react-dom": "ReactDOM"
    }

}

