import { useEffect, useMemo, useRef } from 'react';

interface Live2DCanvasProps {
  modelPath: string;
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  topPadding: number;
  inline?: boolean;
  action?: {
    name: string;
    nonce: number;
  } | null;
}

export default function Live2DCanvas({
  modelPath,
  scale,
  width,
  height,
  offsetX,
  topPadding,
  inline = false,
  action,
}: Live2DCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const safeScale = Number.isFinite(scale) ? Math.max(0.1, scale) : 1;
  const baseWidth = Math.max(1, Math.round(width / safeScale));
  const baseHeight = Math.max(1, Math.round(height / safeScale));

  const src = useMemo(() => {
    const params = new URLSearchParams({
      modelPath,
      scale: '1',
    });
    return `/live2d.html?${params.toString()}`;
  }, [modelPath]);

  useEffect(() => {
    if (!action || !iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      {
        type: 'LIVE2D_ACTION',
        payload: {
          action: action.name,
        },
      },
      '*'
    );
  }, [action]);

  return (
    <div
      className="live2d-stage"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ...(inline
          ? {
              position: 'relative',
              right: 'auto',
              top: 'auto',
            }
          : {
              right: `${offsetX}px`,
              top: `${topPadding}px`,
            }),
      }}
      title={modelPath ? `Live2D 模型: ${modelPath}` : '未配置 Live2D 模型'}
    >
      <div
        className="live2d-stage-inner"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${safeScale})`,
        }}
      >
        <iframe
          ref={iframeRef}
          className="live2d-frame"
          src={src}
          aria-label="Live2D avatar"
        />
      </div>
    </div>
  );
}
