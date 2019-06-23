"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../debug/utils");
function getLaunchConfig(noDebug, path, testName, isGroup) {
    return {
        args: testName ? ["--name", makeRegexForTest(testName, isGroup)] : undefined,
        name: "Tests",
        noDebug,
        program: path,
        request: "launch",
        type: "dart",
    };
}
exports.getLaunchConfig = getLaunchConfig;
function makeRegexForTest(name, isGroup) {
    const prefix = "^";
    const suffix = isGroup ? "" : "$";
    // Require exact match (though for group, allow anything afterwards).
    return prefix + utils_1.escapeRegExp(name) + suffix;
}
exports.makeRegexForTest = makeRegexForTest;
//# sourceMappingURL=test.js.map