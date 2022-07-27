import * as fse from "fs-extra";
import * as path from "path";

function isFolderSync(path: string) {
  try {
    return fse.statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

function rewriteSourceValue(sourceValue: string, relativeDirname: string) {
  if (sourceValue.startsWith(".") && sourceValue.endsWith(".js") === false) {
    const targetPath = path.resolve(relativeDirname, sourceValue);
    // If the target path is a folder, we need to import from the index.js file
    if (isFolderSync(targetPath)) {
      sourceValue += "/index";
    }
    sourceValue += ".js";
  }
  return sourceValue;
}

/**
 * Rewrite import and export statements to append the correct .js file extension when needed
 */
export function rewriteCodeImports(
  fileContents: string,
  absoluteFilePath: string
): string {
  const relativeDirname = path.dirname(absoluteFilePath);

  return fileContents.replace(
    /* this regex should hopefully catch all kind of import/export expressions that are relative. */
    /((?:import|export)\s+[\s\w,{}*]*\s+from\s+["'])((?:\.\/|\.\.\/)(?:(?!\.js).)+)(["'])/g,
    (_, importFromPart, modulePath, hyphenEndPart) => {
      const sourcePath = rewriteSourceValue(modulePath, relativeDirname);
      return `${importFromPart}${sourcePath}${hyphenEndPart}`;
    }
  );
}
