"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeReset = 0;
const codeBlack = 30;
const codeRed = 31;
const codeGreen = 32;
const codeYellow = 33;
const codeBlue = 34;
const codeMagenta = 35;
const codeCyan = 36;
const codeWhite = 37;
const esc = (code) => `\u001B[${code}m`;
exports.black = (msg) => `${esc(codeBlack)}${msg}${esc(codeReset)}`;
exports.red = (msg) => `${esc(codeRed)}${msg}${esc(codeReset)}`;
exports.green = (msg) => `${esc(codeGreen)}${msg}${esc(codeReset)}`;
exports.yellow = (msg) => `${esc(codeYellow)}${msg}${esc(codeReset)}`;
exports.blue = (msg) => `${esc(codeBlue)}${msg}${esc(codeReset)}`;
exports.magenta = (msg) => `${esc(codeMagenta)}${msg}${esc(codeReset)}`;
exports.cyan = (msg) => `${esc(codeCyan)}${msg}${esc(codeReset)}`;
exports.white = (msg) => `${esc(codeWhite)}${msg}${esc(codeReset)}`;
exports.brightBlack = (msg) => `${esc(codeBlack + 60)}${msg}${esc(codeReset)}`;
exports.brightRed = (msg) => `${esc(codeRed + 60)}${msg}${esc(codeReset)}`;
exports.brightGreen = (msg) => `${esc(codeGreen + 60)}${msg}${esc(codeReset)}`;
exports.brightYellow = (msg) => `${esc(codeYellow + 60)}${msg}${esc(codeReset)}`;
exports.brightBlue = (msg) => `${esc(codeBlue + 60)}${msg}${esc(codeReset)}`;
exports.brightMagenta = (msg) => `${esc(codeMagenta + 60)}${msg}${esc(codeReset)}`;
exports.brightCyan = (msg) => `${esc(codeCyan + 60)}${msg}${esc(codeReset)}`;
exports.brightWhite = (msg) => `${esc(codeWhite + 60)}${msg}${esc(codeReset)}`;
exports.blackBackground = (msg) => `${esc(codeBlack + 60)}${msg}${esc(codeReset)}`;
exports.redBackground = (msg) => `${esc(codeRed + 10)}${msg}${esc(codeReset)}`;
exports.greenBackground = (msg) => `${esc(codeGreen + 10)}${msg}${esc(codeReset)}`;
exports.yellowBackground = (msg) => `${esc(codeYellow + 10)}${msg}${esc(codeReset)}`;
exports.blueBackground = (msg) => `${esc(codeBlue + 10)}${msg}${esc(codeReset)}`;
exports.magentaBackground = (msg) => `${esc(codeMagenta + 10)}${msg}${esc(codeReset)}`;
exports.cyanBackground = (msg) => `${esc(codeCyan + 10)}${msg}${esc(codeReset)}`;
exports.whiteBackground = (msg) => `${esc(codeWhite + 10)}${msg}${esc(codeReset)}`;
exports.brightBlackBackground = (msg) => `${esc(codeBlack + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightRedBackground = (msg) => `${esc(codeRed + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightGreenBackground = (msg) => `${esc(codeGreen + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightYellowBackground = (msg) => `${esc(codeYellow + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightBlueBackground = (msg) => `${esc(codeBlue + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightMagentaBackground = (msg) => `${esc(codeMagenta + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightCyanBackground = (msg) => `${esc(codeCyan + 60 + 10)}${msg}${esc(codeReset)}`;
exports.brightWhiteBackground = (msg) => `${esc(codeWhite + 60 + 10)}${msg}${esc(codeReset)}`;
//# sourceMappingURL=colors.js.map