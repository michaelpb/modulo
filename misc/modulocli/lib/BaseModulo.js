// Modulo singleton
// Level of indirection for any global server-side Modulo patches.
const baseModulo = require('../../src/Modulo.js');
const path = require("path");
const fs = require('fs');

baseModulo.ABS_LOCAL_PATH = path.resolve(__dirname, '../../src/Modulo.js');
baseModulo.SOURCE_CODE = fs.readFileSync(baseModulo.ABS_LOCAL_PATH);

module.exports = baseModulo;
