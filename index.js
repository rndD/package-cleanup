var path = require('path');
var fs = require('fs');

var _ = require('lodash');

var Q = require('q');
var FSQ = require("q-io/fs");
var tartifacts = require('tartifacts');

var globby = require('./lib/globby-as-promise');

var logStackTraceAndExit = function(e) {
    console.error(e.stack);
    process.exit(1);
};
// By default files with leading dot are not matches to '*'
const DEFAULT_GLOBBY_OPTIONS = { dot: true };

/**
 * @param {String} patternsFilename - Path to file with patterns
 * @param {Object} [globbyOptions] - Options for globby search
 * @param {Object} [options] - options from CLI
 * @see https://github.com/isaacs/node-glob#options
 */
var PackageCleaner = function (patternsFilename, globbyOptions, options) {
    console.assert(patternsFilename, 'Path to file with patterns not defined');
    console.assert(fs.existsSync(patternsFilename), 'File with patterns "' + patternsFilename + '" does not exist');

    this.globbyOptions = _.defaults({}, globbyOptions, DEFAULT_GLOBBY_OPTIONS);
    this.options = _.defaults({}, options);

    this.options['dryRun'] === true && this.setDryRunMethods();

    this.patternsFilename = patternsFilename;
    this.filesToKeep = null;
    this.pathsToDelete = [];
    this.dirsToKeep = null;

    _.bindAll(this);
};

/**
 * Entrance point for `clean` command from CLI
 */
PackageCleaner.prototype.clean = function() {
    return Q.when(this.readPatterns())
        .then(this.parsePatterns)
        .then(this.getFilesToKeep)
        .then(this.setFilesToKeep)
        .then(this.searchFilesToDelete)
        .then(this.options['deleteEmpty'] ? this.deleteEmptyFiles: _.identity)
        .then(this.deleteFiles)
        .catch(logStackTraceAndExit)
        .done();
};

/**
 * Entrance point for `copy` command from CLI
 */
PackageCleaner.prototype.copy = function(outPath) {
    return this.readPatterns()
        .then(this.parsePatterns)
        .then((patterns) => {
            return tartifacts({
                dest: outPath,
                patterns: patterns
            }, { emptyFiles: !this.options['notCopyEmpty'] });
        })
        .catch(logStackTraceAndExit)
        .done();
};

PackageCleaner.prototype.readPatterns = function() {
    var patternsFilename = this.patternsFilename;

    if (path.extname(patternsFilename) === '.js') {
        var patternsFilePath = path.resolve(process.cwd(), patternsFilename);
        var dynamicPatterns = require(patternsFilePath);

        return Q.fcall(dynamicPatterns);
    }

    return FSQ.read(patternsFilename);
};

/**
 * @param {String} content
 * @returns {String[]}
 */
PackageCleaner.prototype.parsePatterns = function(content) {
    return _(content.split('\n'))
            .map(_.trim)
            // Remove comments
            .filter(function(p) { return !_.startsWith(p, '#') })
            .compact()
            .value();
};

/**
 * @param {String[]} patterns
 * @returns {Q.Promise}
 */
PackageCleaner.prototype.getFilesToKeep = function(patterns) {
    return globby(patterns, this.globbyOptions);
};

/**
 * @param {String[]} filesToKeep
 */
PackageCleaner.prototype.setFilesToKeep = function(filesToKeep) {
    this.filesToKeep = _.map(filesToKeep, path.normalize);
    this.dirsToKeep = this.getDirsToKeep(this.filesToKeep);
};

/**
 * @param {String[]} filesToKeep
 * @returns {String[]}
 */
PackageCleaner.prototype.getDirsToKeep = function(filesToKeep) {

    function parsePathToDirs(dirsToKeep, dirPath) {
        var dirs = dirPath.split(path.sep);
        _.reduce(dirs, function(p, d) {
            var newDir = p ? path.join(p, d): d;
            dirsToKeep.push(newDir);
            return newDir;
        }, "");

        return dirsToKeep;
    }

    return _.chain(filesToKeep)
        .map(path.dirname)
        .map(path.normalize)
        .reduce(parsePathToDirs, [])
        .uniq()
        .sort()
        .value();
};

