import _ from 'lodash';
import tsmlj from 'tsmlj';
import {PREFIX} from './constants';

/**
 * Validates that a plugin name does not include invalid characters or start
 * with the "videojs-" prefix.
 *
 * @param  {String} input
 * @return {String|Boolean}
 */
const name = input => {

  if (!(/^[a-z][a-z0-9-]+$/).test(input)) {
    return tsmlj`
      Names must start with a lower-case letter and contain
      only lower-case letters (a-z), digits (0-9), and hyphens (-).
    `;
  }

  if (_.startsWith(input, PREFIX)) {
    return tsmlj`
      Plugins cannot start with "${PREFIX}"; it will automatically
      be prepended!
    `;
  }

  return true;
};

/**
 * Validates that an npm package scope includes @, but not /.
 *
 * @param  {String} input
 * @return {String|Boolean}
 */
const scope = input => {

  if (input && _.startsWith(input, '@')) {
    return 'Do not begin your scope with "@", it will be automatically added.';
  }

  if (input && _.endsWith(input, '/')) {
    return tsmlj`
      Do not include a trailing "/" in your package scope,
      it will be automatically added.
    `;
  }

  return true;
};

export {name, scope};
