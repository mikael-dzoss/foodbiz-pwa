import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const FORM_CONTROL_TAGS = new Set([
  "Input",
  "Textarea",
  "NativeSelect",
  "SelectTrigger",
  "input",
  "textarea",
  "select",
]);

// Unprefixed utility classes that render form controls below 16px on mobile and trigger iOS Safari auto-zoom.
const SMALL_TEXT_CLASS_RE =
  /(?:^|[\s"'`])text-(?:(?:xs|sm|caption|micro|body-sm|label-sm|label-md|label-strong)(?:\/\S+)?|\[\d*\.?\d+(?:px|r?em)\])(?=$|[\s"'`])/;

function collectTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Form control mobile font size (#353)", () => {
  it("never overrides form controls below 16px without a breakpoint prefix", () => {
    const root = process.cwd();
    const srcDir = join(root, "src");
    const offenders: string[] = [];

    for (const file of collectTsxFiles(srcDir)) {
      const sourceText = readFileSync(file, "utf8");
      const sourceFile = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tagName = node.tagName.getText(sourceFile);
          if (FORM_CONTROL_TAGS.has(tagName)) {
            const classAttr = node.attributes.properties.find(
              (prop): prop is ts.JsxAttribute =>
                ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === "className",
            );
            const classText = classAttr?.initializer?.getText(sourceFile) ?? "";
            const match = SMALL_TEXT_CLASS_RE.exec(classText);
            if (match) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              offenders.push(
                `${relative(root, file)}:${line + 1} <${tagName}> (${match[0].trim()})`,
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    expect(offenders).toEqual([]);
  });
});
