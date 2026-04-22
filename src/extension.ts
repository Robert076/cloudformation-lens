import * as vscode from "vscode";
import { CfnCompletionProvider } from "./providers/completion";
import { CfnDiagnosticsProvider } from "./providers/diagnostics";
import { CfnHoverProvider } from "./providers/hover";

function isCfnTemplate(document: vscode.TextDocument): boolean {
        const text = document.getText();
        return (
                text.includes("Resources:") &&
                (text.includes("AWSTemplateFormatVersion") || text.includes("Type: AWS::"))
        );
}

async function detectAndSwitch(document: vscode.TextDocument): Promise<void> {
        if (document.languageId === "yaml" && isCfnTemplate(document)) {
                await vscode.languages.setTextDocumentLanguage(document, "cloudformation");
        }
}

export function activate(context: vscode.ExtensionContext) {
        console.log("CloudFormation Lens is active");

        const selector: vscode.DocumentSelector = [
                { language: "yaml", scheme: "file" },
                { language: "cloudformation", scheme: "file" },
        ];

        // Auto-detect and switch language for already open documents
        vscode.workspace.textDocuments.forEach(detectAndSwitch);

        // Auto-detect and switch language for newly opened documents
        const onOpen = vscode.workspace.onDidOpenTextDocument(detectAndSwitch);

        // Register completion provider for both yaml and cloudformation
        const completionProvider = vscode.languages.registerCompletionItemProvider(
                selector,
                new CfnCompletionProvider(),
                ".",
                ":",
                " ",
        );

        // Register diagnostics provider
        const diagnosticsProvider = new CfnDiagnosticsProvider();

        const hoverProvider = vscode.languages.registerHoverProvider(
                selector,
                new CfnHoverProvider(),
        );

        if (vscode.window.activeTextEditor) {
                diagnosticsProvider.update(vscode.window.activeTextEditor.document);
        }

        const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
                diagnosticsProvider.update(e.document);
        });

        context.subscriptions.push(
                completionProvider,
                onOpen,
                onChange,
                diagnosticsProvider,
                hoverProvider,
        );
}

export function deactivate() {}
