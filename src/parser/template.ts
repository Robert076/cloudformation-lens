import * as vscode from "vscode";
import { parse, parseDocument } from "yaml";

export interface CfnResource {
        type: string; // AWS::S3::Bucket
        line: number; // line number of the logical ID
        properties: string[]; // property keys actually present in the template
}

export interface CfnTemplate {
        resources: Record<string, CfnResource>; // logical name -> resource info
        parameters: string[];
        outputs: string[];
}

const EMPTY_TEMPLATE: CfnTemplate = {
        resources: {},
        parameters: [],
        outputs: [],
};

export function parseTemplate(document: vscode.TextDocument): CfnTemplate {
        const text = document.getText();

        if (!text.includes("Resources:")) {
                return EMPTY_TEMPLATE;
        }

        let parsed: any;
        try {
                parsed = parse(text);
        } catch {
                return EMPTY_TEMPLATE;
        }

        if (!parsed || typeof parsed !== "object") {
                return EMPTY_TEMPLATE;
        }

        // We use parseDocument separately to get line numbers from the AST
        let doc: any;
        try {
                doc = parseDocument(text);
        } catch {
                return EMPTY_TEMPLATE;
        }

        const resources: Record<string, CfnResource> = {};

        if (parsed.Resources && typeof parsed.Resources === "object") {
                for (const [logicalId, value] of Object.entries(parsed.Resources)) {
                        const resource = value as any;
                        if (!resource?.Type || typeof resource.Type !== "string") continue;

                        // Find the line number of this logical ID in the AST
                        const line = findResourceLine(doc, logicalId, text);

                        // Collect the property keys actually present
                        const properties: string[] = resource.Properties
                                ? Object.keys(resource.Properties)
                                : [];

                        resources[logicalId] = {
                                type: resource.Type,
                                line,
                                properties,
                        };
                }
        }

        const parameters: string[] = [];
        if (parsed.Parameters && typeof parsed.Parameters === "object") {
                for (const paramName of Object.keys(parsed.Parameters)) {
                        parameters.push(paramName);
                }
        }

        const outputs: string[] = [];
        if (parsed.Outputs && typeof parsed.Outputs === "object") {
                for (const outputName of Object.keys(parsed.Outputs)) {
                        outputs.push(outputName);
                }
        }

        return { resources, parameters, outputs };
}

// Walk the YAML AST to find what line a resource logical ID is on
function findResourceLine(doc: any, logicalId: string, text: string): number {
        try {
                const resourcesNode = doc.contents?.items?.find(
                        (item: any) => item.key?.value === "Resources",
                );
                if (!resourcesNode) return 0;

                const resourceNode = resourcesNode.value?.items?.find(
                        (item: any) => item.key?.value === logicalId,
                );
                if (!resourceNode) return 0;

                // The yaml library gives us character offset, convert to line number
                const offset = resourceNode.key?.range?.[0];
                if (offset === undefined) return 0;

                return text.substring(0, offset).split("\n").length - 1;
        } catch {
                return 0;
        }
}
