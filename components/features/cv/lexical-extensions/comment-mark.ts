import {
  $applyNodeReplacement,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  TextNode,
} from 'lexical';

export interface CommentMarkPayload {
  commentId: string;
  resolved: boolean;
}

export interface SerializedCommentMarkNode extends SerializedTextNode {
  commentId: string;
  resolved: boolean;
}

export class CommentMarkNode extends TextNode {
  __commentId: string;
  __resolved: boolean;

  static getType(): string {
    return 'comment-mark';
  }

  static clone(node: CommentMarkNode): CommentMarkNode {
    return new CommentMarkNode(
      node.__text,
      {
        commentId: node.__commentId,
        resolved: node.__resolved,
      },
      node.__key
    );
  }

  constructor(
    text: string,
    payload: CommentMarkPayload,
    key?: NodeKey
  ) {
    super(text, key);
    this.__commentId = payload.commentId;
    this.__resolved = payload.resolved;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);

    if (this.__resolved) {
      dom.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
      dom.style.textDecoration = 'none';
    } else {
      dom.style.backgroundColor = 'rgba(251, 191, 36, 0.25)';
      dom.style.borderBottom = '2px solid rgba(251, 191, 36, 0.8)';
    }

    dom.style.borderRadius = '2px';
    dom.style.cursor = 'pointer';
    dom.setAttribute('data-comment-id', this.__commentId);
    dom.setAttribute('data-resolved', this.__resolved.toString());
    dom.classList.add('comment-mark');

    return dom;
  }

  updateDOM(
    prevNode: CommentMarkNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const isUpdated = super.updateDOM(prevNode, dom, config);

    if (prevNode.__resolved !== this.__resolved) {
      if (this.__resolved) {
        dom.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
        dom.style.borderBottom = 'none';
      } else {
        dom.style.backgroundColor = 'rgba(251, 191, 36, 0.25)';
        dom.style.borderBottom = '2px solid rgba(251, 191, 36, 0.8)';
      }
      dom.setAttribute('data-resolved', this.__resolved.toString());
    }

    if (prevNode.__commentId !== this.__commentId) {
      dom.setAttribute('data-comment-id', this.__commentId);
    }

    return isUpdated;
  }

  static importJSON(serializedNode: SerializedCommentMarkNode): CommentMarkNode {
    const node = $createCommentMarkNode(serializedNode.text, {
      commentId: serializedNode.commentId,
      resolved: serializedNode.resolved,
    });
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedCommentMarkNode {
    return {
      ...super.exportJSON(),
      type: 'comment-mark',
      commentId: this.__commentId,
      resolved: this.__resolved,
    };
  }

  getCommentId(): string {
    return this.__commentId;
  }

  isResolved(): boolean {
    return this.__resolved;
  }

  setResolved(resolved: boolean): void {
    const writable = this.getWritable();
    writable.__resolved = resolved;
  }

  setCommentId(commentId: string): void {
    const writable = this.getWritable();
    writable.__commentId = commentId;
  }
}

export function $createCommentMarkNode(
  text: string,
  payload: CommentMarkPayload
): CommentMarkNode {
  return $applyNodeReplacement(new CommentMarkNode(text, payload));
}

export function $isCommentMarkNode(
  node: LexicalNode | null | undefined
): node is CommentMarkNode {
  return node instanceof CommentMarkNode;
}
