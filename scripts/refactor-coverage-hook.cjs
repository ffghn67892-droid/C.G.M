// A-stage instrumentation only: label the existing VM bundle without changing its code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.resolve(__dirname, '../.refactor-audit/A/renderer-bundle.js');
const source = fs.readFileSync(filename, 'utf8');
const original = vm.runInContext;
vm.runInContext = function (code, context, options) {
  if (code === source) {
    const normalized = typeof options === 'string' ? {filename: options} : options;
    return original.call(this, code, context, {...normalized, filename});
  }
  return original.call(this, code, context, options);
};
