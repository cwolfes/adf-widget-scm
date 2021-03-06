/*
 * The MIT License
 *
 * Copyright (c) 2016, Sebastian Sdorra
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

var gulp = require('gulp');
var connect = require('gulp-connect');
var wiredep = require('wiredep').stream;
var $ = require('gulp-load-plugins')();
var del = require('del');
var jsReporter = require('jshint-stylish');
var annotateAdfPlugin = require('ng-annotate-adf-plugin');
var pkg = require('./package.json');

// proxy stuff for scm-manager
var url = require('url');
var proxy = require('proxy-middleware');
var scmUrl = 'http://localhost:8080/scm/api/rest'
var scmCredentials = {
  user: 'scmadmin',
  password: 'scmadmin'
};

var annotateOptions = {
  plugin: [
    annotateAdfPlugin
  ]
};

var templateOptions = {
  root: '{widgetsPath}/scm/src',
  module: 'adf.widget.scm'
};

/** lint **/

gulp.task('csslint', function(){
  gulp.src('src/**/*.css')
      .pipe($.csslint())
      .pipe($.csslint.reporter());
});

gulp.task('jslint', function(){
  gulp.src('src/**/*.js')
      .pipe($.jshint())
      .pipe($.jshint.reporter(jsReporter));
});

gulp.task('lint', ['csslint', 'jslint']);

/** serve **/

gulp.task('templates', function(){
  return gulp.src('src/**/*.html')
             .pipe($.angularTemplatecache('templates.tpl.js', templateOptions))
             .pipe(gulp.dest('.tmp/dist'));
});

gulp.task('sample', ['templates'], function(){
  var files = gulp.src(['src/**/*.js', 'src/**/*.css', 'src/**/*.less', '.tmp/dist/*.js'])
                  .pipe($.if('*.js', $.angularFilesort()));

  gulp.src('sample/index.html')
      .pipe(wiredep({
        directory: './components/',
        bowerJson: require('./bower.json'),
        devDependencies: true,
        dependencies: true
      }))
      .pipe($.inject(files))
      .pipe(gulp.dest('.tmp/dist'))
      .pipe(connect.reload());
});

gulp.task('watch', function(){
  gulp.watch(['src/**'], ['sample']);
});

gulp.task('serve', ['watch', 'sample'], function(){
  var proxyOptions = url.parse(scmUrl);
  proxyOptions.route = '/api/scm';

  var authentication = function(){
    return function(request, response, next){
      var auth = scmCredentials.user + ':' + scmCredentials.password;
      auth = new Buffer(auth).toString('base64');
      request.headers['Authorization'] = 'Basic ' + auth;
      next();
    }
  };

  var userAgent = function(){
    return function(request, response, next){
      request.headers['User-Agent'] = 'adf-scm-widget/v1';
      next();
    }
  };

  connect.server({
    root: ['.tmp/dist', '.'],
    livereload: true,
    port: 9002,
    middleware: function(connect, opt) {
      return [
        authentication(connect, opt),
        userAgent(),
        proxy(proxyOptions)];
    }
  });
});

/** build **/

gulp.task('css', function(){
  gulp.src(['src/**/*.css', 'src/**/*.less'])
      .pipe($.if('*.less', $.less()))
      .pipe($.concat(pkg.name + '.css'))
      .pipe(gulp.dest('dist'))
      .pipe($.rename(pkg.name + '.min.css'))
      .pipe($.minifyCss())
      .pipe(gulp.dest('dist'));
});

gulp.task('js', function() {
  gulp.src(['src/**/*.js', 'src/**/*.html'])
      .pipe($.if('*.html', $.minifyHtml()))
      .pipe($.if('*.html', $.angularTemplatecache(pkg.name + '.tpl.js', templateOptions)))
      .pipe($.angularFilesort())
      .pipe($.sourcemaps.init())
      .pipe($.if('*.js', $.replace(/'use strict';/g, '')))
      .pipe($.concat(pkg.name + '.js'))
      .pipe($.headerfooter('(function(window, undefined) {\'use strict\';\n', '})(window);'))
      .pipe($.ngAnnotate(annotateOptions))
      .pipe(gulp.dest('dist'))
      .pipe($.rename(pkg.name + '.min.js'))
      .pipe($.uglify())
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('dist'));
});

/** clean **/

gulp.task('clean', function(cb){
  del(['dist', '.tmp'], cb);
});

gulp.task('default', ['css', 'js']);
