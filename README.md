### Package cleanup

[![Build Status](https://travis-ci.org/rndD/package-cleanup.svg?branch=master)](https://travis-ci.org/rndD/package-cleanup)

Command-line tool to delete or copy all unnecessary files by gitignore-like patterns.

#### Example

Copy all js/css/images from '.' to 'frontend' dir:
```
$ cat .frontend-patterns
**/*.js
**/*.css
img/*.{jpg,png,svg}

$ ./node_modules/.bin/package-cleanup copy -p .frontend-patterns -o ./frontend
$ ls ./frontend
js/jquery/jq.min.js
js/jquery/jq.simple-slider.js
js/pages/all.js
all.css
img/img1.png
img/img2.svg

```

Delete all not python/ruby files in 'src':
```
$ cat .scripts-patterns
**/*.py
**/*.rb
# Don't keep tests
!**/test.{py,rb}

$ tree ./src
src
├── __init__.py
├── __init__.pyc
├── a_dir
│   ├── __init__.py
│   ├── __init__.pyc
│   ├── configs.xml
│   └── some-other-dir
│       ├── __init__.py
│       ├── __init__.pyc
│       ├── run.py
│       ├── run.rb
│       ├── secret.txt
│       ├── test.py
│       └── test.rb
└── b_dir
    └── some-other-dir
        ├── data.json
        ├── data.py
        └── data.pyc

4 directories, 15 files

$ ./node_modules/.bin/package-cleanup clean -p ../.scripts-pattern -w ./src
$ tree ./src
src
├── __init__.py
├── a_dir
│   ├── __init__.py
│   └── some-other-dir
│       ├── __init__.py
│       ├── run.py
│       └── run.rb
└── b_dir
    └── some-other-dir
        └── data.py

4 directories, 6 files
```

#### Usage

```
Package cleanup

Usage:
  package-cleanup COMMAND [OPTIONS] [ARGS]

Commands:
  clean : Cleanup package - delete all files matching to the patters
  copy : Copy all files matching to the patterns to dir

Options:
  -h, --help : Help
  -v, --version : Version
  -p PATTERNS, --patterns=PATTERNS : Path to file with patterns (required)
  -w WORKINGDIR, --working-dir=WORKINGDIR : Working directory
  -d, --dry-run : Dry run
  
Options for clean subcommand:
  --delete-empty : Delete empty files

Options for copy subcommand:
  -o OUTPUTDIR, --output-dir=OUTPUTDIR : Output dir
  --not-copy-empty : Not copy empty files
```
