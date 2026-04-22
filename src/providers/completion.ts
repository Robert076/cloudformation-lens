import * as vscode from "vscode";
import { parseTemplate } from "../parser/template";
import { resources } from "../data/resources";

export class CfnCompletionProvider implements vscode.CompletionItemProvider {
        provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position,
        ): vscode.CompletionItem[] {
                const linePrefix = document
                        .lineAt(position)
                        .text.substring(0, position.character);

                // Context 1: AWS:: resource type
                if (linePrefix.match(/Type:\s*AWS::\S*$/) || linePrefix.match(/AWS::\S*$/)) {
                        return this.getResourceTypeCompletions(linePrefix, document, position);
                }

                // Context 2: !Ref
                if (linePrefix.match(/!\s*Ref\s+\S*$/)) {
                        return this.getRefCompletions(document);
                }

                // Context 3: !GetAtt
                if (linePrefix.match(/!\s*GetAtt\s+[\w.]*$/)) {
                        return this.getGetAttCompletions(document, linePrefix, position);
                }

                // Context 4: !ImportValue
                if (linePrefix.match(/!\s*ImportValue\s+\S*$/)) {
                        return this.getImportValueCompletions(document);
                }

                // Context 5: Properties inside a resource block
                const propertyCompletions = this.getPropertyCompletions(document, position);
                if (propertyCompletions.length > 0) {
                        return propertyCompletions;
                }

                return [];
        }

        // --- !Ref completions ---
        private getRefCompletions(document: vscode.TextDocument): vscode.CompletionItem[] {
                const template = parseTemplate(document);
                const items: vscode.CompletionItem[] = [];

                for (const [logicalId, resource] of Object.entries(template.resources)) {
                        const item = new vscode.CompletionItem(
                                logicalId,
                                vscode.CompletionItemKind.Reference,
                        );
                        item.detail = resource.type;
                        item.documentation = `Reference to the ${logicalId} resource (${resource.type})`;
                        items.push(item);
                }

                for (const paramName of template.parameters) {
                        const item = new vscode.CompletionItem(
                                paramName,
                                vscode.CompletionItemKind.Variable,
                        );
                        item.detail = "Parameter";
                        item.documentation = `Reference to the ${paramName} parameter`;
                        items.push(item);
                }

                return items;
        }

        // --- !GetAtt completions ---
        private getGetAttCompletions(
                document: vscode.TextDocument,
                linePrefix: string,
                position: vscode.Position,
        ): vscode.CompletionItem[] {
                const template = parseTemplate(document);
                const items: vscode.CompletionItem[] = [];

                const dotMatch = linePrefix.match(/!\s*GetAtt\s+([\w]+)\.([\w]*)$/);

                if (dotMatch) {
                        // Stage 2 — show attributes for the selected resource
                        const logicalId = dotMatch[1];
                        const resourceType = template.resources[logicalId]?.type;
                        if (!resourceType) return [];

                        const resourceDef = resources[resourceType];
                        if (!resourceDef) return [];

                        const typed = dotMatch[2];
                        const startChar = position.character - typed.length;
                        const range = new vscode.Range(
                                position.line,
                                startChar,
                                position.line,
                                position.character,
                        );

                        for (const attr of resourceDef.attributes) {
                                const item = new vscode.CompletionItem(
                                        attr,
                                        vscode.CompletionItemKind.Property,
                                );
                                item.detail = `${logicalId} attribute`;
                                item.documentation = new vscode.MarkdownString(
                                        `GetAtt attribute of \`${logicalId}\` (${resourceType})`,
                                );
                                item.range = range;
                                items.push(item);
                        }
                } else {
                        // Stage 1 — show all resource logical IDs
                        const noDotMatch = linePrefix.match(/!\s*GetAtt\s+([\w]*)$/);
                        const typed = noDotMatch ? noDotMatch[1] : "";
                        const startChar = position.character - typed.length;
                        const range = new vscode.Range(
                                position.line,
                                startChar,
                                position.line,
                                position.character,
                        );

                        for (const [logicalId, resource] of Object.entries(
                                template.resources,
                        )) {
                                const item = new vscode.CompletionItem(
                                        logicalId,
                                        vscode.CompletionItemKind.Reference,
                                );
                                item.detail = resource.type;
                                item.documentation = `GetAtt target: ${logicalId} (${resource.type})`;
                                item.insertText = `${logicalId}.`;
                                item.range = range;
                                item.command = {
                                        command: "editor.action.triggerSuggest",
                                        title: "Trigger attribute suggestions",
                                };
                                items.push(item);
                        }
                }

                return items;
        }

        // --- !ImportValue completions ---
        private getImportValueCompletions(
                document: vscode.TextDocument,
        ): vscode.CompletionItem[] {
                const template = parseTemplate(document);
                const items: vscode.CompletionItem[] = [];

                for (const outputName of template.outputs) {
                        const item = new vscode.CompletionItem(
                                outputName,
                                vscode.CompletionItemKind.Value,
                        );
                        item.detail = "Output";
                        item.documentation = `Import the exported value of ${outputName}`;
                        items.push(item);
                }

                return items;
        }

        // --- AWS:: resource type completions ---
        private getResourceTypeCompletions(
                linePrefix: string,
                document: vscode.TextDocument,
                position: vscode.Position,
        ): vscode.CompletionItem[] {
                const items: vscode.CompletionItem[] = [];

                const match = linePrefix.match(/(?:Type:\s*|^)(AWS::\S*)$/);
                const typed = match ? match[1] : "AWS::";

                const startChar = position.character - typed.length;
                const range = new vscode.Range(
                        position.line,
                        startChar,
                        position.line,
                        position.character,
                );

                for (const [typeName, resource] of Object.entries(resources)) {
                        if (!typeName.startsWith(typed)) continue;

                        const item = new vscode.CompletionItem(
                                typeName,
                                vscode.CompletionItemKind.Class,
                        );
                        item.detail = resource.description;
                        item.documentation = new vscode.MarkdownString(resource.description);
                        item.range = range;
                        items.push(item);
                }

                return items;
        }

        // --- Property completions ---
        private getPropertyCompletions(
                document: vscode.TextDocument,
                position: vscode.Position,
        ): vscode.CompletionItem[] {
                const resourceType = this.findParentResourceType(document, position);
                if (!resourceType) return [];

                const resourceDef = resources[resourceType];
                if (!resourceDef) return [];

                const items: vscode.CompletionItem[] = [];

                for (const [propName, prop] of Object.entries(resourceDef.properties)) {
                        const item = new vscode.CompletionItem(
                                propName,
                                vscode.CompletionItemKind.Field,
                        );
                        item.detail = `${prop.type}${prop.required ? " (required)" : ""}`;
                        item.documentation = new vscode.MarkdownString(prop.description);
                        items.push(item);
                }

                return items;
        }

        // Walk upward from the cursor to find what resource type we're inside
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
                                if (typeMatch) {
                                        return typeMatch[1];
                                }
                        }

                        if (lineIndent === 0 && line.trim() !== "") break;
                }

                return null;
        }

        private getIndent(line: string): number {
                return line.match(/^(\s*)/)?.[1].length ?? 0;
        }
}
