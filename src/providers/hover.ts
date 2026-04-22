import * as vscode from "vscode";
import { parseTemplate } from "../parser/template";
import { resources } from "../data/resources";

export class CfnHoverProvider implements vscode.HoverProvider {
        provideHover(
                document: vscode.TextDocument,
                position: vscode.Position,
        ): vscode.Hover | null {
                const line = document.lineAt(position).text;
                const wordRange = document.getWordRangeAtPosition(position, /[\w:]+/);
                if (!wordRange) return null;

                const word = document.getText(wordRange);

                // Case 1: hovering over a resource type like AWS::Lambda::Function
                const resourceTypeHover = this.getResourceTypeHover(line, word, wordRange);
                if (resourceTypeHover) return resourceTypeHover;

                // Case 2: hovering over a property name
                const propertyHover = this.getPropertyHover(
                        document,
                        position,
                        word,
                        wordRange,
                );
                if (propertyHover) return propertyHover;

                // Case 3: hovering over a logical ID
                const logicalIdHover = this.getLogicalIdHover(document, word, wordRange);
                if (logicalIdHover) return logicalIdHover;

                return null;
        }

        // Hover over AWS::Lambda::Function on a Type: line
        private getResourceTypeHover(
                line: string,
                word: string,
                wordRange: vscode.Range,
        ): vscode.Hover | null {
                // Only trigger on lines that look like "Type: AWS::..."
                if (!line.match(/Type:\s*AWS::/)) return null;

                // Get the full resource type from the line since word only
                // gets one segment e.g "Function" not "AWS::Lambda::Function"
                const typeMatch = line.match(/Type:\s*(AWS::\S+)/);
                if (!typeMatch) return null;

                const typeName = typeMatch[1];
                const resourceDef = resources[typeName];
                if (!resourceDef) return null;

                const requiredProps = Object.entries(resourceDef.properties)
                        .filter(([, prop]) => prop.required)
                        .map(([name]) => `\`${name}\``)
                        .join(", ");

                const md = new vscode.MarkdownString();
                md.appendMarkdown(`### ${typeName}\n\n`);
                md.appendMarkdown(`${resourceDef.description}\n\n`);
                if (requiredProps) {
                        md.appendMarkdown(`**Required properties:** ${requiredProps}\n\n`);
                }
                md.appendMarkdown(
                        `**Total properties:** ${Object.keys(resourceDef.properties).length}`,
                );

                return new vscode.Hover(md, wordRange);
        }

        // Hover over a property name inside a Properties block
        private getPropertyHover(
                document: vscode.TextDocument,
                position: vscode.Position,
                word: string,
                wordRange: vscode.Range,
        ): vscode.Hover | null {
                const line = document.lineAt(position).text;

                // Must look like a YAML key on this line
                if (!line.match(/^\s*[\w]+\s*:/)) return null;

                // Walk upward to find the parent resource type
                const resourceType = this.findParentResourceType(document, position);
                if (!resourceType) return null;

                const resourceDef = resources[resourceType];
                if (!resourceDef) return null;

                const propDef = resourceDef.properties[word];
                if (!propDef) return null;

                const md = new vscode.MarkdownString();
                md.appendMarkdown(`### ${word}\n\n`);
                md.appendMarkdown(`${propDef.description}\n\n`);
                md.appendMarkdown(`**Type:** \`${propDef.type}\`  \n`);
                md.appendMarkdown(`**Required:** ${propDef.required ? "✅ Yes" : "No"}`);

                return new vscode.Hover(md, wordRange);
        }

        // Hover over a logical ID like MyBucket
        private getLogicalIdHover(
                document: vscode.TextDocument,
                word: string,
                wordRange: vscode.Range,
        ): vscode.Hover | null {
                const template = parseTemplate(document);
                const resource = template.resources[word];
                if (!resource) return null;

                const resourceDef = resources[resource.type];

                const md = new vscode.MarkdownString();
                md.appendMarkdown(`### ${word}\n\n`);
                md.appendMarkdown(`**Type:** \`${resource.type}\`\n\n`);

                if (resourceDef) {
                        md.appendMarkdown(`${resourceDef.description}\n\n`);

                        if (resourceDef.attributes.length > 0) {
                                const attrs = resourceDef.attributes
                                        .map((a) => `\`${word}.${a}\``)
                                        .join(", ");
                                md.appendMarkdown(`**GetAtt attributes:** ${attrs}`);
                        }
                }

                return new vscode.Hover(md, wordRange);
        }

        // Same upward walk as completion provider
        private findParentResourceType(
                document: vscode.TextDocument,
                position: vscode.Position,
        ): string | null {
                const currentIndent = this.getIndent(document.lineAt(position).text);

                for (let i = position.line - 1; i >= 0; i--) {
                        const line = document.lineAt(i).text;
                        if (line.trim() === "") continue;

                        const lineIndent = this.getIndent(line);

                        if (lineIndent < currentIndent) {
                                const typeMatch = line.match(/^\s*Type:\s*(AWS::\S+)/);
                                if (typeMatch) return typeMatch[1];
                        }

                        if (lineIndent === 0 && line.trim() !== "") break;
                }

                return null;
        }

        private getIndent(line: string): number {
                return line.match(/^(\s*)/)?.[1].length ?? 0;
        }
}
