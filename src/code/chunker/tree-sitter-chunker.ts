/**
 * TreeSitterChunker - AST-aware code chunking using tree-sitter
 * Primary chunking strategy for supported languages
 */

import Parser from 'tree-sitter';
// @ts-ignore - tree-sitter language modules don't have proper types
import TypeScript from 'tree-sitter-typescript';
// @ts-ignore
import JavaScript from 'tree-sitter-javascript';
// @ts-ignore
import Python from 'tree-sitter-python';
// @ts-ignore
import Go from 'tree-sitter-go';
// @ts-ignore
import Rust from 'tree-sitter-rust';
// @ts-ignore
import Java from 'tree-sitter-java';
// @ts-ignore
import Bash from 'tree-sitter-bash';

import { CodeChunk, ChunkerConfig } from '../types.js';
import { CodeChunker } from './base.js';
import { CharacterChunker } from './character-chunker.js';

interface LanguageConfig {
  parser: Parser;
  chunkableTypes: string[];
}

export class TreeSitterChunker implements CodeChunker {
  private languages: Map<string, LanguageConfig> = new Map();
  private fallbackChunker: CharacterChunker;

  constructor(private config: ChunkerConfig) {
    this.fallbackChunker = new CharacterChunker(config);
    this.initializeParsers();
  }

  private initializeParsers(): void {
    // TypeScript
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript as any);
    this.languages.set('typescript', {
      parser: tsParser,
      chunkableTypes: [
        'function_declaration',
        'method_definition',
        'class_declaration',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
      ],
    });

    // JavaScript
    const jsParser = new Parser();
    jsParser.setLanguage(JavaScript as any);
    this.languages.set('javascript', {
      parser: jsParser,
      chunkableTypes: [
        'function_declaration',
        'method_definition',
        'class_declaration',
        'export_statement',
      ],
    });

    // Python
    const pyParser = new Parser();
    pyParser.setLanguage(Python as any);
    this.languages.set('python', {
      parser: pyParser,
      chunkableTypes: ['function_definition', 'class_definition', 'decorated_definition'],
    });

    // Go
    const goParser = new Parser();
    goParser.setLanguage(Go as any);
    this.languages.set('go', {
      parser: goParser,
      chunkableTypes: [
        'function_declaration',
        'method_declaration',
        'type_declaration',
        'interface_declaration',
      ],
    });

    // Rust
    const rustParser = new Parser();
    rustParser.setLanguage(Rust as any);
    this.languages.set('rust', {
      parser: rustParser,
      chunkableTypes: [
        'function_item',
        'impl_item',
        'trait_item',
        'struct_item',
        'enum_item',
      ],
    });

    // Java
    const javaParser = new Parser();
    javaParser.setLanguage(Java as any);
    this.languages.set('java', {
      parser: javaParser,
      chunkableTypes: [
        'method_declaration',
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
      ],
    });

    // Bash
    const bashParser = new Parser();
    bashParser.setLanguage(Bash as any);
    this.languages.set('bash', {
      parser: bashParser,
      chunkableTypes: ['function_definition', 'command'],
    });
  }

  async chunk(
    code: string,
    filePath: string,
    language: string
  ): Promise<CodeChunk[]> {
    const langConfig = this.languages.get(language);

    if (!langConfig) {
      // Fallback to character-based chunking
      return this.fallbackChunker.chunk(code, filePath, language);
    }

    try {
      const tree = langConfig.parser.parse(code);
      const chunks: CodeChunk[] = [];

      // Find all chunkable nodes
      const nodes = this.findChunkableNodes(tree.rootNode, langConfig.chunkableTypes);

      for (const [index, node] of nodes.entries()) {
        const content = code.substring(node.startIndex, node.endIndex);

        // Skip chunks that are too small
        if (content.length < 50) {
          continue;
        }

        // If chunk is too large, fall back to character chunking for this node
        if (content.length > this.config.maxChunkSize * 2) {
          const subChunks = await this.fallbackChunker.chunk(content, filePath, language);
          // Adjust line numbers for sub-chunks
          for (const subChunk of subChunks) {
            chunks.push({
              ...subChunk,
              startLine: node.startPosition.row + 1 + subChunk.startLine - 1,
              endLine: node.startPosition.row + 1 + subChunk.endLine - 1,
              metadata: {
                ...subChunk.metadata,
                chunkIndex: chunks.length,
              },
            });
          }
          continue;
        }

        chunks.push({
          content: content.trim(),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          metadata: {
            filePath,
            language,
            chunkIndex: index,
            chunkType: this.getChunkType(node.type),
            name: this.extractName(node, code),
          },
        });
      }

      // If no chunks found or file is small, use fallback
      if (chunks.length === 0 && code.length > 100) {
        return this.fallbackChunker.chunk(code, filePath, language);
      }

      return chunks;
    } catch (error) {
      // On parsing error, fallback to character-based chunking
      console.error(`Tree-sitter parsing failed for ${filePath}:`, error);
      return this.fallbackChunker.chunk(code, filePath, language);
    }
  }

  supportsLanguage(language: string): boolean {
    return this.languages.has(language);
  }

  getStrategyName(): string {
    return 'tree-sitter';
  }

  /**
   * Find all chunkable nodes in the AST
   */
  private findChunkableNodes(
    node: Parser.SyntaxNode,
    chunkableTypes: string[]
  ): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (chunkableTypes.includes(n.type)) {
        nodes.push(n);
        // Don't traverse children of chunkable nodes to avoid nested chunks
        return;
      }

      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return nodes;
  }

  /**
   * Extract function/class name from AST node
   */
  private extractName(node: Parser.SyntaxNode, code: string): string | undefined {
    // Try to find name node
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return code.substring(nameNode.startIndex, nameNode.endIndex);
    }

    // For some node types, name might be in a different location
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return code.substring(child.startIndex, child.endIndex);
      }
    }

    return undefined;
  }

  /**
   * Map AST node type to chunk type
   */
  private getChunkType(
    nodeType: string
  ): 'function' | 'class' | 'interface' | 'block' {
    if (
      nodeType.includes('function') ||
      nodeType.includes('method')
    ) {
      return 'function';
    }
    if (nodeType.includes('class') || nodeType.includes('struct')) {
      return 'class';
    }
    if (nodeType.includes('interface') || nodeType.includes('trait')) {
      return 'interface';
    }
    return 'block';
  }
}