/**
 * @param {String[]} filesToFilter
 * @returns {Q.Promise<String[]>}
 */
PackageCleaner.prototype.filterEmptyFiles = function(filesToFilter) {
    return this.searchEmptyFiles(filesToFilter)
        .then(function(emptyFiles) {
            return _.difference(filesToFilter, emptyFiles);
        })
};

/**
 * @returns {Q.Promise}
 */
PackageCleaner.prototype.searchFilesToDelete = function() {
    return FSQ.listTree('', this._guard);
};

/**
 * Adds files and dirs to delete list
 * Functions calls as a argument for q-io.listTree
 * @param {String} p - path to file or dir
 * @param {Object} stat
 * @returns {Boolean|null}
 * @see https://github.com/kriskowal/q-io#listtreepath-guardpath-stat
 * @private
 */
PackageCleaner.prototype._guard = function(p, stat) {
    if (p === '.') return true;

    if (stat.isDirectory()) {
        if (this._isItDirToKeep(p)) return true;
    } else {
        if (this._isItFileToKeep(p)) return true;
    }
    this.addPathToDeleteList(p);
    return null;
};

/**
 * @param {String} path
 * @private
 */
PackageCleaner.prototype.addPathToDeleteList = function(path) {
    this.pathsToDelete.push(path);
};

/**
 * Search empty files and add it to delete list
 * @returns {Q.Promise}
 */
PackageCleaner.prototype.deleteEmptyFiles = function() {
    return this.searchEmptyFiles()
        .then(function(files) {
            files.map(this.addPathToDeleteList);
        }.bind(this));
};

/**
 * Search empty files
 * @param {String[]} [files] - если не будет передан для фильтрации будет использоваться this.filesToKeep
 * @returns {Q.Promise<String[]>}
 */
PackageCleaner.prototype.searchEmptyFiles = function(files) {
    var that = this;
    files = files || this.filesToKeep;

    var promises = files.map(function(p) {
        return that._statMethod(p)
            .then(function(stat) { return { path: p, size: stat.size } })
    });

    return Q.all(promises).then(function(files) {
        return _.chain(files)
            .reject('size')
            .pluck('path')
            .value();
    });
};

PackageCleaner.prototype.deleteFiles = function() {
    var that = this,
        promises = this.pathsToDelete.map(function(p) {
            return FSQ.isDirectory(p).then(function(isDir) {
                return isDir ? that._deleteDirMethod(p) : that._deleteFileMethod(p);
            });
        });

    return Q.all(promises);
};

PackageCleaner.prototype.setDryRunMethods = function() {
    this._deleteDirMethod = function(p) { console.log('rm -rf ' + p)};
    this._deleteFileMethod = function(p) { console.log('rm ' + p)};
    this._copyMethod = function(f, t) { console.log('cp ' + f + ' ' + t)};
    this._makeTreeMethod = function(p) { console.log('mkdir -p ' + p)};
    return this;
};

PackageCleaner.prototype._statMethod = function(p) {
    return FSQ.stat(p)
        .catch(function(e) {
            // if symlink target not exist, skip this error
            if (e.code === 'ENOENT') {
                console.warn('Warning file "%s" not exist', e.path);
                return { path: '', size: 0 };
            }

            throw new Error(e);
        });
};

PackageCleaner.prototype._deleteFileMethod = function(p) { return FSQ.remove(p) };

PackageCleaner.prototype._deleteDirMethod = function(p) { return FSQ.removeTree(p) };

PackageCleaner.prototype._copyMethod = function(f, t) { return FSQ.copyTree(f,t) };

PackageCleaner.prototype._makeTreeMethod = function(p) { return FSQ.makeTree(p) };

PackageCleaner.prototype._isItFileToKeep = function(file) {
    return _.contains(this.filesToKeep, file);
};

PackageCleaner.prototype._isItDirToKeep = function(dir) {
    return _.contains(this.dirsToKeep, dir);
};

module.exports = PackageCleaner;
