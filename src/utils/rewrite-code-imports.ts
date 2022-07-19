import { parse } from "@babel/parser";
import generate from "@babel/generator";
import traverse from "@babel/traverse";
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
  const ast = parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  const relativeDirname = path.dirname(absoluteFilePath);

  traverse(ast, {
    ImportDeclaration(nodePath) {
      nodePath.node.source.value = rewriteSourceValue(
        nodePath.node.source.value,
        relativeDirname
      );
    },
    ExportDeclaration(nodePath) {
      if (
        nodePath.node.type !== "ExportDefaultDeclaration" &&
        nodePath.node.source
      ) {
        nodePath.node.source.value = rewriteSourceValue(
          nodePath.node.source.value,
          relativeDirname
        );
      }
    },
  });

  return generate(ast).code;
}
