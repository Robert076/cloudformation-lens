import * as vscode from "vscode";
import { parseTemplate } from "../parser/template";

export class CfnDefinitionProvider implements vscode.DefinitionProvider {
        provideDefinition(
                document: vscode.TextDocument,
                position: vscode.Position,
        ): vscode.Location | null {
                const line = document.lineAt(position).text;
                const wordRange = document.getWordRangeAtPosition(position, /[\w]+/);
                if (!wordRange) return null;

                const word = document.getText(wordRange);
                const linePrefix = line.substring(0, wordRange.end.character);

                // Only trigger for !Ref, !GetAtt, or ${...} contexts
                const isRef = linePrefix.match(/!\s*Ref\s+[\w]*$/);
                const isGetAtt = linePrefix.match(/!\s*GetAtt\s+[\w]*$/);
                const isSubVar = linePrefix.match(/\$\{[\w]*$/);
                const isGetAttDot = linePrefix.match(/!\s*GetAtt\s+[\w]+\.[\w]*$/);

                if (!isRef && !isGetAtt && !isSubVar && !isGetAttDot) return null;

                // For !GetAtt MyBucket.Arn — if cursor is on the attribute, jump to the resource
                let targetName = word;
                if (isGetAttDot) {
                        const dotMatch = linePrefix.match(/!\s*GetAtt\s+([\w]+)\./);
                        if (dotMatch) {
                                targetName = dotMatch[1];
                        }
                }

                const template = parseTemplate(document);

                // Check resources first
                const resource = template.resources[targetName];
                if (resource) {
                        const targetPos = new vscode.Position(resource.line, 0);
                        return new vscode.Location(document.uri, targetPos);
                }

                // Check parameters — we need to find the line number
                if (template.parameters.includes(targetName)) {
                        const paramLine = this.findKeyLine(document, "Parameters", targetName);
                        if (paramLine !== null) {
                                const targetPos = new vscode.Position(paramLine, 0);
                                return new vscode.Location(document.uri, targetPos);
                        }
                }

                return null;
        }

        // Find the line number of a key inside a top-level section
        private findKeyLine(
                document: vscode.TextDocument,
                section: string,
                key: string,
        ): number | null {
                let inSection = false;

                for (let i = 0; i < document.lineCount; i++) {
                        const line = document.lineAt(i).text;

                        // Check if we're entering the target section
                        if (line.match(new RegExp(`^${section}:`))) {
                                inSection = true;
                                continue;
                        }

                        // If we hit another top-level key, stop
                        if (inSection && line.match(/^\S/) && !line.startsWith("#")) {
                                break;
                        }

                        // Look for the key inside the section
                        if (inSection && line.match(new RegExp(`^\\s+${key}:`))) {
                                return i;
                        }
                }

                return null;
        }
}
