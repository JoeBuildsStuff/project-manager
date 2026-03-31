import type { Anthropic } from '@anthropic-ai/sdk'

/**
 * Template placeholder tool for the chat API.
 * Replace or extend this with project-specific tools.
 *
 * To add your own tools:
 * 1. Create a new file (e.g., my-tool.ts) in this directory
 * 2. Define the tool schema and execution function (see README.md)
 * 3. Import and add to availableTools and toolExecutors in index.ts
 */

export const templateTool: Anthropic.Tool = {
  name: 'template_example',
  description: 'A placeholder template tool. Add your own project-specific tools by following the pattern in README.md.',
  input_schema: {
    type: 'object' as const,
    properties: {
      message: {
        type: 'string',
        description: 'Example parameter for the template tool',
      },
    },
    required: [],
  },
}

export async function executeTemplateExample(
  parameters: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const message = typeof parameters.message === 'string' ? parameters.message : 'Template tool executed'
    return {
      success: true,
      data: {
        message: `Template tool placeholder. Replace with your own tools. Received: ${message}`,
      },
    }
  } catch (error) {
    console.error('Template tool execution error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
