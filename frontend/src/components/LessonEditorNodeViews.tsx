import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { authenticatedFetch } from '@/auth/authApi';
import { clampLessonImageWidth } from '@/utils/lessonImage';
import 'katex/dist/katex.min.css';

export function InlineMathView({ node, editor, getPos }: NodeViewProps) {
  const latex = typeof node.attrs.latex === 'string' ? node.attrs.latex : '';
  const display = node.attrs.display === true;
  const html = useMemo(
    () => katex.renderToString(latex, { displayMode: display, throwOnError: false }),
    [display, latex],
  );
  return (
    <NodeViewWrapper
      as="span"
      className={`lesson-math-node lesson-math-inline ${display ? 'is-display' : ''} ${editor.isEditable ? 'is-editable' : ''}`}
      onClick={() => {
        const position = getPos();
        if (typeof position === 'number') editor.commands.setNodeSelection(position);
      }}
      aria-label={`Công thức: ${latex}`}
    >
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
}

export function BlockMathView({ node, editor, getPos }: NodeViewProps) {
  const latex = typeof node.attrs.latex === 'string' ? node.attrs.latex : '';
  const html = useMemo(() => katex.renderToString(latex, { displayMode: true, throwOnError: false }), [latex]);
  return (
    <NodeViewWrapper
      as="div"
      className={`lesson-math-node lesson-math-block ${editor.isEditable ? 'is-editable' : ''}`}
      onClick={() => {
        const position = getPos();
        if (typeof position === 'number') editor.commands.setNodeSelection(position);
      }}
      aria-label={`Công thức: ${latex}`}
    >
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
}

export function LessonImageView({ node, editor, selected, updateAttributes }: NodeViewProps) {
  const source = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  const isAuthenticatedSource = source.startsWith('/api/');
  const [imageSource, setImageSource] = useState(isAuthenticatedSource ? '' : source);
  const [imageError, setImageError] = useState('');
  const [imageLoading, setImageLoading] = useState(isAuthenticatedSource);
  const [resizing, setResizing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(
    typeof node.attrs.caption === 'string' ? node.attrs.caption : '',
  );
  const resizeStart = useRef<{
    pointerId: number;
    x: number;
    width: number;
    maxWidth: number;
  } | null>(null);
  const width = typeof node.attrs.width === 'number' ? node.attrs.width : null;
  const alignment = node.attrs.align === 'left' || node.attrs.align === 'right' ? node.attrs.align : 'center';
  const caption = typeof node.attrs.caption === 'string' ? node.attrs.caption : '';

  useEffect(() => {
    setCaptionDraft(caption);
  }, [caption]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImageError('');
    if (!source.startsWith('/api/')) {
      setImageSource(source);
      setImageLoading(false);
      return () => { active = false; };
    }

    setImageSource('');
    setImageLoading(true);
    authenticatedFetch(source, { method: 'GET' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể tải ảnh bài giảng.');
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageSource(objectUrl);
      })
      .catch((error: unknown) => {
        console.error('Không thể tải ảnh trong nội dung bài giảng.', error);
        if (active) setImageError('Không tải được ảnh. Vui lòng thử tải lại trang.');
      })
      .finally(() => {
        if (active) setImageLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const figure = event.currentTarget.closest('figure');
    const contentWidth = figure?.parentElement?.clientWidth ?? 640;
    const maxWidth = Math.max(1, Math.min(1200, contentWidth));
    const initialWidth = Math.min(maxWidth, figure?.clientWidth ?? width ?? 640);
    resizeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      width: initialWidth,
      maxWidth,
    };
    setResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeStart.current || resizeStart.current.pointerId !== event.pointerId) return;
    const nextWidth = clampLessonImageWidth(
      resizeStart.current.width,
      event.clientX - resizeStart.current.x,
      resizeStart.current.maxWidth,
    );
    updateAttributes({ width: nextWidth });
  };
  const stopResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (resizeStart.current?.pointerId !== event.pointerId) return;
    resizeStart.current = null;
    setResizing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`lesson-image-node align-${alignment} ${selected ? 'is-selected' : ''} ${resizing ? 'is-resizing' : ''}`}
      style={{ width: width ? `${width}px` : 'fit-content' }}
    >
      {imageError ? (
        <p role="alert" className="lesson-image-error">{imageError}</p>
      ) : imageLoading ? (
        <p role="status" className="lesson-image-loading">Đang tải ảnh bài giảng...</p>
      ) : (
        <img
          src={imageSource}
          alt={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''}
          draggable={false}
          style={{ width: width ? '100%' : 'auto' }}
        />
      )}
      {caption && !editor.isEditable && <figcaption>{caption}</figcaption>}
      {editor.isEditable && (
        <>
          <input
            className="lesson-image-caption"
            value={captionDraft}
            onChange={(event) => setCaptionDraft(event.target.value)}
            onBlur={() => {
              if (captionDraft !== caption) updateAttributes({ caption: captionDraft });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            placeholder="Thêm chú thích ảnh..."
            aria-label="Chú thích ảnh"
          />
          {selected && (
            <button
              type="button"
              className="lesson-image-resize-handle"
              aria-label="Kéo để thay đổi kích thước ảnh"
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={stopResize}
              onPointerCancel={stopResize}
            />
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}
