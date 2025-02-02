import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

export interface ExportDetails {
  matchingExports: string[];
  allExports: string[];
}

function findMatchingExports(dirPath: string): {
  [filePath: string]: ExportDetails;
} {
  const tsFiles: string[] = [];
  const fileExports: { [filePath: string]: ExportDetails } = {};

  // Find all .ts files in the specified directory (non-recursive)
  function findTsFiles(currentPath: string): void {
    const files = fs.readdirSync(currentPath);

    for (const file of files) {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && file.endsWith(".ts")) {
        tsFiles.push(fullPath);
      }
    }
  }

  findTsFiles(dirPath);

  // Function to check if a node matches the desired export function
  function isMatchingExport(node: ts.Node): boolean {
    if (ts.isFunctionDeclaration(node)) {
      const isAsync =
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
        ) ?? false;

      if (isAsync && node.parameters.length === 1) {
        const param = node.parameters[0];
        if (!param) return false;

        if (ts.isObjectBindingPattern(param.name)) {
          const elements = param.name.elements;
          const hasPage = elements.some((el) => el.name.getText() === "page");
          const hasContext = elements.some(
            (el) => el.name.getText() === "context"
          );
          const hasStagehand = elements.some(
            (el) => el.name.getText() === "stagehand"
          );

          if (hasPage && hasContext && hasStagehand) {
            const type = param.type;
            if (type && ts.isTypeLiteralNode(type)) {
              const properties = type.members;
              const hasPageType = properties.some(
                (prop) =>
                  ts.isPropertySignature(prop) &&
                  prop.name?.getText() === "page" &&
                  prop.type?.getText() === "Page"
              );
              const hasContextType = properties.some(
                (prop) =>
                  ts.isPropertySignature(prop) &&
                  prop.name?.getText() === "context" &&
                  prop.type?.getText() === "BrowserContext"
              );
              const hasStagehandType = properties.some(
                (prop) =>
                  ts.isPropertySignature(prop) &&
                  prop.name?.getText() === "stagehand" &&
                  prop.type?.getText() === "Stagehand"
              );

              return hasPageType && hasContextType && hasStagehandType;
            }
          }
        }
      }
    }
    return false;
  }

  // Function to collect all exports from a file and check for matching exports
  function collectExportsAndCheckMatch(
    sourceFile: ts.SourceFile
  ): ExportDetails {
    const allExports: string[] = [];
    const matchingExports: string[] = [];
    const functionDeclarations: Map<string, ts.FunctionDeclaration> = new Map();
    const matchingFunctions: Set<string> = new Set();

    sourceFile.forEachChild((node) => {
      // First pass: collect all function declarations and check if they match
      if (ts.isFunctionDeclaration(node) && node.name) {
        const functionName = node.name.getText();
        functionDeclarations.set(functionName, node);
        if (isMatchingExport(node)) {
          matchingFunctions.add(functionName);
        }
      }

      if (ts.isExportAssignment(node)) {
        allExports.push("default");
        if (ts.isIdentifier(node.expression)) {
          const functionName = node.expression.getText();
          // Check if this identifier refers to a matching function
          if (matchingFunctions.has(functionName)) {
            matchingExports.push("default");
          }
        } else if (
          ts.isFunctionExpression(node.expression) ||
          ts.isArrowFunction(node.expression)
        ) {
          if (isMatchingExport(node.expression)) {
            matchingExports.push("default");
          }
        }
      } else if (
        ts.isExportDeclaration(node) &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause)
      ) {
        node.exportClause.elements.forEach((element) => {
          allExports.push(element.name.getText());
        });
      } else if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isVariableStatement(node)) &&
        node.modifiers?.some(
          (modifier: ts.ModifierLike) =>
            modifier.kind === ts.SyntaxKind.ExportKeyword
        )
      ) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          const functionName = node.name.getText();
          allExports.push(functionName);
          if (isMatchingExport(node)) {
            matchingExports.push(functionName);
          }
        } else if (ts.isClassDeclaration(node) && node.name) {
          allExports.push(node.name.getText());
        } else if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((declaration) => {
            if (ts.isIdentifier(declaration.name)) {
              allExports.push(declaration.name.getText());
            }
          });
        }
      }
    });

    return { matchingExports, allExports };
  }

  // Read each file and check for the matching export
  for (const filePath of tsFiles) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    const { matchingExports, allExports } =
      collectExportsAndCheckMatch(sourceFile);

    fileExports[filePath] = { matchingExports, allExports };
  }

  // Filter out files without matching exports
  const filteredFileExports = Object.fromEntries(
    Object.entries(fileExports).filter(
      ([_, details]) => details.matchingExports.length > 0
    )
  );

  return filteredFileExports;
}

export { findMatchingExports };
