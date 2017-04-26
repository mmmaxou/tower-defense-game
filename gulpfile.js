// Gulp.js configuration
var
	// modules
	gulp = require('gulp'),
	newer = require('gulp-newer'),
	imagemin = require('gulp-imagemin'),
	htmlclean = require('gulp-htmlclean'),
	concat = require('gulp-concat'),
	deporder = require('gulp-deporder'),
	stripdebug = require('gulp-strip-debug'),
	uglify = require('gulp-uglify'),
	sass = require('gulp-sass'),
	postcss = require('gulp-postcss'),
	gulpIgnore = require('gulp-ignore'),
	browserify = require('browserify'),
	assets = require('postcss-assets'),
	autoprefixer = require('autoprefixer'),
	mqpacker = require('css-mqpacker'),
	cssnano = require('cssnano'),
	source = require('vinyl-source-stream'),
	//	buffer = require('vinyl-buffer'),
	//	sourcemaps = require('gulp-sourcemaps'),
	//	gutil = require('gulp-util'),
	spawn = require('child_process').spawn,
	exec = require('child_process').exec,

	node,

	// development mode?
	devBuild = (process.env.NODE_ENV !== 'production'),

	// folders
	folder = {
		src: './src/',
		build: './build/'
	};

// Image processing
gulp.task('images', function () {
	var out = folder.build + 'images/'
	return gulp.src(folder.src + 'images/**/*')
		.pipe(newer(out))
		.pipe(imagemin({
			optimizationLevel: 5
		}))
		.pipe(gulp.dest(out))
})

// HTML Processing
gulp.task('html', ['images'], function () {
	var
		out = folder.build + 'html/',
		page = gulp.src(folder.src + 'html/**/*')
		.pipe(newer(out))
	// minify production code
	if (!devBuild) {
		page = page.pipe(htmlclean());
	}
	return page
		.pipe(gulp.dest(out))
});

// JavaScript processing
gulp.task('browserify', function () {

	var b = browserify({
		entries: [folder.src + 'js/main.js']
	}).bundle()

	return b
		.pipe(source('main.js'))
		.pipe(gulp.dest(folder.build + 'js/'))
});

gulp.task('js', function () {
	var jsbuild = gulp.src([folder.src + 'js/**/*', '!*main*'])
		.pipe(gulpIgnore.exclude('*main.js'))
		.pipe(deporder())
		.pipe(concat('bundle.js'))

	if (!devBuild) {
		jsbuild = jsbuild
			.pipe(stripdebug())
			.pipe(uglify());
	}
	return jsbuild.pipe(gulp.dest(folder.build + 'js/'))
})

// CSS processing
gulp.task('css', ['images'], function () {

	var postCssOpts = [
  assets({
			loadPaths: ['images/']
		}),
  autoprefixer({
			browsers: ['last 2 versions', '> 2%']
		}),
  mqpacker
  ];

	if (!devBuild) {
		postCssOpts.push(cssnano);
	}

	return gulp.src(folder.src + 'scss/main.scss')
		.pipe(sass({
			outputStyle: 'nested',
			imagePath: 'images/',
			precision: 3,
			errLogToConsole: true
		})).on('error', sass.logError)
		.pipe(postcss(postCssOpts))
		.pipe(gulp.dest(folder.build + 'css/'))

});

/**
 * $ gulp server
 * description: launch the server. If there's a server already running, kill it.
 */
gulp.task('server', function () {
	if (node) node.kill()
	node = spawn('node', ['app.js'], {
		stdio: 'inherit'
	})
	node.on('close', function (code) {
		if (code === 8) {
			gulp.log('Error detected, waiting for changes...');
		}
	})
})
gulp.task('mongo', function () {
	runCommand("mongod")
})

// run all tasks
gulp.task('run', ['html', 'css', 'browserify', 'js', 'server']);

// watch for changes
gulp.task('watch', function () {

	// image changes
	gulp.watch(folder.src + 'images/**/*', ['images']);

	// html changes
	gulp.watch(folder.src + 'html/**/*', ['html']);

	// javascript changes
	gulp.watch(folder.src + 'js/**/*', ['js']);
	gulp.watch(folder.src + 'js/main.js', ['browserify']);

	// css changes
	gulp.watch(folder.src + 'scss/**/*', ['css']);

	// server changes
	gulp.watch('app.js', ['server']);

});
// default task
gulp.task('default', ['run', 'watch']);

// kill the server on stop
process.on('exit', function () {
	if (node) node.kill()
})
