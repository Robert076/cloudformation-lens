import * as vscode from "vscode";
import { parseTemplate } from "../parser/template";
import { resources } from "../data/resources";

export class CfnDiagnosticsProvider {
        private collection: vscode.DiagnosticCollection;

        constructor() {
                this.collection =
                        vscode.languages.createDiagnosticCollection("cloudformation-lens");
        }

        public update(document: vscode.TextDocument): void {
                if (
                        document.languageId !== "yaml" &&
                        document.languageId !== "cloudformation"
                ) {
                        return;
                }

                if (!document.getText().includes("Resources:")) {
                        this.collection.delete(document.uri);
                        return;
                }

                const template = parseTemplate(document);
                const diagnostics: vscode.Diagnostic[] = [];

                for (const [logicalId, resource] of Object.entries(template.resources)) {
                        const resourceDef = resources[resource.type];
                        if (!resourceDef) continue;

                        // Find which required properties are missing
                        const missingProps = Object.entries(resourceDef.properties)
                                .filter(
                                        ([propName, prop]) =>
                                                prop.required &&
                                                !resource.properties.includes(propName),
                                )
                                .map(([propName]) => propName);

                        if (missingProps.length === 0) continue;

                        // Put the squiggly on the logical ID line
                        const line = resource.line;
                        const lineText = document.lineAt(line).text;
                        const startChar = lineText.indexOf(logicalId);
                        const endChar = startChar + logicalId.length;

                        const range = new vscode.Range(line, startChar, line, endChar);

                        const message = `${logicalId} (${resource.type}) is missing required ${missingProps.length === 1 ? "property" : "properties"}: ${missingProps.join(", ")}`;

                        const diagnostic = new vscode.Diagnostic(
                                range,
                                message,
                                vscode.DiagnosticSeverity.Warning,
                        );

                        // Tag it so users know it's from us
                        diagnostic.source = "CloudFormation Lens";

                        diagnostics.push(diagnostic);
                }

                this.collection.set(document.uri, diagnostics);
        }

        public dispose(): void {
                this.collection.dispose();
        }
}
