#!/usr/bin/env node

import { join } from "path";
import { writeFileSync } from 'fs';

function readPackageJson(path: string) {
    const mod = require(join(path, './package.json'));
    return mod.default || mod;
}
const cwd = process.cwd();
const srcPackageJson = readPackageJson(cwd);
const distPackageJson = readPackageJson(join(cwd, './dist'));

distPackageJson.version = srcPackageJson.version;
if ('dependencies' in srcPackageJson) {
    distPackageJson.dependencies = srcPackageJson.dependencies;
}
if ('peerDependencies' in srcPackageJson) {
    distPackageJson.peerDependencies = srcPackageJson.peerDependencies;
}
if ('optionalDependencies' in srcPackageJson) {
    distPackageJson.optionalDependencies = srcPackageJson.optionalDependencies;
}
if ('sideEffects' in srcPackageJson) {
    distPackageJson.sideEffects = srcPackageJson.sideEffects;
}

writeFileSync(join(cwd, './dist/package.json'), JSON.stringify(distPackageJson, null, 2));
