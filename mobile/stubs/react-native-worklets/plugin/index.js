// No-op Babel plugin stub.
// babel-preset-expo conditionally loads react-native-worklets/plugin when the
// package is resolvable. By providing this stub inside the project's own
// node_modules, we shadow any copy installed in a parent directory (which
// lacks @babel/core in its scope and causes a build failure). This stub
// returns an empty Babel plugin so babel-preset-expo continues normally.
module.exports = function reactNativeWorkletsPlugin() {
  return { visitor: {} };
};
