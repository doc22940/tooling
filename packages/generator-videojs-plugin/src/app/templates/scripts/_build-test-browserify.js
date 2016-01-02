var browserify = require('browserify');
var fs = require('fs');
var glob = require('glob');

glob('test/**/*.test.js', function(err, files) {
  browserify(files)
    .transform('babelify')
    .bundle()
    .pipe(fs.createWriteSteam('dist-test/<%= nameOf.package %>.js'));
});
