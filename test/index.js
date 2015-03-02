var PackageCleaner = require('../');
var sinon = require('sinon');
var expect = require('chai').expect;

describe('PackageCleaner', function () {
    var pc;
    beforeEach(function () {
        pc = new PackageCleaner('test/project/test_package');
    });

    describe('getDirsToKeep', function () {
        it('should return array of dirs where filesToKeep are located', function() {
            var fixture = [
                "a/b/c/d/1.txt"
            ];
            expect(pc.getDirsToKeep(fixture)).to.eql([
                'a',
                'a/b',
                'a/b/c',
                'a/b/c/d'
            ]);
        });

        it('should return duplicate free dirs array', function() {
            var fixture = [
                "a/b/1.txt",
                "a/b/2.txt"
            ];
            expect(pc.getDirsToKeep(fixture)).to.eql([
                'a',
                'a/b'
            ]);
        });

        it('should work with relative paths', function() {
            var fixture = [
                "z/x/y/../2.txt"
            ];
            expect(pc.getDirsToKeep(fixture)).to.eql([
                'z',
                'z/x'
            ]);
        });
    });

    describe('parsePatterns', function () {

        it('should return array of patterns', function () {
            var patterns = [
                '/a/**/d.jpg',
                '/a/b/**.jpg'
            ].join('\n');

            expect(pc.parsePatterns(patterns)).to.be.eql([
                '/a/**/d.jpg',
                '/a/b/**.jpg'
            ]);
        });

        it('should skip empty lines', function () {
            var patterns = [
                '/a/**/d.jpg',
                '',
                '/a/b/**.jpg'
            ].join('\n');

            expect(pc.parsePatterns(patterns)).to.be.eql([
                '/a/**/d.jpg',
                '/a/b/**.jpg'
            ]);
        });

        it('should trim', function () {
            var patterns = [
                '/a/**/d.jpg',
                '',
                '    /a/b/**.jpg'
            ].join('\n');

            expect(pc.parsePatterns(patterns)).to.be.eql([
                '/a/**/d.jpg',
                '/a/b/**.jpg'
            ]);
        });

        it('should remove comments', function () {
            var patterns = [
                '# Some comment about glob',
                '/a/**/d.jpg',
                '   # Some cool indent  ',
                '/a/b/**.jpg'
            ].join('\n');

            expect(pc.parsePatterns(patterns)).to.be.eql([
                '/a/**/d.jpg',
                '/a/b/**.jpg'
            ]);
        });

        it('should remove whitespaces from the beginning and end of pattern', function () {
            var patterns = [
                '   !x.jpg',
                '!y.jpg   '
            ].join('\n');

            expect(pc.parsePatterns(patterns)).to.be.eql([
                '!x.jpg',
                '!y.jpg'
            ]);
        });
    });

    describe('_guard', function () {

        var dirStat = {
                isDirectory: sinon.stub().returns(true)
            },
            fileStat = {
                isDirectory: sinon.stub().returns(false)
            };

        beforeEach(function () {
            pc.setFilesToKeep([
                'blocks/item/__flag/item__flag.jpg',
                'pages/page/_page.jpg',
                'pages/i.txt',
                'GITHEAD'
            ]);
        });

        it('should skip "." dir', function () {
            expect(pc._guard(".", dirStat)).to.be.true();
        });

        it('should return false if dir must be deleted', function () {
            expect(pc._guard("blocks/item2", dirStat)).to.be.null();
        });

        it('should return true if dir must be kept', function () {
            expect(pc._guard("blocks/item/__flag", dirStat)).to.be.true();
        });

        it('should return true if file must be kept', function () {
            expect(pc._guard("GITHEAD", fileStat)).to.be.true();
        });

        it('should return true if file must be kept and locates in dir', function () {
            expect(pc._guard("pages/i.txt", fileStat)).to.be.true();
        });

        it('should add file to delete list', function () {
            var file = 'package.json';
            pc._guard(file, fileStat);
            expect(pc.pathsToDelete).to.be.eql([file]);
        });

        it('should not add file to delete list if it must be kept', function () {
            pc._guard('pages/page/_page.jpg', fileStat);
            expect(pc.pathsToDelete).to.be.empty();
        });

        it('should not add dir to delete list if it must be kept', function () {
            pc._guard('pages', dirStat);
            expect(pc.pathsToDelete).to.be.empty();
        });

        it('should add file in delete list even it locates in dirsToKeep', function () {
            var file = 'pages/to_delete.png';
            pc._guard(file, dirStat);
            expect(pc.pathsToDelete).to.be.eql([file]);
        });

        it('should add many paths in delete list', function () {
            var file1 = 'pages/to_delete.png';
            var file2 = 'pages_to_delete/';
            pc._guard(file1, fileStat);
            pc._guard(file2, dirStat);
            expect(pc.pathsToDelete).to.be.eql([file1, file2]);
        });
    });
});
