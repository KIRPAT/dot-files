"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./debug/utils");
const iconUrlFormat = "https://raw.githubusercontent.com/Dart-Code/Icons/master/material/$1%402x.png";
const iconRegex = new RegExp(`(?:${utils_1.escapeRegExp("<p>")})?`
    + utils_1.escapeRegExp('<i class="material-icons md-36">')
    + "([\\w\\s_]+)"
    + utils_1.escapeRegExp('</i> &#x2014; material icon named "')
    + "([\\w\\s_]+)"
    + utils_1.escapeRegExp('".')
    + `(?:${utils_1.escapeRegExp("</p>")})?`, "gi");
const dartDocDirectives = new RegExp(`(\\n\\s*{@.*?}$)|(^{@.*?}\\s*\\n)|(^{@.*?}$)`, "gim");
const dartDocCodeBlockSections = new RegExp(`(\`\`\`\\w+) +\\w+`, "gi");
function cleanDartdoc(doc) {
    if (!doc)
        return "";
    // Clean up some dart.core dartdoc.
    const index = doc.indexOf("## Other resources");
    if (index !== -1)
        doc = doc.substring(0, index);
    // Remove colons from old-style references like [:foo:].
    doc = doc.replace(/\[:\S+:\]/g, (match) => `[${match.substring(2, match.length - 2)}]`);
    doc = doc.replace(iconRegex, `![$1](${iconUrlFormat}|width=32,height=32)`);
    // Remove any directives like {@template xxx}
    doc = doc.replace(dartDocDirectives, "");
    // Remove any code block section names like ```dart preamble
    doc = doc.replace(dartDocCodeBlockSections, "$1");
    return doc;
}
exports.cleanDartdoc = cleanDartdoc;
/// Strips markdown to make nicer plain text.
function stripMarkdown(doc) {
    if (!doc)
        return "";
    // Remove links like [foo](bar).
    doc = doc.replace(/\[(.+?)\]\(.+?\)/g, "$1");
    // Remove references like [foo].
    doc = doc.replace(/\[(.+?)\]/g, "$1");
    return doc;
}
exports.stripMarkdown = stripMarkdown;
//# sourceMappingURL=dartdocs.js.map