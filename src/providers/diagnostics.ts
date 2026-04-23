import * as vscode from "vscode";
import { parseTemplate } from "../parser/template";
import { resources } from "../data/resources";

// These are always valid !Ref targets even though they're
// not defined anywhere in the template
const PSEUDO_PARAMETERS = [
        "AWS::AccountId",
        "AWS::NotificationARNs",
        "AWS::NoValue",
        "AWS::Partition",
        "AWS::Region",
        "AWS::StackId",
        "AWS::StackName",
        "AWS::URLSuffix",
];

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

                // --- Missing required properties ---
                for (const [logicalId, resource] of Object.entries(template.resources)) {
                        const resourceDef = resources[resource.type];
                        if (!resourceDef) continue;

                        const missingProps = Object.entries(resourceDef.properties)
                                .filter(
                                        ([propName, prop]) =>
                                                prop.required &&
                                                !resource.properties.includes(propName),
                                )
                                .map(([propName]) => propName);

                        if (missingProps.length === 0) continue;

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
                        diagnostic.source = "CloudFormation Lens";
                        diagnostics.push(diagnostic);
                }

                // --- Invalid !Ref targets ---
                // Build a set of all valid !Ref targets
                const validRefTargets = new Set<string>([
                        ...Object.keys(template.resources),
                        ...template.parameters,
                        ...PSEUDO_PARAMETERS,
                ]);

                const text = document.getText();
                const refRegex = /!\s*Ref\s+(\S+)/g;
                let match;

                while ((match = refRegex.exec(text)) !== null) {
                        const refTarget = match[1];

                        if (validRefTargets.has(refTarget)) continue;

                        // Convert the character offset to a position
                        const targetStart = match.index + match[0].indexOf(refTarget);
                        const startPos = document.positionAt(targetStart);
                        const endPos = document.positionAt(targetStart + refTarget.length);
                        const range = new vscode.Range(startPos, endPos);

                        const diagnostic = new vscode.Diagnostic(
                                range,
                                `"${refTarget}" is not a valid !Ref target. No resource or parameter with this name exists in the template.`,
                                vscode.DiagnosticSeverity.Warning,
                        );
                        diagnostic.source = "CloudFormation Lens";
                        diagnostics.push(diagnostic);
                }

                this.collection.set(document.uri, diagnostics);
        }

        public dispose(): void {
                this.collection.dispose();
        }
}
