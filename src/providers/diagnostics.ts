import * as vscode from "vscode";
import { parseTemplate } from "../parser/template";
import { resources } from "../data/resources";

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
                const text = document.getText();

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
                const validRefTargets = new Set<string>([
                        ...Object.keys(template.resources),
                        ...template.parameters,
                        ...PSEUDO_PARAMETERS,
                ]);

                const refRegex = /!\s*Ref\s+(\S+)/g;
                let match;

                while ((match = refRegex.exec(text)) !== null) {
                        const refTarget = match[1];
                        if (validRefTargets.has(refTarget)) continue;

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

                // --- Invalid !GetAtt targets ---
                const getAttRegex = /!\s*GetAtt\s+([\w]+)\.([\w]+)/g;

                while ((match = getAttRegex.exec(text)) !== null) {
                        const logicalId = match[1];
                        const attribute = match[2];

                        const resource = template.resources[logicalId];

                        if (!resource) {
                                // Resource doesn't exist
                                const targetStart = match.index + match[0].indexOf(logicalId);
                                const startPos = document.positionAt(targetStart);
                                const endPos = document.positionAt(
                                        targetStart + logicalId.length,
                                );
                                const range = new vscode.Range(startPos, endPos);

                                const diagnostic = new vscode.Diagnostic(
                                        range,
                                        `"${logicalId}" is not a valid !GetAtt target. No resource with this name exists in the template.`,
                                        vscode.DiagnosticSeverity.Warning,
                                );
                                diagnostic.source = "CloudFormation Lens";
                                diagnostics.push(diagnostic);
                                continue;
                        }

                        // Resource exists — check if the attribute is valid
                        const resourceDef = resources[resource.type];
                        if (!resourceDef) continue;

                        if (!resourceDef.attributes.includes(attribute)) {
                                const attrStart = match.index + match[0].indexOf(attribute);
                                const startPos = document.positionAt(attrStart);
                                const endPos = document.positionAt(
                                        attrStart + attribute.length,
                                );
                                const range = new vscode.Range(startPos, endPos);

                                const diagnostic = new vscode.Diagnostic(
                                        range,
                                        `"${attribute}" is not a valid attribute of ${logicalId} (${resource.type}). Available attributes: ${resourceDef.attributes.join(", ") || "none"}`,
                                        vscode.DiagnosticSeverity.Warning,
                                );
                                diagnostic.source = "CloudFormation Lens";
                                diagnostics.push(diagnostic);
                        }
                }

                this.collection.set(document.uri, diagnostics);
        }

        public dispose(): void {
                this.collection.dispose();
        }
}
