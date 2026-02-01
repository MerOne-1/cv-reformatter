import {
  $applyNodeReplacement,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  TextNode,
} from 'lexical';

export interface AuthorHighlightPayload {
  authorId: string;
  authorName: string;
  authorColor: string;
  timestamp: number;
}

export interface SerializedAuthorHighlightNode extends SerializedTextNode {
  authorId: string;
  authorName: string;
  authorColor: string;
  timestamp: number;
}

export class AuthorHighlightNode extends TextNode {
  __authorId: string;
  __authorName: string;
  __authorColor: string;
  __timestamp: number;

  static getType(): string {
    return 'author-highlight';
  }

  static clone(node: AuthorHighlightNode): AuthorHighlightNode {
    return new AuthorHighlightNode(
      node.__text,
      {
        authorId: node.__authorId,
        authorName: node.__authorName,
        authorColor: node.__authorColor,
        timestamp: node.__timestamp,
      },
      node.__key
    );
  }

  constructor(
    text: string,
    payload: AuthorHighlightPayload,
    key?: NodeKey
  ) {
    super(text, key);
    this.__authorId = payload.authorId;
    this.__authorName = payload.authorName;
    this.__authorColor = payload.authorColor;
    this.__timestamp = payload.timestamp;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.backgroundColor = `${this.__authorColor}40`;
    dom.style.borderRadius = '2px';
    dom.style.padding = '0 2px';
    dom.setAttribute('data-author-id', this.__authorId);
    dom.setAttribute('data-author-name', this.__authorName);
    dom.setAttribute('data-timestamp', this.__timestamp.toString());
    dom.title = `Modifié par ${this.__authorName}`;
    return dom;
  }

  updateDOM(
    prevNode: AuthorHighlightNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const isUpdated = super.updateDOM(prevNode, dom, config);
    if (prevNode.__authorColor !== this.__authorColor) {
      dom.style.backgroundColor = `${this.__authorColor}40`;
    }
    if (prevNode.__authorName !== this.__authorName) {
      dom.title = `Modifié par ${this.__authorName}`;
      dom.setAttribute('data-author-name', this.__authorName);
    }
    if (prevNode.__authorId !== this.__authorId) {
      dom.setAttribute('data-author-id', this.__authorId);
    }
    return isUpdated;
  }

  static importJSON(serializedNode: SerializedAuthorHighlightNode): AuthorHighlightNode {
    const node = $createAuthorHighlightNode(serializedNode.text, {
      authorId: serializedNode.authorId,
      authorName: serializedNode.authorName,
      authorColor: serializedNode.authorColor,
      timestamp: serializedNode.timestamp,
    });
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedAuthorHighlightNode {
    return {
      ...super.exportJSON(),
      type: 'author-highlight',
      authorId: this.__authorId,
      authorName: this.__authorName,
      authorColor: this.__authorColor,
      timestamp: this.__timestamp,
    };
  }

  getAuthorId(): string {
    return this.__authorId;
  }

  getAuthorName(): string {
    return this.__authorName;
  }

  getAuthorColor(): string {
    return this.__authorColor;
  }

  getTimestamp(): number {
    return this.__timestamp;
  }

  setAuthorInfo(payload: Partial<AuthorHighlightPayload>): void {
    const writable = this.getWritable();
    if (payload.authorId !== undefined) writable.__authorId = payload.authorId;
    if (payload.authorName !== undefined) writable.__authorName = payload.authorName;
    if (payload.authorColor !== undefined) writable.__authorColor = payload.authorColor;
    if (payload.timestamp !== undefined) writable.__timestamp = payload.timestamp;
  }
}

export function $createAuthorHighlightNode(
  text: string,
  payload: AuthorHighlightPayload
): AuthorHighlightNode {
  return $applyNodeReplacement(new AuthorHighlightNode(text, payload));
}

export function $isAuthorHighlightNode(
  node: LexicalNode | null | undefined
): node is AuthorHighlightNode {
  return node instanceof AuthorHighlightNode;
}
