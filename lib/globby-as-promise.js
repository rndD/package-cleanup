var Q = require('q');
var globby = require('globby');

/**
 * @param {String[]} patterns
 * @param {Object} globby options
 * @returns {Q.Promise<String[]>}
 */
module.exports = Q.denodeify(globby);
