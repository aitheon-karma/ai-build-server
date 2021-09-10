
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
const rimrafLib = require('rimraf');

export const mkdir = util.promisify(fs.mkdir);
export const exists = util.promisify(fs.exists);
export const rimraf = util.promisify(rimrafLib);
export const readdir = util.promisify(fs.readdir);
export const stat = util.promisify(fs.stat);
export const readFile = util.promisify(fs.readFile);
export const open = util.promisify(fs.open);
export const rename = util.promisify(fs.rename);
export const unlink = util.promisify(fs.unlink);
export const writeFile = util.promisify(fs.writeFile);

export const ensureDir = (dirPath: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!await exists(dirPath)) {
                await ensureDir(path.dirname(dirPath));
                await mkdir(dirPath);
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });
};
