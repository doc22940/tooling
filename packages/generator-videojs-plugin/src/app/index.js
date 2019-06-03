import _ from 'lodash';
import chalk from 'chalk';
import chg from 'chg';
import fs from 'fs';
import path from 'path';
import tsmlj from 'tsmlj';
import yeoman from 'yeoman-generator';
import yosay from 'yosay';

import {PREFIX} from './constants';
import packageJSON from './package-json';
import * as validators from './validators';

export default yeoman.generators.Base.extend({

  /**
   * Whether or not this plugin is privately licensed.
   *
   * @return {Boolean}
   */
  _isPrivate() {
    return this.config.get('license') === 'private';
  },

  /**
   * Removes the leading underscore from a template file name and
   * generates the full destination path for it.
   *
   * @method _dest
   * @private
   * @example
   *         this._dest('some-dir/__foo') // "/path/to/some-dir/_foo"
   *         this._dest('_some-file.js')  // "/path/to/some-file.js"
   *         this._dest('some-file.js')   // "/path/to/some-file.js"
   *
   * @param  {String} src
   * @return {String}
   */
  _dest(src) {
    let basename = path.basename(src);
    let destname = src;

    if (_.startsWith(basename, '_')) {
      destname = src.replace(basename, basename.substr(1));
    }

    return this.destinationPath(destname);
  },

  /**
   * Gets the name of the scope including the "@" symbol. Will not prepend
   * the "@" if it is already included.
   *
   * @param  {String} scope
   * @return {String}
   */
  _getScope(scope) {
    if (!scope || typeof scope !== 'string') {
      return '';
    }
    return scope.charAt(0) === '@' ? scope : `@${scope}`;
  },

  /**
   * Gets the name of the plugin (without scope) including the "videojs-"
   * prefix.
   *
   * @param  {String} name
   * @return {String}
   */
  _getPluginName(name) {
    return name && typeof name === 'string' ? PREFIX + name : '';
  },

  /**
   * Gets the full package name, taking scope into account.
   *
   * @param  {String} name
   * @param  {String} [scope='']
   * @return {String}
   */
  _getPackageName(name, scope = '') {
    scope = this._getScope(scope);
    name = this._getPluginName(name);
    return scope ? `${scope}/${name}` : name;
  },

  /**
   * Gets the scope of the plugin (without scope or "videojs-" prefix).
   *
   * @param  {String} name
   * @return {String}
   */
  _getScopeFromPackageName(name) {
    if (!name) {
      return '';
    }

    let match = name.match(/^@([^/]+)\//);

    return match ? match[1] : '';
  },

  /**
   * Gets the core/default - that is, without scope or "videojs-"
   * prefix - name of the plugin.
   *
   * @param  {String} name
   * @return {String}
   */
  _getDefaultNameFromPackageName(name) {
    if (!name) {
      return '';
    }
    return name.split('/').reverse()[0].replace(PREFIX, '');
  },

  /**
   * Attempts to get default values for prompts. Async because it may call
   * out to external processes (e.g. Git) to attempt to gather this info.
   *
   * @method _getPromptDefaults
   * @private
   * @return {Object}
   */
  _getPromptDefaults() {
    let configs = this.config.getAll();
    let pkg = this._currentPkgJSON || {};
    let licenseNames = this._licenseNames;

    let defaults = {
      bower: configs.hasOwnProperty('bower') ? !!configs.bower : true,
      changelog: configs.hasOwnProperty('changelog') ? !!configs.changelog : true,
      docs: configs.hasOwnProperty('docs') ? !!configs.docs : false,
      lang: configs.hasOwnProperty('lang') ? !!configs.lang : false,
      license: this._licenseDefault,
      sass: configs.hasOwnProperty('sass') ? configs.sass : false
    };

    ['author', 'license', 'name', 'description'].forEach(key => {
      if (pkg.hasOwnProperty(key)) {
        defaults[key] = pkg[key];
      } else if (configs.hasOwnProperty(key)) {
        defaults[key] = configs[key];
      }
    });

    // At this point, the `defaults.name` may still have the full scope and
    // prefix included; so, we get the scope now.
    defaults.scope = this._getScopeFromPackageName(defaults.name);

    // Strip out the "videojs-" prefix from the name for the purposes of
    // the prompt (otherwise it will be rejected by validation).
    defaults.name = this._getDefaultNameFromPackageName(defaults.name);

    // The package.json stores a value from `_licenseNames`, so in that
    // case, we need to find the key instead of the value.
    if (pkg && pkg.license && pkg.license === defaults.license) {
      defaults.license = _.find(Object.keys(licenseNames), k => {
        return licenseNames[k] === pkg.license;
      });
    }

    let name = this.user.git.name();

    // Build up an author string from git if possible as a last-ditch effort.
    if (!defaults.author && name) {
      let email = this.user.git.email();

      defaults.author = name;

      if (email) {
        defaults.author += ` <${email}>`;
      }
    }

    return defaults;
  },

  /**
   * Gets prompts for the user.
   *
   * @method _createPrompts
   * @private
   * @return {Array}
   */
  _getPrompts() {
    let defaults = this._getPromptDefaults(defaults);
    let prompts = [{
      name: 'scope',
      message: 'Enter a package scope, if any, for npm (optional):',
      default: defaults.scope,
      validate: validators.scope
    }, {
      name: 'name',
      message: tsmlj`
        Enter the name of this plugin (a-z/0-9/- only; will be
        prefixed with "${PREFIX}"):
      `,
      default: defaults.name,
      validate: validators.name
    }, {
      name: 'description',
      message: 'Enter a description for your plugin:',
      default: defaults.description
    }, {
      name: 'author',
      message: 'Enter the author of this plugin:',
      default: defaults.author
    }, {
      type: 'list',
      name: 'license',
      message: 'Choose a license for your project',
      default: defaults.license,
      choices: _.map(this._licenseNames, (v, k) => {
        return {name: v, value: k};
      })
    }, {
      type: 'confirm',
      name: 'changelog',
      message: 'Do you want to include CHANGELOG tool?',
      default: defaults.changelog
    }, {
      type: 'confirm',
      name: 'sass',
      message: 'Do you want to include Sass styling?',
      default: defaults.sass
    }, {
      type: 'confirm',
      name: 'docs',
      message: 'Do you want to include documentation tooling?',
      default: defaults.docs
    }, {
      type: 'confirm',
      name: 'lang',
      message: tsmlj`
        Do you need video.js language file infrastructure for
        internationalized strings?
      `,
      default: defaults.lang
    }, {
      type: 'confirm',
      name: 'bower',
      message: 'Do you want to support Bower (adds special versioning handling)?',
      default: defaults.bower
    }];

    return prompts.filter(p => !_.contains(this._promptsToFilter, p.name));
  },

  /**
   * Sets up the generator.
   *
   * @method constructor
   */
  constructor() {
    yeoman.generators.Base.apply(this, arguments);

    this.option('bcov', {
      type: 'boolean',
      defaults: false
    });

    this.option('skip-prompt', {
      type: 'boolean',
      defaults: false
    });

    this.option('hurry', {
      type: 'boolean',
      defaults: false
    });

    this._currentPkgJSON = this.fs.readJSON(this.destinationPath('package.json'), null);

    this._licenseNames = {
      apache2: 'Apache-2.0',
      mit: 'MIT',
      private: 'UNLICENSED'
    };

    this._licenseFiles = {
      apache2: 'licenses/_apache2',
      mit: 'licenses/_mit'
    };

    this._licenseDefault = 'mit';

    this._filesToCopy = [
      'scripts/_banner.ejs',
      'scripts/_postversion.js',
      'scripts/_server.js',
      'scripts/_version.js',
      '_.editorconfig',
      '_.gitignore',
      '_.npmignore'
    ];

    this._templatesToCopy = [
      'scripts/_build-test.js',
      'scripts/_watch-test.js',
      'src/_plugin.js',
      'test/_karma.conf.js',
      'test/_index.html',
      'test/_plugin.test.js',
      '_index.html',
      '_CONTRIBUTING.md',
      '_README.md'
    ];

    this._promptsToFilter = [];

    // The "hurry" option skips both prompts and installation.
    if (this.options.hurry) {
      this.options.skipPrompt = this.options.skipInstall = true;
    }

    this._configsTemp = {
      bcov: this.options.bcov || !!this.config.get('bcov')
    };

    // Handle the Brightcove option/config.
    if (this._configsTemp.bcov) {

      // All Brightcove plugins use the same author string.
      this._promptsToFilter.push('author');
      this._configsTemp.author = 'Brightcove, Inc.';

      // Brightcove plugins are either Apache-2.0 or private/closed-source.
      this._licenseNames = _.pick(this._licenseNames, 'apache2', 'private');
      this._licenseDefault = 'apache2';

    // Make sure we filter out the author prompt if there is a current
    // package.json file with an object for the author field.
    } else if (this._currentPkgJSON && _.isPlainObject(this._currentPkgJSON.author)) {
      this._promptsToFilter.push('author');
      this._configsTemp.author = this._currentPkgJSON.author;
    }
  },

  /**
   * Display prompts to the user.
   *
   * @method prompting
   */
  prompting() {
    if (this.options.skipPrompt) {
      return;
    }

    this.log(yosay(`Welcome to the ${chalk.green(`${PREFIX}plugin`)} generator!`));

    let done = this.async();

    this.prompt(this._getPrompts(), responses => {
      _.assign(this._configsTemp, responses);
      done();
    });
  },

  /**
   * Generates a context object used for providing data to EJS file templates.
   *
   * @param {Object} [configs]
   *        Optionally provide custom configs.
   *
   * @return {Object}
   */
  _getContext(configs = this.config.getAll()) {
    return _.assign(_.pick(configs, [
      'author',
      'bower',
      'changelog',
      'description',
      'docs',
      'lang',
      'sass'
    ]), {
      className: `vjs-${configs.name}`,
      functionName: _.camelCase(configs.name),
      isPrivate: this._isPrivate(),
      licenseName: this._licenseNames[configs.license],
      packageName: this._getPackageName(configs.name, configs.scope),
      pluginName: this._getPackageName(configs.name),
      version: this._currentPkgJSON && this._currentPkgJSON.version || '0.0.0',
      year: (new Date()).getFullYear()
    });
  },

  /**
   * Store configs, generate template rendering context, alter the setup for
   * file structure.
   *
   * @method configuring
   */
  configuring() {
    this.config.set(this._configsTemp);
    delete this._configsTemp;

    let configs = this.config.getAll();

    this.context = this._getContext();

    if (!this._isPrivate()) {
      this._filesToCopy.push('_.travis.yml');
    }

    if (configs.lang) {
      this._filesToCopy.push('lang/_en.json');
    }

    if (configs.sass) {
      this._templatesToCopy.push('src/_plugin.scss');
    }

    if (configs.bower) {
      this._templatesToCopy.push('_bower.json');
    }
  },

  /**
   * Perform various writing tasks.
   *
   * @property {Object} writing
   */
  writing: {

    /**
     * Initializes a CHANGELOG.md file if one does not exist.
     *
     * @function changelog
     */
    changelog() {
      try {
        fs.statSync(this._dest('CHANGELOG.md'));
      } catch (x) {
        chg.init(null, this.async());
      }
    },

    /**
     * Writes common files.
     *
     * @function common
     */
    common() {
      this._templatesToCopy.forEach(src => {
        this.fs.copyTpl(this.templatePath(src), this._dest(src), this.context);
      });

      this._filesToCopy.forEach(src => {
        this.fs.copy(this.templatePath(src), this._dest(src));
      });
    },

    /**
     * Writes the LICENSE file based on the chosen license.
     *
     * @function license
     */
    license() {
      let file = this._licenseFiles[this.config.get('license')];

      if (!file) {
        return;
      }

      this.fs.copyTpl(
        this.templatePath(file),
        this.destinationPath('LICENSE'),
        this.context
      );
    },

    /**
     * Writes/updates the package.json file.
     *
     * @function package
     */
    packageJSON() {
      let json = packageJSON(this._currentPkgJSON, this.context);

      // We want to use normal JSON.stringify here because we want to
      // preserve whatever ordering existed in the _currentPkgJSON object.
      let contents = JSON.stringify(json, null, 2);

      this.fs.write(this.destinationPath('package.json'), contents);
    }
  },

  /**
   * Install npm dependencies; we don't have any Bower dependencies; so,
   * we don't want to run that (or depend on it in any way).
   *
   * @method install
   */
  install() {
    this.npmInstall();
  },

  /**
   * Display a final message to the user.
   *
   * @method end
   */
  end() {
    if (this.options.hurry) {
      return;
    }
    this.log(yosay(tsmlj`
      All done; ${chalk.green(this.context.pluginName)} is ready to go!
    `));
  }
});
