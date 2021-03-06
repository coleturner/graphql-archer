import shush from 'shush';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import mkdirp from 'mkdirp';
import merge from 'lodash.mergewith';
import { fail } from './output';
import packageJSON from '../../package.json';
import toPascalCase from 'to-pascal-case';

import { success } from '../lib/output';

const { name, version } = packageJSON;

const settings = parseRCFile(path.join(__dirname, '../../.archerrc'));

export function parseRCFile(fileName) {
  return shush(fileName);
}

export const getPluginSagasObject = () => getPluginPropertiesObject('saga');
export const getPluginReducersObject = () => {
  return getPluginPropertiesObject('reducer');
};

export function getPluginPropertiesObject(prop) {
  const { plugins = [] } = settings;
  return plugins.reduce((map, plugin) => {
    const pluginName = `${name}-${plugin}`;
    try {
      const module = require(pluginName);

      if (!(prop in module)) {
        return map;
      }

      map[pluginName] = module[prop];
      return map;
    } catch (e) {
      fail(
        `Unable to import plugin ${chalk.bgWhite(` ${pluginName} `)}`,
        e.message
      );
      fail(e.stack);
      return map;
    }
  }, {});
}

export function getPackageVersion() {
  return version;
}

export function getPackageName() {
  return name;
}

export function getFileSpaces() {
  return parseInt(settings.indent) || 2;
}

export function toFileSystemName(str) {
  return str.replace(/[^a-zA-Z0-9-]/g, '');
}

export function toGraphQLTypeName(str) {
  return toPascalCase(
    str
      .replace(/^[0-9]/, '') // remove leading numbers
      .replace(/[^a-zA-Z0-9]/g, '') // remove non alphanumeric characters
  );
}

export function updateJSONFile(file, updater) {
  // TODO: Find a way to retain comments, AST parsing?
  const json = shush(file);
  const mutatedJSON = updater(json);

  fs.writeFile(file, JSON.stringify(mutatedJSON, null, 2));
}

export function createProject(name) {
  const cwd = path.resolve(`./${name}`);
  if (fs.existsSync(cwd)) {
    throw new Error(`Path ${cwd} already exists, aborting...`);
  }

  // Make our project folder
  mkdirp(cwd);

  // Copy our root template
  const templatePath = path.resolve(path.join(__dirname), '../../template/');
  fs.copySync(templatePath, cwd);
  success(`Copied base project to ${chalk.magenta(cwd)}`);

  // Modify package.json
  const packageDotJSON = path.resolve(path.join(cwd, 'package.json'));
  updateJSONFile(packageDotJSON, json => {
    return {
      ...json,
      name,
    };
  });

  return {
    name,
    cwd,
  };
}

export function inProject() {
  return fs.existsSync(path.resolve(path.join(process.cwd(), './.archerrc')));
}

export function addPackageObjects(packageJSONFile, objects) {
  updateJSONFile(packageJSONFile, json => {
    const data = { ...json };
    Object.keys(objects).forEach(key => {
      data[key] = {
        ...data[key],
        ...objects[key],
      };
    });

    return data;
  });
}

function deepMergeCustomizer(obj, src) {
  if (Array.isArray(obj)) {
    return obj.concat(src);
  } else if (typeof obj === 'object' && typeof src === 'object') {
    return merge(obj, src, deepMergeCustomizer);
  }

  return src;
}

export function deepMerge(a, b) {
  return merge(a, b, deepMergeCustomizer);
}

export function getTruthySorter(defaultValue) {
  return (a, b) => {
    const x = a.value === defaultValue;
    const y = b.value === defaultValue;

    if (x === y) {
      return 0;
    }

    return x ? -1 : 1;
  };
}

export function getSchemaPath() {
  return settings.schemaPath || './src/schema/';
}

export function getDependencyPackageVersion(packageName) {
  const packageJSON = shush(path.join(__dirname, '../../package.json'));

  if (packageName in packageJSON.dependencies) {
    return packageJSON.dependencies[packageName];
  } else if (packageName in packageJSON.devDependencies) {
    return packageJSON.devDependencies[packageName];
  }

  throw new Error(`Unable to find dependency package: ${packageName}`);
}
