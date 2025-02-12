const path = require('path')
const babelPlugin = require('@rollup/plugin-babel')
const resolve = require('@rollup/plugin-node-resolve')
const replace = require('@rollup/plugin-replace')
const terser = require('@rollup/plugin-terser')
const typescript = require('@rollup/plugin-typescript')
const { default: esbuild } = require('rollup-plugin-esbuild')
const createBabelConfig = require('./babel.config')

const extensions = ['.js', '.ts', '.tsx']
const { root } = path.parse(process.cwd())

function external(id) {
  return !id.startsWith('.') && !id.startsWith(root)
}

function getBabelOptions(targets) {
  return {
    ...createBabelConfig({ env: (env) => env === 'build' }, targets),
    extensions,
    comments: false,
    babelHelpers: 'bundled',
  }
}

function getEsbuild(target, env = 'development') {
  return esbuild({
    minify: env === 'production',
    target,
    tsconfig: path.resolve('./tsconfig.json'),
  })
}

function createDeclarationConfig(input, output) {
  return {
    input,
    output: {
      dir: output,
    },
    external,
    plugins: [
      typescript({
        declaration: true,
        emitDeclarationOnly: true,
        outDir: output,
      }),
    ],
  }
}

function createESMConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'esm' },
    external,
    plugins: [
      resolve({ extensions }),
      replace({
        __DEV__: output.endsWith('.mjs')
          ? '((import.meta.env&&import.meta.env.MODE)!=="production")'
          : '(process.env.NODE_ENV!=="production")',
        // a workround for #410
        'use-sync-external-store/shim': 'use-sync-external-store/shim/index.js',
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      getEsbuild('node12'),
    ],
  }
}

function createCommonJSConfig(input, output) {
  return {
    input,
    output: { file: `${output}.js`, format: 'cjs' },
    external,
    plugins: [
      resolve({ extensions }),
      replace({
        __DEV__: '(process.env.NODE_ENV!=="production")',
        preventAssignment: true,
      }),
      babelPlugin(getBabelOptions({ ie: 11 })),
    ],
  }
}

function createUMDConfig(input, output, env) {
  const c = output.replace(/^dist\/umd\//, '').split('/')
  let name
  if (c.length === 1) {
    name = 'valtio'
  } else if (c.length === 2) {
    name = `valtio${c[1].slice(0, 1).toUpperCase()}${c[1].slice(1)}`
  } else if (c.length === 3) {
    name = `valtio${c[1].slice(0, 1).toUpperCase()}${c[1].slice(1)}${c[2]
      .slice(0, 1)
      .toUpperCase()}${c[2].slice(1)}`
  } else {
    throw new Error('unexpected output format: ' + output)
  }
  return {
    input,
    output: {
      file: `${output}.${env}.js`,
      format: 'umd',
      name,
      globals: {
        react: 'React',
        'valtio/vanilla': 'valtioVanilla',
        'valtio/utils': 'valtioUtils',
        'valtio/react': 'valtioReact',
        'valtio/vanilla/utils': 'valtioVanillaUtils',
        'valtio/react/utils': 'valtioReactUtils',
      },
    },
    external,
    plugins: [
      resolve({ extensions }),
      replace({
        __DEV__: env !== 'production' ? 'true' : 'false',
        preventAssignment: true,
      }),
      babelPlugin(getBabelOptions({ ie: 11 })),
      ...(env === 'production' ? [terser()] : []),
    ],
  }
}

function createSystemConfig(input, output, env) {
  return {
    input,
    output: {
      file: `${output}.${env}.js`,
      format: 'system',
    },
    external,
    plugins: [
      resolve({ extensions }),
      replace({
        __DEV__: env !== 'production' ? 'true' : 'false',
        preventAssignment: true,
      }),
      getEsbuild('node12', env),
    ],
  }
}

module.exports = function (args) {
  let c = Object.keys(args).find((key) => key.startsWith('config-'))
  if (c) {
    c = c.slice('config-'.length).replace(/_/g, '/')
  } else {
    c = 'index'
  }
  return [
    ...(c === 'index' ? [createDeclarationConfig(`src/${c}.ts`, 'dist')] : []),
    createCommonJSConfig(`src/${c}.ts`, `dist/${c}`),
    createESMConfig(`src/${c}.ts`, `dist/esm/${c}.js`),
    createESMConfig(`src/${c}.ts`, `dist/esm/${c}.mjs`),
    createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'development'),
    createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'production'),
    createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'development'),
    createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'production'),
  ]
}
