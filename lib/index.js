// 项目入口文件

const {src, dest, parallel, series, watch} = require('gulp')

const del = require('del')
const browserSync = require('browser-sync')

const loadPlugins = require('gulp-load-plugins')
const plugins = loadPlugins() // 加载插件

const bs = browserSync.create()

const cwd = process.cwd() // 读取当前文件路径
let config = {
  // defaul config
  build:{
    src: 'src',
    dist: 'dist',
    temp: 'temp',
    public: 'public',
    paths: {
      styles: 'assets/styles/*.scss',
      scripts: 'assets/scripts/*.js',
      pages: '*.html',
      images: 'assets/images/**',
      fonts: 'assets/fonts/**'
    }
  }
}

try {
  const loadConfig = require(`${cwd}/pages.config.js`)
  config = Object.assign({}, config, loadConfig)
} catch (error) {
  console.log(error)
  throw Error('can not find pages.config.js file')
}

/** 清除dist文件 */
const clean = () =>{
    return del([config.build.dist, config.build.temp])
}

/** 样式文件编译 */
const style = () =>{
    return src(config.build.paths.styles, {base: config.build.src, cwd: config.build.src})
        .pipe(plugins.sass({ outputStyle: 'expanded'}))
        .pipe(dest(config.build.temp))
        .pipe(bs.reload({ stream: true })) // 使用流的形式加载
}

/** 脚本文件编译 */
const script = () =>{
    return src(config.build.paths.scripts, {base: config.build.src, cwd: config.build.src})
        .pipe(plugins.babel({presets: [require('@babel/preset-env')]}))
        .pipe(dest(config.build.temp))
        .pipe(bs.reload({ stream: true }))
}
/** 页面模版编译 */
const page = () =>{
    return src(config.build.paths.pages, {base: config.build.src, cwd: config.build.src})
        .pipe(plugins.swig({data: config.data, defaults: { cache: false }}))  // 防止模板缓存导致页面不能及时更新
        .pipe(dest(config.build.temp))
        .pipe(bs.reload({ stream: true }))
}

/** 图片转化与压缩 */
const image = () =>{
    return src(config.build.paths.images, {base: config.build.src, cwd: config.build.src})
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
}

/** 字体压缩 */
const font = () =>{
    return src(config.build.paths.fonts, {base: config.build.src, cwd: config.build.src})
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
}

/** 额外文件 */
const extra = () =>{
    return src('**', {base: config.build.public})
        .pipe(dest(config.build.dist))
}

/** 自动构建服务 */
const serve = () =>{
    // 监听文件变化
    //在开发环境中， 脚本、样式、页面的变化比较频繁，且需要需要重新编译成浏览器刻可读内容
    watch(config.build.paths.styles, { cwd: config.build.src },style)
    watch(config.build.paths.scripts, { cwd: config.build.src },script)
    watch(config.build.paths.pages, { cwd: config.build.src },page)
    // watch('src/assets/images/**', image)
    // watch('src/assets/fonts/**', font)
    // watch('public/**', extra)

    // 对于改动比较少，且只是压缩文件的图片、字体等，可统一监听
    // bs.reload可读文件变化后，重新加载浏览器
    watch([
        config.build.paths.images,
        config.build.paths.fonts,
    ],{ cwd: config.build.src }, bs.reload)

    watch(['**'],{ cwd: config.build.public }, bs.reload)

    bs.init({
        notify:false,
        port: 3002,
        //open:false,
        //files: 'dist/**', // 当dist目录下任何一个文件变化， 就重新加载
        server:{
            baseDir:[config.build.temp, config.build.src, config.build.public], // 
            routes:{
                '/node_modules': 'node_modules' // 将html中引用的node_modules中的文件映射到当前路径下
            }
        }
    })
}

/** 文件构建注释删除及压缩 */
const useref = () =>{
  return src('temp/*.html', {base: config.build.temp})
    .pipe(plugins.useref({searchPath: [config.build.temp, '.']}))
    // html js css
    .pipe(plugins.if(/\.js$/, plugins.uglify())) // 压缩js文件
    .pipe(plugins.if(/\.css$/, plugins.cleanCss())) // 压缩css文件
    .pipe(plugins.if(/\.html$/, plugins.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true
    })))
    // 在构建的时候，先将压缩的文件放到temp文件下，
    // 在build阶段， 再将temp文件中的所有文件压缩后放在dist目录下
    // 这样可防止在build过程中，相同文件的写入写出发生错误
    // 减少调试过程中的文件编译的时间，提高本地开发效率
    // 减少线上代码的体积
    .pipe(dest(config.build.dist)) 
}

const compole = parallel(style, script, page)

/** 先清除dist文件然后重新编译 */
/** 上线之前执行的任务 */
const build = series(
  clean, 
  parallel(
    series(compole, useref), // 文件需要先构建后再压缩
    image, 
    font, extra
  )
) 

const develop = series(compole, serve)

module.exports = {
    clean,
    build,
    develop
}