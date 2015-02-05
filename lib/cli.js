var PackageCleaner = require('../');

var commonOptions = function() {
    this
        .opt()
            .name('patterns')
            .title('Path to file with patterns')
            .short('p')
            .long('patterns')
            .req()
        .end()

        .opt()
            .name('dryRun')
            .title('Dry run')
            .short('d')
            .long('dry-run')
            .flag()
        .end()

        .opt()
            .name('workingDir')
            .title('Working directory')
            .short('w')
            .long('working-dir')
            .val(function(path) {
                if (!require('fs').existsSync(path)) return this.reject('Error: \'' + path + '\' does not exist');
                return path;
            })
            .act(function(opts) {
                process.chdir(opts.workingDir);
            })
        .end()

        .opt()
            .name('deleteEmpty')
            .title('Delete empty files')
            .long('delete-empty')
            .flag()
        .end()
};

require('coa').Cmd()
    .name(process.argv[1])
    .title('Package cleanup')
    .helpful()

    .opt()
        .name('version')
        .title('Version')
        .short('v')
        .long('version')
        .flag()
        .act(function() {
            return require('../package.json').version;
        })
    .end()

    .cmd()
        .name("clean")
        .title('Cleanup package - delete all files matching to the patters')
        .helpful()
        .apply(commonOptions)
        .act(function(opts) {
            var pc = new PackageCleaner(opts['patterns'], {}, opts);
            pc.clean();
        })
    .end()

    .cmd()
        .name("move")
        .title('Move all files matching to the patterns to dir')
        .helpful()
        .apply(commonOptions)
        .opt()
            .name('outputDir')
            .title('Output dir')
            .short('o')
            .long('output-dir')
            .def('./out')
        .end()
        .act(function(opts) {
            var pc = new PackageCleaner(opts['patterns'], {}, opts);
            pc.move(opts['outputDir']);
        })
    .end()

    .run(process.argv.slice(2));
